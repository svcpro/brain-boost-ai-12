// ════════════════════════════════════════════════════════════════════
// FORGETTING CURVE 2.0 — Ultra-Advanced Neural Memory Engine
// ────────────────────────────────────────────────────────────────────
// Replaces the legacy 5-factor Ebbinghaus model with a 12-factor neural
// decay model inspired by DSR (Difficulty / Stability / Retrievability)
// + circadian rhythms + topic interference + cognitive load.
//
//   R(t) = exp( -t / S_eff )
//   S_eff = S_base · π( boost_i ) / π( penalty_j )
//
// 12 factors feeding S_eff:
//   1. Initial Mastery (high-confidence ratio)
//   2. Recall Strength (review count × recency)
//   3. Spacing Efficiency (gap-vs-stability adherence)
//   4. Latency / Encoding Speed
//   5. Error Severity (low-confidence cluster)
//   6. Time Gap (raw hours since last review)
//   7. Streak Momentum (consecutive correct sessions)
//   8. Topic Difficulty (per-subject baseline difficulty)
//   9. Interference (concurrent topics in same subject)
//  10. Circadian Match (best vs current hour for user)
//  11. Cognitive Load (study volume in last 24h)
//  12. Sleep Proxy (gap from last late-night session)
//
// Routes:
//   dashboard, topic-detail, simulate (what-if), interventions,
//   ai-narrative, fix-init, fix-questions, fix-submit, fix-complete
// ════════════════════════════════════════════════════════════════════

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

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// ─── 12-Factor Neural Decay Model ────────────────────────────────────
function computeNeuralDecay(
  topic: any,
  studyLogs: any[],
  allTopicsInSubject: any[],
  userContext: { bestStudyHour: number; recentLoadMinutes: number; lateNightSessions: number },
  now: Date,
) {
  const tLogs = studyLogs.filter((l: any) => l.topic_id === topic.id);
  const totalLogs = Math.max(tLogs.length, 1);

  // 1. Initial Mastery
  const highConfCount = tLogs.filter((l: any) => l.confidence_level === "high").length;
  const initialMastery = clamp01(highConfCount / totalLogs);

  // 2. Recall Strength
  const reviewCount = tLogs.length;
  const lastReview = tLogs[0] ? new Date(tLogs[0].created_at) : new Date(topic.created_at || now);
  const hoursSinceReview = Math.max(0, (now.getTime() - lastReview.getTime()) / 36e5);
  const recencyWeight = Math.exp(-hoursSinceReview / 168);
  const recallStrength = clamp01((reviewCount * recencyWeight) / 10);

  // 3. Spacing Efficiency — were past gaps near the optimal stability window?
  let spacingScore = 0.5;
  if (tLogs.length >= 2) {
    const gaps: number[] = [];
    for (let i = 0; i < tLogs.length - 1; i++) {
      const a = new Date(tLogs[i].created_at).getTime();
      const b = new Date(tLogs[i + 1].created_at).getTime();
      gaps.push(Math.abs(a - b) / 36e5);
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    // Sweet spot: 24–96h. Penalize cramming (<6h) and abandonment (>240h).
    if (avgGap < 6) spacingScore = 0.3;
    else if (avgGap > 240) spacingScore = 0.35;
    else spacingScore = clamp01(1 - Math.abs(avgGap - 60) / 180);
  }

  // 4. Latency Factor
  const avgLatency = tLogs.length > 0
    ? tLogs.reduce((s: number, l: any) => s + (l.duration_minutes || 5), 0) / tLogs.length
    : 10;
  const latencyFactor = clamp01(5 / Math.max(avgLatency, 1));

  // 5. Error Severity
  const recentErrors = tLogs.slice(0, 10).filter((l: any) => l.confidence_level === "low").length;
  const errorSeverity = clamp01(recentErrors / 5);

  // 6. Time Gap (raw)
  const timeGapHours = hoursSinceReview;

  // 7. Streak Momentum — last 5 sessions, count consecutive non-low from newest
  let streakLen = 0;
  for (const l of tLogs.slice(0, 5)) {
    if (l.confidence_level === "low") break;
    streakLen++;
  }
  const streakMomentum = clamp01(streakLen / 5);

  // 8. Topic Difficulty — proxy from average confidence (lower confidence = harder)
  const lowRatio = tLogs.filter((l: any) => l.confidence_level === "low").length / totalLogs;
  const topicDifficulty = clamp01(0.3 + lowRatio * 0.7); // 0=easy, 1=very hard

  // 9. Interference — many concurrent topics in same subject competing for memory
  const subjectTopicCount = allTopicsInSubject.length;
  const interference = clamp01((subjectTopicCount - 1) / 20); // 1 topic=0, 21+=1

  // 10. Circadian Match — current hour vs user's best study hour
  const currentHour = now.getHours();
  const hourDiff = Math.min(
    Math.abs(currentHour - userContext.bestStudyHour),
    24 - Math.abs(currentHour - userContext.bestStudyHour),
  );
  const circadianMatch = clamp01(1 - hourDiff / 12);

  // 11. Cognitive Load — heavy load in last 24h reduces consolidation
  const cognitiveLoad = clamp01(userContext.recentLoadMinutes / 240); // 240 min in 24h = saturated

  // 12. Sleep Proxy — late-night sessions degrade memory
  const sleepPenalty = clamp01(userContext.lateNightSessions / 5);

  // ─── Stability Composition ─────────────────────────────────────────
  const baseStability = 24;
  const masteryBoost   = 1 + initialMastery * 3;
  const reviewBoost    = 1 + Math.log2(reviewCount + 1) * 0.5;
  const spacingBoost   = 1 + spacingScore * 0.6;
  const streakBoost    = 1 + streakMomentum * 0.4;
  const latencyBoost   = 1 + latencyFactor * 0.3;
  const circadianBoost = 1 + circadianMatch * 0.2;

  const errorPenalty       = 1 + errorSeverity * 0.5;
  const difficultyPenalty  = 1 + topicDifficulty * 0.6;
  const interferencePenalty= 1 + interference * 0.4;
  const loadPenalty        = 1 + cognitiveLoad * 0.3;
  const sleepPenaltyMul    = 1 + sleepPenalty * 0.4;

  const stability =
    (baseStability * masteryBoost * reviewBoost * spacingBoost * streakBoost * latencyBoost * circadianBoost) /
    (errorPenalty * difficultyPenalty * interferencePenalty * loadPenalty * sleepPenaltyMul);

  const decayRate = 1 / stability;
  const predictedRetention = clamp01(Math.exp(-timeGapHours / stability));

  // Decay velocity: retention loss over the next 24h
  const future = clamp01(Math.exp(-(timeGapHours + 24) / stability));
  const decayVelocity = round4(predictedRetention - future);

  // Personalized review thresholds (advanced learners can wait longer)
  const masteryShift = (initialMastery - 0.5) * 0.1; // ±0.05
  const reviewTarget = clamp01(0.7 + masteryShift); // 0.65–0.75
  const hoursUntilTarget = -stability * Math.log(reviewTarget);
  const nextOptimalReview = new Date(lastReview.getTime() + hoursUntilTarget * 36e5);

  return {
    initialMastery, recallStrength, spacingScore, latencyFactor, errorSeverity,
    streakMomentum, topicDifficulty, interference, circadianMatch, cognitiveLoad,
    sleepPenalty, timeGapHours,
    stability, decayRate, predictedRetention, decayVelocity,
    hoursSinceReview, reviewCount, hoursUntilTarget, nextOptimalReview, lastReview,
    avgLatency, reviewTarget,
  };
}

function deriveUserContext(allLogs: any[]) {
  // Best hour — mode of high-confidence session hours
  const hourBins = new Array(24).fill(0);
  let lateNight = 0;
  let recentLoad = 0;
  const now = Date.now();
  for (const l of allLogs) {
    const ts = new Date(l.created_at);
    const h = ts.getHours();
    if (l.confidence_level === "high") hourBins[h] += 1;
    if (h >= 0 && h < 5) lateNight++;
    if (now - ts.getTime() < 24 * 36e5) recentLoad += l.duration_minutes || 0;
  }
  let bestStudyHour = 18;
  let bestCount = -1;
  for (let h = 0; h < 24; h++) {
    if (hourBins[h] > bestCount) { bestCount = hourBins[h]; bestStudyHour = h; }
  }
  return { bestStudyHour, recentLoadMinutes: recentLoad, lateNightSessions: lateNight };
}

function riskFromRetention(r: number) {
  if (r < 0.3) return "critical";
  if (r < 0.5) return "high";
  if (r < 0.7) return "medium";
  return "low";
}

// ─── ROUTE: dashboard ───
async function handleDashboard(body: any, userClient: any, adminClient: any) {
  const user = await getUser(userClient);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const [topicsRes, logsRes] = await Promise.all([
    userClient.from("topics").select("*, subjects(name)").eq("user_id", user.id).is("deleted_at", null),
    userClient.from("study_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(500),
  ]);

  const topics = topicsRes.data || [];
  const studyLogs = logsRes.data || [];

  if (topics.length === 0) {
    return json({
      success: true,
      data: emptyDashboard(),
    });
  }

  const userContext = deriveUserContext(studyLogs);
  const now = new Date();
  const topicDecays: any[] = [];

  // Group topics by subject for interference
  const bySubject: Record<string, any[]> = {};
  for (const t of topics) {
    const k = t.subject_id || "_none";
    (bySubject[k] = bySubject[k] || []).push(t);
  }

  for (const topic of topics) {
    const sibling = bySubject[topic.subject_id || "_none"] || [];
    const f = computeNeuralDecay(topic, studyLogs, sibling, userContext, now);

    const reasoning =
      `Stability ${f.stability.toFixed(0)}h. Mastery ${(f.initialMastery * 100).toFixed(0)}%, ` +
      `${f.reviewCount} reviews, spacing ${(f.spacingScore * 100).toFixed(0)}%, ` +
      `interference ${(f.interference * 100).toFixed(0)}%. ` +
      (f.predictedRetention < 0.5 ? "⚠️ Below 50% — rescue queued." : "");

    topicDecays.push({
      topic_id: topic.id,
      topic_name: topic.name,
      subject_name: topic.subjects?.name || null,
      subject_id: topic.subject_id || null,
      memory_strength: Math.round(Number(topic.memory_strength) || 0),
      decay_rate: parseFloat(f.decayRate.toFixed(6)),
      decay_velocity_24h: f.decayVelocity,
      predicted_retention: round4(f.predictedRetention),
      predicted_retention_pct: Math.round(f.predictedRetention * 100),
      next_optimal_review: f.nextOptimalReview.toISOString(),
      hours_until_optimal_review: Math.max(0, round2(f.hoursUntilTarget - f.hoursSinceReview)),
      hours_since_last_review: round2(f.hoursSinceReview),
      last_revision_date: topic.last_revision_date || null,
      stability_hours: round2(f.stability),
      review_count: f.reviewCount,
      risk_level: riskFromRetention(f.predictedRetention),
      review_urgency: f.hoursUntilTarget - f.hoursSinceReview <= 0 ? "now" : f.hoursUntilTarget - f.hoursSinceReview <= 24 ? "today" : "scheduled",
      ai_reasoning: reasoning,
      factors: {
        initial_mastery: round4(f.initialMastery),
        recall_strength: round4(f.recallStrength),
        spacing_efficiency: round4(f.spacingScore),
        latency_factor: round4(f.latencyFactor),
        error_severity: round4(f.errorSeverity),
        streak_momentum: round4(f.streakMomentum),
        topic_difficulty: round4(f.topicDifficulty),
        interference: round4(f.interference),
        circadian_match: round4(f.circadianMatch),
        cognitive_load: round4(f.cognitiveLoad),
        sleep_penalty: round4(f.sleepPenalty),
        time_gap_hours: round2(f.timeGapHours),
      },
    });
  }

  topicDecays.sort((a, b) => a.predicted_retention - b.predicted_retention);

  const overallRetention = topicDecays.reduce((s, t) => s + t.predicted_retention, 0) / topicDecays.length;
  const urgentCount  = topicDecays.filter(t => t.predicted_retention < 0.5).length;
  const warningCount = topicDecays.filter(t => t.predicted_retention >= 0.5 && t.predicted_retention < 0.7).length;
  const safeCount    = topicDecays.filter(t => t.predicted_retention >= 0.7).length;

  // Memory landscape heatmap (subject × risk bucket)
  const heatmap: Record<string, {
    critical: number; high: number; medium: number; low: number; total: number;
    retention_sum: number; urgent_topics: string[];
  }> = {};
  for (const t of topicDecays) {
    const k = t.subject_name || "Unsorted";
    heatmap[k] = heatmap[k] || { critical: 0, high: 0, medium: 0, low: 0, total: 0, retention_sum: 0, urgent_topics: [] };
    heatmap[k][t.risk_level as "critical" | "high" | "medium" | "low"]++;
    heatmap[k].total++;
    heatmap[k].retention_sum += t.predicted_retention;
    if (t.predicted_retention < 0.5 && heatmap[k].urgent_topics.length < 3) {
      heatmap[k].urgent_topics.push(t.topic_name);
    }
  }
  const memoryLandscape = Object.entries(heatmap).map(([subject, b]) => ({
    subject,
    critical: b.critical, high: b.high, medium: b.medium, low: b.low, total: b.total,
    avg_retention_pct: Math.round((b.retention_sum / Math.max(b.total, 1)) * 100),
    urgent_topics: b.urgent_topics,
    // Weighted health: low=100, medium=70, high=35, critical=0
    health_score: Math.round(((b.low * 100 + b.medium * 70 + b.high * 35) / Math.max(b.total, 1))),
  })).sort((a, b) => a.health_score - b.health_score);

  // Autonomous interventions — fire-and-forget for newly critical topics
  fireInterventions(user.id, topicDecays, adminClient).catch(() => {});

  // Risk alert
  const riskAlert = urgentCount > 0 ? {
    type: "warning",
    message: `${urgentCount} topic${urgentCount > 1 ? "s" : ""} below 50% — auto-rescue queued`,
    urgent_topics: topicDecays.filter(t => t.predicted_retention < 0.5).map(t => t.topic_name).slice(0, 5),
  } : null;

  return json({
    success: true,
    data: {
      overall_retention: round4(overallRetention),
      overall_retention_pct: Math.round(overallRetention * 100),
      total_topics: topicDecays.length,
      urgent_count: urgentCount,
      warning_count: warningCount,
      safe_count: safeCount,
      topic_decays: topicDecays,
      memory_landscape: memoryLandscape,
      risk_alert: riskAlert,
      user_context: {
        best_study_hour: userContext.bestStudyHour,
        recent_load_minutes_24h: userContext.recentLoadMinutes,
        late_night_sessions: userContext.lateNightSessions,
      },
      model_version: "2.0",
      model_name: "Forgetting Curve 2.0",
      model_description: "12-Factor Neural Decay Model · DSR + Circadian + Interference",
      factor_count: 12,
    },
  });
}

function emptyDashboard() {
  return {
    overall_retention: 0,
    overall_retention_pct: 0,
    total_topics: 0,
    urgent_count: 0,
    warning_count: 0,
    safe_count: 0,
    topic_decays: [],
    memory_landscape: [],
    risk_alert: null,
    user_context: { best_study_hour: 18, recent_load_minutes_24h: 0, late_night_sessions: 0 },
    model_version: "2.0",
    model_name: "Forgetting Curve 2.0",
    model_description: "12-Factor Neural Decay Model",
    factor_count: 12,
  };
}

// ─── Autonomous interventions ───
async function fireInterventions(userId: string, decays: any[], admin: any) {
  const candidates = decays.filter(t =>
    t.predicted_retention < 0.5 || t.decay_velocity_24h > 0.15,
  );
  if (candidates.length === 0) return;

  // Skip if we already queued one in the last 6h for the same topic
  const sixAgo = new Date(Date.now() - 6 * 36e5).toISOString();
  const { data: recent } = await admin
    .from("fc2_interventions")
    .select("topic_id")
    .eq("user_id", userId)
    .gte("created_at", sixAgo);
  const recentSet = new Set((recent || []).map((r: any) => r.topic_id));

  const toInsert = candidates
    .filter(t => !recentSet.has(t.topic_id))
    .slice(0, 5)
    .map(t => ({
      user_id: userId,
      topic_id: t.topic_id,
      topic_name: t.topic_name,
      subject_name: t.subject_name,
      intervention_type: t.predicted_retention < 0.3 ? "rescue_card" : "micro_quiz",
      trigger_reason: t.decay_velocity_24h > 0.15 ? "rapid_decay" : "retention_below_threshold",
      predicted_retention: round2(t.predicted_retention * 100),
      risk_score: round2((1 - t.predicted_retention) * 100),
      status: "queued",
      payload: {
        urgency: t.review_urgency,
        decay_velocity_24h: t.decay_velocity_24h,
        recommended_action: t.predicted_retention < 0.3 ? "Take a 3-min rescue quiz now" : "Schedule micro-review today",
      },
    }));

  if (toInsert.length === 0) return;

  await admin.from("fc2_interventions").insert(toInsert);

  // Also log risk events for audit
  const riskInserts = candidates.slice(0, 5).map(t => ({
    user_id: userId,
    topic_id: t.topic_id,
    topic_name: t.topic_name,
    new_risk: t.risk_level,
    predicted_retention: round2(t.predicted_retention * 100),
    decay_velocity: t.decay_velocity_24h,
    factors: t.factors,
  }));
  await admin.from("fc2_risk_events").insert(riskInserts);
}

// ─── ROUTE: interventions ───
async function handleInterventions(body: any, userClient: any) {
  const user = await getUser(userClient);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { data } = await userClient
    .from("fc2_interventions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return json({ success: true, data: { interventions: data || [] } });
}

// ─── ROUTE: simulate (what-if) ───
async function handleSimulate(body: any, userClient: any) {
  const user = await getUser(userClient);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { topic_id, scenario } = body;
  if (!topic_id || !scenario) return json({ error: "topic_id and scenario required" }, 400);

  const [topicRes, logsRes, allTopicsRes] = await Promise.all([
    userClient.from("topics").select("*, subjects(name)").eq("id", topic_id).maybeSingle(),
    userClient.from("study_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(300),
    userClient.from("topics").select("*").eq("user_id", user.id).is("deleted_at", null),
  ]);

  const topic = topicRes.data;
  if (!topic) return json({ error: "Topic not found" }, 404);

  const allLogs = logsRes.data || [];
  const allTopics = allTopicsRes.data || [];
  const sibling = allTopics.filter((t: any) => t.subject_id === topic.subject_id);
  const userCtx = deriveUserContext(allLogs);
  const now = new Date();

  // Baseline
  const baseline = computeNeuralDecay(topic, allLogs, sibling, userCtx, now);

  // Scenarios shift the relevant factors and recompute
  const simulated = { ...allLogs };
  const synth: any[] = [...allLogs];
  let scenarioLabel = scenario;
  if (scenario === "review_now") {
    synth.unshift({
      topic_id: topic.id, created_at: now.toISOString(),
      duration_minutes: 5, confidence_level: "high",
    });
    scenarioLabel = "Review now (5-min high-confidence session)";
  } else if (scenario === "review_3x_this_week") {
    for (let i = 0; i < 3; i++) {
      synth.unshift({
        topic_id: topic.id,
        created_at: new Date(now.getTime() - i * 48 * 36e5).toISOString(),
        duration_minutes: 5, confidence_level: "high",
      });
    }
    scenarioLabel = "Review 3× this week (spaced)";
  } else if (scenario === "skip_7_days") {
    // Simulate forward by 7 days
    const sevenLater = new Date(now.getTime() + 7 * 24 * 36e5);
    const f = computeNeuralDecay(topic, allLogs, sibling, userCtx, sevenLater);
    return json({
      success: true,
      data: {
        scenario, scenario_label: "Skip review for 7 days",
        baseline: scenarioSnapshot(baseline),
        simulated: scenarioSnapshot(f),
        retention_delta: round4(f.predictedRetention - baseline.predictedRetention),
      },
    });
  }

  const f = computeNeuralDecay(topic, synth, sibling, userCtx, now);
  return json({
    success: true,
    data: {
      scenario,
      scenario_label: scenarioLabel,
      baseline: scenarioSnapshot(baseline),
      simulated: scenarioSnapshot(f),
      retention_delta: round4(f.predictedRetention - baseline.predictedRetention),
    },
  });
}

function scenarioSnapshot(f: any) {
  return {
    predicted_retention: round4(f.predictedRetention),
    predicted_retention_pct: Math.round(f.predictedRetention * 100),
    stability_hours: round2(f.stability),
    decay_rate: parseFloat(f.decayRate.toFixed(6)),
    risk_level: riskFromRetention(f.predictedRetention),
  };
}

// ─── ROUTE: ai-narrative (hybrid: lite for batch scoring, flash for narrative) ───
async function handleAINarrative(body: any, userClient: any, adminClient: any) {
  const user = await getUser(userClient);
  if (!user) return json({ error: "Unauthorized" }, 401);

  // Cache check
  const { data: cached } = await adminClient
    .from("fc2_ai_insights")
    .select("content, generated_at, expires_at")
    .eq("user_id", user.id)
    .eq("insight_key", "overall_narrative")
    .maybeSingle();

  if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
    return json({ success: true, data: { ...cached.content, cached: true } });
  }

  // Pull fresh dashboard summary
  const [topicsRes, logsRes] = await Promise.all([
    userClient.from("topics").select("*, subjects(name)").eq("user_id", user.id).is("deleted_at", null),
    userClient.from("study_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(300),
  ]);
  const topics = topicsRes.data || [];
  const logs = logsRes.data || [];
  if (topics.length === 0) {
    return json({ success: true, data: { narrative: "Add a few topics to unlock your personalized memory analysis.", actions: [] } });
  }

  const userCtx = deriveUserContext(logs);
  const now = new Date();
  const bySubject: Record<string, any[]> = {};
  for (const t of topics) {
    const k = t.subject_id || "_none";
    (bySubject[k] = bySubject[k] || []).push(t);
  }

  const decays = topics.map((t: any) => {
    const sib = bySubject[t.subject_id || "_none"] || [];
    const f = computeNeuralDecay(t, logs, sib, userCtx, now);
    return {
      name: t.name,
      subject: t.subjects?.name || "—",
      retention: Math.round(f.predictedRetention * 100),
      risk: riskFromRetention(f.predictedRetention),
      velocity: f.decayVelocity,
    };
  }).sort((a: any, b: any) => a.retention - b.retention);

  const top5Worst = decays.slice(0, 5);
  const overall = Math.round(decays.reduce((s: number, d: any) => s + d.retention, 0) / decays.length);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ success: true, data: { narrative: `Overall retention ${overall}%. ${top5Worst.length} topics need review.`, actions: [] } });

  const prompt = `You are a sharp, empathetic study coach. Write a short personalized memory analysis (max 90 words, no markdown, no headings) for this learner:

- Overall retention: ${overall}%
- Best study hour: ${userCtx.bestStudyHour}:00
- Late-night sessions (last 30): ${userCtx.lateNightSessions}
- Cognitive load last 24h: ${userCtx.recentLoadMinutes} min
- Top 5 weakest topics: ${top5Worst.map((t: any) => `${t.name} (${t.retention}%, ${t.risk})`).join(", ")}

End with EXACTLY 3 concrete next-step actions, each ≤ 8 words, prefixed with "→".`;

  let narrative = `Overall retention ${overall}%. ${top5Worst.length} topics need review.`;
  let actions: string[] = [];
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an elite study coach. Be specific, warm, brief." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      }),
    });
    if (resp.ok) {
      const ai = await resp.json();
      const txt = (ai.choices?.[0]?.message?.content || "").trim();
      if (txt) {
        const lines = txt.split("\n").map((l: string) => l.trim()).filter(Boolean);
        const actionLines = lines.filter((l: string) => l.startsWith("→"));
        actions = actionLines.map((l: string) => l.replace(/^→\s*/, ""));
        narrative = lines.filter((l: string) => !l.startsWith("→")).join(" ").trim() || txt;
      }
    }
  } catch { /* fall back to baseline narrative */ }

  const content = { narrative, actions, overall_retention_pct: overall, generated_at: now.toISOString() };
  await adminClient.from("fc2_ai_insights").upsert({
    user_id: user.id,
    insight_key: "overall_narrative",
    content,
    model_used: "google/gemini-2.5-flash",
    generated_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 6 * 36e5).toISOString(),
  });

  return json({ success: true, data: { ...content, cached: false } });
}

// ─── ROUTE: topic-detail ───
async function handleTopicDetail(body: any, userClient: any) {
  const user = await getUser(userClient);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { topic_id, topic_name } = body;
  if (!topic_id && !topic_name) return json({ error: "topic_id or topic_name required" }, 400);

  let query = userClient.from("topics").select("*, subjects(name)").eq("user_id", user.id).is("deleted_at", null);
  if (topic_id) query = query.eq("id", topic_id);
  else query = query.eq("name", topic_name);

  const { data: topic } = await query.maybeSingle();
  if (!topic) return json({ error: "Topic not found" }, 404);

  const [logsRes, allTopicsRes, allLogsRes] = await Promise.all([
    userClient.from("study_logs").select("id, created_at, duration_minutes, confidence_level, study_mode, notes, topic_id").eq("user_id", user.id).eq("topic_id", topic.id).order("created_at", { ascending: false }).limit(50),
    userClient.from("topics").select("id, subject_id").eq("user_id", user.id).is("deleted_at", null),
    userClient.from("study_logs").select("created_at, confidence_level, duration_minutes, topic_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(300),
  ]);

  const logs = logsRes.data || [];
  const allTopics = allTopicsRes.data || [];
  const allLogs = allLogsRes.data || [];
  const sibling = allTopics.filter((t: any) => t.subject_id === topic.subject_id);
  const ctx = deriveUserContext(allLogs);
  const now = new Date();
  const f = computeNeuralDecay(topic, allLogs, sibling, ctx, now);

  // Retention timeline (next 7 days)
  const retentionTimeline: any[] = [];
  for (let h = 0; h <= 168; h += 12) {
    const r = clamp01(Math.exp(-(f.hoursSinceReview + h) / f.stability));
    retentionTimeline.push({
      hours_from_now: h,
      predicted_retention: round4(r),
      predicted_retention_pct: Math.round(r * 100),
      label: h === 0 ? "Now" : h < 24 ? `${h}h` : `${Math.round(h / 24)}d`,
    });
  }

  const totalSessions = logs.length;
  const totalMinutes = logs.reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0);
  const confidenceDist = {
    high: logs.filter((l: any) => l.confidence_level === "high").length,
    medium: logs.filter((l: any) => l.confidence_level === "medium").length,
    low: logs.filter((l: any) => l.confidence_level === "low").length,
  };

  const retPct = Math.round(f.predictedRetention * 100);
  const fixDifficulty = retPct < 30 ? "easy" : retPct < 60 ? "medium" : "hard";

  return json({
    success: true,
    data: {
      topic_id: topic.id,
      topic_name: topic.name,
      subject_name: topic.subjects?.name || null,
      memory_strength: Math.round(Number(topic.memory_strength) || 0),
      predicted_retention: round4(f.predictedRetention),
      predicted_retention_pct: retPct,
      decay_rate: parseFloat(f.decayRate.toFixed(6)),
      decay_velocity_24h: f.decayVelocity,
      stability_hours: round2(f.stability),
      hours_since_last_review: round2(f.hoursSinceReview),
      last_revision_date: topic.last_revision_date,
      next_optimal_review: f.nextOptimalReview.toISOString(),
      hours_until_optimal_review: Math.max(0, round2(f.hoursUntilTarget - f.hoursSinceReview)),
      risk_level: riskFromRetention(f.predictedRetention),
      factors: {
        initial_mastery:    { value: round4(f.initialMastery),    label: "Initial Mastery",     description: "High-confidence study sessions" },
        recall_strength:    { value: round4(f.recallStrength),    label: "Recall Strength",     description: "Review frequency × recency" },
        spacing_efficiency: { value: round4(f.spacingScore),      label: "Spacing Efficiency",  description: "How well-spaced your reviews are" },
        latency_factor:     { value: round4(f.latencyFactor),     label: "Encoding Speed",      description: "Faster study = stronger encoding" },
        error_severity:     { value: round4(f.errorSeverity),     label: "Error Severity",      description: "Recent low-confidence answers" },
        streak_momentum:    { value: round4(f.streakMomentum),    label: "Streak Momentum",     description: "Consecutive good sessions" },
        topic_difficulty:   { value: round4(f.topicDifficulty),   label: "Topic Difficulty",    description: "Inferred from your error rate" },
        interference:       { value: round4(f.interference),      label: "Interference",        description: "Competing topics in same subject" },
        circadian_match:    { value: round4(f.circadianMatch),    label: "Circadian Match",     description: "Your best learning hours" },
        cognitive_load:     { value: round4(f.cognitiveLoad),     label: "Cognitive Load",      description: "Study volume in last 24h" },
        sleep_penalty:      { value: round4(f.sleepPenalty),      label: "Sleep Quality",       description: "Late-night session impact" },
        time_gap_hours:     { value: round2(f.timeGapHours),      label: "Time Gap (h)",        description: "Hours since last review" },
      },
      retention_timeline: retentionTimeline,
      study_history: {
        total_sessions: totalSessions,
        total_minutes: totalMinutes,
        confidence_distribution: confidenceDist,
        recent_sessions: logs.slice(0, 5).map((l: any) => ({
          id: l.id, date: l.created_at, duration_minutes: l.duration_minutes,
          confidence: l.confidence_level, mode: l.study_mode, notes: l.notes,
        })),
      },
      fix_config: {
        difficulty: fixDifficulty,
        question_count: 5,
        time_limit_seconds: 180,
        estimated_boost: Math.round((1 - f.predictedRetention) * 30),
      },
      model_version: "2.0",
    },
  });
}

// ─── ROUTE: fix-init ───
async function handleFixInit(body: any, userClient: any) {
  const user = await getUser(userClient);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { topic_name, subject_name, retention_pct } = body;
  if (!topic_name) return json({ error: "topic_name is required" }, 400);

  const retPct = typeof retention_pct === "number" ? retention_pct : 50;
  const difficulty = retPct < 30 ? "easy" : retPct < 60 ? "medium" : "hard";

  const { data: topicRow } = await userClient
    .from("topics")
    .select("id, name, memory_strength, last_revision_date, decay_rate")
    .eq("user_id", user.id).eq("name", topic_name).is("deleted_at", null).maybeSingle();

  let recentSessions = 0;
  let totalStudyMinutes = 0;
  if (topicRow) {
    const { data: logs } = await userClient
      .from("study_logs")
      .select("duration_minutes")
      .eq("user_id", user.id).eq("topic_id", topicRow.id)
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
    recentSessions = logs?.length || 0;
    totalStudyMinutes = (logs || []).reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0);
  }

  const currentStrength = topicRow ? Math.round(Number(topicRow.memory_strength) || 0) : 0;

  return json({
    success: true,
    data: {
      session_config: {
        topic_name, subject_name: subject_name || "General", difficulty,
        question_count: 5, time_limit_seconds: 180, session_type: "quick_fix",
      },
      topic_analysis: {
        topic_id: topicRow?.id || null,
        current_memory_strength: currentStrength,
        retention_pct: retPct,
        decay_rate: topicRow?.decay_rate || 0.05,
        last_revision: topicRow?.last_revision_date || null,
        recent_sessions_7d: recentSessions,
        total_study_minutes_7d: totalStudyMinutes,
        risk_level: currentStrength < 30 ? "critical" : currentStrength < 50 ? "high" : currentStrength < 70 ? "medium" : "low",
      },
      analysis_steps: [
        { step: 1, label: "Scanning topic memory", status: "complete" },
        { step: 2, label: "Identifying weak points", status: "complete" },
        { step: 3, label: "Generating targeted questions", status: "complete" },
        { step: 4, label: "Calibrating difficulty", status: "complete" },
      ],
    },
  });
}

// ─── ROUTE: fix-questions (uses cheap lite model for question generation) ───
async function handleFixQuestions(body: any, userClient: any) {
  const user = await getUser(userClient);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { topic_name, subject_name, retention_pct, count, difficulty: overrideDiff } = body;
  if (!topic_name) return json({ error: "topic_name is required" }, 400);

  const retPct = typeof retention_pct === "number" ? retention_pct : 50;
  const difficulty = overrideDiff || (retPct < 30 ? "easy" : retPct < 60 ? "medium" : "hard");
  const qCount = Math.min(Math.max(count || 5, 3), 10);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "AI not configured" }, 500);

  const prompt = `Generate ${qCount} multiple-choice questions for a student studying "${topic_name}" under subject "${subject_name || "General"}".
Difficulty: ${difficulty} (student's current retention is ${retPct}%).

Return ONLY a valid JSON array, no markdown:
[
  {
    "question": "...",
    "options": ["A text", "B text", "C text", "D text"],
    "correct_index": 0,
    "explanation": "Brief explanation why the correct answer is right",
    "difficulty": "${difficulty}",
    "concept_tag": "micro-concept tested"
  }
]

Rules:
- Exactly 4 options per question
- correct_index is 0-based
- Questions should target weak recall areas for ${difficulty} difficulty
- Explanations must be concise (1-2 sentences)
- Each question tests a distinct concept`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: "You are an expert question generator for competitive exam preparation. Return only valid JSON." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!resp.ok) {
    if (resp.status === 429) return json({ error: "Rate limited. Try again shortly." }, 429);
    if (resp.status === 402) return json({ error: "AI credits exhausted." }, 402);
    return json({ error: "AI generation failed" }, 500);
  }

  const aiData = await resp.json();
  let text = aiData.choices?.[0]?.message?.content || "";
  text = text.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();

  let questions: any[];
  try { questions = JSON.parse(text); }
  catch { return json({ error: "Failed to parse AI response" }, 500); }

  if (!Array.isArray(questions) || questions.length === 0) {
    return json({ error: "No questions generated" }, 500);
  }

  const normalized = questions.map((q: any, i: number) => ({
    question: String(q.question || ""),
    options: Array.isArray(q.options) ? q.options.map(String) : ["A", "B", "C", "D"],
    correct_index: typeof q.correct_index === "number" ? q.correct_index : 0,
    explanation: String(q.explanation || ""),
    difficulty: String(q.difficulty || difficulty),
    concept_tag: String(q.concept_tag || ""),
    question_number: i + 1,
  }));

  return json({
    success: true,
    data: {
      topic_name, subject_name: subject_name || "General",
      difficulty, retention_pct: retPct,
      question_count: normalized.length, time_limit_seconds: 180,
      questions: normalized,
    },
  });
}

// ─── ROUTE: fix-submit ───
async function handleFixSubmit(body: any, userClient: any) {
  const user = await getUser(userClient);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { question_number, selected_index, correct_index, question_text, topic_name } = body;
  if (typeof selected_index !== "number" || typeof correct_index !== "number") {
    return json({ error: "selected_index and correct_index are required" }, 400);
  }

  return json({
    success: true,
    data: {
      question_number: question_number || 1,
      selected_index, correct_index,
      is_correct: selected_index === correct_index,
      topic_name: topic_name || "",
      question_text: question_text || "",
      points_earned: selected_index === correct_index ? 1 : 0,
    },
  });
}

// ─── ROUTE: fix-complete ───
async function handleFixComplete(body: any, userClient: any, adminClient: any) {
  const user = await getUser(userClient);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { topic_name, subject_name, answers, total_questions, time_taken_seconds } = body;
  if (!topic_name || !Array.isArray(answers)) {
    return json({ error: "topic_name and answers array are required" }, 400);
  }

  const totalQ = total_questions || answers.length;
  const correctCount = answers.filter((a: any) => a.selected_index === a.correct_index).length;
  const accuracy = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;
  const memoryBoost = Math.round((correctCount / Math.max(totalQ, 1)) * 30);
  const confidence: string = accuracy >= 80 ? "high" : accuracy >= 50 ? "medium" : "low";
  const subName = subject_name || "General";
  const durationMinutes = time_taken_seconds ? Math.max(1, Math.round(time_taken_seconds / 60)) : 3;

  let { data: subject } = await adminClient
    .from("subjects").select("id").eq("user_id", user.id).eq("name", subName).maybeSingle();
  if (!subject) {
    const { data: newSub } = await adminClient
      .from("subjects").insert({ user_id: user.id, name: subName }).select("id").single();
    subject = newSub;
  }

  let topicId: string | null = null;
  let oldStrength = 0;
  let newStrength = 0;
  if (subject) {
    let { data: topicRow } = await adminClient
      .from("topics").select("id, memory_strength")
      .eq("user_id", user.id).eq("subject_id", subject.id).eq("name", topic_name).maybeSingle();
    if (!topicRow) {
      const initStr = confidence === "high" ? 80 : confidence === "medium" ? 50 : 30;
      const { data: newT } = await adminClient
        .from("topics")
        .insert({ user_id: user.id, subject_id: subject.id, name: topic_name, memory_strength: initStr, last_revision_date: new Date().toISOString() })
        .select("id, memory_strength").single();
      topicRow = newT;
    }
    if (topicRow) {
      topicId = topicRow.id;
      oldStrength = Number(topicRow.memory_strength) || 0;
      newStrength = Math.min(100, oldStrength + memoryBoost);
      await adminClient.from("topics").update({ memory_strength: newStrength, last_revision_date: new Date().toISOString() }).eq("id", topicRow.id);
    }
  }

  await adminClient.from("study_logs").insert({
    user_id: user.id,
    subject_id: subject?.id || null,
    topic_id: topicId,
    duration_minutes: durationMinutes,
    confidence_level: confidence,
    study_mode: "fix",
    notes: `Quick Fix: ${correctCount}/${totalQ} correct (${accuracy}%)`,
  });

  // Mark related interventions as acknowledged
  if (topicId) {
    adminClient
      .from("fc2_interventions")
      .update({ status: "acknowledged", acknowledged_at: new Date().toISOString() })
      .eq("user_id", user.id).eq("topic_id", topicId).eq("status", "queued")
      .then(() => {}, () => {});
  }

  // Invalidate AI narrative cache
  adminClient.from("fc2_ai_insights").delete()
    .eq("user_id", user.id).eq("insight_key", "overall_narrative")
    .then(() => {}, () => {});

  adminClient.from("ml_events").insert({
    user_id: user.id,
    event_type: "quick_fix_complete",
    event_category: "study",
    payload: { topic: topic_name, subject: subName, score: correctCount, total: totalQ, accuracy, memory_boost: memoryBoost, old_strength: oldStrength, new_strength: newStrength, time_taken_seconds: time_taken_seconds || 180 },
  }).then(() => {}, () => {});

  const resultMessage = correctCount === totalQ ? "Perfect! 🎉" : accuracy >= 60 ? "Great job! 💪" : "Keep practicing! 📚";

  return json({
    success: true,
    data: {
      score: correctCount,
      total_questions: totalQ,
      accuracy,
      result_message: resultMessage,
      memory_update: {
        topic_name, subject_name: subName,
        old_strength: oldStrength, new_strength: newStrength,
        memory_boost: memoryBoost, retention_recalculated: true,
      },
      session_stats: {
        duration_minutes: durationMinutes,
        confidence_level: confidence,
        study_mode: "fix",
        time_taken_seconds: time_taken_seconds || 180,
      },
      answer_breakdown: answers.map((a: any, i: number) => ({
        question_number: a.question_number || i + 1,
        selected_index: a.selected_index,
        correct_index: a.correct_index,
        is_correct: a.selected_index === a.correct_index,
      })),
      keep_momentum: {
        suggestion: accuracy >= 80 ? "You've mastered this! Try a harder topic next."
          : accuracy >= 50 ? "Good progress! One more session will solidify this."
          : "Review the explanations and try again in a few hours.",
        next_review_in_hours: accuracy >= 80 ? 48 : accuracy >= 50 ? 24 : 4,
      },
    },
  });
}

// ─── ROUTER ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userClient, adminClient } = getClients(req);

    let body: Record<string, any> = {};
    if (req.method !== "GET" && req.method !== "HEAD") {
      const raw = await req.text();
      if (raw.trim()) body = JSON.parse(raw);
    }

    const action = String(
      body.action || req.headers.get("x-route") || new URL(req.url).searchParams.get("action") || "dashboard",
    );

    switch (action) {
      case "dashboard":       return await handleDashboard(body, userClient, adminClient);
      case "topic-detail":
      case "topic_detail":    return await handleTopicDetail(body, userClient);
      case "simulate":        return await handleSimulate(body, userClient);
      case "interventions":   return await handleInterventions(body, userClient);
      case "ai-narrative":
      case "ai_narrative":    return await handleAINarrative(body, userClient, adminClient);
      case "fix-init":
      case "fix_init":        return await handleFixInit(body, userClient);
      case "fix-questions":
      case "fix_questions":   return await handleFixQuestions(body, userClient);
      case "fix-submit":
      case "fix_submit":      return await handleFixSubmit(body, userClient);
      case "fix-complete":
      case "fix_complete":    return await handleFixComplete(body, userClient, adminClient);
      default:
        return json({
          error: `Unknown action: ${action}`,
          available_actions: [
            "dashboard", "topic-detail", "simulate", "interventions",
            "ai-narrative", "fix-init", "fix-questions", "fix-submit", "fix-complete",
          ],
        }, 400);
    }
  } catch (e) {
    console.error("forgetting-curve error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
