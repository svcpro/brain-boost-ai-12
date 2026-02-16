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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { message, conversationHistory, language } = await req.json();
    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: "Message required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Gather user cognitive context in parallel
    const [topicsRes, logsRes, profileRes, examsRes, rankRes, featuresRes, subjectsRes] = await Promise.all([
      adminClient.from("topics").select("name, memory_strength, next_predicted_drop_date, subject_id, last_revision_date").eq("user_id", userId).is("deleted_at", null).order("memory_strength", { ascending: true }).limit(30),
      adminClient.from("study_logs").select("duration_minutes, created_at, confidence_level, study_mode").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      adminClient.from("profiles").select("daily_study_goal_minutes, exam_date, exam_type, display_name, weekly_focus_goal_minutes").eq("id", userId).maybeSingle(),
      adminClient.from("exam_results").select("score, total_questions, difficulty, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
      adminClient.from("rank_predictions").select("predicted_rank, percentile, recorded_at").eq("user_id", userId).order("recorded_at", { ascending: false }).limit(5),
      adminClient.from("user_features").select("*").eq("user_id", userId).maybeSingle(),
      adminClient.from("subjects").select("id, name").eq("user_id", userId).is("deleted_at", null),
    ]);

    const topics = topicsRes.data || [];
    const logs = logsRes.data || [];
    const profile = profileRes.data;
    const exams = examsRes.data || [];
    const ranks = rankRes.data || [];
    const features = featuresRes.data;
    const subjects = subjectsRes.data || [];

    const subjectMap = new Map(subjects.map((s: any) => [s.id, s.name]));
    const now = new Date();
    const daysToExam = profile?.exam_date
      ? Math.ceil((new Date(profile.exam_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const totalStudyMinutes14d = logs
      .filter(l => new Date(l.created_at) >= new Date(now.getTime() - 14 * 86400000))
      .reduce((s, l) => s + (l.duration_minutes || 0), 0);

    const criticalTopics = topics.filter(t => Number(t.memory_strength) < 40);
    const atRiskTopics = topics.filter(t => Number(t.memory_strength) >= 40 && Number(t.memory_strength) < 60);

    const cognitiveContext = `
## STUDENT PROFILE
- Name: ${profile?.display_name || "Student"}
- Daily goal: ${profile?.daily_study_goal_minutes || 60} min
- Exam: ${profile?.exam_type || "Not set"} ${daysToExam !== null ? `in ${daysToExam} days` : "(no date)"}
- Total study (14d): ${Math.round(totalStudyMinutes14d / 60 * 10) / 10} hours across ${logs.length} sessions

## COGNITIVE STATE
${features ? `- Study consistency: ${features.study_consistency_score}%
- Engagement: ${features.engagement_score}%
- Fatigue: ${features.fatigue_indicator}%
- Burnout risk: ${features.burnout_risk_score}%
- Knowledge stability: ${features.knowledge_stability}%
- Learning velocity: ${features.learning_velocity} topics/day
- Avg session: ${features.avg_session_duration_minutes} min` : "No ML features yet."}

## MEMORY STATE
- Critical (<40%): ${criticalTopics.length > 0 ? criticalTopics.map(t => `${t.name} (${Math.round(Number(t.memory_strength))}%, ${subjectMap.get(t.subject_id) || ""})`).join(", ") : "None"}
- At-risk (40-60%): ${atRiskTopics.length > 0 ? atRiskTopics.map(t => `${t.name} (${Math.round(Number(t.memory_strength))}%)`).join(", ") : "None"}
- Total topics: ${topics.length}

## EXAM HISTORY
${exams.length > 0 ? exams.slice(0, 5).map(e => `- ${e.score}/${e.total_questions} (${e.difficulty}) on ${new Date(e.created_at).toLocaleDateString()}`).join("\n") : "None yet."}

## RANK
${ranks.length > 0 ? `Rank: ${ranks[0].predicted_rank} (${ranks[0].percentile}th percentile)${ranks.length > 1 ? ` | Prev: ${ranks[1].predicted_rank}` : ""}` : "No rank data."}

## SUBJECTS
${subjects.map(s => s.name).join(", ") || "None added."}
`;

    const lang = language === "hi" ? "Respond in Hindi (Devanagari, Hinglish style where natural)." : "Respond in English.";

    const systemPrompt = `You are ACRY Brain Assistant — a 24/7 personal AI brain assistant for exam preparation. You are calm, intelligent, motivating, supportive, and professional.

You have COMPLETE access to the student's real cognitive data below. ALWAYS use their actual data — never give generic advice.

${cognitiveContext}

IMPORTANT RULES:
1. Reference specific topic names, scores, and numbers from their data.
2. Instead of "revise physics", say "Your Current Electricity memory is at 32% — a 5-min review will strengthen it before it drops."
3. Adapt tone: motivational when they're struggling, celebratory when doing well, urgent near exams.
4. You can explain predictions, suggest study strategies, help fix weak topics, assist with app usage, and provide emotional encouragement.
5. Keep responses concise but helpful. Use bullet points and structure.
6. ${lang}
7. If you don't have data for something, say so honestly.
8. For app usage questions: ACRY has Brain tab (memory tracking), Action tab (study tools), Progress tab (analytics), You tab (settings).
9. If a problem requires human support, tell the user to email support@acry.app.`;

    // Build messages array with history
    const messages: any[] = [{ role: "system", content: systemPrompt }];

    if (conversationHistory && Array.isArray(conversationHistory)) {
      // Include last 20 messages for context
      const recent = conversationHistory.slice(-20);
      for (const msg of recent) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: "user", content: message });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Streaming response
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        stream: true,
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Track usage
    adminClient.rpc("increment_api_usage", { p_service_name: "lovable_ai" }).then(() => {}).catch(() => {});

    // Stream SSE directly to client
    return new Response(aiResp.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-support-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
