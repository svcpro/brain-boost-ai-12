import { createClient } from "npm:@supabase/supabase-js@2";
import { aiFetch } from "../_shared/aiFetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authError } = await anonClient.auth.getUser();
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Gather context
    const [profileRes, topicsRes, logsRes, rankRes, featuresRes] = await Promise.all([
      supabase.from("profiles").select("display_name, daily_study_goal_minutes, exam_date, exam_type").eq("id", userId).maybeSingle(),
      supabase.from("topics").select("name, memory_strength").eq("user_id", userId).is("deleted_at", null).order("memory_strength", { ascending: true }).limit(10),
      supabase.from("study_logs").select("duration_minutes, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      supabase.from("rank_predictions").select("predicted_rank, percentile").eq("user_id", userId).order("recorded_at", { ascending: false }).limit(1),
      supabase.from("user_features").select("burnout_risk_score, study_consistency_score, fatigue_indicator").eq("user_id", userId).maybeSingle(),
    ]);

    const profile = profileRes.data;
    const topics = topicsRes.data || [];
    const logs = logsRes.data || [];
    const rank = rankRes.data?.[0];
    const features = featuresRes.data;

    const now = new Date();
    const daysToExam = profile?.exam_date
      ? Math.ceil((new Date(profile.exam_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const criticalTopics = topics.filter((t: any) => Number(t.memory_strength) < 40);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const studyYesterday = logs
      .filter((l: any) => new Date(l.created_at) >= yesterday)
      .reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0);

    const briefContext = `Student: ${profile?.display_name || "Student"}
Exam: ${profile?.exam_type || "Not set"} ${daysToExam !== null ? `in ${daysToExam} days` : ""}
Study last 24h: ${studyYesterday} min (goal: ${profile?.daily_study_goal_minutes || 60} min)
Critical topics: ${criticalTopics.length > 0 ? criticalTopics.slice(0, 3).map((t: any) => `${t.name} (${Math.round(Number(t.memory_strength))}%)`).join(", ") : "None"}
Rank: ${rank ? `#${rank.predicted_rank} (${rank.percentile}th percentile)` : "N/A"}
Burnout risk: ${features?.burnout_risk_score ?? "N/A"}%
Consistency: ${features?.study_consistency_score ?? "N/A"}%
Fatigue: ${features?.fatigue_indicator ?? "N/A"}%`;

    const aiResp = await aiFetch({
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: "You are ACRY, an AI study brain. Generate a concise brain briefing for the student. 3-4 sentences max. Be motivating, mention specific actions based on their data. Include insights about memory health, study progress, and one actionable recommendation.",
          },
          {
            role: "user",
            content: `Generate an on-demand brain briefing for this student:\n${briefContext}`,
          },
        ],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const briefingText = aiData.choices?.[0]?.message?.content || "Unable to generate briefing right now.";

    // Log to notification history
    await supabase.from("notification_history").insert({
      user_id: userId,
      title: "🧠 On-Demand Brain Briefing",
      body: briefingText,
      type: "daily_briefing",
    });

    return new Response(JSON.stringify({ briefing: briefingText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("on-demand-briefing error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
