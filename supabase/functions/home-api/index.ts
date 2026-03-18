import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const rawJson = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const json = (data: unknown, status = 200) => rawJson(sanitizeNulls(data), status);

const sanitizeNulls = (value: unknown): unknown => {
  if (value === null) return "";
  if (Array.isArray(value)) return value.map(sanitizeNulls);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [key, sanitizeNulls(nestedValue)]),
    );
  }
  return value;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

const adminClient = createClient(supabaseUrl, serviceKey);

async function resolveUser(req: Request): Promise<string | null> {
  // 1. Try Bearer JWT token
  const auth = req.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ")) {
    const token = auth.replace("Bearer ", "").trim();
    const { data } = await adminClient.auth.getUser(token);
    if (data?.user?.id) return data.user.id;
  }

  // 2. Try x-api-key / api-key headers (acry_ prefixed keys)
  const apiKeyCandidates = [
    req.headers.get("x-api-key"),
    req.headers.get("api-key"),
    req.headers.get("apikey"),
  ].filter(Boolean).map(k => k!.trim()).filter(Boolean);

  // Also check Authorization header as raw key (non-Bearer)
  if (auth && !auth.startsWith("Bearer ")) {
    apiKeyCandidates.push(auth.trim());
  }

  for (const candidate of apiKeyCandidates) {
    const acryMatch = candidate.match(/acry_[A-Za-z0-9]+/)?.[0];
    if (acryMatch) {
      const storedPrefix = `${acryMatch.substring(0, 10)}...`;
      const { data: keyRow } = await adminClient
        .from("api_keys")
        .select("created_by")
        .eq("key_prefix", storedPrefix)
        .eq("is_active", true)
        .maybeSingle();
      if (keyRow?.created_by) return keyRow.created_by;
    }

    // Fallback: match by key_hash
    const { data: hashRow } = await adminClient
      .from("api_keys")
      .select("created_by")
      .eq("key_hash", candidate)
      .eq("is_active", true)
      .maybeSingle();
    if (hashRow?.created_by) return hashRow.created_by;
  }

  return null;
}

function userClient(authHeader: string) {
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    // Extract route: e.g. "brain-health" from various path patterns
    const rawPath = url.pathname.replace(/^\/+|\/+$/g, "");
    const route = rawPath
      .replace(/^functions\/v1\/home-api\/?/i, "")
      .replace(/^home-api\/?/i, "")
      .replace(/^api\/home\/?/i, "")
      .replace(/^\/+|\/+$/g, "");

    const userId = await resolveUser(req);
    if (!userId) return json({ error: "Unauthorized" }, 401);

    let body: Record<string, unknown> = {};
    if (req.method === "POST" || req.method === "PATCH" || req.method === "PUT") {
      try {
        const text = await req.text();
        if (text.trim()) body = JSON.parse(text);
      } catch { /* empty body is fine */ }
    }

    // Also check query params
    const query = Object.fromEntries(url.searchParams.entries());

    switch (route) {
      // ─── Brain Health (Hero Section) ───
      case "brain-health": {
        const { data: topics } = await adminClient
          .from("topics")
          .select("id, memory_strength, risk_level")
          .eq("user_id", userId)
          .is("deleted_at", null);
        const all = topics || [];
        const total = all.length;
        const strong = all.filter((t: any) => (t.memory_strength ?? 0) >= 70).length;
        const weak = all.filter((t: any) => (t.memory_strength ?? 0) < 40).length;
        const atRisk = all.filter((t: any) => t.risk_level === "critical" || t.risk_level === "high").length;
        const avgHealth = total > 0 ? Math.round(all.reduce((s: number, t: any) => s + (t.memory_strength ?? 0), 0) / total) : 0;
        const healthLabel = total === 0 ? "Not started" : avgHealth > 70 ? "Strong" : avgHealth > 50 ? "Needs care" : "Critical";
        const tip = total === 0 ? "Add your first topic to start tracking brain health!" : avgHealth < 40 ? "Review your weakest topics to boost brain health" : "Keep going — your brain health is improving.";
        return json({ overall_health: avgHealth, health_label: healthLabel, at_risk_count: atRisk, total_topics: total, strong_topics: strong, weak_topics: weak, tip });
      }

      // ─── Rank Prediction ───
      case "rank-prediction": {
        const { data: pred } = await adminClient
          .from("rank_predictions")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!pred) {
          return json({ predicted_rank: 4500, rank_range: { min: 3825, max: 5175 }, trend: "needs_data", confidence: 0, factors: { memory_strength: 0, topics_covered: 0, study_minutes_this_week: 0, consistency: 0, note: "Add topics and study to get accurate rank predictions" } });
        }
        const predictedRank = pred.predicted_rank ?? Math.round(((pred.rank_range_min ?? 4000) + (pred.rank_range_max ?? 5000)) / 2);
        return json({
          predicted_rank: predictedRank,
          rank_range: { min: pred.rank_range_min ?? Math.max(1, predictedRank - Math.round(predictedRank * 0.15)), max: pred.rank_range_max ?? predictedRank + Math.round(predictedRank * 0.15) },
          trend: pred.trend || "stable",
          confidence: pred.confidence ?? 0,
          factors: pred.factors ?? {},
        });
      }

      // ─── Exam Countdown ───
      case "exam-countdown": {
        const { data: profile } = await adminClient
          .from("profiles")
          .select("exam_date")
          .eq("id", userId)
          .maybeSingle();
        if (!profile?.exam_date) return json({ days_left: 0, exam_date: "", urgency: "normal" });
        const daysLeft = Math.max(0, Math.ceil((new Date(profile.exam_date).getTime() - Date.now()) / 86400000));
        const urgency = daysLeft <= 3 ? "critical" : daysLeft <= 14 ? "warning" : "normal";
        return json({ days_left: daysLeft, exam_date: profile.exam_date, urgency });
      }

      // ─── Refresh AI ───
      case "refresh-ai": {
        const deepRefresh = body.deep_refresh !== false;
        const authHeader = req.headers.get("authorization") || "";
        const client = userClient(authHeader);

        // Fast lane: core refresh
        const [memRes, rankRes] = await Promise.allSettled([
          client.functions.invoke("memory-engine", { body: { action: "predict" } }),
          client.functions.invoke("precision-intelligence", { body: {} }),
        ]);

        // Get updated health
        const { data: topics } = await adminClient
          .from("topics")
          .select("memory_strength")
          .eq("user_id", userId)
          .is("deleted_at", null);
        const all = topics || [];
        const avgHealth = all.length > 0 ? Math.round(all.reduce((s: number, t: any) => s + (t.memory_strength ?? 0), 0) / all.length) : 0;

        // Count recommendations
        const { count } = await adminClient
          .from("ai_recommendations")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("completed", false);

        // Deep lane (non-blocking)
        if (deepRefresh) {
          void Promise.allSettled([
            client.functions.invoke("user-embedding", { body: {} }),
            client.functions.invoke("brain-missions", { body: { action: "generate" } }),
            client.functions.invoke("rl-agent", { body: {} }),
            client.functions.invoke("hybrid-prediction", { body: {} }),
          ]);
        }

        return json({
          status: "refreshed",
          overall_health: avgHealth,
          predicted_rank: (rankRes.status === "fulfilled" ? (rankRes.value as any)?.data?.predicted_rank : null) ?? null,
          recommendations_count: count ?? 0,
          deep_tasks_queued: deepRefresh,
        });
      }

      // ─── AI Recommendations ───
      case "ai-recommendations": {
        const limit = parseInt(query.limit || String(body.limit) || "5") || 5;
        const { data } = await adminClient
          .from("ai_recommendations")
          .select("id, title, description, type, priority, topic_id")
          .eq("user_id", userId)
          .eq("completed", false)
          .order("created_at", { ascending: false })
          .limit(limit);
        return json({ recommendations: data || [], tip: (data || []).length === 0 ? "Complete a few study sessions to unlock AI recommendations" : "" });
      }

      // ─── Burnout Status ───
      case "burnout-status": {
        const authHeader = req.headers.get("authorization") || "";
        const client = userClient(authHeader);
        const { data } = await client.functions.invoke("burnout-detection", { body: {} });
        return json(data ?? { burnout_score: 0, risk_level: "low", recommendations: [] });
      }

      // ─── Streak Status ───
      case "streak-status":
      case "streak-details": {
        const { data: streak } = await adminClient
          .from("study_streaks")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        const { count: freezeCount } = await adminClient
          .from("streak_freezes")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_used", false);
        const streakAtRisk = (streak?.current_streak ?? 0) > 0 && !(streak?.today_met);
        return json({
          current_streak: streak?.current_streak ?? 0,
          longest_streak: streak?.longest_streak ?? 0,
          today_met: streak?.today_met ?? false,
          auto_shield_used: streak?.auto_shield_used ?? false,
          freezes_available: freezeCount ?? 0,
          next_milestone: getNextMilestone(streak?.current_streak ?? 0),
          streak_at_risk: streakAtRisk,
          motivation: (streak?.current_streak ?? 0) === 0 ? "Start a study session to build your streak!" : streakAtRisk ? "Study now to keep your streak alive!" : "Nice work — keep the momentum going!",
        });
      }

      // ─── Daily Goal ───
      case "daily-goal": {
        const today = new Date().toISOString().split("T")[0];
        const [profileRes, logsRes] = await Promise.all([
          adminClient.from("profiles").select("daily_study_goal_minutes").eq("id", userId).maybeSingle(),
          adminClient.from("study_logs").select("duration_minutes").eq("user_id", userId).gte("created_at", `${today}T00:00:00Z`),
        ]);
        const goal = profileRes.data?.daily_study_goal_minutes ?? 60;
        const studied = (logsRes.data || []).reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0);
        const completionPct = Math.min(100, Math.round((studied / goal) * 100));
        return json({ goal_minutes: goal, studied_minutes: studied, completion_pct: completionPct, status: studied >= goal ? "completed" : studied > 0 ? "in_progress" : "not_started" });
      }

      // ─── Today's Mission ───
      case "todays-mission": {
        // Get top recommendation or top at-risk topic
        const { data: recs } = await adminClient
          .from("ai_recommendations")
          .select("id, title, description, type, priority, topic_id")
          .eq("user_id", userId)
          .eq("completed", false)
          .order("created_at", { ascending: false })
          .limit(1);
        if (recs && recs.length > 0) return json({ mission: recs[0], source: "ai_recommendation" });

        const { data: riskTopics } = await adminClient
          .from("topics")
          .select("id, name, memory_strength, risk_level, subject_id")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .in("risk_level", ["critical", "high"])
          .order("memory_strength", { ascending: true })
          .limit(1);
        if (riskTopics && riskTopics.length > 0) {
          const t = riskTopics[0];
          return json({
            mission: { id: `risk-${t.id}`, title: `Review: ${t.name}`, description: `Memory at ${Math.round(t.memory_strength ?? 0)}%`, type: "review", priority: t.risk_level || "high", topic_id: t.id },
            source: "risk_topic",
          });
        }

        // Check for any weak topics
        const { data: weakTopics } = await adminClient
          .from("topics")
          .select("id, name, memory_strength")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .order("memory_strength", { ascending: true })
          .limit(1);
        if (weakTopics && weakTopics.length > 0) {
          const w = weakTopics[0];
          return json({
            mission: { id: `weak-${w.id}`, title: `Strengthen: ${w.name}`, description: `Memory strength is ${Math.round(w.memory_strength ?? 0)}%. A quick review will help!`, type: "review", priority: "medium", topic_id: w.id },
            source: "weak_topic",
          });
        }

        return json({
          mission: { id: "onboard-start", title: "🚀 Add Your First Topic", description: "Start by adding a subject and topic to begin your AI-powered study journey!", type: "onboarding", priority: "high", topic_id: "" },
          source: "system",
        });
      }

      // ─── Quick Actions ───
      case "quick-actions": {
        const { data: topics } = await adminClient
          .from("topics")
          .select("id, name, memory_strength, risk_level")
          .eq("user_id", userId)
          .is("deleted_at", null);
        const all = topics || [];
        const atRisk = all.filter((t: any) => t.risk_level === "critical" || t.risk_level === "high");
        const weakest = [...all].sort((a: any, b: any) => (a.memory_strength ?? 0) - (b.memory_strength ?? 0)).slice(0, 3);
        const defaultTopic = { id: "", name: "", memory_strength: 0, risk_level: "low" };
        return json({
          smart_recall: { available: all.length > 0, topic: weakest[0] || defaultTopic, label: all.length === 0 ? "Add topics first" : "Smart Recall" },
          risk_shield: { available: atRisk.length > 0, count: atRisk.length, top_topic: atRisk[0] || defaultTopic },
          rank_boost: { available: all.length > 0 },
          focus_shield: { available: true },
        });
      }

      // ─── Review Queue ───
      case "review-queue": {
        const limit = parseInt(query.limit || "10") || 10;
        const { data } = await adminClient
          .from("topics")
          .select("id, name, memory_strength, risk_level, next_review_at, subject_id")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .not("next_review_at", "is", null)
          .lte("next_review_at", new Date().toISOString())
          .order("next_review_at", { ascending: true })
          .limit(limit);
        return json({ queue: data || [], count: (data || []).length });
      }

      // ─── Brain Missions ───
      case "brain-missions": {
        const status = query.status || String(body.status || "active");
        const { data } = await adminClient
          .from("brain_missions")
          .select("id, title, description, mission_type, priority, status, target_value, current_value, reward_type, reward_value, expires_at")
          .eq("user_id", userId)
          .eq("status", status)
          .order("created_at", { ascending: false })
          .limit(10);
        return json({ missions: data || [] });
      }

      // ─── Cognitive Embedding ───
      case "cognitive-embedding": {
        const { data } = await adminClient
          .from("user_embeddings")
          .select("embedding_data, learning_style, cognitive_strengths, updated_at")
          .eq("user_id", userId)
          .maybeSingle();
        return json({
          embedding_summary: data?.embedding_data ?? {},
          learning_style: data?.learning_style ?? "unknown",
          cognitive_strengths: data?.cognitive_strengths ?? [],
          last_computed_at: data?.updated_at ?? null,
        });
      }

      // ─── RL Policy ───
      case "rl-policy": {
        const { data } = await adminClient
          .from("rl_policy_states")
          .select("*")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return json({
          policy_version: data?.policy_version ?? "v1",
          optimization_target: data?.optimization_target ?? "memory_retention",
          current_reward: data?.current_reward ?? 0,
          actions_taken: data?.actions_taken ?? 0,
          last_updated_at: data?.updated_at ?? null,
        });
      }

      // ─── Auto Study Summary ───
      case "auto-study-summary": {
        const days = parseInt(query.days || String(body.days) || "7") || 7;
        const since = new Date(Date.now() - days * 86400000).toISOString();
        const { data: logs } = await adminClient
          .from("study_logs")
          .select("duration_minutes, subject_name, created_at")
          .eq("user_id", userId)
          .gte("created_at", since);
        const allLogs = logs || [];
        const totalMinutes = allLogs.reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0);
        const subjectMap: Record<string, number> = {};
        allLogs.forEach((l: any) => {
          const name = l.subject_name || "Unknown";
          subjectMap[name] = (subjectMap[name] || 0) + (l.duration_minutes || 0);
        });
        const topSubjects = Object.entries(subjectMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, minutes]) => ({ name, minutes }));
        return json({
          summary: `You studied ${totalMinutes} minutes across ${allLogs.length} sessions in the last ${days} days.`,
          total_minutes: totalMinutes,
          sessions_count: allLogs.length,
          top_subjects: topSubjects,
          patterns: [],
          suggestions: [],
        });
      }

      // ─── Precision Intelligence ───
      case "precision-intelligence": {
        const authHeader = req.headers.get("authorization") || "";
        const client = userClient(authHeader);
        const { data } = await client.functions.invoke("precision-intelligence", { body: {} });
        return json(data ?? { predicted_rank: null, rank_range: null, probability: 0, trend: "stable", improvement_potential: {}, competition_density: 0 });
      }

      // ─── Decay Forecast ───
      case "decay-forecast": {
        const limit = parseInt(query.limit || "10") || 10;
        const { data: topics } = await adminClient
          .from("topics")
          .select("id, name, memory_strength, risk_level, next_review_at, decay_rate, subject_id")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .order("memory_strength", { ascending: true })
          .limit(limit);
        const allTopics = topics || [];
        // Enrich with subject names
        const subjectIds = [...new Set(allTopics.map((t: any) => t.subject_id).filter(Boolean))];
        let subjectMap: Record<string, string> = {};
        if (subjectIds.length > 0) {
          const { data: subjects } = await adminClient.from("subjects").select("id, name").in("id", subjectIds);
          subjectMap = Object.fromEntries((subjects || []).map((s: any) => [s.id, s.name]));
        }
        const atRiskTopics = allTopics.map((t: any) => ({
          topic_id: t.id,
          topic_name: t.name,
          subject_name: subjectMap[t.subject_id] || "Unknown",
          memory_strength: t.memory_strength ?? 0,
          predicted_drop_date: t.next_review_at,
          decay_rate: t.decay_rate ?? 0,
          urgency: (t.memory_strength ?? 0) < 20 ? "critical" : (t.memory_strength ?? 0) < 40 ? "high" : (t.memory_strength ?? 0) < 60 ? "medium" : "low",
        }));
        const overallDecay = allTopics.length > 0 ? Math.round(allTopics.reduce((s: number, t: any) => s + (t.decay_rate ?? 0), 0) / allTopics.length * 100) / 100 : 0;
        return json({ at_risk_topics: atRiskTopics, overall_decay_rate: overallDecay });
      }

      // ─── Risk Digest ───
      case "risk-digest": {
        const { data: topics } = await adminClient
          .from("topics")
          .select("id, name, memory_strength, risk_level, subject_id")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .in("risk_level", ["critical", "high"])
          .order("memory_strength", { ascending: true })
          .limit(10);
        return json({ risk_topics: topics || [], count: (topics || []).length });
      }

      // ─── Brain Feed ───
      case "brain-feed": {
        const { data: reports } = await adminClient
          .from("brain_reports")
          .select("id, report_type, summary, metrics, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(5);
        return json({ feed: reports || [] });
      }

      // ─── Recently Studied ───
      case "recently-studied": {
        const { data: logs } = await adminClient
          .from("study_logs")
          .select("id, subject_name, topic_name, duration_minutes, mode, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(10);
        return json({ sessions: logs || [] });
      }

      // ─── Study Insights ───
      case "study-insights": {
        const authHeader = req.headers.get("authorization") || "";
        const client = userClient(authHeader);
        const { data } = await client.functions.invoke("study-insights", { body: {} });
        return json(data ?? { insights: [] });
      }

      // ─── Autopilot Status ───
      case "autopilot-status": {
        const today = new Date().toISOString().split("T")[0];
        const { data } = await adminClient
          .from("autopilot_sessions")
          .select("*")
          .eq("user_id", userId)
          .eq("session_date", today)
          .maybeSingle();
        const { data: config } = await adminClient
          .from("autopilot_config")
          .select("is_enabled")
          .limit(1)
          .maybeSingle();
        const safeSession = data ?? { id: "", session_date: today, status: "not_started", completed_sessions: 0, total_sessions: 0, planned_schedule: {}, performance_summary: {}, emergency_triggered: false, mode_switches: [] };
        return json({
          enabled: config?.is_enabled ?? false,
          today_session: safeSession,
          completed: safeSession.completed_sessions ?? 0,
          total: safeSession.total_sessions ?? 0,
        });
      }

      // ─── Daily Quote ───
      case "daily-quote": {
        const quotes = [
          { quote: "The secret of getting ahead is getting started.", author: "Mark Twain", category: "motivation" },
          { quote: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier", category: "consistency" },
          { quote: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson", category: "persistence" },
          { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs", category: "passion" },
          { quote: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela", category: "education" },
        ];
        const dayIndex = Math.floor(Date.now() / 86400000) % quotes.length;
        return json(quotes[dayIndex]);
      }

      // ─── Weekly Summary ───
      case "weekly-summary": {
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString();
        const [thisWeekRes, lastWeekRes] = await Promise.all([
          adminClient.from("study_logs").select("duration_minutes, topic_name").eq("user_id", userId).gte("created_at", weekAgo),
          adminClient.from("study_logs").select("duration_minutes").eq("user_id", userId).gte("created_at", twoWeeksAgo).lt("created_at", weekAgo),
        ]);
        const thisWeek = thisWeekRes.data || [];
        const lastWeek = lastWeekRes.data || [];
        const thisTotal = thisWeek.reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0);
        const lastTotal = lastWeek.reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0);
        const improvementPct = lastTotal > 0 ? Math.round(((thisTotal - lastTotal) / lastTotal) * 100) : 0;
        const topicSet = new Set(thisWeek.map((l: any) => l.topic_name).filter(Boolean));
        return json({
          total_minutes: thisTotal,
          sessions: thisWeek.length,
          topics_covered: topicSet.size,
          improvement_pct: improvementPct,
          highlights: [],
          weak_areas: [],
        });
      }

      // ─── Streak Recovery ───
      case "streak-recovery": {
        const { data: streak } = await adminClient
          .from("study_streaks")
          .select("current_streak, today_met")
          .eq("user_id", userId)
          .maybeSingle();
        const { count: freezeCount } = await adminClient
          .from("streak_freezes")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_used", false);
        const atRisk = (streak?.current_streak ?? 0) > 0 && !(streak?.today_met);
        return json({
          recovery_available: atRisk,
          freezes_count: freezeCount ?? 0,
          recovery_session_type: atRisk ? "quick_review" : null,
          streak_at_risk: atRisk,
        });
      }

      // ─── Trial Status ───
      case "trial-status": {
        const { data: sub } = await adminClient
          .from("user_subscriptions")
          .select("*, plan:subscription_plans(plan_key, name)")
          .eq("user_id", userId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!sub) return json({ plan_key: "free", plan_name: "Free Brain", is_trial: false, trial_days_remaining: null, status: "free", expires_at: null });
        const plan = sub.plan as any;
        const trialDaysRemaining = sub.is_trial && sub.trial_end_date
          ? Math.max(0, Math.ceil((new Date(sub.trial_end_date).getTime() - Date.now()) / 86400000))
          : null;
        return json({
          plan_key: plan?.plan_key ?? "unknown",
          plan_name: plan?.name ?? "Unknown",
          is_trial: sub.is_trial ?? false,
          trial_days_remaining: trialDaysRemaining,
          status: sub.status,
          expires_at: sub.expires_at,
        });
      }

      // ─── Welcome Status ───
      case "welcome-status": {
        const { data: profile } = await adminClient
          .from("profiles")
          .select("display_name, avatar_url, created_at")
          .eq("id", userId)
          .maybeSingle();
        const h = new Date().getHours();
        const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
        const isNew = profile?.created_at ? (Date.now() - new Date(profile.created_at).getTime()) < 86400000 : false;
        return json({
          show_welcome: isNew,
          display_name: profile?.display_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
          greeting,
        });
      }

      // ─── Completion Rate ───
      case "completion-rate": {
        const { data } = await adminClient
          .from("plan_quality_logs")
          .select("overall_completion_rate")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(2);
        const current = (data?.[0]?.overall_completion_rate ?? 0.5) * 100;
        const prev = data?.[1]?.overall_completion_rate ? data[1].overall_completion_rate * 100 : current;
        const trend = current > prev + 2 ? "improving" : current < prev - 2 ? "declining" : "stable";
        return json({ completion_rate: Math.round(current), trend });
      }

      // ═══ UNIFIED DASHBOARD — All data in one call ═══
      case "dashboard":
      case "all": {
        const today = new Date().toISOString().split("T")[0];
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

        // Run ALL queries in parallel for maximum speed
        const [
          topicsRes, profileRes, streakRes, freezeCountRes,
          recsRes, missionsRes, logsToday, logsWeek,
          rankPredRes, reportsRes, recentLogsRes,
          autopilotRes, autopilotCfgRes, subRes,
          completionRes, reviewQueueRes, riskTopicsRes
        ] = await Promise.all([
          adminClient.from("topics").select("id, name, memory_strength, risk_level, next_review_at, decay_rate, subject_id").eq("user_id", userId).is("deleted_at", null),
          adminClient.from("profiles").select("display_name, avatar_url, exam_date, daily_study_goal_minutes, created_at").eq("id", userId).maybeSingle(),
          adminClient.from("study_streaks").select("*").eq("user_id", userId).maybeSingle(),
          adminClient.from("streak_freezes").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_used", false),
          adminClient.from("ai_recommendations").select("id, title, description, type, priority, topic_id").eq("user_id", userId).eq("completed", false).order("created_at", { ascending: false }).limit(5),
          adminClient.from("brain_missions").select("id, title, description, mission_type, priority, status, target_value, current_value, reward_type, reward_value, expires_at").eq("user_id", userId).eq("status", "active").order("created_at", { ascending: false }).limit(10),
          adminClient.from("study_logs").select("duration_minutes").eq("user_id", userId).gte("created_at", `${today}T00:00:00Z`),
          adminClient.from("study_logs").select("duration_minutes, subject_name, topic_name, created_at").eq("user_id", userId).gte("created_at", weekAgo),
          adminClient.from("rank_predictions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          adminClient.from("brain_reports").select("id, report_type, summary, metrics, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
          adminClient.from("study_logs").select("id, subject_name, topic_name, duration_minutes, mode, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
          adminClient.from("autopilot_sessions").select("*").eq("user_id", userId).eq("session_date", today).maybeSingle(),
          adminClient.from("autopilot_config").select("is_enabled").limit(1).maybeSingle(),
          adminClient.from("user_subscriptions").select("*, plan:subscription_plans(plan_key, name)").eq("user_id", userId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
          adminClient.from("plan_quality_logs").select("overall_completion_rate").eq("user_id", userId).order("created_at", { ascending: false }).limit(2),
          adminClient.from("topics").select("id, name, memory_strength, risk_level, next_review_at, subject_id").eq("user_id", userId).is("deleted_at", null).not("next_review_at", "is", null).lte("next_review_at", new Date().toISOString()).order("next_review_at", { ascending: true }).limit(10),
          adminClient.from("topics").select("id, name, memory_strength, risk_level, subject_id").eq("user_id", userId).is("deleted_at", null).in("risk_level", ["critical", "high"]).order("memory_strength", { ascending: true }).limit(10),
        ]);

        const allTopics = topicsRes.data || [];
        const profile = profileRes.data;
        const streak = streakRes.data;
        const allRecs = recsRes.data || [];
        const todayLogs = logsToday.data || [];
        const weekLogs = logsWeek.data || [];

        // ── Brain Health ──
        const total = allTopics.length;
        const strong = allTopics.filter((t: any) => (t.memory_strength ?? 0) >= 70).length;
        const weak = allTopics.filter((t: any) => (t.memory_strength ?? 0) < 40).length;
        const atRisk = allTopics.filter((t: any) => t.risk_level === "critical" || t.risk_level === "high").length;
        const avgHealth = total > 0 ? Math.round(allTopics.reduce((s: number, t: any) => s + (t.memory_strength ?? 0), 0) / total) : 0;

        // ── Exam Countdown ──
        let examCountdown = { days_left: null as number | null, exam_date: null as string | null, urgency: "normal" };
        if (profile?.exam_date) {
          const daysLeft = Math.max(0, Math.ceil((new Date(profile.exam_date).getTime() - Date.now()) / 86400000));
          examCountdown = { days_left: daysLeft, exam_date: profile.exam_date, urgency: daysLeft <= 3 ? "critical" : daysLeft <= 14 ? "warning" : "normal" };
        }

        // ── Daily Goal ──
        const goalMin = profile?.daily_study_goal_minutes ?? 60;
        const studiedMin = todayLogs.reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0);

        // ── Streak ──
        const streakAtRisk = (streak?.current_streak ?? 0) > 0 && !(streak?.today_met);

        // ── Rank ──
        const pred = rankPredRes.data;

        // ── Weekly Summary ──
        const weekTotal = weekLogs.reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0);
        const subjectMap: Record<string, number> = {};
        weekLogs.forEach((l: any) => { const n = l.subject_name || "Unknown"; subjectMap[n] = (subjectMap[n] || 0) + (l.duration_minutes || 0); });
        const topSubjects = Object.entries(subjectMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, minutes]) => ({ name, minutes }));

        // ── Trial ──
        const sub = subRes.data;
        const subPlan = sub?.plan as any;
        const trialDaysRemaining = sub?.is_trial && sub?.trial_end_date ? Math.max(0, Math.ceil((new Date(sub.trial_end_date).getTime() - Date.now()) / 86400000)) : null;

        // ── Completion Rate ──
        const compData = completionRes.data || [];
        const compCurrent = ((compData as any)[0]?.overall_completion_rate ?? 0.5) * 100;
        const compPrev = (compData as any)[1]?.overall_completion_rate ? (compData as any)[1].overall_completion_rate * 100 : compCurrent;

        // ── Welcome ──
        const h = new Date().getHours();
        const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
        const isNew = profile?.created_at ? (Date.now() - new Date(profile.created_at).getTime()) < 86400000 : false;

        // ── Daily Quote ──
        const quotes = [
          { quote: "The secret of getting ahead is getting started.", author: "Mark Twain", category: "motivation" },
          { quote: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier", category: "consistency" },
          { quote: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson", category: "persistence" },
          { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs", category: "passion" },
          { quote: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela", category: "education" },
        ];
        const dayIndex = Math.floor(Date.now() / 86400000) % quotes.length;

        // ── Quick Actions ──
        const weakest = [...allTopics].sort((a: any, b: any) => (a.memory_strength ?? 0) - (b.memory_strength ?? 0)).slice(0, 3);
        const riskTopicsList = riskTopicsRes.data || [];

        // ── Today's Mission ──
        let todaysMission: any = { mission: null, source: null };
        if (allRecs.length > 0) {
          todaysMission = { mission: allRecs[0], source: "ai_recommendation" };
        } else {
          const riskArr = riskTopicsRes.data || [];
          if (riskArr.length > 0) {
            const t = riskArr[0] as any;
            todaysMission = { mission: { id: `risk-${t.id}`, title: `Review: ${t.name}`, description: `Memory at ${Math.round(t.memory_strength ?? 0)}%`, type: "review", priority: t.risk_level, topic_id: t.id }, source: "risk_topic" };
          } else if (total > 0 && weakest.length > 0) {
            const w = weakest[0] as any;
            todaysMission = { mission: { id: `weak-${w.id}`, title: `Strengthen: ${w.name}`, description: `Memory strength is ${Math.round(w.memory_strength ?? 0)}%. A quick review will help!`, type: "review", priority: "medium", topic_id: w.id }, source: "weak_topic" };
          } else {
            todaysMission = { mission: { id: "onboard-start", title: "🚀 Add Your First Topic", description: "Start by adding a subject and topic to begin your AI-powered study journey!", type: "onboarding", priority: "high", topic_id: "" }, source: "system" };
          }
        }

        const defaultTopic = {
          id: "",
          name: "",
          memory_strength: 0,
          risk_level: "low",
          subject_id: "",
        };

        const safeExamCountdown = examCountdown.exam_date
          ? examCountdown
          : { days_left: 0, exam_date: "", urgency: "normal" };

        const safeSmartRecallTopic = weakest[0] || defaultTopic;
        const safeRiskTopic = riskTopicsList[0] || defaultTopic;

        const estimatedConfidence = Math.min(100, total * 5 + weekLogs.length * 2);
        const fallbackRank = total > 0
          ? Math.max(1, Math.round(5000 - (avgHealth * 40) - (total * 10) - (studiedMin * 2)))
          : 4500;

        // ── Rank Prediction (never null) ──
        const resolvedPredictedRank = pred?.predicted_rank
          ?? (pred?.rank_range_min && pred?.rank_range_max
            ? Math.round((pred.rank_range_min + pred.rank_range_max) / 2)
            : fallbackRank);
        const resolvedRankMin = pred?.rank_range_min ?? Math.max(1, resolvedPredictedRank - Math.round(resolvedPredictedRank * 0.15));
        const resolvedRankMax = pred?.rank_range_max ?? resolvedPredictedRank + Math.round(resolvedPredictedRank * 0.15);

        const rankPrediction = {
          predicted_rank: resolvedPredictedRank,
          rank_range: { min: resolvedRankMin, max: resolvedRankMax },
          trend: pred?.trend || (weekTotal > 60 ? "rising" : weekTotal > 0 ? "stable" : "needs_data"),
          confidence: pred?.confidence ?? estimatedConfidence,
          factors: pred?.factors ?? {
            memory_strength: avgHealth,
            topics_covered: total,
            study_minutes_this_week: weekTotal,
            consistency: streak?.current_streak ?? 0,
            note: total === 0 ? "Add topics and study to get accurate rank predictions" : "Rank improves as you study more consistently",
          },
        };

        // ── Trial Status (never null) ──
        const trialStatus = sub
          ? {
              plan_key: subPlan?.plan_key ?? "unknown",
              plan_name: subPlan?.name ?? "Unknown",
              is_trial: sub.is_trial ?? false,
              trial_days_remaining: trialDaysRemaining ?? 0,
              status: sub.status,
              expires_at: sub.expires_at ?? "",
              upgrade_prompt: "",
            }
          : {
              plan_key: "free",
              plan_name: "Free Brain",
              is_trial: false,
              trial_days_remaining: 0,
              status: "free",
              expires_at: "",
              upgrade_prompt: "Upgrade to Premium for AI-powered study plans, unlimited topics, and rank predictions!",
            };

        const safeAutopilotSession = autopilotRes.data ?? {
          id: "",
          session_date: today,
          status: "not_started",
          completed_sessions: 0,
          total_sessions: 0,
          planned_schedule: {},
          performance_summary: {},
          emergency_triggered: false,
          mode_switches: [],
        };

        return json(sanitizeNulls({
          brain_health: {
            overall_health: avgHealth,
            health_label: avgHealth > 70 ? "Strong" : avgHealth > 50 ? "Needs care" : total === 0 ? "Not started" : "Critical",
            at_risk_count: atRisk,
            total_topics: total,
            strong_topics: strong,
            weak_topics: weak,
            tip: total === 0 ? "Add your first topic to start tracking brain health!" : avgHealth < 40 ? "Review your weakest topics to boost brain health" : "Keep going — your brain health is improving.",
          },
          rank_prediction: rankPrediction,
          exam_countdown: safeExamCountdown,
          daily_goal: {
            goal_minutes: goalMin,
            studied_minutes: studiedMin,
            completion_pct: Math.min(100, Math.round((studiedMin / goalMin) * 100)),
            status: studiedMin >= goalMin ? "completed" : studiedMin > 0 ? "in_progress" : "not_started",
          },
          streak: {
            current_streak: streak?.current_streak ?? 0,
            longest_streak: streak?.longest_streak ?? 0,
            today_met: streak?.today_met ?? false,
            auto_shield_used: streak?.auto_shield_used ?? false,
            freezes_available: freezeCountRes.count ?? 0,
            next_milestone: getNextMilestone(streak?.current_streak ?? 0),
            streak_at_risk: streakAtRisk,
            motivation: (streak?.current_streak ?? 0) === 0 ? "Start a study session to build your streak!" : streakAtRisk ? "Study now to keep your streak alive!" : "Nice work — keep the momentum going!",
          },
          todays_mission: todaysMission,
          ai_recommendations: {
            recommendations: allRecs,
            tip: allRecs.length === 0 ? "Complete a few study sessions to unlock AI recommendations" : "You already have AI recommendations ready.",
          },
          brain_missions: { missions: missionsRes.data || [] },
          quick_actions: {
            smart_recall: { available: total > 0, topic: safeSmartRecallTopic, label: total === 0 ? "Add topics first" : "Smart Recall" },
            risk_shield: { available: riskTopicsList.length > 0, count: riskTopicsList.length, top_topic: safeRiskTopic },
            rank_boost: { available: total > 0 },
            focus_shield: { available: true },
          },
          review_queue: { queue: reviewQueueRes.data || [], count: (reviewQueueRes.data || []).length },
          risk_digest: { risk_topics: riskTopicsList, count: riskTopicsList.length },
          weekly_summary: {
            total_minutes: weekTotal,
            sessions: weekLogs.length,
            top_subjects: topSubjects,
            summary: weekLogs.length === 0 ? "No study sessions this week. Start today!" : `You studied ${weekTotal} minutes across ${weekLogs.length} sessions this week.`,
          },
          recently_studied: {
            sessions: recentLogsRes.data || [],
            tip: (recentLogsRes.data || []).length === 0 ? "Your recent sessions will appear here" : "Your latest study sessions are shown here.",
          },
          brain_feed: { feed: reportsRes.data || [] },
          autopilot: {
            enabled: autopilotCfgRes.data?.is_enabled ?? false,
            today_session: safeAutopilotSession,
            completed: safeAutopilotSession.completed_sessions ?? 0,
            total: safeAutopilotSession.total_sessions ?? 0,
          },
          trial_status: trialStatus,
          completion_rate: { completion_rate: Math.round(compCurrent), trend: compCurrent > compPrev + 2 ? "improving" : compCurrent < compPrev - 2 ? "declining" : "stable" },
          welcome: {
            show_welcome: isNew,
            display_name: profile?.display_name?.trim() || "Learner",
            avatar_url: profile?.avatar_url || "",
            greeting,
          },
          daily_quote: quotes[dayIndex],
        }));
      }

      default:
        return json({ error: `Unknown home route: ${route}`, available_routes: [
          "dashboard", "all",
          "brain-health", "rank-prediction", "exam-countdown", "refresh-ai",
          "ai-recommendations", "burnout-status", "streak-status", "streak-details",
          "daily-goal", "todays-mission", "quick-actions", "review-queue",
          "brain-missions", "cognitive-embedding", "rl-policy", "auto-study-summary",
          "precision-intelligence", "decay-forecast", "risk-digest", "brain-feed",
          "recently-studied", "study-insights", "autopilot-status", "daily-quote",
          "weekly-summary", "streak-recovery", "trial-status", "welcome-status",
          "completion-rate",
        ]}, 404);
    }
  } catch (e) {
    console.error("[home-api] Error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function getNextMilestone(current: number): number | null {
  const milestones = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365];
  return milestones.find(m => m > current) ?? null;
}
