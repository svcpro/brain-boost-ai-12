import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { action } = await req.json();
    const userId = user.id;

    // Gather all user data in parallel (including Intel v10.0 predictions)
    const [topicsRes, profileRes, logsRes, examsRes, featuresRes, rankRes, twinRes, intelRes] = await Promise.all([
      supabase.from("topics").select("id, name, memory_strength, subject_id, last_revision_date, next_predicted_drop_date, revision_count, created_at")
        .eq("user_id", userId).is("deleted_at", null),
      supabase.from("profiles").select("daily_study_goal_minutes, exam_date, exam_type, display_name")
        .eq("id", userId).maybeSingle(),
      supabase.from("study_logs").select("duration_minutes, created_at, confidence_level, study_mode, topic_id")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
      supabase.from("exam_results").select("score, total_questions, difficulty, created_at, topic_scores")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      supabase.from("user_features").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("rank_predictions").select("predicted_rank, percentile, recorded_at")
        .eq("user_id", userId).order("recorded_at", { ascending: false }).limit(10),
      supabase.from("cognitive_twins").select("*").eq("user_id", userId).order("computed_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("exam_intel_student_briefs").select("*").eq("user_id", userId).order("computed_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const topics = topicsRes.data || [];
    const profile = profileRes.data;
    const logs = logsRes.data || [];
    const exams = examsRes.data || [];
    const features = featuresRes.data;
    const ranks = rankRes.data || [];
    const twin = twinRes.data;
    const intelBrief = intelRes.data;

    const now = new Date();
    const daysToExam = profile?.exam_date
      ? Math.ceil((new Date(profile.exam_date).getTime() - now.getTime()) / 86400000)
      : null;

    // Build comprehensive context
    const topicSummary = topics.map(t => ({
      name: t.name,
      strength: Math.round(Number(t.memory_strength)),
      revisions: t.revision_count || 0,
      daysSinceRevision: t.last_revision_date ? Math.floor((now.getTime() - new Date(t.last_revision_date).getTime()) / 86400000) : null,
      predictedDrop: t.next_predicted_drop_date,
    }));

    const examSummary = exams.map(e => ({
      score: e.score,
      total: e.total_questions,
      pct: Math.round((e.score / e.total_questions) * 100),
      difficulty: e.difficulty,
      date: e.created_at,
    }));

    const recentLogs = logs.slice(0, 50);
    const totalStudyHours = logs.reduce((s, l) => s + (l.duration_minutes || 0), 0) / 60;

    const contextStr = `
## STUDENT PROFILE
- Exam: ${profile?.exam_type || "Unknown"} ${daysToExam !== null ? `in ${daysToExam} days` : "(no date set)"}
- Daily goal: ${profile?.daily_study_goal_minutes || 60} min
- Total study hours: ${Math.round(totalStudyHours * 10) / 10}h across ${logs.length} sessions

## COGNITIVE METRICS
${features ? `- Consistency: ${features.study_consistency_score}% | Engagement: ${features.engagement_score}%
- Burnout risk: ${features.burnout_risk_score}% | Knowledge stability: ${features.knowledge_stability}%
- Learning velocity: ${features.learning_velocity} | Memory decay slope: ${features.memory_decay_slope}` : "No ML features computed yet."}

## COGNITIVE TWIN
${twin ? `- Brain evolution: ${twin.brain_evolution_score}% | Learning efficiency: ${twin.learning_efficiency_score}%
- Optimal session: ${twin.optimal_session_duration}min | Best study hour: ${twin.optimal_study_hour}
- Recall pattern: ${twin.recall_pattern_type}` : "No cognitive twin data."}

## TOPICS (${topics.length} total)
${topicSummary.map(t => `- ${t.name}: ${t.strength}% strength, ${t.revisions} revisions${t.daysSinceRevision !== null ? `, ${t.daysSinceRevision}d since last revision` : ""}`).join("\n")}

## EXAM HISTORY (${exams.length} exams)
${examSummary.slice(0, 10).map(e => `- ${e.pct}% (${e.score}/${e.total}) ${e.difficulty} on ${new Date(e.date).toLocaleDateString()}`).join("\n")}

## RANK TRAJECTORY
${ranks.slice(0, 5).map(r => `- Rank ${r.predicted_rank} (${r.percentile}th pctile) on ${new Date(r.recorded_at).toLocaleDateString()}`).join("\n")}

## STUDY PATTERNS (recent 50 sessions)
${recentLogs.slice(0, 15).map(l => `- ${l.duration_minutes}min ${l.study_mode || "study"} | confidence: ${l.confidence_level || "N/A"} | ${new Date(l.created_at).toLocaleDateString()}`).join("\n")}

## EXAM INTEL v10.0 PREDICTIONS
${intelBrief ? `- Overall Readiness: ${intelBrief.overall_readiness_score}%
- Hot Topics: ${(intelBrief.predicted_hot_topics || []).slice(0, 5).map((t: any) => `${t.topic} (${Math.round(t.probability * 100)}%)`).join(", ")}
- Critical Gaps (High Prob + Low Strength): ${(intelBrief.weakness_overlap || []).slice(0, 3).map((w: any) => `${w.topic} (exam: ${Math.round(w.probability * 100)}%, you: ${Math.round(w.your_strength * 100)}%)`).join(", ")}
- Risk Topics (Not Studied): ${(intelBrief.risk_topics || []).slice(0, 3).map((r: any) => `${r.topic} (${Math.round(r.probability * 100)}%)`).join(", ")}
- AI Strategy: ${intelBrief.ai_strategy_summary || "N/A"}` : "No intel brief computed yet."}
`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { aiFetch } = await import("../_shared/aiFetch.ts");
    const aiResp = await aiFetch({
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are ACRY ULTRA — the most advanced AI Exam Domination Engine. You analyze student data using predictive analytics to maximize exam cracking probability.

Your analysis covers 7 dimensions:
1. EXAM INTELLIGENCE: Analyze topic frequency, difficulty trends, repetition clusters, marks distribution. Score each topic 0-100% probability of appearing.
2. PREDICTIVE QUESTIONS: Generate 5 high-probability predicted questions with confidence scores, difficulty tags, and exam relevance.
3. COMPETITION SIMULATION: Simulate competition among 10,000 virtual students. Estimate rank range, percentile, cutoff prediction, crack probability.
4. ADAPTIVE STRATEGY: Based on user's speed, accuracy, weak topics, mistake patterns. Recommend time allocation, difficulty adjustments, daily plan.
5. SYLLABUS DOMINATION: Coverage map showing completion %, high ROI topics, revision priority, uncovered topics.
6. ULTRA METRICS: Calculate Exam Intelligence Score, Performance Acceleration Index, ML Confidence, Weakness Exposure Index.
7. CONTINUOUS LEARNING: Identify improvement trends, prediction accuracy, model confidence over time.

Be data-driven and realistic. Use actual student metrics provided. Don't be overly optimistic.`
          },
          { role: "user", content: contextStr }
        ],
        tools: [{
          type: "function",
          function: {
            name: "exam_domination_analysis",
            description: "Complete ACRY ULTRA exam domination analysis",
            parameters: {
              type: "object",
              properties: {
                exam_intelligence: {
                  type: "object",
                  properties: {
                    overall_score: { type: "number", description: "Exam Intelligence Score 0-100" },
                    high_probability_topics: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          probability: { type: "number", description: "0-100%" },
                          trend: { type: "string", enum: ["rising", "stable", "declining"] },
                          impact: { type: "string", enum: ["critical", "high", "medium", "low"] }
                        },
                        required: ["name", "probability", "trend", "impact"],
                        additionalProperties: false
                      }
                    },
                    emerging_topics: { type: "array", items: { type: "string" } },
                    declining_topics: { type: "array", items: { type: "string" } }
                  },
                  required: ["overall_score", "high_probability_topics", "emerging_topics", "declining_topics"],
                  additionalProperties: false
                },
                predicted_questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question: { type: "string" },
                      probability: { type: "number" },
                      difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                      relevance_score: { type: "number" },
                      topic: { type: "string" }
                    },
                    required: ["question", "probability", "difficulty", "relevance_score", "topic"],
                    additionalProperties: false
                  }
                },
                competition_simulation: {
                  type: "object",
                  properties: {
                    expected_rank_min: { type: "number" },
                    expected_rank_max: { type: "number" },
                    percentile: { type: "number" },
                    crack_probability: { type: "number", description: "0-100%" },
                    competition_intensity: { type: "string", enum: ["low", "moderate", "high", "extreme"] },
                    cutoff_risk: { type: "string", enum: ["safe", "borderline", "at_risk", "below"] },
                    virtual_students_simulated: { type: "number" }
                  },
                  required: ["expected_rank_min", "expected_rank_max", "percentile", "crack_probability", "competition_intensity", "cutoff_risk", "virtual_students_simulated"],
                  additionalProperties: false
                },
                adaptive_strategy: {
                  type: "object",
                  properties: {
                    daily_plan: { type: "array", items: { type: "object", properties: { topic: { type: "string" }, minutes: { type: "number" }, priority: { type: "string", enum: ["critical", "high", "medium", "low"] } }, required: ["topic", "minutes", "priority"], additionalProperties: false } },
                    weak_areas: { type: "array", items: { type: "string" } },
                    time_allocation_advice: { type: "string" },
                    difficulty_recommendation: { type: "string", enum: ["increase", "maintain", "decrease"] },
                    strategy_summary: { type: "string" }
                  },
                  required: ["daily_plan", "weak_areas", "time_allocation_advice", "difficulty_recommendation", "strategy_summary"],
                  additionalProperties: false
                },
                syllabus_domination: {
                  type: "object",
                  properties: {
                    coverage_percentage: { type: "number" },
                    high_roi_topics: { type: "array", items: { type: "string" } },
                    uncovered_topics: { type: "array", items: { type: "string" } },
                    revision_priority: { type: "array", items: { type: "object", properties: { topic: { type: "string" }, urgency: { type: "string", enum: ["immediate", "soon", "can_wait"] } }, required: ["topic", "urgency"], additionalProperties: false } }
                  },
                  required: ["coverage_percentage", "high_roi_topics", "uncovered_topics", "revision_priority"],
                  additionalProperties: false
                },
                ultra_metrics: {
                  type: "object",
                  properties: {
                    exam_intelligence_score: { type: "number" },
                    performance_acceleration: { type: "number" },
                    ml_confidence: { type: "number" },
                    weakness_exposure: { type: "number" },
                    mastery_heatmap: { type: "array", items: { type: "object", properties: { topic: { type: "string" }, mastery: { type: "number" } }, required: ["topic", "mastery"], additionalProperties: false } },
                    rank_probability_data: { type: "array", items: { type: "object", properties: { rank_range: { type: "string" }, probability: { type: "number" } }, required: ["rank_range", "probability"], additionalProperties: false } }
                  },
                  required: ["exam_intelligence_score", "performance_acceleration", "ml_confidence", "weakness_exposure", "mastery_heatmap", "rank_probability_data"],
                  additionalProperties: false
                },
                overall_verdict: { type: "string", description: "One powerful sentence about exam readiness" },
                domination_level: { type: "string", enum: ["dominating", "strong", "building", "needs_work", "critical"] }
              },
              required: ["exam_intelligence", "predicted_questions", "competition_simulation", "adaptive_strategy", "syllabus_domination", "ultra_metrics", "overall_verdict", "domination_level"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "exam_domination_analysis" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limited — please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const errorText = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, errorText);
      throw new Error("AI analysis failed");
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    let result: any = {};
    if (toolCall?.function?.arguments) {
      result = JSON.parse(toolCall.function.arguments);
    }

    // Add metadata
    result.generated_at = new Date().toISOString();
    result.days_to_exam = daysToExam;
    result.exam_type = profile?.exam_type || "Unknown";
    result.total_topics = topics.length;
    result.total_study_hours = Math.round(totalStudyHours * 10) / 10;

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("exam-domination-engine error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
