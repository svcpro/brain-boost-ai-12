import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
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

async function computeRankHeatmap(admin: any, userId: string, params: any) {
  const examType = params.exam_type || "general";

  // Get user's exam results
  const { data: results } = await admin.from("exam_results").select("score, total_questions, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
  
  // Get all users' avg scores for internal ranking
  const { data: allScores } = await admin.from("exam_results").select("user_id, score, total_questions").order("created_at", { ascending: false }).limit(500);

  const userAvg = results?.length ? results.reduce((s: number, r: any) => s + (r.score / r.total_questions) * 100, 0) / results.length : 50;

  // Internal percentile
  const uniqueUsers = new Map<string, number>();
  allScores?.forEach((s: any) => {
    if (!uniqueUsers.has(s.user_id)) {
      uniqueUsers.set(s.user_id, (s.score / s.total_questions) * 100);
    }
  });
  const allAvgs = Array.from(uniqueUsers.values());
  const belowCount = allAvgs.filter(a => a < userAvg).length;
  const internalPercentile = allAvgs.length > 1 ? (belowCount / allAvgs.length) * 100 : 50;

  // Simulated national benchmark (AI-estimated based on exam difficulty)
  const nationalBenchmarks: Record<string, number> = { JEE: 45, NEET: 50, UPSC: 35, general: 50 };
  const baseBenchmark = nationalBenchmarks[examType] || 50;
  const simulatedNational = Math.min(99, baseBenchmark + (userAvg - 50) * 0.8);

  // Blended percentile (60% internal, 40% simulated)
  const blended = internalPercentile * 0.6 + simulatedNational * 0.4;

  // Get subject breakdown from topics
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
    user_id: userId,
    exam_type: examType,
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

  if (!topics?.length) {
    return new Response(JSON.stringify({ predictions: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Use AI to predict failure zones
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
        try {
          aiPredictions = JSON.parse(toolCall.function.arguments).predictions || [];
        } catch { /* fallback below */ }
      }
    }
  }

  // Fallback: use heuristic
  if (!aiPredictions.length) {
    aiPredictions = topics.slice(0, 3).map((t: any) => ({
      topic_name: t.name,
      failure_probability: Math.max(10, 95 - (t.memory_strength ?? 0) * 100),
      risk_factors: [(t.memory_strength ?? 0) < 0.3 ? "Very low retention" : "Below average retention", !t.last_studied_at ? "Never studied" : "Needs review"],
      reasoning: `Memory strength at ${Math.round((t.memory_strength ?? 0) * 100)}% with decay risk`,
      reinforcement_days: 3,
    }));
  }

  // Store predictions
  const inserts = aiPredictions.slice(0, 3).map((p: any) => {
    const matchedTopic = topics.find((t: any) => t.name.toLowerCase() === p.topic_name?.toLowerCase());
    const reinforcementDate = new Date();
    reinforcementDate.setDate(reinforcementDate.getDate() + (p.reinforcement_days || 3));
    return {
      user_id: userId,
      topic_id: matchedTopic?.id || null,
      topic_name: p.topic_name || matchedTopic?.name || "Unknown",
      failure_probability: Math.min(99, Math.max(1, p.failure_probability)),
      risk_factors: { factors: p.risk_factors || [] },
      ai_reasoning: p.reasoning || null,
      reinforcement_scheduled: true,
      reinforcement_date: reinforcementDate.toISOString().split("T")[0],
    };
  });

  if (inserts.length) {
    await admin.from("weakness_predictions").insert(inserts);
  }

  return new Response(JSON.stringify({ predictions: inserts }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function analyzeTrends(admin: any, params: any) {
  const examType = params.exam_type || "general";
  const { data: trends } = await admin.from("exam_trend_patterns").select("*").eq("exam_type", examType).order("predicted_probability", { ascending: false }).limit(20);

  return new Response(JSON.stringify({ trends: trends || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function generateAccelerator(admin: any, userClient: any, userId: string, params: any) {
  const examType = params.exam_type || "general";

  // Get weakness predictions
  const { data: weaknesses } = await admin.from("weakness_predictions").select("topic_name, failure_probability").eq("user_id", userId).order("computed_at", { ascending: false }).limit(5);

  // Get high-probability trends
  const { data: trends } = await admin.from("exam_trend_patterns").select("topic, predicted_probability").eq("exam_type", examType).order("predicted_probability", { ascending: false }).limit(5);

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  let strategy = "Focus on weak topics first, then high-probability exam topics. Alternate between intense practice and review sessions.";
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
          { role: "user", content: `Weak areas: ${weakStr}\nHigh-probability topics: ${trendStr}\nCreate a concise 30-day strategy with daily schedule pattern.` },
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
                  properties: {
                    mon: { type: "string" }, tue: { type: "string" }, wed: { type: "string" },
                    thu: { type: "string" }, fri: { type: "string" }, sat: { type: "string" }, sun: { type: "string" },
                  },
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
    user_id: userId,
    target_exam_type: examType,
    intensity_level: "high",
    daily_schedule: schedule,
    weak_topics: weaknesses?.map((w: any) => ({ name: w.topic_name, risk: w.failure_probability })) || [],
    high_probability_topics: trends?.map((t: any) => ({ name: t.topic, probability: t.predicted_probability })) || [],
    ai_strategy: strategy,
    status: "active",
  };

  const { data: inserted, error } = await admin.from("accelerator_enrollments").insert(enrollment).select().single();
  if (error) throw error;

  return new Response(JSON.stringify(inserted), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
