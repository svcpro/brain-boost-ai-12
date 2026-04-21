import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Scheduled job: Scans all active users for churn risk, sends motivational
 * interventions, bundles daily summaries, and triggers rank war pushes.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Get active users (logged in within 30 days)
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: users } = await supabase
      .from("profiles")
      .select("id")
      .gte("last_active_at", cutoff)
      .limit(500);

    if (!users || users.length === 0) {
      return json({ processed: 0, reason: "no_active_users" });
    }

    let churnAlerts = 0;
    let bundled = 0;
    let rankWar = 0;
    let motivation = 0;
    let growthProcessed = 0;

    // Run growth engine daily tasks (segmentation, journeys, subscription triggers)
    try {
      const growthRes = await callGrowthEngine(SUPABASE_URL, SERVICE_KEY, { action: "run_daily_growth" });
      growthProcessed = growthRes?.processed || 0;
    } catch { /* non-blocking */ }

    for (const user of users) {
      const userId = user.id;

      // 1. Churn prediction
      try {
        const churnRes = await callEngine(SUPABASE_URL, SERVICE_KEY, {
          action: "predict_churn", user_id: userId,
        });

        if (churnRes?.risk_level === "critical" || churnRes?.risk_level === "high") {
          await callOmnichannel(SUPABASE_URL, SERVICE_KEY, {
            event_type: "churn_risk_detected",
            user_id: userId,
            source: "system",
            data: { churn_probability: churnRes.churn_probability, risk_factors: churnRes.risk_factors },
          });
          churnAlerts++;
        }
      } catch { /* non-blocking */ }

      // 2. Daily brain summary bundle
      try {
        const bundleRes = await callEngine(SUPABASE_URL, SERVICE_KEY, {
          action: "bundle_notifications", user_id: userId,
        });
        if (bundleRes?.bundled) bundled++;
      } catch { /* non-blocking */ }

      // 3. Rank war check
      try {
        const rwRes = await callEngine(SUPABASE_URL, SERVICE_KEY, {
          action: "rank_war_check", user_id: userId,
        });
        if (rwRes?.rank_war) {
          await callOmnichannel(SUPABASE_URL, SERVICE_KEY, {
            event_type: "rank_war_daily",
            user_id: userId,
            source: "system",
            data: { days_until_exam: rwRes.days_until_exam, intensity: rwRes.intensity, peer_count: rwRes.peer_count },
          });
          rankWar++;
        }
      } catch { /* non-blocking */ }

      // 4. Motivation boost (for users with declining confidence)
      try {
        const { data: recentLogs } = await supabase
          .from("study_logs")
          .select("confidence_level")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(5);

        if (recentLogs && recentLogs.length >= 3) {
          const avgConf = recentLogs.reduce((s: number, l: any) => s + (l.confidence_level || 50), 0) / recentLogs.length;
          if (avgConf < 40) {
            await callOmnichannel(SUPABASE_URL, SERVICE_KEY, {
              event_type: "motivation_boost",
              user_id: userId,
              source: "system",
              data: { avg_confidence: avgConf },
            });
            motivation++;
          }
        }
      } catch { /* non-blocking */ }
    }

    return json({
      processed: users.length,
      churn_alerts: churnAlerts,
      bundled,
      rank_war: rankWar,
      motivation_boosts: motivation,
      growth_engine: growthProcessed,
    });
  } catch (e) {
    console.error("behavioral-notify-cron error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

async function callEngine(url: string, key: string, body: Record<string, any>) {
  const res = await fetch(`${url}/functions/v1/intelligent-notify-engine`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok ? await res.json() : null;
}

async function callOmnichannel(url: string, key: string, body: Record<string, any>) {
  const res = await fetch(`${url}/functions/v1/omnichannel-notify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok ? await res.json() : null;
}

async function callGrowthEngine(url: string, key: string, body: Record<string, any>) {
  const res = await fetch(`${url}/functions/v1/growth-engine`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok ? await res.json() : null;
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
