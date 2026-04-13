import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-api-key, api-key, x-api-token, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const adminClient = createClient(supabaseUrl, serviceKey);

/* ────────────────── helpers ────────────────── */

function ok(data: unknown) {
  return new Response(JSON.stringify(sanitize(data)), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(msg: string, status = 400) {
  return new Response(JSON.stringify({ success: false, error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sanitize(obj: unknown): unknown {
  if (obj === null || obj === undefined) return "";
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[k] = sanitize(v);
    }
    return out;
  }
  return obj;
}

/* ────────────── auth helper ────────────── */

async function resolveUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization") || "";
  const apiKeyHeader =
    req.headers.get("x-api-key") || req.headers.get("api-key") || "";

  // JWT
  if (authHeader.startsWith("Bearer ey")) {
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
    } = await adminClient.auth.getUser(token);
    if (user?.id) return user.id;
  }

  // acry_ API key
  if (apiKeyHeader.startsWith("acry_") || authHeader.startsWith("acry_")) {
    const raw = apiKeyHeader || authHeader;
    const prefix = raw.substring(0, 10) + "...";
    const { data } = await adminClient
      .from("api_keys")
      .select("created_by")
      .eq("key_prefix", prefix)
      .eq("is_active", true)
      .maybeSingle();
    if (data?.created_by) return data.created_by;
  }

  return null;
}

/* ────────────── constants ────────────── */

const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500, 7500, 10000];

const BRAIN_LEVELS = [
  { name: "Beginner", icon: "🌱" },
  { name: "Learner", icon: "📖" },
  { name: "Explorer", icon: "🧭" },
  { name: "Thinker", icon: "💡" },
  { name: "Scholar", icon: "🎓" },
  { name: "Master", icon: "🏆" },
  { name: "Genius", icon: "🧠" },
  { name: "Legend", icon: "⚡" },
  { name: "Titan", icon: "👑" },
  { name: "Immortal", icon: "🌟" },
];

const ACHIEVEMENT_DEFS = [
  { id: "first_study", icon: "📖", title: "First Steps", desc: "Complete your first study session", check: (s: any) => s.totalSessions > 0 },
  { id: "streak_3", icon: "🔥", title: "On Fire", desc: "3-day study streak", check: (s: any) => s.streak >= 3 },
  { id: "streak_7", icon: "⚡", title: "Unstoppable", desc: "7-day study streak", check: (s: any) => s.streak >= 7 },
  { id: "streak_30", icon: "👑", title: "Monthly Master", desc: "30-day study streak", check: (s: any) => s.streak >= 30 },
  { id: "topics_10", icon: "🧠", title: "Knowledge Builder", desc: "Add 10 topics", check: (s: any) => s.topicCount >= 10 },
  { id: "topics_50", icon: "📚", title: "Library Builder", desc: "Add 50 topics", check: (s: any) => s.topicCount >= 50 },
  { id: "strength_80", icon: "💪", title: "Strong Mind", desc: "Get any topic above 80%", check: (s: any) => s.maxStrength >= 80 },
  { id: "hours_10", icon: "⏰", title: "10 Hour Club", desc: "Study for 10+ hours total", check: (s: any) => s.totalMinutes >= 600 },
  { id: "hours_50", icon: "🏆", title: "50 Hour Legend", desc: "Study for 50+ hours total", check: (s: any) => s.totalMinutes >= 3000 },
  { id: "level_5", icon: "🌟", title: "Rising Star", desc: "Reach Brain Level 5", check: (s: any) => s.level >= 5 },
];

/* ────────── date helpers ────────── */

function daysAgo(n: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function dayLabel(iso: string) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(iso).getDay()];
}

function formatDate(iso: string) {
  return iso.slice(0, 10);
}

/* ══════════════════════════════════════════════════
   MAIN HANDLER
   ══════════════════════════════════════════════════ */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const userId = await resolveUserId(req);
    if (!userId) return err("Unauthorized", 401);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body.action || "init";

    switch (action) {
      case "init":
        return await handleInit(userId);
      case "profile":
        return await handleProfile(userId);
      case "level":
        return await handleLevel(userId);
      case "identity":
        return await handleIdentity(userId);
      case "subscription":
        return await handleSubscription(userId);
      case "exam_intelligence":
        return await handleExamIntelligence(userId);
      case "evolution":
        return await handleEvolution(userId);
      case "monthly_snapshot":
        return await handleMonthlySnapshot(userId);
      case "achievements":
        return await handleAchievements(userId);
      default:
        return err(`Unknown action: ${action}`);
    }
  } catch (e: any) {
    return err(e.message || "Internal error", 500);
  }
});

/* ══════════════════════════════════════════════════
   ACTION: init — Full You Tab payload
   ══════════════════════════════════════════════════ */

async function handleInit(userId: string) {
  const [profile, level, identity, subscription, exam, evolution, monthly, achievements] =
    await Promise.all([
      buildProfile(userId),
      buildLevel(userId),
      buildIdentity(userId),
      buildSubscription(userId),
      buildExamIntelligence(userId),
      buildEvolution(userId),
      buildMonthlySnapshot(userId),
      buildAchievements(userId),
    ]);

  return ok({
    success: true,
    you_tab: {
      profile,
      level_up: level,
      ai_identity_insight: identity,
      acry_premium: subscription,
      exam_intelligence: exam,
      evolution_path: evolution,
      monthly_snapshot: monthly,
      achievement_wall: achievements,
    },
  });
}

/* individual handlers */
async function handleProfile(uid: string) { return ok({ success: true, profile: await buildProfile(uid) }); }
async function handleLevel(uid: string) { return ok({ success: true, level_up: await buildLevel(uid) }); }
async function handleIdentity(uid: string) { return ok({ success: true, ai_identity_insight: await buildIdentity(uid) }); }
async function handleSubscription(uid: string) { return ok({ success: true, acry_premium: await buildSubscription(uid) }); }
async function handleExamIntelligence(uid: string) { return ok({ success: true, exam_intelligence: await buildExamIntelligence(uid) }); }
async function handleEvolution(uid: string) { return ok({ success: true, evolution_path: await buildEvolution(uid) }); }
async function handleMonthlySnapshot(uid: string) { return ok({ success: true, monthly_snapshot: await buildMonthlySnapshot(uid) }); }
async function handleAchievements(uid: string) { return ok({ success: true, achievement_wall: await buildAchievements(uid) }); }

/* ══════════════════════════════════════════════════
   BUILDERS
   ══════════════════════════════════════════════════ */

// ─── Profile ───
async function buildProfile(userId: string) {
  const { data: p } = await adminClient
    .from("profiles")
    .select("display_name, email, avatar_url, exam_type, exam_date")
    .eq("id", userId)
    .maybeSingle();

  return {
    display_name: p?.display_name || "",
    email: p?.email || "",
    avatar_url: p?.avatar_url || "",
    exam_type: p?.exam_type || "",
    exam_date: p?.exam_date || "",
  };
}

// ─── Level Up ───
async function buildLevel(userId: string) {
  // Total XP from study_logs duration_minutes
  const { data: logs } = await adminClient
    .from("study_logs")
    .select("duration_minutes, session_type, created_at")
    .eq("user_id", userId);

  const allLogs = logs || [];
  const totalXp = allLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0);

  // Current level
  let currentLevel = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVEL_THRESHOLDS[i]) { currentLevel = i + 1; break; }
  }

  const currentThreshold = LEVEL_THRESHOLDS[Math.min(currentLevel - 1, LEVEL_THRESHOLDS.length - 1)] || 0;
  const nextThreshold = LEVEL_THRESHOLDS[Math.min(currentLevel, LEVEL_THRESHOLDS.length - 1)] || currentThreshold + 1000;
  const xpInLevel = totalXp - currentThreshold;
  const xpNeeded = nextThreshold - currentThreshold;
  const progressPct = Math.min(100, Math.round((xpInLevel / xpNeeded) * 100));
  const levelInfo = BRAIN_LEVELS[Math.min(currentLevel - 1, BRAIN_LEVELS.length - 1)];

  // XP breakdown (last 7 days)
  const since7 = daysAgo(6);
  const recentLogs = allLogs.filter((l) => l.created_at >= since7);

  const breakdown = { revision: 0, focus: 0, mock: 0, other: 0 };
  const dailyBuckets: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    dailyBuckets[d.toISOString().slice(0, 10)] = 0;
  }

  for (const log of recentLogs) {
    const mins = log.duration_minutes || 0;
    const type = log.session_type || "other";
    const dayKey = log.created_at.slice(0, 10);
    if (dayKey in dailyBuckets) dailyBuckets[dayKey] += mins;

    if (type === "revision" || type === "review") breakdown.revision += mins;
    else if (type === "focus" || type === "deep_focus") breakdown.focus += mins;
    else if (type === "mock" || type === "exam") breakdown.mock += mins;
    else breakdown.other += mins;
  }

  const totalBreakdown = breakdown.revision + breakdown.focus + breakdown.mock + breakdown.other;
  const xp_contribution = [
    { label: "Revision", value: breakdown.revision, pct: totalBreakdown > 0 ? Math.round((breakdown.revision / totalBreakdown) * 100) : 0, icon: "📖" },
    { label: "Focus Sessions", value: breakdown.focus, pct: totalBreakdown > 0 ? Math.round((breakdown.focus / totalBreakdown) * 100) : 0, icon: "🎯" },
    { label: "Mock Exams", value: breakdown.mock, pct: totalBreakdown > 0 ? Math.round((breakdown.mock / totalBreakdown) * 100) : 0, icon: "🏆" },
    { label: "Other", value: breakdown.other, pct: totalBreakdown > 0 ? Math.round((breakdown.other / totalBreakdown) * 100) : 0, icon: "⏰" },
  ];

  // Consistency score
  const dailyMins = Object.values(dailyBuckets);
  const daysActive = dailyMins.filter((m) => m > 0).length;
  const freq = (daysActive / 7) * 100;
  const activeMins = dailyMins.filter((m) => m > 0);
  let evenness = 100;
  if (activeMins.length > 1) {
    const mean = activeMins.reduce((a, b) => a + b, 0) / activeMins.length;
    const variance = activeMins.reduce((a, b) => a + (b - mean) ** 2, 0) / activeMins.length;
    evenness = Math.max(0, Math.round(100 - (Math.sqrt(variance) / (mean || 1)) * 50));
  }
  const consistencyScore = Math.round(freq * 0.6 + evenness * 0.4);
  const consistencyLabel = consistencyScore >= 85 ? "Elite" : consistencyScore >= 65 ? "Strong" : consistencyScore >= 40 ? "Building" : "Starting";

  const daily_activity = Object.entries(dailyBuckets).map(([day, mins]) => ({
    date: day,
    day: dayLabel(day),
    minutes: mins,
  }));

  return {
    total_xp: totalXp,
    current_level: currentLevel,
    level_name: levelInfo.name,
    level_icon: levelInfo.icon,
    xp_in_level: xpInLevel,
    xp_needed: xpNeeded,
    progress_pct: progressPct,
    next_threshold: nextThreshold,
    current_threshold: currentThreshold,
    consistency: {
      score: consistencyScore,
      label: consistencyLabel,
      days_active_7d: daysActive,
    },
    xp_contribution,
    daily_activity,
  };
}

// ─── AI Identity Insight ───
async function buildIdentity(userId: string) {
  // Gather stats for insight generation
  const { data: logs } = await adminClient
    .from("study_logs")
    .select("duration_minutes, created_at")
    .eq("user_id", userId);

  const allLogs = logs || [];
  const totalXp = allLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0);

  let currentLevel = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVEL_THRESHOLDS[i]) { currentLevel = i + 1; break; }
  }

  // Streak
  const { data: streakRows } = await adminClient
    .from("study_streaks")
    .select("current_streak, longest_streak")
    .eq("user_id", userId)
    .maybeSingle();

  const currentStreak = streakRows?.current_streak || 0;
  const longestStreak = streakRows?.longest_streak || 0;

  // Topics for exam readiness
  const { data: topics } = await adminClient
    .from("topics")
    .select("memory_strength")
    .eq("user_id", userId)
    .is("deleted_at", null);

  const topicList = topics || [];
  const avgStrength = topicList.length > 0
    ? Math.round(topicList.reduce((s, t) => s + (t.memory_strength || 0), 0) / topicList.length)
    : 0;

  // Freeze count
  const { data: freezes } = await adminClient
    .from("streak_freezes")
    .select("id")
    .eq("user_id", userId)
    .is("used_date", null);

  // Determine study archetype
  const since30 = daysAgo(29);
  const recentLogs = allLogs.filter((l) => l.created_at >= since30);
  let archetype = "balanced";
  let peakHour: number | null = null;

  if (recentLogs.length > 0) {
    const hourBuckets: Record<number, number> = {};
    let totalMins = 0;
    for (const l of recentLogs) {
      const h = new Date(l.created_at).getHours();
      const m = l.duration_minutes || 0;
      hourBuckets[h] = (hourBuckets[h] || 0) + m;
      totalMins += m;
    }
    const avgMins = totalMins / recentLogs.length;
    const uniqueDays = new Set(recentLogs.map((l) => l.created_at.slice(0, 10))).size;

    const peak = Object.entries(hourBuckets).sort(([, a], [, b]) => b - a)[0];
    if (peak) {
      peakHour = parseInt(peak[0]);
      if (peakHour >= 5 && peakHour < 12) archetype = "morning";
      else if (peakHour >= 21 || peakHour < 5) archetype = "night_owl";
    }
    if (avgMins > 45 && uniqueDays < 15) archetype = "sprint";
    else if (uniqueDays >= 20 && avgMins <= 40) archetype = "marathon";
  }

  const archetypes: Record<string, any> = {
    sprint: { emoji: "⚡", title: "Sprint Learner", desc: "You absorb in intense bursts.", traits: ["High intensity", "Fast recall", "Needs recovery breaks"] },
    marathon: { emoji: "🏃", title: "Marathon Learner", desc: "You thrive on consistency.", traits: ["High consistency", "Steady growth", "Strong retention"] },
    night_owl: { emoji: "🦉", title: "Night Owl Scholar", desc: "Your brain peaks after sunset.", traits: ["Evening peak", "Deep focus after 9PM", "Creative thinker"] },
    morning: { emoji: "🌅", title: "Dawn Strategist", desc: "Early hours are your golden zone.", traits: ["Morning peak", "Sharp before noon", "Disciplined routine"] },
    explorer: { emoji: "🧭", title: "Knowledge Explorer", desc: "You study broadly across topics.", traits: ["Wide coverage", "Topic diversity", "Connection builder"] },
    specialist: { emoji: "🔬", title: "Deep Specialist", desc: "You master topics one by one.", traits: ["Deep mastery", "Focused study", "High per-topic strength"] },
    balanced: { emoji: "⚖️", title: "Balanced Achiever", desc: "You maintain equilibrium.", traits: ["Even distribution", "Reliable routine", "Steady progress"] },
  };

  const arch = archetypes[archetype] || archetypes["balanced"];

  return {
    total_xp: totalXp,
    current_level: currentLevel,
    current_streak: currentStreak,
    longest_streak: longestStreak,
    exam_readiness_pct: avgStrength,
    topic_count: topicList.length,
    freeze_count: (freezes || []).length,
    peak_study_hour: peakHour,
    archetype: {
      key: archetype,
      emoji: arch.emoji,
      title: arch.title,
      description: arch.desc,
      traits: arch.traits,
    },
    insight_prompt: `Level ${currentLevel} • ${currentStreak}-day streak • ${avgStrength}% readiness • ${arch.title}`,
  };
}

// ─── ACRY Premium / Subscription ───
async function buildSubscription(userId: string) {
  const { data } = await adminClient
    .from("user_subscriptions")
    .select("plan_id, is_trial, trial_start_date, trial_end_date, expires_at, status, billing_cycle, amount, currency, created_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return {
      plan: "free",
      is_premium: false,
      is_trial: false,
      is_active: false,
      days_left: 0,
      expires_at: "",
      billing_cycle: "",
      amount: 0,
      currency: "INR",
      features: [],
    };
  }

  const isPremium = ["premium", "pro", "ultra"].includes(data.plan_id);
  const endDate = data.is_trial ? data.trial_end_date : data.expires_at;
  let daysLeft = 0;
  if (endDate) {
    daysLeft = Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  }

  const features = [
    { key: "ai_brain", label: "AI Second Brain", icon: "🧠", enabled: isPremium },
    { key: "focus_mode", label: "Focus Study Mode", icon: "🎯", enabled: isPremium },
    { key: "neural_map", label: "Neural Memory Map", icon: "🗺️", enabled: isPremium },
    { key: "ai_strategy", label: "AI Strategy", icon: "📊", enabled: isPremium },
    { key: "voice_notif", label: "Voice Notifications", icon: "🔊", enabled: isPremium },
    { key: "unlimited", label: "Unlimited Usage", icon: "♾️", enabled: isPremium },
  ];

  return {
    plan: data.plan_id,
    is_premium: isPremium,
    is_trial: data.is_trial || false,
    is_active: data.status === "active",
    days_left: daysLeft,
    trial_start_date: data.trial_start_date || "",
    trial_end_date: data.trial_end_date || "",
    expires_at: data.expires_at || "",
    billing_cycle: data.billing_cycle || "",
    amount: data.amount || 0,
    currency: data.currency || "INR",
    status_badge: data.is_trial ? "Trial" : "Active",
    status_label: data.is_trial && daysLeft > 0
      ? `Trial · ${daysLeft} days left`
      : data.expires_at
        ? `Next billing: ${data.expires_at.slice(0, 10)}`
        : "Active",
    features,
  };
}

// ─── Exam Intelligence ───
async function buildExamIntelligence(userId: string) {
  const { data: p } = await adminClient
    .from("profiles")
    .select("exam_type, exam_date")
    .eq("id", userId)
    .maybeSingle();

  const rawExamType = p?.exam_type || "";
  const examDate = p?.exam_date || "";
  const examVariants = rawExamType === "NEET UG"
    ? ["NEET UG", "NEET"]
    : rawExamType === "NEET"
      ? ["NEET", "NEET UG"]
      : rawExamType
        ? [rawExamType]
        : [];

  let daysRemaining: number | null = null;
  if (examDate) {
    const d = Math.ceil((new Date(examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    daysRemaining = d > 0 ? d : null;
  }

  const [subjectsRes, topicScoresRes, studentBriefRes, alertsRes, practiceQuestionsRes] = await Promise.all([
    adminClient
      .from("subjects")
      .select("id, name")
      .eq("user_id", userId)
      .is("deleted_at", null),
    examVariants.length > 0
      ? adminClient
          .from("exam_intel_topic_scores")
          .select("*")
          .in("exam_type", examVariants)
          .order("composite_score", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [], error: null }),
    examVariants.length > 0
      ? adminClient
          .from("exam_intel_student_briefs")
          .select("*")
          .eq("user_id", userId)
          .in("exam_type", examVariants)
          .order("computed_at", { ascending: false })
          .limit(1)
      : Promise.resolve({ data: [], error: null }),
    examVariants.length > 0
      ? adminClient
          .from("exam_intel_alerts")
          .select("*")
          .in("exam_type", examVariants)
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [], error: null }),
    examVariants.length > 0
      ? adminClient
          .from("exam_intel_practice_questions")
          .select("*")
          .in("exam_type", examVariants)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const subjects = subjectsRes.data || [];
  const subjectStrengths: { name: string; strength: number; topic_count: number }[] = [];
  let totalTopics = 0;

  if (subjects.length) {
    const subjectTopicResults = await Promise.all(
      subjects.map((sub) =>
        adminClient
          .from("topics")
          .select("memory_strength")
          .eq("subject_id", sub.id)
          .is("deleted_at", null)
          .then(({ data }) => ({ sub, topics: data || [] }))
      )
    );

    for (const { sub, topics } of subjectTopicResults) {
      if (topics.length) {
        totalTopics += topics.length;
        const avg = Math.round(topics.reduce((s, t) => s + (t.memory_strength || 0), 0) / topics.length);
        subjectStrengths.push({ name: sub.name, strength: avg, topic_count: topics.length });
      }
    }
  }

  subjectStrengths.sort((a, b) => b.strength - a.strength);
  const strong = subjectStrengths.filter((s) => s.strength >= 60).slice(0, 5);
  const weak = [...subjectStrengths]
    .filter((s) => s.strength < 60)
    .sort((a, b) => a.strength - b.strength)
    .slice(0, 5);
  const readiness = subjectStrengths.length > 0
    ? Math.round(subjectStrengths.reduce((s, x) => s + x.strength, 0) / subjectStrengths.length)
    : 0;

  const urgency = daysRemaining !== null
    ? daysRemaining <= 30 ? "critical" : daysRemaining <= 60 ? "high" : daysRemaining <= 90 ? "medium" : "low"
    : "unknown";

  const topicScores = topicScoresRes.data || [];
  const studentBrief = studentBriefRes.data?.[0] || null;
  const alerts = alertsRes.data || [];
  const practiceQuestions = practiceQuestionsRes.data || [];

  const topicList = topicScores.map((t: any, idx: number) => ({
    serial: idx + 1,
    id: t.id,
    topic: t.topic || "",
    subject: t.subject || "",
    probability_score: t.probability_score || 0,
    probability_label: `${Math.round((t.probability_score || 0) * 100)}%`,
    trend_direction: t.trend_direction || "stable",
    trend_icon: t.trend_direction === "rising" ? "📈" : t.trend_direction === "declining" ? "📉" : "➡️",
    ai_confidence: t.ai_confidence || 0,
    ai_confidence_label: `${Math.round((t.ai_confidence || 0) * 100)}%`,
    historical_frequency: t.historical_frequency || 0,
    last_appeared_year: t.last_appeared_year || "",
    consecutive_appearances: t.consecutive_appearances || 0,
    predicted_marks_weight: t.predicted_marks_weight || 0,
    ca_boost_score: t.ca_boost_score || 0,
    composite_score: t.composite_score || 0,
    composite_label: `${Math.round((t.composite_score || 0) * 100)}%`,
    computed_at: t.computed_at || "",
  }));

  const trendSummary = {
    rising: topicScores.filter((t: any) => t.trend_direction === "rising").length,
    stable: topicScores.filter((t: any) => t.trend_direction === "stable").length,
    declining: topicScores.filter((t: any) => t.trend_direction === "declining").length,
  };

  const subjectMap: Record<string, { topic: string; probability_score: number; composite_score: number; trend_direction: string }[]> = {};
  for (const item of topicScores) {
    const subject = item.subject || "General";
    if (!subjectMap[subject]) subjectMap[subject] = [];
    subjectMap[subject].push({
      topic: item.topic || "",
      probability_score: item.probability_score || 0,
      composite_score: item.composite_score || 0,
      trend_direction: item.trend_direction || "stable",
    });
  }

  const subjectBreakdown = Object.entries(subjectMap).map(([subject, items]) => ({
    subject,
    topic_count: items.length,
    avg_probability_score: Number((items.reduce((sum, item) => sum + item.probability_score, 0) / items.length).toFixed(2)),
    avg_composite_score: Number((items.reduce((sum, item) => sum + item.composite_score, 0) / items.length).toFixed(2)),
    topics: items,
  }));

  const brief = studentBrief
    ? {
        overall_readiness_score: studentBrief.overall_readiness_score || 0,
        overall_readiness_label: `${Math.round(studentBrief.overall_readiness_score || 0)}%`,
        predicted_hot_topics: studentBrief.predicted_hot_topics || [],
        weakness_overlap: studentBrief.weakness_overlap || [],
        risk_topics: studentBrief.risk_topics || [],
        opportunity_topics: studentBrief.opportunity_topics || [],
        recommended_actions: studentBrief.recommended_actions || [],
        ai_strategy_summary: studentBrief.ai_strategy_summary || "",
        computed_at: studentBrief.computed_at || "",
      }
    : {
        overall_readiness_score: 0,
        overall_readiness_label: "0%",
        predicted_hot_topics: [],
        weakness_overlap: [],
        risk_topics: [],
        opportunity_topics: [],
        recommended_actions: [],
        ai_strategy_summary: "",
        computed_at: "",
      };

  const alertList = alerts.map((a: any, idx: number) => ({
    serial: idx + 1,
    id: a.id,
    alert_type: a.alert_type || "",
    topic: a.topic || "",
    subject: a.subject || "",
    exam_type: a.exam_type || rawExamType,
    old_score: a.old_score || 0,
    new_score: a.new_score || 0,
    severity: a.severity || "info",
    message: a.message || "",
    is_read: !!a.is_read,
    is_pushed: !!a.is_pushed,
    created_at: a.created_at || "",
  }));

  const practiceList = practiceQuestions.map((q: any, idx: number) => ({
    serial: idx + 1,
    id: q.id,
    exam_type: q.exam_type || rawExamType,
    subject: q.subject || "",
    topic: q.topic || "",
    question_text: q.question_text || q.question || q.prompt || "",
    difficulty: q.difficulty || "medium",
    explanation: q.explanation || "",
    created_at: q.created_at || "",
  }));

  const lastUpdated = topicScores[0]?.computed_at || studentBrief?.computed_at || alerts[0]?.created_at || "";

  return {
    exam_type: rawExamType,
    exam_date: examDate,
    days_remaining: daysRemaining,
    urgency,
    readiness_pct: readiness,
    readiness_label: readiness >= 70 ? "Strong" : readiness >= 40 ? "Building" : "Needs Work",
    total_subjects: subjectStrengths.length,
    total_topics: totalTopics,
    strong_subjects: strong,
    weak_subjects: weak,
    all_subjects: subjectStrengths,
    title: "Exam Intelligence",
    subtitle: "AI-Powered Topic Probability Engine",
    update_title: "Exam Intelligence Updates",
    update_subtext: topicList.length > 0 ? `${topicList.length} AI-ranked topics available` : "No exam intelligence updates available yet",
    total_topics_tracked: topicList.length,
    topic_list_title: "Topic Probability Index (TPI)",
    topic_list_subtext: topicList.length > 0 ? `${topicList.length} topics tracked with AI confidence scores` : "No AI-ranked topics found yet",
    topic_list: topicList,
    trend_summary: {
      ...trendSummary,
      rising_label: `${trendSummary.rising} Rising`,
      stable_label: `${trendSummary.stable} Stable`,
      declining_label: `${trendSummary.declining} Declining`,
    },
    subject_breakdown_title: "Subject-wise Analysis",
    subject_breakdown: subjectBreakdown,
    student_brief_title: "Your Personalized Brief",
    student_brief: brief,
    alerts_title: "Intelligence Alerts",
    alerts_count: alertList.length,
    alerts: alertList,
    practice_questions_title: "Intel Practice Questions",
    practice_questions_count: practiceList.length,
    practice_questions: practiceList,
    last_updated: lastUpdated,
    last_updated_label: lastUpdated ? formatDate(lastUpdated) : "",
  };
}

// ─── Evolution Path ───
async function buildEvolution(userId: string) {
  const since30 = daysAgo(29);
  const { data: logs } = await adminClient
    .from("study_logs")
    .select("created_at, duration_minutes")
    .eq("user_id", userId)
    .gte("created_at", since30);

  const allLogs = logs || [];
  const totalMins = allLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0);
  const sessionCount = allLogs.length;

  // All-time totals for stages
  const { data: allTimeLogs } = await adminClient
    .from("study_logs")
    .select("duration_minutes")
    .eq("user_id", userId);

  const allTimeMins = (allTimeLogs || []).reduce((s, l) => s + (l.duration_minutes || 0), 0);
  const allTimeSessions = (allTimeLogs || []).length;

  const stages = [
    { label: "First Session", icon: "🌱", reached: allTimeSessions > 0, current: allTimeSessions > 0 && allTimeSessions < 7 },
    { label: "7-Day Active", icon: "📖", reached: allTimeSessions >= 7, current: allTimeSessions >= 7 && allTimeSessions < 20 },
    { label: "Pattern Formed", icon: "🔄", reached: allTimeSessions >= 20, current: allTimeSessions >= 20 && allTimeMins < 500 },
    { label: "Deep Learner", icon: "🧠", reached: allTimeMins >= 500, current: allTimeMins >= 500 && allTimeMins < 1500 },
    { label: "Master Mind", icon: "👑", reached: allTimeMins >= 1500, current: allTimeMins >= 1500 },
  ];

  const currentIdx = stages.findIndex((s) => s.current);
  const reachedCount = stages.filter((s) => s.reached).length;
  const progressPct = Math.round(((currentIdx >= 0 ? currentIdx : reachedCount - 1) + 1) / stages.length * 100);

  return {
    stages,
    progress_pct: progressPct,
    current_stage: stages.find((s) => s.current)?.label || stages[0].label,
    total_sessions_all_time: allTimeSessions,
    total_minutes_all_time: allTimeMins,
    total_hours_all_time: Math.round(allTimeMins / 60 * 10) / 10,
  };
}

// ─── Monthly Snapshot ───
async function buildMonthlySnapshot(userId: string) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const thisMonthStart = daysAgo(29);
  const prevMonthStart = daysAgo(59);

  const [currentRes, prevRes, topicsRes] = await Promise.all([
    adminClient.from("study_logs").select("created_at, duration_minutes, subject_id").eq("user_id", userId).gte("created_at", thisMonthStart),
    adminClient.from("study_logs").select("duration_minutes").eq("user_id", userId).gte("created_at", prevMonthStart).lt("created_at", thisMonthStart),
    adminClient.from("topics").select("memory_strength").eq("user_id", userId).is("deleted_at", null),
  ]);

  const currentLogs = currentRes.data || [];
  const prevLogs = prevRes.data || [];
  const topics = topicsRes.data || [];

  const totalMin = currentLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0);
  const prevTotalMin = prevLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0);
  const totalHours = Math.round(totalMin / 60 * 10) / 10;
  const prevTotalHours = Math.round(prevTotalMin / 60 * 10) / 10;

  const daySet = new Set(currentLogs.map((l) => l.created_at.slice(0, 10)));
  const daysActive = daySet.size;
  const avgDailyMin = daysActive > 0 ? Math.round(totalMin / daysActive) : 0;

  // Top subject
  const subjectMin: Record<string, number> = {};
  currentLogs.forEach((l) => {
    if (l.subject_id) subjectMin[l.subject_id] = (subjectMin[l.subject_id] || 0) + (l.duration_minutes || 0);
  });
  const topSubId = Object.entries(subjectMin).sort(([, a], [, b]) => b - a)[0]?.[0];
  let topSubName = "";
  if (topSubId) {
    const { data } = await adminClient.from("subjects").select("name").eq("id", topSubId).maybeSingle();
    topSubName = data?.name || "";
  }

  const improved = topics.filter((t) => (t.memory_strength || 0) >= 60).length;
  const declined = topics.filter((t) => (t.memory_strength || 0) < 40 && (t.memory_strength || 0) > 0).length;

  const trend = totalHours > prevTotalHours ? "up" : totalHours < prevTotalHours ? "down" : "same";
  const trendDiff = Math.round((totalHours - prevTotalHours) * 10) / 10;

  const metrics = [
    { key: "total_hours", icon: "⏰", label: "Total Hours", value: `${totalHours}h`, raw: totalHours },
    { key: "days_active", icon: "🔥", label: "Days Active", value: `${daysActive}/30`, raw: daysActive },
    { key: "avg_daily", icon: "🧠", label: "Avg/Day", value: `${avgDailyMin}m`, raw: avgDailyMin },
    { key: "vs_last_month", icon: trend === "up" ? "📈" : trend === "down" ? "📉" : "➡️", label: "vs Last Month", value: trend === "up" ? `+${trendDiff}h` : trend === "down" ? `${trendDiff}h` : "Same", raw: trendDiff },
  ];

  return {
    period: "Last 30 days",
    total_hours: totalHours,
    prev_total_hours: prevTotalHours,
    avg_daily_minutes: avgDailyMin,
    days_active: daysActive,
    top_subject: topSubName,
    topics_improved: improved,
    topics_declined: declined,
    trend,
    trend_diff: trendDiff,
    metrics,
    insights: [
      topSubName ? `📚 Top: ${topSubName}` : "",
      improved > 0 ? `↑ ${improved} topics strong` : "",
      declined > 0 ? `↓ ${declined} need review` : "",
    ].filter(Boolean),
  };
}

// ─── Achievements ───
async function buildAchievements(userId: string) {
  const [logsRes, topicsRes, streakRes] = await Promise.all([
    adminClient.from("study_logs").select("duration_minutes").eq("user_id", userId),
    adminClient.from("topics").select("id, memory_strength").eq("user_id", userId).is("deleted_at", null),
    adminClient.from("study_streaks").select("current_streak").eq("user_id", userId).maybeSingle(),
  ]);

  const logs = logsRes.data || [];
  const topics = topicsRes.data || [];
  const totalMinutes = logs.reduce((s, l) => s + (l.duration_minutes || 0), 0);
  const totalSessions = logs.length;
  const topicCount = topics.length;
  const maxStrength = topics.reduce((max, t) => Math.max(max, t.memory_strength || 0), 0);
  const streak = streakRes.data?.current_streak || 0;

  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalMinutes >= LEVEL_THRESHOLDS[i]) { level = i + 1; break; }
  }

  const stats = { totalSessions, totalMinutes, topicCount, maxStrength, streak, level };

  const achievements = ACHIEVEMENT_DEFS.map((def) => ({
    id: def.id,
    icon: def.icon,
    title: def.title,
    description: def.desc,
    earned: def.check(stats),
  }));

  const earned = achievements.filter((a) => a.earned);
  const locked = achievements.filter((a) => !a.earned);

  return {
    total: achievements.length,
    earned_count: earned.length,
    locked_count: locked.length,
    progress_pct: Math.round((earned.length / achievements.length) * 100),
    achievements,
    earned,
    locked,
  };
}
