import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all users with features data
    const { data: allFeatures, error: featErr } = await supabase
      .from("user_features")
      .select("user_id, study_consistency_score, recall_success_rate, burnout_risk_score, knowledge_stability")
      .order("computed_at", { ascending: false });

    if (featErr) throw featErr;

    // Deduplicate to latest per user
    const userMap = new Map<string, typeof allFeatures[0]>();
    for (const f of allFeatures || []) {
      if (!userMap.has(f.user_id)) userMap.set(f.user_id, f);
    }

    // Get global benchmarks
    const { data: globalPatterns } = await supabase
      .from("global_learning_patterns")
      .select("pattern_type, pattern_key, metrics")
      .eq("pattern_type", "cognitive_benchmark")
      .order("pattern_date", { ascending: false })
      .limit(10);

    const getGlobal = (key: string): number | null => {
      const p = (globalPatterns || []).find(g => g.pattern_key === key);
      if (!p?.metrics) return null;
      const m = p.metrics as Record<string, any>;
      return m.avg ?? m.mean ?? m.value ?? null;
    };

    const THRESHOLD = 0.2;
    const oneDayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    let totalSent = 0;

    for (const [userId, features] of userMap) {
      // Check push notification opt-in
      const { data: profile } = await supabase
        .from("profiles")
        .select("push_notification_prefs")
        .eq("id", userId)
        .maybeSingle();

      const prefs = profile?.push_notification_prefs as Record<string, boolean> | null;
      if (prefs?.benchmarkAlerts === false) continue;

      // Check if user has push subscriptions
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", userId)
        .limit(1);

      if (!subs?.length) continue;

      // Build alerts
      const alerts: { title: string; body: string; type: string }[] = [];

      // Consistency check
      if (features.study_consistency_score != null) {
        const val = Number(features.study_consistency_score) * 100;
        const globalVal = (getGlobal("study_consistency") ?? 0.55) * 100;
        const diff = (val - globalVal) / Math.max(globalVal, 1);
        if (diff < -THRESHOLD) {
          alerts.push({
            title: "📉 Consistency below benchmark",
            body: `Your consistency (${Math.round(val)}%) is below the community avg of ${Math.round(globalVal)}%. Try fixed study times.`,
            type: "benchmark_alert",
          });
        }
      }

      // Recall check
      if (features.recall_success_rate != null) {
        const val = Number(features.recall_success_rate) * 100;
        const globalVal = (getGlobal("recall_success_rate") ?? 0.58) * 100;
        const diff = (val - globalVal) / Math.max(globalVal, 1);
        if (diff < -THRESHOLD) {
          alerts.push({
            title: "🧠 Recall rate needs attention",
            body: `Your recall (${Math.round(val)}%) is below avg of ${Math.round(globalVal)}%. Focus on active recall.`,
            type: "benchmark_alert",
          });
        }
      }

      // Burnout check
      if (features.burnout_risk_score != null && Number(features.burnout_risk_score) > 0.7) {
        alerts.push({
          title: "🔥 High burnout risk",
          body: `Burnout risk at ${Math.round(Number(features.burnout_risk_score) * 100)}%. Consider shorter sessions.`,
          type: "benchmark_alert",
        });
      }

      if (alerts.length === 0) continue;

      // Deduplicate against recent notifications
      const { data: recent } = await supabase
        .from("notification_history")
        .select("title")
        .eq("user_id", userId)
        .gte("created_at", oneDayAgo);

      const recentTitles = new Set((recent || []).map(n => n.title));
      const newAlerts = alerts.filter(a => !recentTitles.has(a.title));
      if (newAlerts.length === 0) continue;

      // Insert notifications
      await supabase.from("notification_history").insert(
        newAlerts.map(a => ({ user_id: userId, title: a.title, body: a.body, type: a.type, read: false }))
      );

      // Send push for the most critical alert
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            recipient_id: userId,
            title: newAlerts[0].title,
            body: newAlerts[0].body,
            data: { type: "benchmark_deviation" },
          }),
        });
        totalSent++;
      } catch (e) {
        console.warn(`Push failed for ${userId}:`, e);
      }
    }

    return new Response(JSON.stringify({ users_checked: userMap.size, push_sent: totalSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Scheduled benchmark check error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
