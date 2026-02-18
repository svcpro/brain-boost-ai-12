import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Get all users with topics
    const { data: users } = await supabase
      .from("profiles")
      .select("id, display_name, daily_study_goal_minutes, exam_date, exam_type, push_notification_prefs")
      .limit(500);

    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let sent = 0;

    for (const profile of users) {
      try {
        // Check opt-out
        const prefs = profile.push_notification_prefs as Record<string, boolean> | null;
        if (prefs?.riskDigest === false) continue;

        const userId = profile.id;

        // Fetch topics and recent study activity
        const [topicsRes, logsRes, twinRes] = await Promise.all([
          supabase
            .from("topics")
            .select("id, name, memory_strength, next_predicted_drop_date, last_revision_date, subject_id")
            .eq("user_id", userId)
            .is("deleted_at", null)
            .order("memory_strength", { ascending: true }),
          supabase
            .from("study_logs")
            .select("topic_id, duration_minutes, created_at")
            .eq("user_id", userId)
            .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
            .order("created_at", { ascending: false }),
          supabase
            .from("cognitive_twins")
            .select("avg_decay_rate, optimal_session_duration, topic_models")
            .eq("user_id", userId)
            .maybeSingle(),
        ]);

        const topics = topicsRes.data || [];
        if (topics.length === 0) continue;

        const logs = logsRes.data || [];
        const twin = twinRes.data;

        // Identify at-risk topics (strength < 50 or predicted drop within 3 days)
        const now = new Date();
        const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

        const atRisk = topics.filter(t => {
          const strength = Number(t.memory_strength);
          const dropDate = t.next_predicted_drop_date ? new Date(t.next_predicted_drop_date) : null;
          return strength < 50 || (dropDate && dropDate <= threeDaysLater);
        });

        if (atRisk.length === 0) {
          // No risk — send a brief positive notification
          await supabase.from("notification_history").insert({
            user_id: userId,
            title: "✅ Risk Digest: All Clear!",
            body: "No topics at risk today. Keep up the great work! Consider reviewing your strongest topics to maintain them.",
            type: "risk_digest",
          });
          sent++;
          processed++;
          continue;
        }

        // Get subject names for context
        const subjectIds = [...new Set(atRisk.map(t => t.subject_id).filter(Boolean))];
        const { data: subjects } = subjectIds.length > 0
          ? await supabase.from("subjects").select("id, name").in("id", subjectIds)
          : { data: [] };
        const subjectMap: Record<string, string> = {};
        for (const s of subjects || []) subjectMap[s.id] = s.name;

        // Recently studied topic IDs
        const recentlyStudiedIds = new Set(logs.map(l => l.topic_id).filter(Boolean));

        // Rank at-risk topics by urgency
        const ranked = atRisk.map(t => {
          const strength = Number(t.memory_strength);
          const dropDate = t.next_predicted_drop_date ? new Date(t.next_predicted_drop_date) : null;
          const daysUntilDrop = dropDate ? Math.max(0, (dropDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 999;
          const recentlyStudied = recentlyStudiedIds.has(t.id);
          // Urgency: lower strength + sooner drop + not recently studied = higher urgency
          const urgency = (100 - strength) + (10 / Math.max(0.1, daysUntilDrop)) + (recentlyStudied ? 0 : 15);
          return { ...t, strength, daysUntilDrop: Math.round(daysUntilDrop * 10) / 10, urgency, recentlyStudied, subjectName: subjectMap[t.subject_id] || "Unknown" };
        }).sort((a, b) => b.urgency - a.urgency);

        const topPriority = ranked.slice(0, 5);
        const optimalDuration = twin?.optimal_session_duration || 25;

        // Generate AI study plan
        const contextStr = `Student: ${profile.display_name || "Student"}
Exam: ${profile.exam_type || "Not set"}${profile.exam_date ? ` (${Math.ceil((new Date(profile.exam_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} days away)` : ""}
Daily goal: ${profile.daily_study_goal_minutes || 60} min
Optimal session: ${optimalDuration} min

At-risk topics (${atRisk.length} total, showing top ${topPriority.length}):
${topPriority.map((t, i) => `${i + 1}. ${t.name} (${t.subjectName}) — ${t.strength}% strength, drops in ${t.daysUntilDrop}d${t.recentlyStudied ? " [studied this week]" : " [NOT studied recently]"}`).join("\n")}`;

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
                content: `You are ACRY, an AI study assistant. Generate a concise daily risk digest notification with a quick study plan. Format:
Line 1: ⚠️ Summary (e.g. "3 topics at risk, 2 critical")
Line 2-4: Quick plan with specific times (e.g. "1. Review [Topic] for 15m — strength at 23%")  
Line 5: One motivating sentence.
Keep it under 5 lines total. Be specific with topic names and durations.`,
              },
              {
                role: "user",
                content: `Generate today's risk digest and quick study plan:\n${contextStr}`,
              },
            ],
          }),
        });

        let digestText = "";
        if (aiResp.ok) {
          const aiData = await aiResp.json();
          digestText = aiData.choices?.[0]?.message?.content || "";
        }

        // Fallback if AI fails
        if (!digestText) {
          const criticalCount = topPriority.filter(t => t.strength < 30).length;
          digestText = `⚠️ ${atRisk.length} topic${atRisk.length > 1 ? "s" : ""} at risk${criticalCount > 0 ? ` (${criticalCount} critical)` : ""}.\n`;
          digestText += topPriority.slice(0, 3).map((t, i) =>
            `${i + 1}. Review "${t.name}" (${t.strength}%) — ${Math.min(optimalDuration, 20)}m session`
          ).join("\n");
          digestText += "\n📚 Even a quick 15-minute session can prevent memory decay!";
        }

        // Save notification
        await supabase.from("notification_history").insert({
          user_id: userId,
          title: `🔴 Risk Digest: ${atRisk.length} topic${atRisk.length > 1 ? "s" : ""} need attention`,
          body: digestText,
          type: "risk_digest",
        });

        // Also send push notification if user has subscriptions
        const { data: pushSubs } = await supabase
          .from("push_subscriptions")
          .select("id")
          .eq("user_id", userId)
          .limit(1);

        if (pushSubs && pushSubs.length > 0) {
          const shortBody = `${atRisk.length} topic${atRisk.length > 1 ? "s" : ""} at risk. Top: ${topPriority[0]?.name} (${topPriority[0]?.strength}%). Tap to see your study plan.`;
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push-notification`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              recipient_id: userId,
              title: `🔴 ${atRisk.length} topic${atRisk.length > 1 ? "s" : ""} at risk`,
              body: shortBody,
              data: { type: "risk_digest" },
            }),
          });
        }


        sent++;
        processed++;

        // Rate limiting
        await new Promise(r => setTimeout(r, 300));
      } catch (userErr) {
        console.error(`Risk digest error for user ${profile.id}:`, userErr);
        processed++;
      }
    }

    return new Response(JSON.stringify({ processed, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("daily-risk-digest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
