import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, params } = await req.json();

    // Auth optional for cron, required for user actions
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id || null;
    }

    const handlers: Record<string, () => Promise<any>> = {
      // Full autonomous pipeline
      run_full_pipeline: () => runFullPipeline(supabaseAdmin, params),
      // Individual modules
      compute_topic_scores: () => computeTopicScores(supabaseAdmin, params),
      generate_intel_questions: () => generateIntelQuestions(supabaseAdmin, params),
      compute_student_brief: () => computeStudentBrief(supabaseAdmin, userId!, params),
      detect_shifts_and_alert: () => detectShiftsAndAlert(supabaseAdmin, params),
      get_student_intel: () => getStudentIntel(supabaseAdmin, userId!, params),
      get_pipeline_status: () => getPipelineStatus(supabaseAdmin, params),
      get_intel_dashboard: () => getIntelDashboard(supabaseAdmin, params),
    };

    const handler = handlers[action];
    if (!handler) throw new Error(`Invalid action: ${action}`);
    const result = await handler();

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("exam-intel-v10 error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ════════════════════════════════════════════
// FULL AUTONOMOUS PIPELINE
// ════════════════════════════════════════════
async function runFullPipeline(sb: any, params: any) {
  const startTime = Date.now();
  const examTypes = params?.exam_types || ["NEET", "JEE Main", "UPSC CSE", "SSC CGL", "CAT"];

  const pipelineId = crypto.randomUUID();
  await sb.from("exam_intel_pipeline_runs").insert({
    id: pipelineId, exam_type: examTypes.join(","), pipeline_stage: "full_pipeline", status: "running",
  });

  let totalTopics = 0, totalPredictions = 0, totalAlerts = 0, totalBriefs = 0;

  try {
    // Stage 1+2: Run scoring + shift detection for ALL exam types in PARALLEL
    const stage1Results = await Promise.allSettled(
      examTypes.map(async (examType: string) => {
        const [scores, shifts] = await Promise.all([
          computeTopicScores(sb, { exam_type: examType }),
          detectShiftsAndAlert(sb, { exam_type: examType }),
        ]);
        return { examType, scores, shifts };
      })
    );

    // Collect results and prepare question generation
    const questionTasks: Promise<any>[] = [];
    for (const r of stage1Results) {
      if (r.status !== "fulfilled") continue;
      const { examType, scores, shifts } = r.value;
      totalTopics += scores.count || 0;
      totalAlerts += shifts.alerts_created || 0;

      // Stage 3: Queue question generation for top 3 topics (not 5) per exam
      const topTopics = scores.top_topics?.slice(0, 3) || [];
      for (const t of topTopics) {
        questionTasks.push(
          generateIntelQuestions(sb, {
            exam_type: examType, subject: t.subject, topic: t.topic, count: 2,
            probability_score: t.composite_score,
          }).catch(() => ({ count: 0 }))
        );
      }
    }

    // Run ALL question generations in parallel (batched to avoid rate limits)
    const BATCH_SIZE = 5;
    for (let i = 0; i < questionTasks.length; i += BATCH_SIZE) {
      const batch = questionTasks.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch);
      for (const r of results) {
        if (r.status === "fulfilled") totalPredictions += r.value?.count || 0;
      }
    }

    // Stage 4: Student briefs - batch in parallel, limit to 20 max
    const { data: activeUsers } = await sb
      .from("profiles")
      .select("id, exam_type")
      .not("exam_type", "is", null)
      .limit(20);

    if (activeUsers?.length) {
      const briefResults = await Promise.allSettled(
        activeUsers.map((u: any) =>
          computeStudentBrief(sb, u.id, { exam_type: u.exam_type }).catch(() => null)
        )
      );
      totalBriefs = briefResults.filter(r => r.status === "fulfilled" && r.value).length;
    }

    const duration = Date.now() - startTime;
    await sb.from("exam_intel_pipeline_runs").update({
      status: "completed", topics_analyzed: totalTopics, predictions_generated: totalPredictions,
      alerts_created: totalAlerts, student_briefs_updated: totalBriefs,
      duration_ms: duration, completed_at: new Date().toISOString(),
    }).eq("id", pipelineId);

    return { status: "completed", topics_analyzed: totalTopics, predictions_generated: totalPredictions,
      alerts_created: totalAlerts, student_briefs_updated: totalBriefs, duration_ms: duration };
  } catch (e: any) {
    await sb.from("exam_intel_pipeline_runs").update({
      status: "failed", error_message: e.message, completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
    }).eq("id", pipelineId);
    throw e;
  }
}

// ════════════════════════════════════════════
// MODULE 1: AI Topic Probability Scoring
// ════════════════════════════════════════════
async function computeTopicScores(sb: any, params: any) {
  const { exam_type } = params;
  if (!exam_type) throw new Error("exam_type required");

  // Gather PYQ patterns + CA data + existing evolution data
  const [patternsRes, caLinksRes, existingScoresRes] = await Promise.all([
    sb.from("exam_evolution_patterns").select("*").eq("exam_type", exam_type).order("year", { ascending: false }).limit(200),
    sb.from("ca_syllabus_links").select("*").eq("exam_type", exam_type).order("created_at", { ascending: false }).limit(100),
    sb.from("exam_intel_topic_scores").select("topic, probability_score").eq("exam_type", exam_type),
  ]);

  const patterns = patternsRes.data || [];
  const caLinks = caLinksRes.data || [];
  const oldScores: Record<string, number> = {};
  for (const s of (existingScoresRes.data || [])) oldScores[s.topic] = s.probability_score;

  // Build topic frequency map from PYQ patterns
  const topicMap: Record<string, { subject: string; years: number[]; freqSum: number; diffSum: number; count: number }> = {};
  for (const p of patterns) {
    const key = p.topic || p.subject;
    if (!topicMap[key]) topicMap[key] = { subject: p.subject, years: [], freqSum: 0, diffSum: 0, count: 0 };
    topicMap[key].years.push(p.year);
    topicMap[key].freqSum += Number(p.frequency_score || 0);
    topicMap[key].diffSum += Number(p.difficulty_index || 0);
    topicMap[key].count++;
  }

  // Build CA boost map
  const caBoost: Record<string, number> = {};
  for (const cl of caLinks) {
    const key = cl.micro_topic || cl.subject;
    caBoost[key] = Math.max(caBoost[key] || 0, Number(cl.relevance_score || 0) * 0.3);
  }

  // Use AI for comprehensive analysis
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  let aiTopics: any[] = [];

  if (LOVABLE_API_KEY) {
    try {
      const topicList = Object.entries(topicMap).map(([topic, d]) => ({
        topic, subject: d.subject, frequency: d.freqSum / d.count, appearances: d.count,
        ca_boost: caBoost[topic] || 0,
      })).slice(0, 40);

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: "You are an exam intelligence engine that predicts topic probability for upcoming exams." },
            { role: "user", content: `For ${exam_type} exam, analyze these topics from PYQ data and predict probability (0-1) for next exam. Consider: frequency trends, difficulty shifts, current affairs relevance, and cyclical patterns.\n\nTopics: ${JSON.stringify(topicList)}` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "return_predictions",
              description: "Return topic probability predictions",
              parameters: {
                type: "object",
                properties: {
                  predictions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        topic: { type: "string" },
                        subject: { type: "string" },
                        probability_score: { type: "number" },
                        trend_direction: { type: "string", enum: ["rising", "stable", "declining"] },
                        ai_confidence: { type: "number" },
                        reasoning: { type: "string" },
                      },
                      required: ["topic", "subject", "probability_score", "trend_direction", "ai_confidence"],
                    },
                  },
                },
                required: ["predictions"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "return_predictions" } },
        }),
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const tc = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (tc) aiTopics = JSON.parse(tc.function.arguments).predictions || [];
      }
    } catch (e) { console.error("AI scoring failed, using heuristic:", e); }
  }

  // Merge AI predictions with heuristic data
  const finalScores: any[] = [];
  const processedTopics = new Set<string>();

  for (const ai of aiTopics) {
    processedTopics.add(ai.topic);
    const mapData = topicMap[ai.topic];
    const years = mapData?.years || [];
    const lastYear = years.length > 0 ? Math.max(...years) : null;
    const consecutive = years.length;

    finalScores.push({
      exam_type,
      subject: ai.subject || mapData?.subject || "General",
      topic: ai.topic,
      probability_score: Math.min(1, Math.max(0, ai.probability_score)),
      trend_direction: ai.trend_direction,
      historical_frequency: mapData ? mapData.freqSum / mapData.count : 0,
      ai_confidence: Math.min(1, Math.max(0, ai.ai_confidence)),
      last_appeared_year: lastYear,
      consecutive_appearances: consecutive,
      ca_boost_score: caBoost[ai.topic] || 0,
      predicted_marks_weight: ai.probability_score * 0.8,
      computed_at: new Date().toISOString(),
    });
  }

  // Add remaining topics from heuristic
  for (const [topic, d] of Object.entries(topicMap)) {
    if (processedTopics.has(topic)) continue;
    const freq = d.freqSum / d.count;
    finalScores.push({
      exam_type,
      subject: d.subject,
      topic,
      probability_score: Math.min(1, freq * 0.8 + (caBoost[topic] || 0)),
      trend_direction: "stable",
      historical_frequency: freq,
      ai_confidence: 0.5,
      last_appeared_year: d.years.length > 0 ? Math.max(...d.years) : null,
      consecutive_appearances: d.count,
      ca_boost_score: caBoost[topic] || 0,
      predicted_marks_weight: freq * 0.5,
      computed_at: new Date().toISOString(),
    });
  }

  // Upsert scores
  if (finalScores.length > 0) {
    // Delete old scores for this exam type and re-insert
    await sb.from("exam_intel_topic_scores").delete().eq("exam_type", exam_type);
    await sb.from("exam_intel_topic_scores").insert(finalScores);
  }

  // Sort by composite and return top topics
  finalScores.sort((a: any, b: any) => {
    const compA = a.probability_score * 0.4 + a.historical_frequency * 0.25 + (a.ca_boost_score || 0) * 0.15 + a.ai_confidence * 0.2;
    const compB = b.probability_score * 0.4 + b.historical_frequency * 0.25 + (b.ca_boost_score || 0) * 0.15 + b.ai_confidence * 0.2;
    return compB - compA;
  });

  return { count: finalScores.length, exam_type, top_topics: finalScores.slice(0, 15) };
}

// ════════════════════════════════════════════
// MODULE 2: AI Intel Question Generation
// ════════════════════════════════════════════
async function generateIntelQuestions(sb: any, params: any) {
  const { exam_type, subject, topic, count = 5, probability_score = 0.5 } = params;
  if (!exam_type || !subject || !topic) throw new Error("exam_type, subject, topic required");

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: `You generate high-probability exam questions for ${exam_type}. These are predicted to appear in the next exam based on pattern analysis. Quality must match real exam standards.` },
        { role: "user", content: `Generate ${count} questions for "${topic}" (${subject}) with probability score ${probability_score}. Include varied difficulty and cognitive types. Each needs 4 options, correct answer index (0-3), and detailed explanation.` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_questions",
          description: "Return generated questions",
          parameters: {
            type: "object",
            properties: {
              questions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    question_text: { type: "string" },
                    options: { type: "array", items: { type: "string" } },
                    correct_answer: { type: "number" },
                    explanation: { type: "string" },
                    difficulty_level: { type: "string", enum: ["easy", "medium", "hard"] },
                    cognitive_type: { type: "string", enum: ["factual", "conceptual", "application", "analytical"] },
                  },
                  required: ["question_text", "options", "correct_answer", "explanation", "difficulty_level"],
                },
              },
            },
            required: ["questions"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_questions" } },
    }),
  });

  if (!aiRes.ok) throw new Error("AI question generation failed");
  const aiData = await aiRes.json();

  let questions: any[] = [];
  try {
    const tc = aiData.choices?.[0]?.message?.tool_calls?.[0];
    questions = JSON.parse(tc.function.arguments).questions;
  } catch { throw new Error("Failed to parse generated questions"); }

  const rows = questions.map(q => ({
    exam_type, subject, topic,
    question_text: q.question_text,
    options: q.options,
    correct_answer: q.correct_answer,
    explanation: q.explanation,
    difficulty_level: q.difficulty_level,
    cognitive_type: q.cognitive_type || "application",
    probability_score,
    source: "ai_intel_v10",
  }));

  await sb.from("exam_intel_practice_questions").insert(rows);
  return { questions: rows, count: rows.length };
}

// ════════════════════════════════════════════
// MODULE 3: Per-Student Intel Brief
// ════════════════════════════════════════════
async function computeStudentBrief(sb: any, userId: string, params: any) {
  if (!userId) throw new Error("userId required");
  const { exam_type } = params;
  if (!exam_type) throw new Error("exam_type required");

  // Get student's topics and performance
  const [topicsRes, intelScoresRes] = await Promise.all([
    sb.from("topics").select("id, name, memory_strength, subjects(name)")
      .eq("user_id", userId).is("deleted_at", null),
    sb.from("exam_intel_topic_scores").select("*")
      .eq("exam_type", exam_type).order("composite_score", { ascending: false }).limit(50),
  ]);

  const userTopics = topicsRes.data || [];
  const intelScores = intelScoresRes.data || [];

  // Map user topic strengths
  const userStrengths: Record<string, number> = {};
  for (const t of userTopics) userStrengths[t.name?.toLowerCase()] = t.memory_strength || 0;

  // Find weakness overlaps (high probability + low student strength)
  const weaknessOverlap = intelScores
    .filter((s: any) => {
      const strength = userStrengths[s.topic?.toLowerCase()] ?? null;
      return strength !== null && strength < 0.4 && s.probability_score > 0.6;
    })
    .slice(0, 5)
    .map((s: any) => ({
      topic: s.topic, subject: s.subject,
      probability: s.probability_score,
      your_strength: userStrengths[s.topic?.toLowerCase()] || 0,
      gap: s.probability_score - (userStrengths[s.topic?.toLowerCase()] || 0),
    }));

  // Hot topics (top probability regardless of strength)
  const hotTopics = intelScores.slice(0, 8).map((s: any) => ({
    topic: s.topic, subject: s.subject, probability: s.probability_score,
    trend: s.trend_direction, confidence: s.ai_confidence,
  }));

  // Risk topics (high probability, not studied at all)
  const riskTopics = intelScores
    .filter((s: any) => !(s.topic?.toLowerCase() in userStrengths) && s.probability_score > 0.5)
    .slice(0, 5)
    .map((s: any) => ({
      topic: s.topic, subject: s.subject, probability: s.probability_score,
    }));

  // Opportunity topics (student is strong + high probability = guaranteed marks)
  const opportunityTopics = intelScores
    .filter((s: any) => {
      const strength = userStrengths[s.topic?.toLowerCase()] ?? 0;
      return strength > 0.7 && s.probability_score > 0.6;
    })
    .slice(0, 5)
    .map((s: any) => ({
      topic: s.topic, subject: s.subject, probability: s.probability_score,
      your_strength: userStrengths[s.topic?.toLowerCase()] || 0,
    }));

  // Readiness score
  const coveredHighProb = intelScores.slice(0, 20).filter((s: any) => {
    const strength = userStrengths[s.topic?.toLowerCase()] ?? 0;
    return strength > 0.5;
  }).length;
  const readiness = Math.round((coveredHighProb / Math.max(1, Math.min(20, intelScores.length))) * 100);

  const actions = [];
  if (weaknessOverlap.length > 0) actions.push({ type: "emergency_focus", topic: weaknessOverlap[0].topic, reason: "High probability + Low strength" });
  if (riskTopics.length > 0) actions.push({ type: "start_studying", topic: riskTopics[0].topic, reason: "High probability + Not studied" });
  if (opportunityTopics.length > 0) actions.push({ type: "maintain", topic: opportunityTopics[0].topic, reason: "Guaranteed marks potential" });

  const brief = {
    user_id: userId, exam_type,
    predicted_hot_topics: hotTopics,
    weakness_overlap: weaknessOverlap,
    risk_topics: riskTopics,
    opportunity_topics: opportunityTopics,
    overall_readiness_score: readiness,
    recommended_actions: actions,
    ai_strategy_summary: `Your readiness for ${exam_type} is ${readiness}%. ${weaknessOverlap.length} critical gaps found in high-probability topics. ${opportunityTopics.length} guaranteed-marks topics ready.`,
    computed_at: new Date().toISOString(),
  };

  // Upsert
  const { data: existing } = await sb.from("exam_intel_student_briefs")
    .select("id").eq("user_id", userId).eq("exam_type", exam_type).maybeSingle();

  if (existing) {
    await sb.from("exam_intel_student_briefs").update(brief).eq("id", existing.id);
  } else {
    await sb.from("exam_intel_student_briefs").insert(brief);
  }

  // Generate alerts for critical gaps
  let alertsCreated = 0;
  for (const w of weaknessOverlap) {
    await sb.from("exam_intel_alerts").insert({
      user_id: userId, alert_type: "critical_gap", topic: w.topic, subject: w.subject,
      exam_type, old_score: w.your_strength, new_score: w.probability,
      severity: w.gap > 0.5 ? "critical" : "high",
      message: `🔴 "${w.topic}" has ${Math.round(w.probability * 100)}% exam probability but your strength is only ${Math.round(w.your_strength * 100)}%`,
    });
    alertsCreated++;
  }

  return { brief, alerts_created: alertsCreated };
}

// ════════════════════════════════════════════
// MODULE 4: Curriculum Shift Detection + Alerts
// ════════════════════════════════════════════
async function detectShiftsAndAlert(sb: any, params: any) {
  const { exam_type } = params;
  if (!exam_type) throw new Error("exam_type required");

  // Get current and previous scores to detect probability spikes
  const { data: currentScores } = await sb.from("exam_intel_topic_scores")
    .select("*").eq("exam_type", exam_type);

  // Check curriculum shift events
  const { data: recentShifts } = await sb.from("curriculum_shift_events")
    .select("*").eq("exam_type", exam_type)
    .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString());

  let alertsCreated = 0;

  // Alert all users with this exam type about major shifts
  if ((recentShifts || []).length > 0) {
    const { data: users } = await sb.from("profiles")
      .select("id").eq("exam_type", exam_type).limit(50);

    const highConfShifts = (recentShifts || []).filter((s: any) => s.confidence > 0.7);
    if (highConfShifts.length > 0 && users?.length) {
      const alertRows = highConfShifts.flatMap((shift: any) =>
        (users || []).slice(0, 20).map((u: any) => ({
          user_id: u.id, alert_type: "syllabus_shift",
          topic: shift.affected_topic || "General", subject: shift.affected_subject,
          exam_type, old_score: shift.old_weight, new_score: shift.new_weight,
          severity: shift.confidence > 0.85 ? "critical" : "medium",
          message: `📊 Syllabus shift detected: "${shift.affected_topic}" weight changed from ${Math.round((shift.old_weight || 0) * 100)}% → ${Math.round((shift.new_weight || 0) * 100)}%`,
        }))
      );
      if (alertRows.length > 0) {
        await sb.from("exam_intel_alerts").insert(alertRows);
        alertsCreated = alertRows.length;
      }
    }
  }

  return { exam_type, shifts_detected: (recentShifts || []).length, alerts_created: alertsCreated };
}

// ════════════════════════════════════════════
// MODULE 5: Student Intel Retrieval
// ════════════════════════════════════════════
async function getStudentIntel(sb: any, userId: string, params: any) {
  if (!userId) throw new Error("userId required");
  const { exam_type } = params;

  const [briefRes, alertsRes, topScoresRes, practiceQsRes] = await Promise.all([
    sb.from("exam_intel_student_briefs").select("*")
      .eq("user_id", userId).eq("exam_type", exam_type).maybeSingle(),
    sb.from("exam_intel_alerts").select("*")
      .eq("user_id", userId).eq("is_read", false)
      .order("created_at", { ascending: false }).limit(10),
    sb.from("exam_intel_topic_scores").select("*")
      .eq("exam_type", exam_type).order("composite_score", { ascending: false }).limit(20),
    sb.from("exam_intel_practice_questions").select("*")
      .eq("exam_type", exam_type).eq("is_active", true)
      .order("probability_score", { ascending: false }).limit(10),
  ]);

  return {
    brief: briefRes.data,
    unread_alerts: alertsRes.data || [],
    top_predictions: topScoresRes.data || [],
    practice_questions: practiceQsRes.data || [],
  };
}

// ════════════════════════════════════════════
// Pipeline Status
// ════════════════════════════════════════════
async function getPipelineStatus(sb: any, params: any) {
  const { data } = await sb.from("exam_intel_pipeline_runs")
    .select("*").order("created_at", { ascending: false }).limit(10);
  return { runs: data || [] };
}

// ════════════════════════════════════════════
// Admin Dashboard Data
// ════════════════════════════════════════════
async function getIntelDashboard(sb: any, params: any) {
  const { exam_type } = params || {};

  const queries: Promise<any>[] = [
    sb.from("exam_intel_topic_scores").select("*", { count: "exact" })
      .order("composite_score", { ascending: false }).limit(20),
    sb.from("exam_intel_pipeline_runs").select("*")
      .order("created_at", { ascending: false }).limit(5),
    sb.from("exam_intel_practice_questions").select("*", { count: "exact" }).limit(5),
    sb.from("exam_intel_student_briefs").select("*", { count: "exact" }).limit(5),
    sb.from("exam_intel_alerts").select("*", { count: "exact" })
      .order("created_at", { ascending: false }).limit(10),
  ];

  if (exam_type) {
    queries[0] = sb.from("exam_intel_topic_scores").select("*", { count: "exact" })
      .eq("exam_type", exam_type).order("composite_score", { ascending: false }).limit(20);
  }

  const [scoresRes, pipelineRes, questionsRes, briefsRes, alertsRes] = await Promise.all(queries);

  return {
    topic_scores: { data: scoresRes.data || [], count: scoresRes.count || 0 },
    pipeline_runs: pipelineRes.data || [],
    practice_questions: { count: questionsRes.count || 0 },
    student_briefs: { count: briefsRes.count || 0 },
    alerts: { data: alertsRes.data || [], count: alertsRes.count || 0 },
    version: "v10.0",
  };
}
