import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client for auth
    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    // Service client for writes to notification_history & reading global patterns
    const serviceClient = createClient(supabaseUrl, serviceKey);

    // Fetch user data and global patterns in parallel
    const [featuresRes, topicsRes, twinRes, globalRes] = await Promise.all([
      userClient.from("user_features")
        .select("study_consistency_score, recall_success_rate, avg_session_duration_minutes, knowledge_stability, burnout_risk_score")
        .eq("user_id", user.id)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      userClient.from("topics")
        .select("memory_strength")
        .eq("user_id", user.id)
        .is("deleted_at", null),
      userClient.from("cognitive_twins")
        .select("cognitive_capacity_score, learning_efficiency_score")
        .eq("user_id", user.id)
        .maybeSingle(),
      serviceClient.from("global_learning_patterns")
        .select("pattern_type, pattern_key, metrics, sample_size")
        .order("pattern_date", { ascending: false })
        .limit(100),
    ]);

    const features = featuresRes.data;
    const topics = topicsRes.data || [];
    const twin = twinRes.data;
    const globalPatterns = globalRes.data || [];

    if (!features && !twin && topics.length === 0) {
      return new Response(JSON.stringify({ alerts: [], message: "Not enough data yet" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Helper to extract global metric
    const getGlobal = (type: string, key: string): number | null => {
      const p = globalPatterns.find(g => g.pattern_type === type && g.pattern_key === key);
      if (!p?.metrics) return null;
      const m = p.metrics as Record<string, any>;
      return m.avg ?? m.mean ?? m.value ?? null;
    };

    const maxSample = Math.max(...globalPatterns.map(p => p.sample_size || 0), 0);

    interface Alert {
      title: string;
      body: string;
      type: string;
      severity: "positive" | "negative";
    }

    const alerts: Alert[] = [];
    const THRESHOLD = 0.2; // 20% deviation triggers alert

    // Check retention vs global
    if (topics.length > 0) {
      const avgRetention = topics.reduce((s, t) => s + Number(t.memory_strength), 0) / topics.length;
      const globalRetention = getGlobal("cognitive_benchmark", "knowledge_stability");
      const globalVal = globalRetention !== null ? globalRetention * 100 : 62;
      const diff = (avgRetention - globalVal) / Math.max(globalVal, 1);

      if (diff < -THRESHOLD) {
        alerts.push({
          title: "⚠️ Retention below benchmark",
          body: `Your average retention (${Math.round(avgRetention)}%) is ${Math.abs(Math.round(diff * 100))}% below the global average of ${Math.round(globalVal)}%. Consider increasing revision frequency.`,
          type: "benchmark_alert",
          severity: "negative",
        });
      } else if (diff > THRESHOLD) {
        alerts.push({
          title: "🌟 Outstanding retention!",
          body: `Your retention (${Math.round(avgRetention)}%) is ${Math.round(diff * 100)}% above the global average of ${Math.round(globalVal)}%. You're outperforming most learners!`,
          type: "benchmark_positive",
          severity: "positive",
        });
      }
    }

    // Check consistency
    if (features?.study_consistency_score != null) {
      const userVal = Number(features.study_consistency_score) * 100;
      const globalConsistency = getGlobal("cognitive_benchmark", "study_consistency");
      const globalVal = globalConsistency !== null ? globalConsistency * 100 : 55;
      const diff = (userVal - globalVal) / Math.max(globalVal, 1);

      if (diff < -THRESHOLD) {
        alerts.push({
          title: "📉 Study consistency dropping",
          body: `Your consistency score (${Math.round(userVal)}%) is below the community average of ${Math.round(globalVal)}%. Try scheduling fixed study times.`,
          type: "benchmark_alert",
          severity: "negative",
        });
      } else if (diff > THRESHOLD * 1.5) {
        alerts.push({
          title: "💪 Top-tier consistency!",
          body: `Your consistency (${Math.round(userVal)}%) exceeds the community average of ${Math.round(globalVal)}%. Your discipline is paying off!`,
          type: "benchmark_positive",
          severity: "positive",
        });
      }
    }

    // Check recall rate
    if (features?.recall_success_rate != null) {
      const userVal = Number(features.recall_success_rate) * 100;
      const globalRecall = getGlobal("cognitive_benchmark", "recall_success_rate");
      const globalVal = globalRecall !== null ? globalRecall * 100 : 58;
      const diff = (userVal - globalVal) / Math.max(globalVal, 1);

      if (diff < -THRESHOLD) {
        alerts.push({
          title: "🧠 Recall rate needs attention",
          body: `Your recall rate (${Math.round(userVal)}%) is ${Math.abs(Math.round(diff * 100))}% below the average of ${Math.round(globalVal)}%. Focus on active recall techniques.`,
          type: "benchmark_alert",
          severity: "negative",
        });
      }
    }

    // Check burnout risk
    if (features?.burnout_risk_score != null) {
      const burnout = Number(features.burnout_risk_score);
      if (burnout > 0.7) {
        alerts.push({
          title: "🔥 High burnout risk detected",
          body: `Your burnout risk (${Math.round(burnout * 100)}%) is significantly above safe levels. Consider taking shorter sessions and more breaks.`,
          type: "benchmark_alert",
          severity: "negative",
        });
      }
    }

    // Check cognitive capacity vs baseline
    if (twin?.cognitive_capacity_score != null) {
      const score = Number(twin.cognitive_capacity_score);
      if (score > 75) {
        alerts.push({
          title: "🚀 Exceptional cognitive performance",
          body: `Your cognitive capacity score (${Math.round(score)}) is well above the baseline of 50. You're learning faster than most!`,
          type: "benchmark_positive",
          severity: "positive",
        });
      } else if (score < 30) {
        alerts.push({
          title: "📊 Cognitive performance below baseline",
          body: `Your cognitive score (${Math.round(score)}) suggests room for improvement. Try optimizing your study timing and session lengths.`,
          type: "benchmark_alert",
          severity: "negative",
        });
      }
    }

    // Insert alerts as notifications (skip duplicates from last 24h)
    let inserted = 0;
    if (alerts.length > 0) {
      const oneDayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data: recentNotifs } = await serviceClient
        .from("notification_history")
        .select("title")
        .eq("user_id", user.id)
        .eq("type", "benchmark_alert")
        .gte("created_at", oneDayAgo);

      // Also check positive type
      const { data: recentPositive } = await serviceClient
        .from("notification_history")
        .select("title")
        .eq("user_id", user.id)
        .eq("type", "benchmark_positive")
        .gte("created_at", oneDayAgo);

      const recentTitles = new Set([
        ...(recentNotifs || []).map(n => n.title),
        ...(recentPositive || []).map(n => n.title),
      ]);

      const newAlerts = alerts.filter(a => !recentTitles.has(a.title));

      if (newAlerts.length > 0) {
        const rows = newAlerts.map(a => ({
          user_id: user.id,
          title: a.title,
          body: a.body,
          type: a.type,
          read: false,
        }));
        await serviceClient.from("notification_history").insert(rows);
        inserted = newAlerts.length;
      }
    }

    return new Response(JSON.stringify({
      alerts,
      inserted,
      global_sample: maxSample,
      message: alerts.length === 0
        ? "Your performance is within normal range — no significant deviations detected."
        : `Found ${alerts.length} benchmark deviation${alerts.length > 1 ? "s" : ""}.`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
