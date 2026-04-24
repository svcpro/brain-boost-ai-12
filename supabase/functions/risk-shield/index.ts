import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-route",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function getClients(req: Request) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("authorization") || "";
  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const adminClient = createClient(url, serviceKey);
  return { userClient, adminClient };
}

async function getUser(client: any) {
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  return user;
}

// ─── ROUTE: init ───
// Scans all topics, identifies at-risk ones, returns shield analysis
async function handleInit(body: any, userClient: any) {
  const user = await getUser(userClient);
  if (!user) return json({ error: "Unauthorized" }, 401);

  // Fetch all user topics
  const { data: topics } = await userClient
    .from("topics")
    .select("id, name, memory_strength, decay_rate, last_revision_date, subject_id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("memory_strength", { ascending: true });

  const allTopics = topics || [];

  // Categorize risk levels
  const critical: any[] = [];   // < 30%
  const high: any[] = [];       // 30-49%
  const medium: any[] = [];     // 50-69%
  const safe: any[] = [];       // 70%+

  for (const t of allTopics) {
    const strength = Number(t.memory_strength) || 0;
    const decayRate = Number(t.decay_rate) || 0.05;
    const lastRevision = t.last_revision_date ? new Date(t.last_revision_date) : null;
    const hoursSinceRevision = lastRevision
      ? (Date.now() - lastRevision.getTime()) / (1000 * 60 * 60)
      : 999;

    // Predict retention using decay model
    const stability = 1 / Math.max(0.001, decayRate);
    const predictedRetention = strength * Math.exp(-hoursSinceRevision / stability);

    const entry = {
      topic_id: t.id,
      topic_name: t.name,
      subject_id: t.subject_id,
      current_strength: Math.round(strength),
      predicted_retention: Math.round(predictedRetention * 10) / 10,
      decay_rate: decayRate,
      hours_since_revision: Math.round(hoursSinceRevision),
      last_revision: t.last_revision_date,
    };

    if (strength < 30) critical.push(entry);
    else if (strength < 50) high.push(entry);
    else if (strength < 70) medium.push(entry);
    else safe.push(entry);
  }

  const atRiskTopics = [...critical, ...high, ...medium];
  const protectableTopics = allTopics
    .filter((t: any) => Number(t.memory_strength) >= 30 && Number(t.memory_strength) < 70)
    .slice(0, 5);

  return json({
    success: true,
    data: {
      shield_status: atRiskTopics.length === 0 ? "all_safe" : "risks_detected",
      total_topics: allTopics.length,
      at_risk_count: atRiskTopics.length,
      risk_breakdown: {
        critical: { count: critical.length, topics: critical },
        high: { count: high.length, topics: high },
        medium: { count: medium.length, topics: medium },
        safe: { count: safe.length },
      },
      protectable_topics: protectableTopics.map((t: any) => ({
        topic_id: t.id,
        topic_name: t.name,
        current_strength: Math.round(Number(t.memory_strength) || 0),
        estimated_boost: Math.max(1, Math.round((70 - Number(t.memory_strength)) * 0.15)),
      })),
      analysis_phases: [
        { phase: 1, label: "Activating shield", status: "complete", icon: "shield" },
        { phase: 2, label: "Scanning memory risks", status: "complete", icon: "brain" },
        { phase: 3, label: "Identifying decay patterns", status: "complete", icon: "trending-down" },
        { phase: 4, label: "Calculating protection plan", status: "complete", icon: "calculator" },
      ],
    },
  });
}

// ─── ROUTE: activate ───
// Performs the actual shield protection: boosts at-risk topics, logs activity, returns results
async function handleActivate(body: any, userClient: any, adminClient: any) {
  const user = await getUser(userClient);
  if (!user) return json({ error: "Unauthorized" }, 401);

  // Fetch at-risk topics (strength 30-70 = protectable via minor boost)
  const { data: allTopics } = await adminClient
    .from("topics")
    .select("id, name, memory_strength, decay_rate, last_revision_date, subject_id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("memory_strength", { ascending: true });

  const topics = allTopics || [];
  const minorRisk = topics
    .filter((t: any) => Number(t.memory_strength) >= 30 && Number(t.memory_strength) < 70)
    .slice(0, 5);

  const protectedTopics: { topic_id: string; topic_name: string; old_strength: number; new_strength: number; boost: number }[] = [];
  let totalBoost = 0;

  // Protect minor-risk topics
  for (const topic of minorRisk) {
    const currentStrength = Number(topic.memory_strength) || 0;
    const boost = Math.max(1, Math.round((70 - currentStrength) * 0.15));
    const newStrength = Math.min(100, currentStrength + boost);

    await adminClient
      .from("topics")
      .update({
        memory_strength: newStrength,
        last_revision_date: new Date().toISOString(),
      })
      .eq("id", topic.id);

    protectedTopics.push({
      topic_id: topic.id,
      topic_name: topic.name,
      old_strength: Math.round(currentStrength),
      new_strength: Math.round(newStrength),
      boost,
    });
    totalBoost += boost;
  }

  // If no minor-risk topics but there are at-risk topics, protect the weakest one
  if (protectedTopics.length === 0 && topics.length > 0) {
    const weakest = topics[0];
    const currentStrength = Number(weakest.memory_strength) || 0;
    const boost = 1;
    const newStrength = Math.min(100, currentStrength + boost);

    await adminClient
      .from("topics")
      .update({
        memory_strength: newStrength,
        last_revision_date: new Date().toISOString(),
      })
      .eq("id", weakest.id);

    protectedTopics.push({
      topic_id: weakest.id,
      topic_name: weakest.name,
      old_strength: Math.round(currentStrength),
      new_strength: Math.round(newStrength),
      boost,
    });
    totalBoost = 1;
  }

  // Log study activity
  const subjectId = minorRisk[0]?.subject_id || topics[0]?.subject_id || null;
  await adminClient.from("study_logs").insert({
    user_id: user.id,
    subject_id: subjectId,
    duration_minutes: 1,
    study_mode: "fix",
    confidence_level: "high",
    notes: `Risk Shield: ${protectedTopics.length} topics protected, +${totalBoost}% total boost`,
  });

  // Track ML event (non-blocking)
  adminClient.from("ml_events").insert({
    user_id: user.id,
    event_type: "risk_shield_activated",
    event_category: "memory",
    payload: {
      topics_protected: protectedTopics.length,
      total_boost: totalBoost,
      protected_topics: protectedTopics.map(t => ({ name: t.topic_name, boost: t.boost })),
    },
  }).then(() => {}, () => {});

  // Calculate overall shield stats
  const totalTopics = topics.length;
  const stillAtRisk = topics.filter((t: any) => {
    const s = Number(t.memory_strength) || 0;
    const boosted = protectedTopics.find(p => p.topic_id === t.id);
    const effective = boosted ? boosted.new_strength : s;
    return effective < 70;
  }).length;

  return json({
    success: true,
    data: {
      shield_activated: true,
      protected_topics: protectedTopics,
      total_boost: totalBoost,
      summary: {
        topics_protected: protectedTopics.length,
        total_topics: totalTopics,
        still_at_risk: stillAtRisk,
        shield_coverage: totalTopics > 0
          ? Math.round(((totalTopics - stillAtRisk) / totalTopics) * 100)
          : 100,
      },
      result_message: protectedTopics.length > 0
        ? `Shield Active 🛡️ — ${protectedTopics.length} topic${protectedTopics.length !== 1 ? "s" : ""} protected`
        : "All topics are already safe! 🎉",
      stability_gain: `+${totalBoost}% stability`,
      streak_preserved: true,
      next_shield_available_in: "24 hours",
    },
  });
}

// ─── ROUTE: status ───
// Returns current shield status without making changes
async function handleStatus(body: any, userClient: any) {
  const user = await getUser(userClient);
  if (!user) return json({ error: "Unauthorized" }, 401);

  // Count topics by risk level
  const { data: topics } = await userClient
    .from("topics")
    .select("id, name, memory_strength")
    .eq("user_id", user.id)
    .is("deleted_at", null);

  const all = topics || [];
  const atRisk = all.filter((t: any) => Number(t.memory_strength) < 70);
  const critical = all.filter((t: any) => Number(t.memory_strength) < 30);

  // Check last shield activation
  const { data: lastShield } = await userClient
    .from("study_logs")
    .select("created_at")
    .eq("user_id", user.id)
    .eq("study_mode", "fix")
    .ilike("notes", "%Risk Shield%")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastActivation = lastShield?.created_at || null;
  const hoursSince = lastActivation
    ? (Date.now() - new Date(lastActivation).getTime()) / (1000 * 60 * 60)
    : 999;

  // Check shield streak
  const { data: recentLogs } = await userClient
    .from("study_logs")
    .select("created_at")
    .eq("user_id", user.id)
    .eq("study_mode", "fix")
    .ilike("notes", "%Risk Shield%")
    .order("created_at", { ascending: false })
    .limit(30);

  let streak = 0;
  if (recentLogs && recentLogs.length > 0) {
    const dates = [...new Set(recentLogs.map((l: any) => new Date(l.created_at).toDateString()))];
    const today = new Date();
    for (let i = 0; i < dates.length; i++) {
      const expected = new Date(today);
      expected.setDate(expected.getDate() - i);
      if (dates.includes(expected.toDateString())) {
        streak++;
      } else {
        break;
      }
    }
  }

  return json({
    success: true,
    data: {
      shield_available: hoursSince >= 24 || !lastActivation,
      last_activation: lastActivation,
      hours_since_activation: Math.round(hoursSince),
      cooldown_remaining_hours: Math.max(0, Math.round(24 - hoursSince)),
      shield_streak: streak,
      risk_summary: {
        total_topics: all.length,
        at_risk: atRisk.length,
        critical: critical.length,
        safe: all.length - atRisk.length,
        shield_coverage: all.length > 0
          ? Math.round(((all.length - atRisk.length) / all.length) * 100)
          : 100,
      },
      top_at_risk: atRisk.slice(0, 5).map((t: any) => ({
        topic_id: t.id,
        topic_name: t.name,
        current_strength: Math.round(Number(t.memory_strength) || 0),
      })),
    },
  });
}

// ─── ROUTE: history ───
// Returns past shield activations
async function handleHistory(body: any, userClient: any) {
  const user = await getUser(userClient);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const limit = Math.min(body.limit || 10, 50);

  const { data: logs } = await userClient
    .from("study_logs")
    .select("id, created_at, notes, duration_minutes")
    .eq("user_id", user.id)
    .eq("study_mode", "fix")
    .ilike("notes", "%Risk Shield%")
    .order("created_at", { ascending: false })
    .limit(limit);

  const activations = (logs || []).map((l: any) => {
    // Parse notes like "Risk Shield: 3 topics protected, +5% total boost"
    const topicsMatch = l.notes?.match(/(\d+) topics? protected/);
    const boostMatch = l.notes?.match(/\+(\d+)% total boost/);
    return {
      id: l.id,
      activated_at: l.created_at,
      topics_protected: topicsMatch ? parseInt(topicsMatch[1]) : 0,
      total_boost: boostMatch ? parseInt(boostMatch[1]) : 0,
      duration_minutes: l.duration_minutes,
    };
  });

  return json({
    success: true,
    data: {
      total_activations: activations.length,
      activations,
    },
  });
}

// ─── MAIN ROUTER ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userClient, adminClient } = getClients(req);

    let body: Record<string, any> = {};
    if (req.method !== "GET" && req.method !== "HEAD") {
      const raw = await req.text();
      if (raw.trim()) body = JSON.parse(raw);
    }

    const action = String(
      body.action || req.headers.get("x-route") || new URL(req.url).searchParams.get("action") || "init"
    );

    switch (action) {
      case "init":
        return await handleInit(body, userClient);
      case "activate":
        return await handleActivate(body, userClient, adminClient);
      case "status":
        return await handleStatus(body, userClient);
      case "history":
        return await handleHistory(body, userClient);
      default:
        return json({
          error: `Unknown action: ${action}`,
          available_actions: ["init", "activate", "status", "history"],
        }, 400);
    }
  } catch (e) {
    console.error("risk-shield error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
