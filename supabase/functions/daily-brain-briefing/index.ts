import { createClient } from "npm:@supabase/supabase-js@2";
import { aiFetch } from "../_shared/aiFetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find users who have push subscriptions and haven't opted out of daily briefings
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("user_id")
      .limit(200);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No users with push subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduplicate user IDs
    const userIds = [...new Set(subscriptions.map(s => s.user_id))];

    let sent = 0;
    let skipped = 0;

    for (const userId of userIds) {
      try {
        // Check if user opted out of daily briefings
        const { data: profile } = await supabase
          .from("profiles")
          .select("push_notification_prefs, display_name, daily_study_goal_minutes, exam_date, exam_type")
          .eq("id", userId)
          .maybeSingle();

        const prefs = profile?.push_notification_prefs as Record<string, boolean> | null;
        if (prefs?.dailyBriefing === false) {
          skipped++;
          continue;
        }

        // Gather lightweight context for this user
        const [topicsRes, logsRes, rankRes, featuresRes] = await Promise.all([
          supabase.from("topics").select("name, memory_strength").eq("user_id", userId).is("deleted_at", null).order("memory_strength", { ascending: true }).limit(10),
          supabase.from("study_logs").select("duration_minutes, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
          supabase.from("rank_predictions").select("predicted_rank, percentile").eq("user_id", userId).order("recorded_at", { ascending: false }).limit(1),
          supabase.from("user_features").select("burnout_risk_score, study_consistency_score, fatigue_indicator").eq("user_id", userId).maybeSingle(),
        ]);

        const topics = topicsRes.data || [];
        const logs = logsRes.data || [];
        const rank = rankRes.data?.[0];
        const features = featuresRes.data;

        const now = new Date();
        const daysToExam = profile?.exam_date
          ? Math.ceil((new Date(profile.exam_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        const criticalTopics = topics.filter(t => Number(t.memory_strength) < 40);
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const studyYesterday = logs
          .filter(l => new Date(l.created_at) >= yesterday)
          .reduce((s, l) => s + (l.duration_minutes || 0), 0);

        const briefContext = `Student: ${profile?.display_name || "Student"}
Exam: ${profile?.exam_type || "Not set"} ${daysToExam !== null ? `in ${daysToExam} days` : ""}
Study yesterday: ${studyYesterday} min (goal: ${profile?.daily_study_goal_minutes || 60} min)
Critical topics: ${criticalTopics.length > 0 ? criticalTopics.slice(0, 3).map(t => `${t.name} (${Math.round(Number(t.memory_strength))}%)`).join(", ") : "None"}
Rank: ${rank ? `#${rank.predicted_rank} (${rank.percentile}th percentile)` : "N/A"}
Burnout risk: ${features?.burnout_risk_score ?? "N/A"}%
Fatigue: ${features?.fatigue_indicator ?? "N/A"}%`;

        // Generate a concise morning briefing via AI
        const aiResp = await aiFetch({
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content: "You are ACRY, an AI study brain. Generate a SHORT morning briefing for a push notification. Max 2 sentences. Be motivating, mention one specific action. Use the student's data."
              },
              {
                role: "user",
                content: `Generate a morning briefing notification for this student:\n${briefContext}`
              }
            ],
          }),
        });

        if (!aiResp.ok) {
          console.error(`AI error for user ${userId}: ${aiResp.status}`);
          continue;
        }

        const aiData = await aiResp.json();
        // Track Lovable AI usage (fire-and-forget)
        supabase.rpc("increment_api_usage", { p_service_name: "lovable_ai" }).then(() => {}).catch(() => {});
        const briefingText = aiData.choices?.[0]?.message?.content || "";

        if (!briefingText) continue;

        // Send push notification via the existing send-push-notification function
        // We call it internally using service role
        const pushResp = await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipient_id: userId,
            title: "🧠 Your Morning Brain Briefing",
            body: briefingText,
            data: { type: "daily_briefing" },
          }),
        });

        if (pushResp.ok) {
          sent++;
        } else {
          console.error(`Push failed for user ${userId}: ${pushResp.status}`);
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));
      } catch (userErr) {
        console.error(`Error processing user ${userId}:`, userErr);
      }
    }

    return new Response(JSON.stringify({ processed: userIds.length, sent, skipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("daily-brain-briefing error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
