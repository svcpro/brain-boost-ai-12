import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { userId, type } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch user context for personalized notification (optional userId)
    let profile: any = null;
    let recentLogs: any[] = [];
    let weakTopics: any[] = [];

    if (userId) {
      const [profileRes, logsRes, topicsRes] = await Promise.all([
        supabase.from("profiles").select("display_name, exam_type, daily_study_goal_minutes").eq("id", userId).maybeSingle(),
        supabase.from("study_logs").select("duration_minutes, confidence_level, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(7),
        supabase.from("topics").select("name, memory_strength").eq("user_id", userId).is("deleted_at", null).order("memory_strength", { ascending: true }).limit(5),
      ]);
      profile = profileRes.data;
      recentLogs = logsRes.data || [];
      weakTopics = topicsRes.data || [];
    }

    const totalMinutes = recentLogs.reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0);
    const sessionsCount = recentLogs.length;
    const weakTopicNames = weakTopics.map((t: any) => `${t.name} (${t.memory_strength}%)`).join(", ");

    const notificationType = type || "general";
    const typeInstructions: Record<string, string> = {
      general: "Write a friendly, encouraging notification about their learning progress.",
      reminder: "Write a gentle study reminder that motivates them to study today.",
      achievement: "Write a celebratory notification recognizing their effort or a milestone.",
      warning: "Write a concerned but supportive notification about declining study activity.",
      system: "Write a brief, professional system notification about their account.",
    };

    const prompt = `You are an admin sending a notification to a student on a study app called ACRY Brain.

User context:
- Name: ${profile?.display_name || "Student"}
- Exam: ${profile?.exam_type || "Unknown"}
- Daily goal: ${profile?.daily_study_goal_minutes || 30} minutes
- Last 7 sessions: ${sessionsCount} sessions, ${totalMinutes} total minutes
- Weakest topics: ${weakTopicNames || "None tracked yet"}

Notification type: ${notificationType}
${typeInstructions[notificationType] || typeInstructions.general}

Return ONLY a JSON object with "title" (max 60 chars, punchy) and "body" (max 200 chars, personal and actionable). Use their name if available. No markdown, no code fences.`;

    const { aiFetch } = await import("../_shared/aiFetch.ts");
    const response = await aiFetch({
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    let title = "";
    let body = "";
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      title = parsed.title || "";
      body = parsed.body || "";
    } catch {
      // Fallback: try to extract from text
      title = "Keep going! 🧠";
      body = content.slice(0, 200);
    }

    return new Response(JSON.stringify({ title, body }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-notification error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
