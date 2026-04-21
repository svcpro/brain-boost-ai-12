import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub;

    const { action, ...params } = await req.json();

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    switch (action) {
      case "compute_rank_heatmap":
        return await computeRankHeatmap(adminClient, userId, params);
      case "predict_weaknesses":
        return await predictWeaknesses(adminClient, supabase, userId, params);
      case "analyze_trends":
        return await analyzeTrends(adminClient, params);
      case "generate_accelerator":
        return await generateAccelerator(adminClient, supabase, userId, params);
      case "auto_pipeline":
        return await runAutoPipeline(adminClient, params);
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
    }
  } catch (e) {
    console.error("competitive-intelligence error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ══════════════════════════════════════════════════════════
// FULL AUTO PIPELINE — AI-driven, zero manual work
// ══════════════════════════════════════════════════════════
async function runAutoPipeline(admin: any, params: any) {
  const examTypes = params.exam_types || ["JEE", "NEET", "UPSC"];
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const results: Record<string, any> = { steps: [] };

  // ── STEP 1: AI Trend Generation ──
  try {
    const { data: existingTopics } = await admin.from("topics").select("name, subjects(name)").eq("deleted", false).limit(100);
    const topicList = existingTopics?.map((t: any) => `${t.name} (${t.subjects?.name || "General"})`).join(", ") || "Physics, Chemistry, Mathematics, Biology";

    for (const examType of examTypes) {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: `You are an exam trend analysis AI for Indian competitive exams. Analyze historical patterns and predict high-probability topics for ${examType} exams. Use real exam pattern knowledge. Probability must be between 55 and 85.` },
            { role: "user", content: `Based on known ${examType} exam patterns from 2018-2025, generate 8-12 high-probability topic predictions. Available topics in our system: ${topicList}. For each, estimate frequency of appearance and predicted probability for next exam.` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "generate_trends",
              description: "Generate exam trend pattern predictions",
              parameters: {
                type: "object",
                properties: {
                  trends: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        subject: { type: "string" },
                        topic: { type: "string" },
                        year: { type: "number" },
                        frequency_count: { type: "number" },
                        predicted_probability: { type: "number" },
                        reasoning: { type: "string" },
                      },
                      required: ["subject", "topic", "frequency_count", "predicted_probability"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["trends"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "generate_trends" } },
        }),
      });

      if (aiResp.ok) {
        const aiData = await aiResp.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall) {
          const parsed = JSON.parse(toolCall.function.arguments);
          const trends = (parsed.trends || []).map((t: any) => ({
            exam_type: examType,
            subject: t.subject,
            topic: t.topic,
            year: t.year || 2025,
            frequency_count: Math.max(1, t.frequency_count || 1),
            predicted_probability: Math.min(85, Math.max(55, t.predicted_probability)),
            source: "ai_auto",
          }));
          if (trends.length) {
            // Clear old AI-generated trends for this exam type
            await admin.from("exam_trend_patterns").delete().eq("exam_type", examType).eq("source", "ai_auto");
            await admin.from("exam_trend_patterns").insert(trends);
          }
          results.steps.push({ step: "trend_generation", exam_type: examType, status: "success", count: trends.length });
        }
      } else {
        const errText = await aiResp.text();
        console.error(`Trend AI failed for ${examType}:`, aiResp.status, errText);
        results.steps.push({ step: "trend_generation", exam_type: examType, status: "error", error: `AI returned ${aiResp.status}` });
      }
    }
  } catch (e) {
    results.steps.push({ step: "trend_generation", status: "error", error: String(e) });
  }

  // ── STEP 2: AI Opponent Auto-Calibration ──
  try {
    const { data: allResults } = await admin.from("exam_results").select("score, total_questions").order("created_at", { ascending: false }).limit(200);
    const avgScore = allResults?.length
      ? allResults.reduce((s: number, r: any) => s + (r.score / r.total_questions) * 100, 0) / allResults.length
      : 50;

    // AI decides optimal opponent difficulty based on cohort performance
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You are a competitive exam difficulty calibration AI." },
          { role: "user", content: `Average student score is ${avgScore.toFixed(1)}%. Total ${allResults?.length || 0} recent results. Recommend optimal opponent simulation settings to maintain engagement while pushing improvement.` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "calibrate_opponent",
            description: "Return optimal opponent simulation settings",
            parameters: {
              type: "object",
              properties: {
                pressure_level: { type: "string", enum: ["low", "medium", "high", "extreme"] },
                time_pressure_multiplier: { type: "number" },
                difficulty_escalation_rate: { type: "number" },
                reasoning: { type: "string" },
              },
              required: ["pressure_level", "time_pressure_multiplier", "difficulty_escalation_rate", "reasoning"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "calibrate_opponent" } },
      }),
    });

    if (aiResp.ok) {
      const aiData = await aiResp.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        const parsed = JSON.parse(toolCall.function.arguments);
        const { data: existing } = await admin.from("opponent_simulation_config").select("id").limit(1).maybeSingle();
        if (existing) {
          await admin.from("opponent_simulation_config").update({
            pressure_level: parsed.pressure_level,
            time_pressure_multiplier: Math.min(1.0, Math.max(0.5, parsed.time_pressure_multiplier)),
            difficulty_escalation_rate: Math.min(2.0, Math.max(1.0, parsed.difficulty_escalation_rate)),
            is_enabled: true,
          }).eq("id", existing.id);
        }
        results.steps.push({ step: "opponent_calibration", status: "success", config: parsed });
      }
    } else {
      results.steps.push({ step: "opponent_calibration", status: "error", error: `AI returned ${aiResp.status}` });
    }
  } catch (e) {
    results.steps.push({ step: "opponent_calibration", status: "error", error: String(e) });
  }

  // ── STEP 3: Auto-Enable All Engines ──
  try {
    const { data: config } = await admin.from("competitive_intel_config").select("id").limit(1).maybeSingle();
    if (config) {
      await admin.from("competitive_intel_config").update({
        trend_engine_enabled: true,
        weakness_engine_enabled: true,
        accelerator_enabled: true,
        opponent_sim_enabled: true,
        rank_heatmap_enabled: true,
      }).eq("id", config.id);
    }
    results.steps.push({ step: "engine_activation", status: "success", engines: 5 });
  } catch (e) {
    results.steps.push({ step: "engine_activation", status: "error", error: String(e) });
  }

  // ── STEP 4: AI Competitive Summary Generation ──
  try {
    const { data: trends } = await admin.from("exam_trend_patterns").select("exam_type, topic, predicted_probability").eq("source", "ai_auto").order("predicted_probability", { ascending: false }).limit(20);
    
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You are a competitive exam intelligence summarizer. Create a concise executive summary." },
          { role: "user", content: `Summarize these AI-generated trend predictions in 3-4 sentences for admin review:\n${JSON.stringify(trends)}` },
        ],
      }),
    });

    if (aiResp.ok) {
      const aiData = await aiResp.json();
      const summary = aiData.choices?.[0]?.message?.content || "Pipeline completed successfully.";
      results.summary = summary;
      results.steps.push({ step: "summary_generation", status: "success" });
    }
  } catch (e) {
    results.steps.push({ step: "summary_generation", status: "error", error: String(e) });
  }

  results.completed_at = new Date().toISOString();
  results.total_steps = results.steps.length;
  results.success_count = results.steps.filter((s: any) => s.status === "success").length;

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ══════════════════════════════════════════════════════════
// EXISTING FUNCTIONS (unchanged)
// ══════════════════════════════════════════════════════════

async function computeRankHeatmap(admin: any, userId: string, params: any) {
  const examType = params.exam_type || "general";
  const { data: results } = await admin.from("exam_results").select("score, total_questions, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
  const { data: allScores } = await admin.from("exam_results").select("user_id, score, total_questions").order("created_at", { ascending: false }).limit(500);

  const userAvg = results?.length ? results.reduce((s: number, r: any) => s + (r.score / r.total_questions) * 100, 0) / results.length : 50;
  const uniqueUsers = new Map<string, number>();
  allScores?.forEach((s: any) => { if (!uniqueUsers.has(s.user_id)) uniqueUsers.set(s.user_id, (s.score / s.total_questions) * 100); });
  const allAvgs = Array.from(uniqueUsers.values());
  const belowCount = allAvgs.filter(a => a < userAvg).length;
  const internalPercentile = allAvgs.length > 1 ? (belowCount / allAvgs.length) * 100 : 50;

  const nationalBenchmarks: Record<string, number> = {
    JEE: 45, NEET: 50, UPSC: 35, CAT: 40, GATE: 42, general: 50,
  };
  const baseBenchmark = nationalBenchmarks[examType] || 50;
  const simulatedNational = Math.min(99, baseBenchmark + (userAvg - 50) * 0.8);
  const blended = internalPercentile * 0.6 + simulatedNational * 0.4;

  const { data: topics } = await admin.from("topics").select("name, memory_strength, subjects(name)").eq("user_id", userId).eq("deleted", false);
  const subjectMap: Record<string, { total: number; count: number }> = {};
  topics?.forEach((t: any) => {
    const subj = t.subjects?.name || "General";
    if (!subjectMap[subj]) subjectMap[subj] = { total: 0, count: 0 };
    subjectMap[subj].total += (t.memory_strength ?? 0) * 100;
    subjectMap[subj].count += 1;
  });
  const subjectBreakdown: Record<string, number> = {};
  Object.entries(subjectMap).forEach(([k, v]) => { subjectBreakdown[k] = Math.round(v.total / v.count); });

  const snapshot = {
    user_id: userId, exam_type: examType,
    percentile: Math.round(internalPercentile * 100) / 100,
    internal_rank_score: Math.round(userAvg * 100) / 100,
    simulated_national_score: Math.round(simulatedNational * 100) / 100,
    blended_percentile: Math.round(blended * 100) / 100,
    total_internal_users: uniqueUsers.size,
    subject_breakdown: subjectBreakdown,
  };
  await admin.from("rank_heatmap_snapshots").insert(snapshot);
  return new Response(JSON.stringify(snapshot), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function predictWeaknesses(admin: any, userClient: any, userId: string, params: any) {
  const { data: topics } = await admin.from("topics").select("id, name, memory_strength, last_studied_at, subjects(name)").eq("user_id", userId).eq("deleted", false).order("memory_strength", { ascending: true }).limit(10);
  if (!topics?.length) return new Response(JSON.stringify({ predictions: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  let aiPredictions: any[] = [];

  if (LOVABLE_API_KEY) {
    const topicSummary = topics.map((t: any) => `${t.name} (${t.subjects?.name || 'General'}): strength=${Math.round((t.memory_strength ?? 0) * 100)}%, last_studied=${t.last_studied_at || 'never'}`).join("\n");
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You are an exam analytics engine. Given a student's weak topics, predict the top 3 most likely failure zones. Return JSON array." },
          { role: "user", content: `Predict top 3 failure zones with risk factors:\n${topicSummary}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "predict_failures",
            description: "Return top 3 failure zone predictions",
            parameters: {
              type: "object",
              properties: {
                predictions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      topic_name: { type: "string" },
                      failure_probability: { type: "number" },
                      risk_factors: { type: "array", items: { type: "string" } },
                      reasoning: { type: "string" },
                      reinforcement_days: { type: "number" },
                    },
                    required: ["topic_name", "failure_probability", "risk_factors", "reasoning"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["predictions"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "predict_failures" } },
      }),
    });

    if (aiResp.ok) {
      const aiData = await aiResp.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        try { aiPredictions = JSON.parse(toolCall.function.arguments).predictions || []; } catch {}
      }
    }
  }

  if (!aiPredictions.length) {
    aiPredictions = topics.slice(0, 3).map((t: any) => ({
      topic_name: t.name,
      failure_probability: Math.max(10, 95 - (t.memory_strength ?? 0) * 100),
      risk_factors: [(t.memory_strength ?? 0) < 0.3 ? "Very low retention" : "Below average retention"],
      reasoning: `Memory strength at ${Math.round((t.memory_strength ?? 0) * 100)}%`,
      reinforcement_days: 3,
    }));
  }

  const inserts = aiPredictions.slice(0, 3).map((p: any) => {
    const matchedTopic = topics.find((t: any) => t.name.toLowerCase() === p.topic_name?.toLowerCase());
    const reinforcementDate = new Date();
    reinforcementDate.setDate(reinforcementDate.getDate() + (p.reinforcement_days || 3));
    return {
      user_id: userId, topic_id: matchedTopic?.id || null, topic_name: p.topic_name || "Unknown",
      failure_probability: Math.min(99, Math.max(1, p.failure_probability)),
      risk_factors: { factors: p.risk_factors || [] },
      ai_reasoning: p.reasoning || null,
      reinforcement_scheduled: true,
      reinforcement_date: reinforcementDate.toISOString().split("T")[0],
    };
  });

  if (inserts.length) await admin.from("weakness_predictions").insert(inserts);
  return new Response(JSON.stringify({ predictions: inserts }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function analyzeTrends(admin: any, params: any) {
  const examType = params.exam_type || "general";
  const { data: trends } = await admin.from("exam_trend_patterns").select("*").eq("exam_type", examType).order("predicted_probability", { ascending: false }).limit(20);
  return new Response(JSON.stringify({ trends: trends || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function generateAccelerator(admin: any, userClient: any, userId: string, params: any) {
  const examType = params.exam_type || "general";
  const { data: weaknesses } = await admin.from("weakness_predictions").select("topic_name, failure_probability").eq("user_id", userId).order("computed_at", { ascending: false }).limit(5);
  const { data: trends } = await admin.from("exam_trend_patterns").select("topic, predicted_probability").eq("exam_type", examType).order("predicted_probability", { ascending: false }).limit(5);

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  let strategy = "Focus on weak topics first, then high-probability exam topics.";
  let schedule: Record<string, any> = {};

  if (LOVABLE_API_KEY) {
    const weakStr = weaknesses?.map((w: any) => `${w.topic_name}: ${w.failure_probability}% failure risk`).join(", ") || "No data";
    const trendStr = trends?.map((t: any) => `${t.topic}: ${t.predicted_probability}% probability`).join(", ") || "No data";

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You are an exam strategist. Create a 30-day accelerator plan." },
          { role: "user", content: `Weak areas: ${weakStr}\nHigh-probability topics: ${trendStr}\nCreate a concise 30-day strategy.` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "create_plan",
            description: "Return a 30-day accelerator plan",
            parameters: {
              type: "object",
              properties: {
                strategy: { type: "string" },
                weekly_pattern: {
                  type: "object",
                  properties: { mon: { type: "string" }, tue: { type: "string" }, wed: { type: "string" }, thu: { type: "string" }, fri: { type: "string" }, sat: { type: "string" }, sun: { type: "string" } },
                  required: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
                  additionalProperties: false,
                },
              },
              required: ["strategy", "weekly_pattern"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_plan" } },
      }),
    });

    if (aiResp.ok) {
      const aiData = await aiResp.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        try {
          const parsed = JSON.parse(toolCall.function.arguments);
          strategy = parsed.strategy || strategy;
          schedule = parsed.weekly_pattern || {};
        } catch {}
      }
    }
  }

  const enrollment = {
    user_id: userId, target_exam_type: examType, intensity_level: "high",
    daily_schedule: schedule,
    weak_topics: weaknesses?.map((w: any) => ({ name: w.topic_name, risk: w.failure_probability })) || [],
    high_probability_topics: trends?.map((t: any) => ({ name: t.topic, probability: t.predicted_probability })) || [],
    ai_strategy: strategy, status: "active",
  };

  const { data: inserted, error } = await admin.from("accelerator_enrollments").insert(enrollment).select().single();
  if (error) throw error;
  return new Response(JSON.stringify(inserted), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
