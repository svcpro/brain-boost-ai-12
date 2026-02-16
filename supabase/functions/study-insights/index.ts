import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, handleCors, jsonResponse, errorResponse, securityHeaders } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const { userId, supabase } = await authenticateRequest(req);
    const user = { id: userId };

    // Fetch topics with memory data
    const { data: topics } = await supabase
      .from("topics")
      .select("id, name, memory_strength, last_revision_date, next_predicted_drop_date, subject_id")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("memory_strength", { ascending: true })
      .limit(30);

    // Fetch subjects for naming
    const { data: subjects } = await supabase
      .from("subjects")
      .select("id, name")
      .eq("user_id", user.id)
      .is("deleted_at", null);

    // Fetch weak questions
    const { data: weakQs } = await supabase
      .from("question_performance")
      .select("question_text, times_wrong, times_seen, last_seen_at")
      .eq("user_id", user.id)
      .gte("times_wrong", 2)
      .order("times_wrong", { ascending: false })
      .limit(10);

    // Fetch recent study logs (last 14 days)
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentLogs } = await supabase
      .from("study_logs")
      .select("duration_minutes, created_at, subject_id, topic_id")
      .eq("user_id", user.id)
      .gte("created_at", twoWeeksAgo);

    // Profile for goal
    const { data: profile } = await supabase
      .from("profiles")
      .select("daily_study_goal_minutes, exam_date, exam_type")
      .eq("id", user.id)
      .maybeSingle();

    const subjectMap = new Map((subjects || []).map(s => [s.id, s.name]));

    const topicSummaries = (topics || []).map(t => ({
      name: t.name,
      subject: subjectMap.get(t.subject_id) || "Unknown",
      memoryStrength: Math.round(t.memory_strength * 100) / 100,
      lastRevised: t.last_revision_date || "never",
      predictedDrop: t.next_predicted_drop_date || null,
    }));

    const totalMinutes14d = (recentLogs || []).reduce((s, l) => s + (l.duration_minutes || 0), 0);
    const daysToExam = profile?.exam_date
      ? Math.ceil((new Date(profile.exam_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    const prompt = `You are a study coach AI. Analyze this student's data and provide exactly 4-6 actionable study insights.

STUDENT DATA:
- Daily goal: ${profile?.daily_study_goal_minutes || 60} minutes
- Exam: ${profile?.exam_type || "Not set"} in ${daysToExam !== null ? daysToExam + " days" : "no date set"}
- Study volume (last 14 days): ${totalMinutes14d} minutes across ${(recentLogs || []).length} sessions

TOPICS (sorted by weakest first):
${topicSummaries.slice(0, 15).map(t => `- ${t.name} (${t.subject}): strength=${t.memoryStrength}, last revised=${t.lastRevised}, predicted drop=${t.predictedDrop || "unknown"}`).join("\n")}

WEAK QUESTIONS (wrong 2+ times):
${(weakQs || []).slice(0, 5).map(q => `- "${q.question_text.slice(0, 60)}..." wrong ${q.times_wrong}/${q.times_seen}, last seen ${q.last_seen_at}`).join("\n") || "None"}

Respond with a JSON array. Each insight object must have:
- "type": one of "urgent", "optimization", "encouragement", "schedule"
- "title": short headline (max 8 words)
- "body": 1-2 sentence actionable advice
- "topic": relevant topic name or null
- "subject": the subject that the topic belongs to, or null if no specific topic
- "priority": 1 (highest) to 4 (lowest)

Focus on: which topics to revise NOW based on forgetting curve, optimal revision timing, weak question patterns, and study volume trends. Be specific with topic names and always include the subject they belong to.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        tools: [{
          type: "function",
          function: {
            name: "study_insights",
            description: "Return study insights for the student",
            parameters: {
              type: "object",
              properties: {
                insights: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["urgent", "optimization", "encouragement", "schedule"] },
                      title: { type: "string" },
                      body: { type: "string" },
                      topic: { type: "string" },
                      subject: { type: "string" },
                      priority: { type: "integer" },
                    },
                    required: ["type", "title", "body", "priority"],
                  },
                },
              },
              required: ["insights"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "study_insights" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResp.text();
      console.error("AI error:", aiResp.status, errText);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResp.json();

    // Track API usage (fire-and-forget)
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    adminClient.rpc("increment_api_usage", { p_service_name: "lovable_ai" }).then(() => {}).catch(() => {});

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let insights: any[] = [];

    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      insights = parsed.insights || [];
    }

    // Sort by priority
    insights.sort((a: any, b: any) => (a.priority || 4) - (b.priority || 4));

    return new Response(JSON.stringify({ insights }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("study-insights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
