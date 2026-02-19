import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const { action, user_id, event_type, data } = await req.json();

    switch (action) {
      case "compute_send_time":
        return json(await computeOptimalSendTime(supabase, user_id));

      case "generate_dopamine_copy":
        return json(await generateDopamineCopy(supabase, LOVABLE_API_KEY, user_id, event_type, data));

      case "predict_churn":
        return json(await predictChurn(supabase, user_id));

      case "bundle_notifications":
        return json(await bundleNotifications(supabase, user_id));

      case "check_escalation":
        return json(await checkEscalation(supabase, user_id, event_type));

      case "track_engagement":
        return json(await trackEngagement(supabase, user_id, data));

      case "update_channel_effectiveness":
        return json(await updateChannelEffectiveness(supabase, user_id, data));

      case "get_smart_channels":
        return json(await getSmartChannels(supabase, user_id));

      case "rank_war_check":
        return json(await rankWarCheck(supabase, user_id));

      case "compute_dynamic_reward":
        return json(await computeDynamicReward(supabase, user_id, data));

      case "compute_profile":
        return json(await computeBehavioralProfile(supabase, user_id));

      case "get_analytics":
        return json(await getNotificationAnalytics(supabase, data));

      case "get_dashboard":
        return json(await getDashboardData(supabase));

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    console.error("intelligent-notify-engine error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════
// 1. AI SEND-TIME OPTIMIZATION
// ═══════════════════════════════════════════════════════════════

async function computeOptimalSendTime(supabase: any, userId: string) {
  const { data: patterns } = await supabase
    .from("user_engagement_patterns")
    .select("hour_of_day, day_of_week, engagement_count, open_rate, click_rate")
    .eq("user_id", userId)
    .order("engagement_count", { ascending: false });

  if (!patterns || patterns.length === 0) {
    // Default: morning 9 AM
    return { optimal_hour: 9, optimal_day: null, confidence: 0.3, source: "default" };
  }

  // Score each hour by weighted engagement
  const hourScores: Record<number, number> = {};
  for (const p of patterns) {
    const score = (p.engagement_count * 0.4) + (p.open_rate * 100 * 0.35) + (p.click_rate * 100 * 0.25);
    hourScores[p.hour_of_day] = (hourScores[p.hour_of_day] || 0) + score;
  }

  const bestHour = Object.entries(hourScores)
    .sort(([, a], [, b]) => b - a)[0];

  // Best day
  const dayScores: Record<number, number> = {};
  for (const p of patterns) {
    const score = (p.engagement_count * 0.4) + (p.open_rate * 100 * 0.35) + (p.click_rate * 100 * 0.25);
    dayScores[p.day_of_week] = (dayScores[p.day_of_week] || 0) + score;
  }
  const bestDay = Object.entries(dayScores)
    .sort(([, a], [, b]) => b - a)[0];

  return {
    optimal_hour: parseInt(bestHour[0]),
    optimal_day: parseInt(bestDay[0]),
    confidence: Math.min(0.95, 0.3 + patterns.length * 0.05),
    source: "learned",
    all_hours: hourScores,
  };
}

// ═══════════════════════════════════════════════════════════════
// 2. DOPAMINE-BASED NOTIFICATION COPY
// ═══════════════════════════════════════════════════════════════

async function generateDopamineCopy(
  supabase: any,
  apiKey: string | undefined,
  userId: string,
  eventType: string,
  data: any
) {
  if (!apiKey) return { title: data?.title || "Update", body: data?.body || "", source: "fallback" };

  // Fetch user context
  const [profileRes, logsRes, topicsRes] = await Promise.all([
    supabase.from("profiles").select("display_name, exam_type").eq("id", userId).maybeSingle(),
    supabase.from("study_logs").select("duration_minutes, confidence_level").eq("user_id", userId).order("created_at", { ascending: false }).limit(7),
    supabase.from("topics").select("name, memory_strength").eq("user_id", userId).is("deleted_at", null).order("memory_strength", { ascending: true }).limit(3),
  ]);

  const profile = profileRes.data;
  const recentSessions = logsRes.data?.length || 0;
  const weakTopics = topicsRes.data?.map((t: any) => t.name).join(", ") || "none";
  const totalMinutes = (logsRes.data || []).reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0);

  const prompt = `You are a behavioral notification copywriter for a study app called ACRY Brain.

EVENT: ${eventType}
USER: ${profile?.display_name || "Student"} (Exam: ${profile?.exam_type || "General"})
CONTEXT: ${recentSessions} sessions this week, ${totalMinutes} total minutes, weak topics: ${weakTopics}
EVENT DATA: ${JSON.stringify(data || {})}

Write a notification using ONE psychological trigger (choose the most effective):
- CURIOSITY: "Did you know…?" / "Something changed in your brain…"
- SCARCITY: "Only X hours left before…" / "This window closes…"
- SOCIAL PROOF: "82% of students at your level…" / "Top rankers do this…"
- LOSS AVERSION: "You're about to lose…" / "Don't let X slip away…"
- PROGRESS: "You're X% closer to…" / "One more step to…"

Return ONLY a JSON: {"title":"max 50 chars, punchy","body":"max 160 chars, personal & actionable","trigger_used":"curiosity|scarcity|social_proof|loss_aversion|progress"}
No markdown, no code fences.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      return { title: data?.title || "Update", body: data?.body || "", source: "fallback" };
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return { ...parsed, source: "ai_dopamine" };
  } catch {
    return { title: data?.title || "Keep going! 🧠", body: data?.body || "", source: "fallback" };
  }
}

// ═══════════════════════════════════════════════════════════════
// 3. CHURN PREDICTION ENGINE
// ═══════════════════════════════════════════════════════════════

async function predictChurn(supabase: any, userId: string) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000).toISOString();

  const [recentRes, olderRes, profileRes] = await Promise.all([
    supabase.from("study_logs").select("id").eq("user_id", userId).gte("created_at", sevenDaysAgo),
    supabase.from("study_logs").select("id").eq("user_id", userId).gte("created_at", fourteenDaysAgo).lt("created_at", sevenDaysAgo),
    supabase.from("profiles").select("last_active_at, created_at").eq("id", userId).maybeSingle(),
  ]);

  const recentCount = recentRes.data?.length || 0;
  const olderCount = olderRes.data?.length || 0;
  const riskFactors: string[] = [];
  let churnScore = 0;

  // Factor 1: Activity decline
  if (olderCount > 0 && recentCount === 0) {
    churnScore += 0.4;
    riskFactors.push("zero_activity_this_week");
  } else if (olderCount > 0 && recentCount < olderCount * 0.5) {
    churnScore += 0.25;
    riskFactors.push("activity_declined_50pct");
  }

  // Factor 2: Inactivity duration
  const lastActive = profileRes.data?.last_active_at;
  if (lastActive) {
    const daysSinceActive = (now.getTime() - new Date(lastActive).getTime()) / 86400000;
    if (daysSinceActive > 5) { churnScore += 0.3; riskFactors.push(`inactive_${Math.floor(daysSinceActive)}_days`); }
    else if (daysSinceActive > 3) { churnScore += 0.15; riskFactors.push(`inactive_${Math.floor(daysSinceActive)}_days`); }
  }

  // Factor 3: Low session count
  if (recentCount <= 1) { churnScore += 0.15; riskFactors.push("very_low_sessions"); }

  // Factor 4: New user vulnerability (< 7 days old)
  const createdAt = profileRes.data?.created_at;
  if (createdAt) {
    const accountAge = (now.getTime() - new Date(createdAt).getTime()) / 86400000;
    if (accountAge < 7 && recentCount < 3) { churnScore += 0.1; riskFactors.push("new_user_low_engagement"); }
  }

  churnScore = Math.min(1, churnScore);
  const riskLevel = churnScore >= 0.7 ? "critical" : churnScore >= 0.4 ? "high" : churnScore >= 0.2 ? "medium" : "low";
  const daysUntilChurn = churnScore >= 0.4 ? Math.max(1, Math.floor(7 * (1 - churnScore))) : null;

  // Upsert prediction
  await supabase.from("churn_predictions").upsert({
    user_id: userId,
    churn_probability: churnScore,
    risk_level: riskLevel,
    days_until_predicted_churn: daysUntilChurn,
    risk_factors: riskFactors,
    computed_at: now.toISOString(),
  }, { onConflict: "user_id", ignoreDuplicates: false });

  return { churn_probability: churnScore, risk_level: riskLevel, days_until_predicted_churn: daysUntilChurn, risk_factors: riskFactors };
}

// ═══════════════════════════════════════════════════════════════
// 4. SMART NOTIFICATION BUNDLING
// ═══════════════════════════════════════════════════════════════

async function bundleNotifications(supabase: any, userId: string) {
  // Gather recent low-priority events not yet bundled
  const cutoff = new Date(Date.now() - 24 * 3600000).toISOString();
  const { data: events } = await supabase
    .from("event_log")
    .select("event_type, payload, created_at")
    .eq("user_id", userId)
    .eq("status", "processed")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!events || events.length < 2) return { bundled: false, reason: "not_enough_events" };

  // Group by category
  const items = events.map((e: any) => ({
    type: e.event_type,
    summary: e.payload?.title || e.event_type.replace(/_/g, " "),
    time: e.created_at,
  }));

  // Check if bundle already exists today
  const today = new Date().toISOString().split("T")[0];
  const { data: existing } = await supabase
    .from("notification_bundles")
    .select("id")
    .eq("user_id", userId)
    .eq("bundle_type", "daily_summary")
    .gte("created_at", today)
    .maybeSingle();

  if (existing) return { bundled: false, reason: "already_bundled_today" };

  // Create bundle
  await supabase.from("notification_bundles").insert({
    user_id: userId,
    bundle_type: "daily_summary",
    items,
    item_count: items.length,
    channel: "push",
    status: "pending",
  });

  return { bundled: true, item_count: items.length };
}

// ═══════════════════════════════════════════════════════════════
// 5. BRAIN RISK ESCALATION PROTOCOL
// ═══════════════════════════════════════════════════════════════

const ESCALATION_LADDER = ["push", "email", "voice"];

async function checkEscalation(supabase: any, userId: string, eventType: string) {
  const { data: existing } = await supabase
    .from("notification_escalations")
    .select("*")
    .eq("user_id", userId)
    .eq("event_type", eventType)
    .eq("resolved", false)
    .maybeSingle();

  if (!existing) {
    // Create new escalation tracker
    await supabase.from("notification_escalations").insert({
      user_id: userId,
      event_type: eventType,
      ignore_count: 1,
      current_escalation_level: 0,
      escalation_channels: [ESCALATION_LADDER[0]],
    });
    return { escalated: false, level: 0, channels: [ESCALATION_LADDER[0]] };
  }

  // Increment ignore count and escalate
  const newLevel = Math.min(existing.current_escalation_level + 1, ESCALATION_LADDER.length - 1);
  const channels = ESCALATION_LADDER.slice(0, newLevel + 1);

  await supabase.from("notification_escalations")
    .update({
      ignore_count: existing.ignore_count + 1,
      current_escalation_level: newLevel,
      escalation_channels: channels,
      last_escalated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  return {
    escalated: true,
    level: newLevel,
    channels,
    ignore_count: existing.ignore_count + 1,
  };
}

// ═══════════════════════════════════════════════════════════════
// 6. ENGAGEMENT TRACKING
// ═══════════════════════════════════════════════════════════════

async function trackEngagement(supabase: any, userId: string, data: any) {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  const type = data?.type || "app_open";

  // Direct upsert without RPC
  try {
    const { data: existing } = await supabase
      .from("user_engagement_patterns")
      .select("id, engagement_count")
      .eq("user_id", userId)
      .eq("hour_of_day", hour)
      .eq("day_of_week", day)
      .eq("engagement_type", type)
      .maybeSingle();

    if (existing) {
      await supabase.from("user_engagement_patterns")
        .update({ engagement_count: existing.engagement_count + 1, last_engaged_at: now.toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase.from("user_engagement_patterns").insert({
        user_id: userId,
        hour_of_day: hour,
        day_of_week: day,
        engagement_type: type,
        engagement_count: 1,
      });
    }
  } catch (e) {
    console.warn("Engagement tracking failed:", e);
  }

  return { tracked: true, hour, day, type };
}

// ═══════════════════════════════════════════════════════════════
// 7. AUTO-LEARNING CHANNEL EFFECTIVENESS
// ═══════════════════════════════════════════════════════════════

async function updateChannelEffectiveness(supabase: any, userId: string, data: any) {
  const { channel, outcome } = data; // outcome: "sent" | "opened" | "clicked" | "ignored"

  const { data: existing } = await supabase
    .from("channel_effectiveness")
    .select("*")
    .eq("user_id", userId)
    .eq("channel", channel)
    .maybeSingle();

  if (!existing) {
    const row: any = {
      user_id: userId,
      channel,
      total_sent: outcome === "sent" ? 1 : 0,
      total_opened: outcome === "opened" ? 1 : 0,
      total_clicked: outcome === "clicked" ? 1 : 0,
      total_ignored: outcome === "ignored" ? 1 : 0,
    };
    row.effectiveness_score = computeEffectiveness(row);
    await supabase.from("channel_effectiveness").insert(row);
    return { updated: true, effectiveness_score: row.effectiveness_score };
  }

  const updated: any = { ...existing };
  if (outcome === "sent") updated.total_sent++;
  if (outcome === "opened") { updated.total_opened++; updated.last_successful_at = new Date().toISOString(); }
  if (outcome === "clicked") { updated.total_clicked++; updated.last_successful_at = new Date().toISOString(); }
  if (outcome === "ignored") updated.total_ignored++;

  updated.effectiveness_score = computeEffectiveness(updated);

  // Auto-disable channel if effectiveness is very low (< 5% over 50+ sends)
  if (updated.total_sent > 50 && updated.effectiveness_score < 0.05) {
    updated.is_disabled = true;
  }

  await supabase.from("channel_effectiveness")
    .update({
      total_sent: updated.total_sent,
      total_opened: updated.total_opened,
      total_clicked: updated.total_clicked,
      total_ignored: updated.total_ignored,
      effectiveness_score: updated.effectiveness_score,
      is_disabled: updated.is_disabled,
      last_successful_at: updated.last_successful_at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  return { updated: true, effectiveness_score: updated.effectiveness_score, is_disabled: updated.is_disabled };
}

function computeEffectiveness(ch: any): number {
  const sent = ch.total_sent || 1;
  const openRate = (ch.total_opened || 0) / sent;
  const clickRate = (ch.total_clicked || 0) / sent;
  return Math.round((openRate * 0.6 + clickRate * 0.4) * 10000) / 10000;
}

// ═══════════════════════════════════════════════════════════════
// 8. SMART CHANNEL SELECTION (Auto-Learning Priority)
// ═══════════════════════════════════════════════════════════════

async function getSmartChannels(supabase: any, userId: string) {
  const { data: channels } = await supabase
    .from("channel_effectiveness")
    .select("channel, effectiveness_score, is_disabled, total_sent")
    .eq("user_id", userId)
    .eq("is_disabled", false)
    .order("effectiveness_score", { ascending: false });

  if (!channels || channels.length === 0) {
    return { channels: ["push", "email"], source: "default" };
  }

  return {
    channels: channels.map((c: any) => c.channel),
    scores: channels.reduce((acc: any, c: any) => { acc[c.channel] = c.effectiveness_score; return acc; }, {}),
    source: "learned",
  };
}

// ═══════════════════════════════════════════════════════════════
// 9. RANK WAR MODE
// ═══════════════════════════════════════════════════════════════

async function rankWarCheck(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("exam_date, exam_type")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.exam_date) return { rank_war: false, reason: "no_exam_date" };

  const daysUntilExam = Math.ceil((new Date(profile.exam_date).getTime() - Date.now()) / 86400000);
  if (daysUntilExam > 30 || daysUntilExam < 0) return { rank_war: false, days_until_exam: daysUntilExam };

  // Fetch peer stats
  const { data: peers } = await supabase
    .from("profiles")
    .select("id")
    .eq("exam_type", profile.exam_type)
    .neq("id", userId)
    .limit(100);

  return {
    rank_war: true,
    days_until_exam: daysUntilExam,
    peer_count: peers?.length || 0,
    intensity: daysUntilExam <= 7 ? "extreme" : daysUntilExam <= 14 ? "high" : "moderate",
  };
}

// ═══════════════════════════════════════════════════════════════
// 10. DYNAMIC REWARDS
// ═══════════════════════════════════════════════════════════════

async function computeDynamicReward(supabase: any, userId: string, data: any) {
  const { session_duration, topics_reviewed, confidence_delta, memory_points_saved } = data || {};

  const rewards: string[] = [];

  if (memory_points_saved && memory_points_saved > 0) {
    rewards.push(`You saved ${memory_points_saved} memory points today 🧠`);
  }
  if (topics_reviewed && topics_reviewed > 3) {
    rewards.push(`${topics_reviewed} topics mastered — brain power unlocked 🔓`);
  }
  if (confidence_delta && confidence_delta > 0) {
    rewards.push(`Confidence boosted by ${Math.round(confidence_delta)}% 📈`);
  }
  if (session_duration && session_duration > 30) {
    rewards.push(`${session_duration}-minute deep focus — elite level 🏆`);
  }

  if (rewards.length === 0) {
    rewards.push("Every session counts. You're building a stronger brain 💪");
  }

  return { rewards, count: rewards.length };
}

// ═══════════════════════════════════════════════════════════════
// 11. BEHAVIORAL PROFILE COMPUTATION
// ═══════════════════════════════════════════════════════════════

async function computeBehavioralProfile(supabase: any, userId: string) {
  const [sendTime, channels, churn] = await Promise.all([
    computeOptimalSendTime(supabase, userId),
    getSmartChannels(supabase, userId),
    predictChurn(supabase, userId),
  ]);

  const channelScores = channels.scores || { push: 50, email: 50, voice: 50 };
  const stressLevel = churn.churn_probability >= 0.7 ? "high" : churn.churn_probability >= 0.4 ? "moderate" : "normal";
  const motivationType = churn.risk_level === "critical" ? "loss_aversion" : churn.risk_level === "high" ? "social_proof" : "achievement";

  const profile = {
    user_id: userId,
    engagement_score: Math.round((1 - churn.churn_probability) * 100),
    channel_preference: channelScores,
    churn_risk_score: churn.churn_probability,
    motivation_type: motivationType,
    stress_level: stressLevel,
    best_send_hour: sendTime.optimal_hour,
    best_send_day: sendTime.optimal_day || 1,
    notification_fatigue_score: 0,
    silence_mode_active: false,
    dopamine_strategy: motivationType === "loss_aversion" ? "scarcity" : motivationType === "social_proof" ? "social_proof" : "curiosity",
    habit_loop_stage: churn.churn_probability < 0.2 ? "reinforcement" : churn.churn_probability < 0.5 ? "reward" : "cue",
    rank_war_eligible: false,
    last_computed_at: new Date().toISOString(),
  };

  await supabase.from("behavioral_profiles").upsert(profile, { onConflict: "user_id" });
  return profile;
}

// ═══════════════════════════════════════════════════════════════
// 12. ANALYTICS DASHBOARD DATA
// ═══════════════════════════════════════════════════════════════

async function getNotificationAnalytics(supabase: any, data: any) {
  const days = data?.days || 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const [deliveryRes, churnRes, escalationRes, bundleRes, channelRes] = await Promise.all([
    supabase.from("notification_delivery_log").select("status, channel, created_at").gte("created_at", since),
    supabase.from("churn_predictions").select("risk_level, resolved, churn_probability").gte("created_at", since),
    supabase.from("notification_escalations").select("current_escalation_level, resolved").gte("created_at", since),
    supabase.from("notification_bundles").select("status, item_count").gte("created_at", since),
    supabase.from("channel_effectiveness").select("channel, effectiveness_score, total_sent, total_opened, total_clicked, total_ignored"),
  ]);

  const deliveries = deliveryRes.data || [];
  const totalSent = deliveries.length;
  const delivered = deliveries.filter((d: any) => d.status === "delivered").length;
  const channelBreakdown: Record<string, number> = {};
  for (const d of deliveries) {
    channelBreakdown[d.channel] = (channelBreakdown[d.channel] || 0) + 1;
  }

  const churns = churnRes.data || [];
  const churnPrevented = churns.filter((c: any) => c.resolved).length;
  const highRisk = churns.filter((c: any) => c.risk_level === "critical" || c.risk_level === "high").length;

  const escalations = escalationRes.data || [];
  const totalEscalated = escalations.length;
  const resolvedEscalations = escalations.filter((e: any) => e.resolved).length;

  const bundles = bundleRes.data || [];
  const totalBundled = bundles.reduce((s: number, b: any) => s + (b.item_count || 0), 0);

  const channels = channelRes.data || [];

  return {
    total_sent: totalSent,
    total_delivered: delivered,
    delivery_rate: totalSent > 0 ? Math.round((delivered / totalSent) * 100) : 0,
    channel_breakdown: channelBreakdown,
    churn_prevented: churnPrevented,
    high_risk_users: highRisk,
    total_escalated: totalEscalated,
    resolved_escalations: resolvedEscalations,
    total_bundled: totalBundled,
    channel_effectiveness: channels,
    period_days: days,
  };
}

async function getDashboardData(supabase: any) {
  const [profilesRes, churnRes, escalationsRes, abTestsRes] = await Promise.all([
    supabase.from("behavioral_profiles").select("engagement_score, churn_risk_score, motivation_type, dopamine_strategy, stress_level, silence_mode_active, habit_loop_stage").limit(500),
    supabase.from("churn_predictions").select("risk_level, resolved").order("created_at", { ascending: false }).limit(200),
    supabase.from("notification_escalations").select("current_escalation_level, resolved, event_type").eq("resolved", false).limit(50),
    supabase.from("notification_ab_tests").select("*").eq("is_active", true).limit(10),
  ]);

  const profiles = profilesRes.data || [];
  const avgEngagement = profiles.length > 0 ? Math.round(profiles.reduce((s: number, p: any) => s + (p.engagement_score || 0), 0) / profiles.length) : 0;
  const avgChurnRisk = profiles.length > 0 ? Math.round(profiles.reduce((s: number, p: any) => s + (p.churn_risk_score || 0) * 100, 0) / profiles.length) : 0;
  const silenceModeCount = profiles.filter((p: any) => p.silence_mode_active).length;

  const motivationDist: Record<string, number> = {};
  const strategyDist: Record<string, number> = {};
  const stressDist: Record<string, number> = {};
  const habitDist: Record<string, number> = {};
  for (const p of profiles) {
    motivationDist[p.motivation_type] = (motivationDist[p.motivation_type] || 0) + 1;
    strategyDist[p.dopamine_strategy] = (strategyDist[p.dopamine_strategy] || 0) + 1;
    stressDist[p.stress_level] = (stressDist[p.stress_level] || 0) + 1;
    habitDist[p.habit_loop_stage] = (habitDist[p.habit_loop_stage] || 0) + 1;
  }

  const churns = churnRes.data || [];
  const churnByLevel: Record<string, number> = {};
  for (const c of churns) {
    churnByLevel[c.risk_level] = (churnByLevel[c.risk_level] || 0) + 1;
  }

  return {
    total_profiles: profiles.length,
    avg_engagement: avgEngagement,
    avg_churn_risk: avgChurnRisk,
    silence_mode_count: silenceModeCount,
    motivation_distribution: motivationDist,
    strategy_distribution: strategyDist,
    stress_distribution: stressDist,
    habit_distribution: habitDist,
    churn_by_level: churnByLevel,
    active_escalations: escalationsRes.data || [],
    active_ab_tests: abTestsRes.data || [],
  };
}

// ─── Helpers ───

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
