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
    if (!authHeader) throw new Error("Missing auth");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { action, message } = await req.json();
    const userId = user.id;

    // Gather comprehensive user context in parallel
    const [
      topicsRes, logsRes, profileRes, featuresRes, examsRes, rankRes, burnoutRes
    ] = await Promise.all([
      supabase.from("topics").select("name, memory_strength, next_predicted_drop_date, subject_id, last_revision_date").eq("user_id", userId).is("deleted_at", null).order("memory_strength", { ascending: true }).limit(30),
      supabase.from("study_logs").select("duration_minutes, created_at, confidence_level, study_mode").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      supabase.from("profiles").select("daily_study_goal_minutes, exam_date, exam_type, display_name").eq("id", userId).maybeSingle(),
      supabase.from("user_features").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("exam_results").select("score, total_questions, difficulty, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
      supabase.from("rank_predictions").select("predicted_rank, percentile, recorded_at").eq("user_id", userId).order("recorded_at", { ascending: false }).limit(5),
      supabase.from("subjects").select("id, name").eq("user_id", userId).is("deleted_at", null),
    ]);

    const topics = topicsRes.data || [];
    const logs = logsRes.data || [];
    const profile = profileRes.data;
    const features = featuresRes.data;
    const exams = examsRes.data || [];
    const ranks = rankRes.data || [];
    const subjects = burnoutRes.data || [];

    const subjectMap = new Map(subjects.map((s: any) => [s.id, s.name]));

    // Build cognitive context summary
    const now = new Date();
    const daysToExam = profile?.exam_date
      ? Math.ceil((new Date(profile.exam_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const totalStudyMinutes14d = logs
      .filter(l => new Date(l.created_at) >= new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000))
      .reduce((s, l) => s + (l.duration_minutes || 0), 0);

    const criticalTopics = topics.filter(t => Number(t.memory_strength) < 40);
    const atRiskTopics = topics.filter(t => Number(t.memory_strength) >= 40 && Number(t.memory_strength) < 60);

    const cognitiveContext = `
## STUDENT PROFILE
- Name: ${profile?.display_name || "Student"}
- Daily goal: ${profile?.daily_study_goal_minutes || 60} min
- Exam: ${profile?.exam_type || "Not set"} ${daysToExam !== null ? `in ${daysToExam} days` : "(no date)"}
- Total study (14d): ${Math.round(totalStudyMinutes14d / 60 * 10) / 10} hours across ${logs.length} sessions

## COGNITIVE STATE (ML Features)
${features ? `- Study consistency: ${features.study_consistency_score}%
- Engagement: ${features.engagement_score}%
- Fatigue indicator: ${features.fatigue_indicator}%
- Burnout risk: ${features.burnout_risk_score}%
- Knowledge stability: ${features.knowledge_stability}%
- Learning velocity: ${features.learning_velocity} topics/day
- Memory decay slope: ${features.memory_decay_slope}
- Avg session: ${features.avg_session_duration_minutes} min
- Hours studied (24h): ${features.hours_studied_last_24h}h | (7d): ${features.hours_studied_last_7d}h` : "No ML features computed yet."}

## MEMORY STATE
- Critical topics (< 40%): ${criticalTopics.length > 0 ? criticalTopics.map(t => `${t.name} (${Math.round(Number(t.memory_strength))}%)`).join(", ") : "None"}
- At-risk topics (40-60%): ${atRiskTopics.length > 0 ? atRiskTopics.map(t => `${t.name} (${Math.round(Number(t.memory_strength))}%)`).join(", ") : "None"}
- Total topics tracked: ${topics.length}

## EXAM PERFORMANCE
${exams.length > 0 ? exams.slice(0, 5).map(e => `- Score: ${e.score}/${e.total_questions} (${e.difficulty}) on ${new Date(e.created_at).toLocaleDateString()}`).join("\n") : "No exams taken yet."}

## RANK TRAJECTORY
${ranks.length > 0 ? `Current rank: ${ranks[0].predicted_rank} (${ranks[0].percentile}th percentile)${ranks.length > 1 ? ` | Previous: ${ranks[1].predicted_rank}` : ""}` : "No rank data."}
`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    if (action === "analyze") {
      // Autonomous analysis: generate a comprehensive brain briefing
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are ACRY, an autonomous AI cognitive engine for exam preparation. You analyze the student's complete learning data and provide a strategic briefing. Be concise, data-driven, and actionable. Use the student's actual topic names and numbers. Think like a personal AI tutor who deeply understands the forgetting curve and optimal study scheduling.`
            },
            {
              role: "user",
              content: `${cognitiveContext}\n\nGenerate a comprehensive AI brain briefing with strategic analysis.`
            }
          ],
          tools: [{
            type: "function",
            function: {
              name: "brain_briefing",
              description: "Generate autonomous AI brain briefing",
              parameters: {
                type: "object",
                properties: {
                  cognitive_summary: { type: "string", description: "2-3 sentence overview of current cognitive state" },
                  memory_analysis: { type: "string", description: "Analysis of memory patterns and decay risks" },
                  strategic_advice: { type: "array", items: { type: "object", properties: { title: { type: "string" }, advice: { type: "string" }, urgency: { type: "string", enum: ["immediate", "today", "this_week"] } }, required: ["title", "advice", "urgency"] } },
                  predicted_outcome: { type: "string", description: "Brief prediction of exam readiness trajectory" },
                  focus_recommendation: { type: "string", description: "What to focus on RIGHT NOW" },
                  wellness_note: { type: "string", description: "Brief note on study-life balance based on fatigue/burnout signals" },
                },
                required: ["cognitive_summary", "memory_analysis", "strategic_advice", "predicted_outcome", "focus_recommendation"],
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "brain_briefing" } },
        }),
      });

      if (!aiResp.ok) {
        if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("AI gateway error");
      }

      const aiData = await aiResp.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      let briefing = {};
      if (toolCall?.function?.arguments) {
        briefing = JSON.parse(toolCall.function.arguments);
      }

      return new Response(JSON.stringify(briefing), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "chat") {
      // Conversational AI agent with full context
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are ACRY, an autonomous AI brain assistant for exam preparation. You have complete access to the student's cognitive data. Answer questions, give study advice, explain predictions, and provide personalized strategy. Be conversational but data-driven. Reference specific topics and numbers from their data.

${cognitiveContext}`
            },
            { role: "user", content: message }
          ],
        }),
      });

      if (!aiResp.ok) {
        if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("AI gateway error");
      }

      const aiData = await aiResp.json();
      const reply = aiData.choices?.[0]?.message?.content || "I couldn't process that. Please try again.";

      return new Response(JSON.stringify({ reply }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "explain") {
      // AI Explainability: explain any prediction
      const { prediction_type, prediction_data } = await req.json().catch(() => ({ prediction_type: "general", prediction_data: {} }));

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content: "You are ACRY's explainability engine. Explain AI predictions in simple, human-friendly language. Be brief (2-3 sentences max). Reference specific data points."
            },
            {
              role: "user",
              content: `Explain this ${prediction_type} prediction to the student:\n\nPrediction data: ${JSON.stringify(prediction_data)}\n\nStudent context:\n${cognitiveContext}`
            }
          ],
        }),
      });

      if (!aiResp.ok) throw new Error("AI gateway error");
      const aiData = await aiResp.json();
      const explanation = aiData.choices?.[0]?.message?.content || "";

      return new Response(JSON.stringify({ explanation }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-brain-agent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
