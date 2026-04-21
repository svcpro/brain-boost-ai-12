import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, user_id, data } = await req.json();

    switch (action) {
      case "compute_segment":
        return json(await computeSegment(supabase, user_id));
      case "process_journey":
        return json(await processJourney(supabase, user_id));
      case "check_fatigue":
        return json(await checkFatigue(supabase, user_id));
      case "check_subscription_trigger":
        return json(await checkSubscriptionTrigger(supabase, user_id));
      case "check_referral_trigger":
        return json(await checkReferralTrigger(supabase, user_id, data));
      case "check_exam_mode":
        return json(await checkExamMode(supabase, user_id));
      case "get_growth_dashboard":
        return json(await getGrowthDashboard(supabase));
      case "get_growth_analytics":
        return json(await getGrowthAnalytics(supabase, data));
      case "run_daily_growth":
        return json(await runDailyGrowth(supabase));
      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    console.error("growth-engine error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════
// 1. USER SEGMENTATION ENGINE
// ═══════════════════════════════════════════════════════════════

async function computeSegment(supabase: any, userId: string) {
  const now = Date.now();
  const [profileRes, subRes, logsRes, churnRes] = await Promise.all([
    supabase.from("profiles").select("created_at, last_active_at, exam_date").eq("id", userId).maybeSingle(),
    supabase.from("user_subscriptions").select("status, is_trial, trial_end_date, plan_id").eq("user_id", userId).maybeSingle(),
    supabase.from("study_logs").select("id, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
    supabase.from("churn_predictions").select("churn_probability, risk_level").eq("user_id", userId).maybeSingle(),
  ]);

  const profile = profileRes.data;
  const sub = subRes.data;
  const logs = logsRes.data || [];
  const churn = churnRes.data;

  if (!profile) return { segment: "unknown" };

  const accountAgeDays = Math.floor((now - new Date(profile.created_at).getTime()) / 86400000);
  const daysSinceActive = profile.last_active_at
    ? Math.floor((now - new Date(profile.last_active_at).getTime()) / 86400000)
    : 999;
  const sessionsLast7 = logs.filter((l: any) => now - new Date(l.created_at).getTime() < 7 * 86400000).length;
  const sessionsLast30 = logs.length;
  const daysUntilExam = profile.exam_date
    ? Math.ceil((new Date(profile.exam_date).getTime() - now) / 86400000)
    : null;
  const isPremium = sub && !sub.is_trial && sub.status === "active";

  // Determine segments (user can be in multiple)
  const segments: string[] = [];

  if (churn?.risk_level === "critical" || churn?.risk_level === "high") segments.push("high_churn_risk");
  if (daysSinceActive > 14) segments.push("dormant");
  else if (daysSinceActive > 7) segments.push("at_risk");
  if (daysUntilExam !== null && daysUntilExam > 0 && daysUntilExam <= 30) segments.push("exam_week");
  if (isPremium) segments.push("premium");
  if (accountAgeDays <= 7) segments.push("new_user");
  else if (accountAgeDays <= 30) segments.push("early_learner");

  if (sessionsLast7 >= 5) segments.push("power_user");
  else if (sessionsLast7 >= 2) segments.push("active_learner");

  // Default
  if (segments.length === 0) segments.push("active_learner");

  // Upsert segments
  const now_iso = new Date().toISOString();
  // Clear old segments
  await supabase.from("notification_segments").delete().eq("user_id", userId);
  // Insert new
  await supabase.from("notification_segments").insert(
    segments.map(s => ({ user_id: userId, segment_key: s, assigned_at: now_iso, metadata: { account_age: accountAgeDays, sessions_7d: sessionsLast7 } }))
  );

  return { segments, account_age_days: accountAgeDays, sessions_last_7: sessionsLast7, days_until_exam: daysUntilExam };
}

// ═══════════════════════════════════════════════════════════════
// 2. 30-DAY ACTIVATION JOURNEY
// ═══════════════════════════════════════════════════════════════

const JOURNEY_STEPS = [
  { day: 0, event_type: "journey_welcome", title: "Welcome to ACRY Brain! 🧠", body: "Your AI-powered study journey begins now. Set up your first topic." },
  { day: 1, event_type: "journey_study_trigger", title: "Time to start! ⚡", body: "Your brain is freshest today. Start your first study session." },
  { day: 3, event_type: "journey_improvement", title: "First improvement detected! 📈", body: "Your memory is already forming new connections." },
  { day: 7, event_type: "journey_streak", title: "One week strong! 🔥", body: "You're building a powerful study habit." },
  { day: 14, event_type: "journey_ai_insight", title: "AI Brain Update 🤖", body: "Your cognitive twin has identified your learning patterns." },
  { day: 21, event_type: "journey_ranking", title: "Rank unlocked! 🏆", body: "See how you compare to other students preparing for the same exam." },
  { day: 30, event_type: "journey_subscription", title: "Your journey so far ✨", body: "Review your progress and unlock advanced features." },
];

async function processJourney(supabase: any, userId: string) {
  const { data: journey } = await supabase
    .from("growth_journeys")
    .select("*")
    .eq("user_id", userId)
    .eq("journey_key", "onboarding_30d")
    .eq("status", "active")
    .maybeSingle();

  if (!journey) {
    // Create journey for new user
    await supabase.from("growth_journeys").insert({
      user_id: userId,
      journey_key: "onboarding_30d",
      current_step: 0,
      total_steps: JOURNEY_STEPS.length,
    });
    return { created: true, step: 0 };
  }

  if (journey.completed_at) return { completed: true };

  const daysSinceStart = Math.floor((Date.now() - new Date(journey.started_at).getTime()) / 86400000);
  const currentStep = journey.current_step;

  // Find next step that should fire
  const nextStep = JOURNEY_STEPS.find((s, i) => i >= currentStep && s.day <= daysSinceStart);
  if (!nextStep) return { waiting: true, current_step: currentStep, days_since_start: daysSinceStart };

  const stepIndex = JOURNEY_STEPS.indexOf(nextStep);

  // Send notification
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  await fetch(`${SUPABASE_URL}/functions/v1/omnichannel-notify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      event_type: nextStep.event_type,
      user_id: userId,
      source: "growth_journey",
      data: { step: stepIndex, day: nextStep.day },
      title: nextStep.title,
      body: nextStep.body,
    }),
  }).catch(() => {});

  // Log trigger
  await supabase.from("growth_trigger_log").insert({
    user_id: userId,
    trigger_type: "journey_step",
    trigger_data: { step: stepIndex, event_type: nextStep.event_type, day: nextStep.day },
    channel: "omnichannel",
    outcome: "sent",
  });

  // Update journey
  const newStep = stepIndex + 1;
  const history = [...(journey.step_history || []), { step: stepIndex, fired_at: new Date().toISOString() }];
  await supabase.from("growth_journeys").update({
    current_step: newStep,
    last_step_at: new Date().toISOString(),
    step_history: history,
    completed_at: newStep >= JOURNEY_STEPS.length ? new Date().toISOString() : null,
    status: newStep >= JOURNEY_STEPS.length ? "completed" : "active",
  }).eq("id", journey.id);

  return { fired: true, step: stepIndex, event_type: nextStep.event_type };
}

// ═══════════════════════════════════════════════════════════════
// 3. NOTIFICATION FATIGUE PREVENTION
// ═══════════════════════════════════════════════════════════════

async function checkFatigue(supabase: any, userId: string) {
  const today = new Date().toISOString().split("T")[0];
  const { data: todayLogs } = await supabase
    .from("notification_delivery_log")
    .select("id, status")
    .eq("user_id", userId)
    .gte("created_at", today);

  const sent = todayLogs?.length || 0;
  const ignored = todayLogs?.filter((l: any) => l.status === "failed" || l.status === "ignored").length || 0;
  const ignoreRate = sent > 0 ? ignored / sent : 0;

  let fatigueScore = 0;
  if (sent > 10) fatigueScore += 0.4;
  else if (sent > 6) fatigueScore += 0.2;
  if (ignoreRate > 0.6) fatigueScore += 0.3;
  else if (ignoreRate > 0.3) fatigueScore += 0.15;

  fatigueScore = Math.min(1, fatigueScore);
  const shouldReduce = fatigueScore > 0.5;
  const silenceMode = fatigueScore > 0.7;

  // Update behavioral profile
  await supabase.from("behavioral_profiles").update({
    notification_fatigue_score: Math.round(fatigueScore * 100),
    silence_mode_active: silenceMode,
  }).eq("user_id", userId);

  return { fatigue_score: fatigueScore, sent_today: sent, ignore_rate: ignoreRate, should_reduce: shouldReduce, silence_mode: silenceMode };
}

// ═══════════════════════════════════════════════════════════════
// 4. SUBSCRIPTION CONVERSION ENGINE
// ═══════════════════════════════════════════════════════════════

async function checkSubscriptionTrigger(supabase: any, userId: string) {
  const { data: sub } = await supabase
    .from("user_subscriptions")
    .select("is_trial, trial_end_date, status, plan_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!sub || !sub.is_trial || sub.status !== "active") return { trigger: false, reason: "not_trial" };

  const daysLeft = Math.ceil((new Date(sub.trial_end_date).getTime() - Date.now()) / 86400000);
  if (daysLeft < 0) return { trigger: false, reason: "expired" };

  const triggers: string[] = [];
  if (daysLeft <= 1) triggers.push("trial_expiry_urgent");
  else if (daysLeft <= 3) triggers.push("trial_expiry_warning");
  else if (daysLeft <= 7) triggers.push("trial_feature_teaser");

  if (triggers.length === 0) return { trigger: false, days_left: daysLeft };

  // Log & emit
  for (const t of triggers) {
    await supabase.from("growth_trigger_log").insert({
      user_id: userId, trigger_type: t, trigger_data: { days_left: daysLeft }, channel: "omnichannel", outcome: "queued",
    });
  }

  return { trigger: true, triggers, days_left: daysLeft };
}

// ═══════════════════════════════════════════════════════════════
// 5. VIRAL REFERRAL TRIGGERS
// ═══════════════════════════════════════════════════════════════

async function checkReferralTrigger(supabase: any, userId: string, data: any) {
  const milestoneType = data?.milestone_type; // "streak_7", "rank_up", "top_10pct"
  if (!milestoneType) return { trigger: false };

  const messages: Record<string, string> = {
    streak_7: "7-day streak! 🔥 Challenge your friends to beat you.",
    rank_up: "You climbed the ranks! 🏆 Invite friends to compete.",
    top_10pct: "You're in the top 10%! Share your achievement.",
  };

  const body = messages[milestoneType] || "You hit a milestone! Share with friends.";

  await supabase.from("growth_trigger_log").insert({
    user_id: userId, trigger_type: "referral_prompt", trigger_data: { milestone_type: milestoneType }, channel: "in_app", outcome: "sent",
  });

  return { trigger: true, milestone_type: milestoneType, message: body };
}

// ═══════════════════════════════════════════════════════════════
// 6. EXAM MODE INTENSITY
// ═══════════════════════════════════════════════════════════════

async function checkExamMode(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("exam_date, exam_type")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.exam_date) return { exam_mode: false };

  const daysUntil = Math.ceil((new Date(profile.exam_date).getTime() - Date.now()) / 86400000);
  if (daysUntil < 0 || daysUntil > 30) return { exam_mode: false, days_until_exam: daysUntil };

  const intensity = daysUntil <= 3 ? "critical" : daysUntil <= 7 ? "extreme" : daysUntil <= 14 ? "high" : "moderate";
  const frequencyMultiplier = daysUntil <= 3 ? 3 : daysUntil <= 7 ? 2.5 : daysUntil <= 14 ? 2 : 1.5;
  const tone = daysUntil <= 7 ? "serious_mentor" : "competitive";

  // Enable rank war
  await supabase.from("behavioral_profiles").update({ rank_war_eligible: true }).eq("user_id", userId);

  return { exam_mode: true, days_until_exam: daysUntil, intensity, frequency_multiplier: frequencyMultiplier, tone };
}

// ═══════════════════════════════════════════════════════════════
// 7. DAILY GROWTH ENGINE (CRON)
// ═══════════════════════════════════════════════════════════════

async function runDailyGrowth(supabase: any) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data: users } = await supabase
    .from("profiles")
    .select("id")
    .gte("last_active_at", cutoff)
    .limit(500);

  if (!users?.length) return { processed: 0 };

  let journeysFired = 0, subTriggers = 0, examModeTriggers = 0, segmented = 0;

  for (const u of users) {
    // Segment
    try { await computeSegment(supabase, u.id); segmented++; } catch {}

    // Journey
    try {
      const jr = await processJourney(supabase, u.id);
      if (jr.fired) journeysFired++;
    } catch {}

    // Subscription conversion
    try {
      const st = await checkSubscriptionTrigger(supabase, u.id);
      if (st.trigger) {
        for (const t of (st.triggers || [])) {
          const titles: Record<string, string> = {
            trial_expiry_urgent: "⏰ Trial ends today!",
            trial_expiry_warning: "⚠️ Trial ending soon",
            trial_feature_teaser: "✨ Unlock Pro features",
          };
          await fetch(`${SUPABASE_URL}/functions/v1/omnichannel-notify`, {
            method: "POST",
            headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              event_type: t, user_id: u.id, source: "growth_engine",
              title: titles[t] || "Subscription Update",
              data: { days_left: st.days_left },
            }),
          }).catch(() => {});
        }
        subTriggers++;
      }
    } catch {}

    // Exam mode
    try {
      const em = await checkExamMode(supabase, u.id);
      if (em.exam_mode && (em.intensity === "critical" || em.intensity === "extreme")) {
        await fetch(`${SUPABASE_URL}/functions/v1/omnichannel-notify`, {
          method: "POST",
          headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            event_type: "exam_mode_alert", user_id: u.id, source: "growth_engine",
            title: `⚡ ${em.days_until_exam} days to exam!`,
            body: "Rank War mode activated. Every revision counts.",
            data: { days_until_exam: em.days_until_exam, intensity: em.intensity },
          }),
        }).catch(() => {});
        examModeTriggers++;
      }
    } catch {}

    // Fatigue check
    try { await checkFatigue(supabase, u.id); } catch {}
  }

  // Rollup analytics
  const today = new Date().toISOString().split("T")[0];
  const { data: segments } = await supabase.from("notification_segments").select("segment_key");
  const segCounts: Record<string, number> = {};
  for (const s of (segments || [])) {
    segCounts[s.segment_key] = (segCounts[s.segment_key] || 0) + 1;
  }

  // Insert daily analytics per segment
  for (const [seg, count] of Object.entries(segCounts)) {
    await supabase.from("growth_analytics").upsert({
      metric_date: today,
      segment_key: seg,
      dau: count,
      notifications_sent: 0,
    }, { onConflict: "metric_date,segment_key" }).catch(() => {});
  }

  return { processed: users.length, segmented, journeys_fired: journeysFired, subscription_triggers: subTriggers, exam_mode_triggers: examModeTriggers };
}

// ═══════════════════════════════════════════════════════════════
// 8. GROWTH DASHBOARD & ANALYTICS
// ═══════════════════════════════════════════════════════════════

async function getGrowthDashboard(supabase: any) {
  const [segRes, journeyRes, triggerRes, analyticsRes] = await Promise.all([
    supabase.from("notification_segments").select("segment_key"),
    supabase.from("growth_journeys").select("status, current_step, journey_key"),
    supabase.from("growth_trigger_log").select("trigger_type, outcome, created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("growth_analytics").select("*").order("metric_date", { ascending: false }).limit(30),
  ]);

  // Segment distribution
  const segDist: Record<string, number> = {};
  for (const s of (segRes.data || [])) {
    segDist[s.segment_key] = (segDist[s.segment_key] || 0) + 1;
  }

  // Journey stats
  const journeys = journeyRes.data || [];
  const activeJourneys = journeys.filter((j: any) => j.status === "active").length;
  const completedJourneys = journeys.filter((j: any) => j.status === "completed").length;

  // Recent triggers
  const triggerDist: Record<string, number> = {};
  for (const t of (triggerRes.data || [])) {
    triggerDist[t.trigger_type] = (triggerDist[t.trigger_type] || 0) + 1;
  }

  return {
    segment_distribution: segDist,
    total_segments: Object.values(segDist).reduce((s, v) => s + v, 0),
    active_journeys: activeJourneys,
    completed_journeys: completedJourneys,
    trigger_distribution: triggerDist,
    recent_analytics: analyticsRes.data || [],
  };
}

async function getGrowthAnalytics(supabase: any, data: any) {
  const days = data?.days || 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const [triggerRes, journeyRes, deliveryRes] = await Promise.all([
    supabase.from("growth_trigger_log").select("trigger_type, outcome, created_at").gte("created_at", since),
    supabase.from("growth_journeys").select("status, current_step, started_at, completed_at"),
    supabase.from("notification_delivery_log").select("status, channel, created_at").gte("created_at", since),
  ]);

  const triggers = triggerRes.data || [];
  const triggerByType: Record<string, number> = {};
  for (const t of triggers) {
    triggerByType[t.trigger_type] = (triggerByType[t.trigger_type] || 0) + 1;
  }

  const journeys = journeyRes.data || [];
  const completionRate = journeys.length > 0
    ? Math.round((journeys.filter((j: any) => j.status === "completed").length / journeys.length) * 100)
    : 0;

  const deliveries = deliveryRes.data || [];
  const deliveredCount = deliveries.filter((d: any) => d.status === "delivered").length;

  return {
    total_triggers: triggers.length,
    trigger_breakdown: triggerByType,
    journey_completion_rate: completionRate,
    total_journeys: journeys.length,
    delivery_rate: deliveries.length > 0 ? Math.round((deliveredCount / deliveries.length) * 100) : 0,
    total_deliveries: deliveries.length,
    period_days: days,
  };
}

// ─── Helpers ───

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
