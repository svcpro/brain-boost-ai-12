import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const securityHeaders = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  "Pragma": "no-cache",
  "Surrogate-Control": "no-store",
  "CDN-Cache-Control": "no-store",
  "Vary": "Authorization, x-api-key, api-key, apikey, x-access-token, access-token",
};

const rawJson = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, ...securityHeaders, "Content-Type": "application/json" },
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
  const auth = req.headers.get("authorization") ?? "";
  const normalizedAuth = auth.trim();
  const jwtToken = normalizedAuth.startsWith("Bearer ")
    ? normalizedAuth.replace("Bearer ", "").trim()
    : normalizedAuth.split(".").length === 3
      ? normalizedAuth
      : "";

  // 1. Try JWT token from Authorization header (with or without Bearer prefix)
  if (jwtToken) {
    const token = jwtToken;
    const { data } = await adminClient.auth.getUser(token);
    if (data?.user?.id) return data.user.id;
  }

  // 2. Try x-api-key / api-key headers
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
    const normalizedCandidate = candidate.trim();
    if (!normalizedCandidate) continue;

    const resolvedApiKey = normalizedCandidate.match(/acry_[A-Za-z0-9]+/)?.[0] || normalizedCandidate;

    const { data: keyRow } = await adminClient
      .from("api_keys")
      .select("created_by")
      .eq("key_hash", resolvedApiKey)
      .eq("is_active", true)
      .maybeSingle();

    if (keyRow?.created_by) return keyRow.created_by;
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
    let route = rawPath
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

    // If route is empty (SDK invoke), resolve from x-route header or body.route/body.action
    if (!route) {
      route = req.headers.get("x-route") || String(body.route || body.action || query.route || "");
    }

    switch (route) {
      // ─── Brain Health (Hero Section) ───
      case "brain-health": {
        const { data: topics } = await adminClient
          .from("topics")
          .select("id, memory_strength")
          .eq("user_id", userId)
          .is("deleted_at", null);
        const all = topics || [];
        const total = all.length;
        const strong = all.filter((t: any) => (t.memory_strength ?? 0) >= 70).length;
        const weak = all.filter((t: any) => (t.memory_strength ?? 0) < 40).length;
        const atRisk = all.filter((t: any) => (t.memory_strength ?? 0) < 40).length;
        const avgHealth = total > 0 ? Math.round(all.reduce((s: number, t: any) => s + (t.memory_strength ?? 0), 0) / total) : 0;
        const healthLabel = total === 0 ? "Not started" : avgHealth > 70 ? "Strong" : avgHealth > 50 ? "Needs care" : "Critical";
        const tip = total === 0 ? "Add your first topic to start tracking brain health!" : avgHealth < 40 ? "Review your weakest topics to boost brain health" : "Keep going — your brain health is improving.";
        return json({ overall_health: avgHealth, health_label: healthLabel, at_risk_count: atRisk, total_topics: total, strong_topics: strong, weak_topics: weak, tip });
      }

      // ─── Rank Prediction ───
      case "rank-prediction": {
        const [predV2Res, predV1Res] = await Promise.all([
          adminClient
            .from("rank_predictions_v2")
            .select("predicted_rank, rank_band_low, rank_band_high, percentile_estimation, factors_breakdown, computed_at")
            .eq("user_id", userId)
            .order("computed_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          adminClient
            .from("rank_predictions")
            .select("predicted_rank, percentile, factors, recorded_at")
            .eq("user_id", userId)
            .order("recorded_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        const predV2 = predV2Res.data;
        const predV1 = predV1Res.data;
        const predictedRank = predV2?.predicted_rank ?? predV1?.predicted_rank ?? 4500;

        if (!predV2 && !predV1) {
          return json({ predicted_rank: 4500, rank_range: { min: 3825, max: 5175 }, trend: "needs_data", confidence: 0, factors: { memory_strength: 0, topics_covered: 0, study_minutes_this_week: 0, consistency: 0, note: "Add topics and study to get accurate rank predictions" } });
        }

        return json({
          predicted_rank: predictedRank,
          rank_range: {
            min: predV2?.rank_band_low ?? Math.max(1, Math.round(predictedRank * 0.85)),
            max: predV2?.rank_band_high ?? Math.round(predictedRank * 1.15),
          },
          trend: "stable",
          confidence: predV2?.percentile_estimation ?? predV1?.percentile ?? 0,
          factors: predV1?.factors ?? {},
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
        // Helper to resolve topic_name & subject_name
        const resolveTopicInfo = async (topicId: string) => {
          if (!topicId) return { topic_name: "", subject_name: "" };
          const { data: t } = await adminClient.from("topics").select("name, subject_id").eq("id", topicId).maybeSingle();
          if (!t) return { topic_name: "", subject_name: "" };
          let sName = "";
          if (t.subject_id) {
            const { data: s } = await adminClient.from("subjects").select("name").eq("id", t.subject_id).maybeSingle();
            sName = s?.name || "";
          }
          return { topic_name: t.name || "", subject_name: sName };
        };

        // Priority 1: Active brain missions
        const { data: activeMissions } = await adminClient
          .from("brain_missions")
          .select("id, title, description, mission_type, priority, target_topic_id, status, reasoning, reward_value, target_value")
          .eq("user_id", userId)
          .in("status", ["active", "in_progress"])
          .order("created_at", { ascending: false })
          .limit(1);
        if (activeMissions && activeMissions.length > 0) {
          const bm = activeMissions[0];
          const info = await resolveTopicInfo(bm.target_topic_id || "");
          const minMatch = (bm.description || "").match(/(\d+)[\s-]*min/i);
          const estMin = minMatch ? parseInt(minMatch[1]) : (bm.target_value || 15);
          return json({
            mission: {
              id: bm.id, title: bm.title,
              description: bm.description || `Complete this ${bm.mission_type} mission`,
              type: bm.mission_type || "review", priority: bm.priority || "medium",
              topic_id: bm.target_topic_id || "",
              topic_name: info.topic_name, subject_name: info.subject_name,
              estimated_minutes: estMin, estimatedMinutes: estMin, brain_improvement_pct: bm.reward_value || 5, brainImprovementPct: bm.reward_value || 5,
              reasoning: bm.reasoning || "Personalized by your AI brain agent.",
            },
            source: "brain_mission",
          });
        }

        // Priority 2: AI recommendation
        const { data: recs } = await adminClient
          .from("ai_recommendations")
          .select("id, title, description, type, priority, topic_id")
          .eq("user_id", userId)
          .eq("completed", false)
          .order("created_at", { ascending: false })
          .limit(1);
        if (recs && recs.length > 0) {
          const rec = recs[0];
          const info = await resolveTopicInfo(rec.topic_id || "");
          return json({
            mission: {
              ...rec, topic_name: info.topic_name, subject_name: info.subject_name,
              estimated_minutes: 15, estimatedMinutes: 15, brain_improvement_pct: 5, brainImprovementPct: 5,
              reasoning: rec.description || "AI recommendation based on your learning patterns.",
            },
            source: "ai_recommendation",
          });
        }

        // Priority 3: Critical/high risk topics (memory_strength < 40)
        const { data: riskTopics } = await adminClient
          .from("topics")
          .select("id, name, memory_strength, subject_id")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .lt("memory_strength", 40)
          .order("memory_strength", { ascending: true })
          .limit(1);
        if (riskTopics && riskTopics.length > 0) {
          const t = riskTopics[0];
          const riskLevel = Number(t.memory_strength) < 20 ? "critical" : "high";
          let sName = "";
          if (t.subject_id) {
            const { data: s } = await adminClient.from("subjects").select("name").eq("id", t.subject_id).maybeSingle();
            sName = s?.name || "";
          }
          const brainPct = Number(t.memory_strength) < 20 ? 15 : 10;
          return json({
            mission: {
              id: `risk-${t.id}`, title: `Review: ${t.name}`,
              description: `Memory at ${Math.round(t.memory_strength ?? 0)}% — needs urgent review`,
              type: "review", priority: riskLevel, topic_id: t.id,
              topic_name: t.name, subject_name: sName,
              estimated_minutes: 15, estimatedMinutes: 15, brain_improvement_pct: brainPct, brainImprovementPct: brainPct,
              reasoning: `${t.name} memory is critically low at ${Math.round(t.memory_strength ?? 0)}%. Reviewing now will prevent further decay.`,
            },
            source: "risk_topic",
          });
        }

        // Priority 4: Only truly weak topics (< 60%)
        const { data: weakTopics } = await adminClient
          .from("topics")
          .select("id, name, memory_strength, subject_id")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .lt("memory_strength", 60)
          .order("memory_strength", { ascending: true })
          .limit(1);
        if (weakTopics && weakTopics.length > 0) {
          const w = weakTopics[0];
          let sName = "";
          if (w.subject_id) {
            const { data: s } = await adminClient.from("subjects").select("name").eq("id", w.subject_id).maybeSingle();
            sName = s?.name || "";
          }
          return json({
            mission: {
              id: `weak-${w.id}`, title: `Strengthen: ${w.name}`,
              description: `Memory strength is ${Math.round(w.memory_strength ?? 0)}%. A quick review will help!`,
              type: "review", priority: Number(w.memory_strength) < 30 ? "high" : "medium", topic_id: w.id,
              topic_name: w.name, subject_name: sName,
              estimated_minutes: 10, brain_improvement_pct: 8,
              reasoning: `Strengthening ${w.name} will boost your overall brain health.`,
            },
            source: "weak_topic",
          });
        }

        // Priority 5: Topics due for spaced repetition
        const { data: dueTopics } = await adminClient
          .from("topics")
          .select("id, name, memory_strength, next_predicted_drop_date, subject_id")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .not("next_predicted_drop_date", "is", null)
          .lte("next_predicted_drop_date", new Date().toISOString())
          .order("next_predicted_drop_date", { ascending: true })
          .limit(1);
        if (dueTopics && dueTopics.length > 0) {
          const d = dueTopics[0];
          let sName = "";
          if (d.subject_id) {
            const { data: s } = await adminClient.from("subjects").select("name").eq("id", d.subject_id).maybeSingle();
            sName = s?.name || "";
          }
          return json({
            mission: {
              id: `review-${d.id}`, title: `Review: ${d.name}`,
              description: `Scheduled for spaced repetition review`,
              type: "review", priority: "medium", topic_id: d.id,
              topic_name: d.name, subject_name: sName,
              estimated_minutes: 10, brain_improvement_pct: 5,
              reasoning: `${d.name} is due for spaced repetition to maintain long-term retention.`,
            },
            source: "review_queue",
          });
        }

        // Priority 6: All strong — practice mode with a specific topic
        const { data: practiceTopics } = await adminClient
          .from("topics")
          .select("id, name, memory_strength, subject_id")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .order("memory_strength", { ascending: true })
          .limit(5);
        if (practiceTopics && practiceTopics.length > 0) {
          const pick = practiceTopics[Math.floor(Math.random() * practiceTopics.length)];
          let subjectName = "General";
          if (pick.subject_id) {
            const { data: subj } = await adminClient.from("subjects").select("name").eq("id", pick.subject_id).maybeSingle();
            if (subj?.name) subjectName = subj.name;
          }
          return json({
            mission: {
              id: `practice-${pick.id}`, title: `Practice: ${subjectName}`,
              description: `Complete 10 practice questions on ${pick.name}.`,
              type: "practice", priority: "low", topic_id: pick.id,
              topic_name: pick.name, subject_name: subjectName,
              estimated_minutes: 15, brain_improvement_pct: 3,
              reasoning: `All topics are strong! Practice keeps your skills sharp.`,
            },
            source: "maintenance",
          });
        }

        // Priority 7: No topics
        return json({
          mission: {
            id: "onboard-start", title: "🚀 Add Your First Topic",
            description: "Start by adding a subject and topic to begin your AI-powered study journey!",
            type: "onboarding", priority: "high", topic_id: "",
            topic_name: "", subject_name: "", estimated_minutes: 5, brain_improvement_pct: 0,
            reasoning: "Get started by adding your first topic!",
          },
          source: "system",
        });
      }

      // ─── Quick Actions ───
      case "quick-actions": {
        const [topicsRes, streakLogsQA, focusRes] = await Promise.all([
          adminClient.from("topics").select("id, name, memory_strength").eq("user_id", userId).is("deleted_at", null),
          adminClient.from("study_sessions").select("created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(60),
          adminClient.from("distraction_scores").select("focus_score").eq("user_id", userId).eq("score_date", new Date().toISOString().slice(0, 10)).maybeSingle(),
        ]);
        const all = topicsRes.data || [];
        const atRisk = all.filter((t: any) => (t.memory_strength ?? 0) < 40);
        const weakest = [...all].sort((a: any, b: any) => (a.memory_strength ?? 0) - (b.memory_strength ?? 0)).slice(0, 3);
        const defaultTopic = { id: "", name: "", memory_strength: 0, risk_level: "low" };
        const totalTopics = all.length;
        const avgHealth = totalTopics > 0 ? Math.round(all.reduce((s: number, t: any) => s + (t.memory_strength ?? 0), 0) / totalTopics) : 0;
        const qaStreakDays = calculateStreak((streakLogsQA.data || []) as Array<{ created_at: string }>).current_streak;
        const focusScoreVal = (focusRes.data as any)?.focus_score ?? null;
        return json({
          smart_recall: {
            available: totalTopics > 0,
            topic: weakest[0] ? { ...weakest[0], risk_level: (weakest[0].memory_strength ?? 0) < 40 ? "high" : "low" } : defaultTopic,
            label: totalTopics === 0 ? "Add topics first" : "Smart Recall",
            reward: "+3% memory",
          },
          risk_shield: {
            available: atRisk.length > 0,
            count: atRisk.length,
            top_topic: atRisk[0] ? { ...atRisk[0], risk_level: "high" } : defaultTopic,
            reward: atRisk.length > 0 ? `${atRisk.length} at risk` : "All safe",
          },
          rank_boost: {
            available: totalTopics > 0,
            reward: "+1 rank",
          },
          focus_shield: {
            available: true,
            reward: focusScoreVal !== null ? `${focusScoreVal}% focus` : "Track focus",
            focus_score: focusScoreVal,
          },
          overall_health: avgHealth,
          streak_days: qaStreakDays,
          at_risk_count: atRisk.length,
          total_topics: totalTopics,
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
          .select("id, name, memory_strength, next_predicted_drop_date, subject_id")
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
          predicted_drop_date: t.next_predicted_drop_date || "",
          decay_rate: 0,
          urgency: (t.memory_strength ?? 0) < 20 ? "critical" : (t.memory_strength ?? 0) < 40 ? "high" : (t.memory_strength ?? 0) < 60 ? "medium" : "low",
        }));
        const overallDecay = 0;
        return json({ at_risk_topics: atRiskTopics, overall_decay_rate: overallDecay });
      }

      // ─── Risk Digest ───
      case "risk-digest": {
        const { data: topics } = await adminClient
          .from("topics")
          .select("id, name, memory_strength, subject_id")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .lt("memory_strength", 40)
          .order("memory_strength", { ascending: true })
          .limit(10);
        const riskDigestTopics = (topics || []).map((t: any) => ({
          ...t,
          risk_level: (t.memory_strength ?? 0) < 20 ? "critical" : "high",
        }));
        return json({ risk_topics: riskDigestTopics, count: riskDigestTopics.length });
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
        return json({ sessions: logs || [], tip: (logs || []).length === 0 ? "Your recent sessions will appear here" : "" });
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
          top_subjects: topSubjects,
          summary: thisWeek.length === 0 ? "No study sessions this week. Start today!" : `You studied ${thisTotal} minutes across ${thisWeek.length} sessions this week.`,
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
        if (!sub) return json({ plan_key: "free", plan_name: "Free Brain", is_trial: false, trial_days_remaining: 0, status: "free", expires_at: "", upgrade_prompt: "Upgrade to Premium for AI-powered study plans, unlimited topics, and rank predictions!" });
        const plan = sub.plan as any;
        const trialDaysRemaining = sub.is_trial && sub.trial_end_date
          ? Math.max(0, Math.ceil((new Date(sub.trial_end_date).getTime() - Date.now()) / 86400000))
          : 0;
        return json({
          plan_key: plan?.plan_key ?? "unknown",
          plan_name: plan?.name ?? "Unknown",
          is_trial: sub.is_trial ?? false,
          trial_days_remaining: trialDaysRemaining,
          status: sub.status,
          expires_at: sub.expires_at ?? "",
          upgrade_prompt: "",
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
          display_name: profile?.display_name?.trim() || "Learner",
          avatar_url: profile?.avatar_url || "",
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
        // ─── Onboarding gate — block dashboard if user hasn't completed onboarding ───
        const { data: gateProfile } = await adminClient
          .from("profiles")
          .select("display_name, study_preferences, is_banned, onboarding_completed, exam_type")
          .eq("id", userId)
          .maybeSingle();

        if ((gateProfile as any)?.is_banned) {
          return json({
            error: "account_suspended",
            onboarding_required: false,
            message: "Your account has been suspended. Please contact support.",
            redirect_to: "/banned",
          }, 403);
        }

        const prefs = (gateProfile as any)?.study_preferences as Record<string, unknown> | null;
        const onboardingCompleted =
          (gateProfile as any)?.onboarding_completed === true ||
          prefs?.onboarded === true;

        if (!onboardingCompleted) {
          const [subjCountRes, topicCountRes] = await Promise.all([
            adminClient.from("subjects").select("id", { count: "exact", head: true }).eq("user_id", userId),
            adminClient.from("topics").select("id", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null),
          ]);

          let currentStep = 1;
          if ((gateProfile as any)?.display_name) currentStep = 2;
          if ((gateProfile as any)?.exam_type) currentStep = 3;
          if ((subjCountRes.count || 0) > 0) currentStep = 4;
          if ((topicCountRes.count || 0) > 0) currentStep = 5;
          if ((prefs as any)?.study_mode) currentStep = 6;

          return json({
            error: "onboarding_required",
            onboarding_required: true,
            onboarded: false,
            current_step: currentStep,
            next_action: "POST /functions/v1/onboarding with { action: 'get-status' }",
            message: "User has not completed onboarding. Complete onboarding before accessing the dashboard.",
            redirect_to: "/onboarding",
          }, 403);
        }

        const today = new Date().toISOString().split("T")[0];
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString();
        const nowIso = new Date().toISOString();

        const getRiskLevel = (memoryStrength: number) => {
          if (memoryStrength < 20) return "critical";
          if (memoryStrength < 40) return "high";
          if (memoryStrength < 60) return "medium";
          return "low";
        };

        const buildTopicView = (topic: Record<string, unknown>) => {
          const memoryStrength = Number(topic.memory_strength ?? 0);
          return {
            id: String(topic.id ?? ""),
            name: String(topic.name ?? ""),
            memory_strength: memoryStrength,
            risk_level: getRiskLevel(memoryStrength),
            subject_id: String(topic.subject_id ?? ""),
            next_review_at: String(topic.next_predicted_drop_date ?? ""),
          };
        };

        const calculateStreak = (entries: Array<{ created_at: string }>) => {
          const dateSet = new Set(entries.map((entry) => entry.created_at.split("T")[0]));
          const todayDate = new Date(`${today}T00:00:00Z`);
          const yesterdayDate = new Date(todayDate.getTime() - 86400000);
          const hasToday = dateSet.has(today);

          let cursor = hasToday ? todayDate : yesterdayDate;
          let currentStreak = 0;

          while (dateSet.has(cursor.toISOString().split("T")[0])) {
            currentStreak += 1;
            cursor = new Date(cursor.getTime() - 86400000);
          }

          const orderedDates = Array.from(dateSet).sort();
          let longestStreak = 0;
          let runningStreak = 0;
          let previousDate: Date | null = null;

          for (const dateString of orderedDates) {
            const currentDate = new Date(`${dateString}T00:00:00Z`);
            if (!previousDate) {
              runningStreak = 1;
            } else {
              const dayDelta = Math.round((currentDate.getTime() - previousDate.getTime()) / 86400000);
              runningStreak = dayDelta === 1 ? runningStreak + 1 : 1;
            }
            longestStreak = Math.max(longestStreak, runningStreak);
            previousDate = currentDate;
          }

          return {
            current_streak: currentStreak,
            longest_streak: longestStreak,
            today_met: hasToday,
          };
        };

        const [
          topicsRes, profileRes, freezeCountRes,
          recsRes, missionsRes, logsTodayRes, logsWeekRes,
          rankPredV2Res, rankPredRes, reportsRes, recentLogsRes,
          autopilotRes, autopilotCfgRes, subRes,
          completionRes, reviewQueueRes, streakLogsRes,
          plansRes,
        ] = await Promise.all([
          adminClient.from("topics").select("id, name, memory_strength, next_predicted_drop_date, subject_id").eq("user_id", userId).is("deleted_at", null),
          adminClient.from("profiles").select("display_name, avatar_url, exam_date, daily_study_goal_minutes, created_at").eq("id", userId).maybeSingle(),
          adminClient.from("streak_freezes").select("id", { count: "exact", head: true }).eq("user_id", userId).is("used_date", null),
          adminClient.from("ai_recommendations").select("id, title, description, type, priority, topic_id").eq("user_id", userId).eq("completed", false).order("created_at", { ascending: false }).limit(5),
          adminClient.from("brain_missions").select("id, title, description, mission_type, priority, status, target_topic_id, target_value, current_value, reward_type, reward_value, expires_at, reasoning").eq("user_id", userId).in("status", ["active", "in_progress"]).order("created_at", { ascending: false }).limit(10),
          adminClient.from("study_logs").select("duration_minutes").eq("user_id", userId).gte("created_at", `${today}T00:00:00Z`),
          adminClient.from("study_logs").select("duration_minutes, subject_id, topic_id, created_at, study_mode").eq("user_id", userId).gte("created_at", weekAgo),
          adminClient.from("rank_predictions_v2").select("predicted_rank, rank_band_low, rank_band_high, percentile_estimation, factors_breakdown, computed_at").eq("user_id", userId).order("computed_at", { ascending: false }).limit(1).maybeSingle(),
          adminClient.from("rank_predictions").select("id, predicted_rank, percentile, factors, recorded_at").eq("user_id", userId).order("recorded_at", { ascending: false }).limit(1).maybeSingle(),
          adminClient.from("brain_reports").select("id, report_type, summary, metrics, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
          adminClient.from("study_logs").select("id, duration_minutes, study_mode, subject_id, topic_id, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
          adminClient.from("autopilot_sessions").select("*").eq("user_id", userId).eq("session_date", today).maybeSingle(),
          adminClient.from("autopilot_config").select("is_enabled").limit(1).maybeSingle(),
          adminClient.from("user_subscriptions").select("*, plan:subscription_plans(plan_key, name, price, yearly_price, currency, trial_days)").eq("user_id", userId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
          adminClient.from("plan_quality_logs").select("overall_completion_rate").eq("user_id", userId).order("created_at", { ascending: false }).limit(2),
          adminClient.from("topics").select("id, name, memory_strength, next_predicted_drop_date, subject_id").eq("user_id", userId).is("deleted_at", null).not("next_predicted_drop_date", "is", null).lte("next_predicted_drop_date", nowIso).order("next_predicted_drop_date", { ascending: true }).limit(10),
          adminClient.from("study_logs").select("created_at").eq("user_id", userId).gte("created_at", yearAgo).order("created_at", { ascending: false }).limit(500),
          adminClient.from("subscription_plans").select("plan_key, name, price, yearly_price, currency, trial_days, features, is_popular").eq("is_active", true).order("sort_order", { ascending: true }),
        ]);

        const profile = profileRes.data;
        const allRecs = recsRes.data || [];
        const todayLogs = logsTodayRes.data || [];
        const rawWeekLogs = logsWeekRes.data || [];
        const rawRecentLogs = recentLogsRes.data || [];

        const allTopics = (topicsRes.data || []).map((topic) => buildTopicView(topic as Record<string, unknown>));
        const reviewQueue = (reviewQueueRes.data || []).map((topic) => buildTopicView(topic as Record<string, unknown>));
        const riskTopicsList = [...allTopics]
          .filter((topic) => topic.risk_level === "critical" || topic.risk_level === "high")
          .sort((a, b) => a.memory_strength - b.memory_strength)
          .slice(0, 10);
        const weakest = [...allTopics].sort((a, b) => a.memory_strength - b.memory_strength).slice(0, 3);

        const subjectIds = Array.from(new Set([
          ...allTopics.map((topic) => topic.subject_id),
          ...rawWeekLogs.map((log: any) => String(log.subject_id ?? "")),
          ...rawRecentLogs.map((log: any) => String(log.subject_id ?? "")),
        ].filter(Boolean)));
        const topicIds = Array.from(new Set([
          ...rawWeekLogs.map((log: any) => String(log.topic_id ?? "")),
          ...rawRecentLogs.map((log: any) => String(log.topic_id ?? "")),
        ].filter(Boolean)));

        const [subjectsRes, topicsLookupRes] = await Promise.all([
          subjectIds.length > 0
            ? adminClient.from("subjects").select("id, name").in("id", subjectIds)
            : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
          topicIds.length > 0
            ? adminClient.from("topics").select("id, name").in("id", topicIds)
            : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
        ]);

        const subjectMap = Object.fromEntries((subjectsRes.data || []).map((subject: any) => [subject.id, subject.name]));
        const topicMap = Object.fromEntries((topicsLookupRes.data || []).map((topic: any) => [topic.id, topic.name]));

        const weekLogs = rawWeekLogs.map((log: any) => ({
          ...log,
          subject_name: subjectMap[String(log.subject_id ?? "")] || "General",
          topic_name: topicMap[String(log.topic_id ?? "")] || "",
          mode: log.study_mode || "focus",
        }));

        const recentLogs = rawRecentLogs.map((log: any) => ({
          id: log.id,
          subject_name: subjectMap[String(log.subject_id ?? "")] || "General",
          topic_name: topicMap[String(log.topic_id ?? "")] || "",
          duration_minutes: log.duration_minutes ?? 0,
          mode: log.study_mode || "focus",
          created_at: log.created_at,
        }));

        const streakInfo = calculateStreak((streakLogsRes.data || []) as Array<{ created_at: string }>);

        const total = allTopics.length;
        const strong = allTopics.filter((topic) => topic.memory_strength >= 70).length;
        const weak = allTopics.filter((topic) => topic.memory_strength < 40).length;
        const atRisk = riskTopicsList.length;
        const avgHealth = total > 0 ? Math.round(allTopics.reduce((sum, topic) => sum + topic.memory_strength, 0) / total) : 0;

        const examCountdown = profile?.exam_date
          ? (() => {
              const daysLeft = Math.max(0, Math.ceil((new Date(profile.exam_date).getTime() - Date.now()) / 86400000));
              return {
                days_left: daysLeft,
                exam_date: profile.exam_date,
                urgency: daysLeft <= 3 ? "critical" : daysLeft <= 14 ? "warning" : "normal",
              };
            })()
          : { days_left: 0, exam_date: "", urgency: "normal" };

        const goalMin = profile?.daily_study_goal_minutes ?? 60;
        const studiedMin = todayLogs.reduce((sum: number, log: any) => sum + (log.duration_minutes || 0), 0);
        const streakAtRisk = streakInfo.current_streak > 0 && !streakInfo.today_met;

        const predV2 = rankPredV2Res.data;
        const predV1 = rankPredRes.data;
        const weekTotal = weekLogs.reduce((sum: number, log: any) => sum + (log.duration_minutes || 0), 0);
        const weeklySubjectMap: Record<string, number> = {};
        weekLogs.forEach((log: any) => {
          const subjectName = log.subject_name || "General";
          weeklySubjectMap[subjectName] = (weeklySubjectMap[subjectName] || 0) + (log.duration_minutes || 0);
        });
        const topSubjects = Object.entries(weeklySubjectMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, minutes]) => ({ name, minutes }));

        const sub = subRes.data;
        const subPlan = sub?.plan as any;
        const trialDaysRemaining = sub?.is_trial && sub?.trial_end_date ? Math.max(0, Math.ceil((new Date(sub.trial_end_date).getTime() - Date.now()) / 86400000)) : 0;

        const compData = completionRes.data || [];
        const compCurrent = ((compData as any)[0]?.overall_completion_rate ?? 0.5) * 100;
        const compPrev = (compData as any)[1]?.overall_completion_rate ? (compData as any)[1].overall_completion_rate * 100 : compCurrent;

        const hour = new Date().getHours();
        const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
        const isNew = profile?.created_at ? (Date.now() - new Date(profile.created_at).getTime()) < 86400000 : false;

        const quotes = [
          { quote: "The secret of getting ahead is getting started.", author: "Mark Twain", category: "motivation" },
          { quote: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier", category: "consistency" },
          { quote: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson", category: "persistence" },
          { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs", category: "passion" },
          { quote: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela", category: "education" },
        ];
        const dayIndex = Math.floor(Date.now() / 86400000) % quotes.length;

        let todaysMission: any = { mission: null, source: null };

        // Priority 1: Active brain mission (from AI-generated missions)
        const activeBrainMissions = (missionsRes.data || []).filter(
          (m: any) => m.status === "active" || m.status === "in_progress"
        );
        if (activeBrainMissions.length > 0) {
          const bm = activeBrainMissions[0];
          // Resolve topic_name and subject_name from target_topic_id
          let missionTopicName = "";
          let missionSubjectName = "";
          if (bm.target_topic_id) {
            const matchedTopic = allTopics.find((t: any) => t.id === bm.target_topic_id);
            if (matchedTopic) {
              missionTopicName = matchedTopic.name || "";
              missionSubjectName = subjectMap[matchedTopic.subject_id] || "";
            }
          }
          // Extract estimated_minutes from description if possible (e.g. "25-min session")
          const minMatch = (bm.description || "").match(/(\d+)[\s-]*min/i);
          const estimatedMinutes = minMatch ? parseInt(minMatch[1]) : (bm.target_value || 15);
          todaysMission = {
            mission: {
              id: bm.id,
              title: bm.title,
              description: bm.description || `Complete this ${bm.mission_type} mission`,
              type: bm.mission_type || "review",
              priority: bm.priority || "medium",
              topic_id: bm.target_topic_id || "",
              topic_name: missionTopicName,
              subject_name: missionSubjectName,
              estimated_minutes: estimatedMinutes,
              estimatedMinutes: estimatedMinutes,
              brain_improvement_pct: bm.reward_value || 5,
              brainImprovementPct: bm.reward_value || 5,
              reasoning: bm.reasoning || "Personalized by your AI brain agent.",
            },
            source: "brain_mission",
          };
        }
        // Priority 2: AI recommendation
        else if (allRecs.length > 0) {
          const rec = allRecs[0];
          let recTopicName = "";
          let recSubjectName = "";
          if (rec.topic_id) {
            const mt = allTopics.find((t: any) => t.id === rec.topic_id);
            if (mt) { recTopicName = mt.name || ""; recSubjectName = subjectMap[mt.subject_id] || ""; }
          }
          todaysMission = {
            mission: {
              ...rec,
              topic_name: recTopicName,
              subject_name: recSubjectName,
              estimated_minutes: 15,
              estimatedMinutes: 15,
              brain_improvement_pct: 5,
              brainImprovementPct: 5,
              reasoning: rec.description || "AI recommendation based on your learning patterns.",
            },
            source: "ai_recommendation",
          };
        }
        // Priority 3: Critical/high risk topics
        else if (riskTopicsList.length > 0) {
          const topic = riskTopicsList[0];
          const topicSubjectName = subjectMap[topic.subject_id] || "";
          const brainPct = topic.memory_strength < 20 ? 15 : 10;
          todaysMission = {
            mission: {
              id: `risk-${topic.id}`,
              title: `Review: ${topic.name}`,
              description: `Memory at ${Math.round(topic.memory_strength)}% — needs urgent review`,
              type: "review",
              priority: topic.risk_level,
              topic_id: topic.id,
              topic_name: topic.name,
              subject_name: topicSubjectName,
              estimated_minutes: 15,
              estimatedMinutes: 15,
              brain_improvement_pct: brainPct,
              brainImprovementPct: brainPct,
              reasoning: `${topic.name} memory is critically low at ${Math.round(topic.memory_strength)}%. Reviewing now will prevent further decay.`,
            },
            source: "risk_topic",
          };
        }
        // Priority 4: Only truly weak topics (< 60% memory)
        else if (weakest.length > 0 && Number(weakest[0].memory_strength) < 60) {
          const topic = weakest[0];
          const topicSubjectName = subjectMap[topic.subject_id] || "";
          todaysMission = {
            mission: {
              id: `weak-${topic.id}`,
              title: `Strengthen: ${topic.name}`,
              description: `Memory strength is ${Math.round(topic.memory_strength)}%. A quick review will help!`,
              type: "review",
              priority: Number(topic.memory_strength) < 30 ? "high" : "medium",
              topic_id: topic.id,
              topic_name: topic.name,
              subject_name: topicSubjectName,
              estimated_minutes: 10,
              estimatedMinutes: 10,
              brain_improvement_pct: 8,
              brainImprovementPct: 8,
              reasoning: `Strengthening ${topic.name} will boost your overall brain health.`,
            },
            source: "weak_topic",
          };
        }
        // Priority 5: Topics due for review (spaced repetition)
        else if (reviewQueue.length > 0) {
          const rq = reviewQueue[0];
          const rqSubjectName = subjectMap[rq.subject_id] || "";
          todaysMission = {
            mission: {
              id: `review-${rq.id}`,
              title: `Review: ${rq.name}`,
              description: `Scheduled for spaced repetition review`,
              type: "review",
              priority: "medium",
              topic_id: rq.id,
              topic_name: rq.name,
              subject_name: rqSubjectName,
              estimated_minutes: 10,
              estimatedMinutes: 10,
              brain_improvement_pct: 5,
              brainImprovementPct: 5,
              reasoning: `${rq.name} is due for spaced repetition to maintain long-term retention.`,
            },
            source: "review_queue",
          };
        }
        // Priority 6: All topics strong — pick a specific topic for practice
        else if (total > 0) {
          const practicePool = weakest.length > 0 ? weakest : allTopics.slice(0, 5);
          const pick = practicePool[Math.floor(Math.random() * practicePool.length)];
          const pickSubjectName = pick?.subject_id ? (subjectMap[pick.subject_id] || "General") : "General";
          todaysMission = {
            mission: {
              id: `practice-${pick?.id || ""}`,
              title: `Practice: ${pickSubjectName}`,
              description: `Complete 10 practice questions on ${pick?.name || "mixed topics"}.`,
              type: "practice",
              priority: "low",
              topic_id: pick?.id || "",
              topic_name: pick?.name || "",
              subject_name: pickSubjectName,
              estimated_minutes: 15,
              estimatedMinutes: 15,
              brain_improvement_pct: 3,
              brainImprovementPct: 3,
              reasoning: `All topics are strong! Practice keeps your skills sharp.`,
            },
            source: "maintenance",
          };
        }
        // Priority 7: No topics at all
        else {
          todaysMission = {
            mission: {
              id: "onboard-start",
              title: "🚀 Add Your First Topic",
              description: "Start by adding a subject and topic to begin your AI-powered study journey!",
              type: "onboarding",
              priority: "high",
              topic_id: "",
              topic_name: "",
              subject_name: "",
              estimated_minutes: 5,
              estimatedMinutes: 5,
              brain_improvement_pct: 0,
              brainImprovementPct: 0,
              reasoning: "Get started by adding your first topic!",
            },
            source: "system",
          };
        }

        const defaultTopic = {
          id: "",
          name: "",
          memory_strength: 0,
          risk_level: "low",
          subject_id: "",
          next_review_at: "",
        };

        const estimatedConfidence = Math.min(100, total * 5 + weekLogs.length * 2);
        const fallbackRank = total > 0 ? Math.max(1, Math.round(10000 * Math.exp(-4.5 * (Math.min(99.9, Math.max(0.1, avgHealth)) / 100)))) : 4500;
        const resolvedPredictedRank = predV2?.predicted_rank ?? predV1?.predicted_rank ?? fallbackRank;
        const resolvedRankMin = predV2?.rank_band_low ?? Math.max(1, Math.round(resolvedPredictedRank * 0.85));
        const resolvedRankMax = predV2?.rank_band_high ?? Math.round(resolvedPredictedRank * 1.15);

        const rankPrediction = {
          predicted_rank: resolvedPredictedRank,
          rank_range: { min: resolvedRankMin, max: resolvedRankMax },
          trend: weekTotal > 60 ? "rising" : weekTotal > 0 ? "stable" : "needs_data",
          confidence: predV2?.percentile_estimation ?? predV1?.percentile ?? estimatedConfidence,
          factors: predV1?.factors ?? {
            memory_strength: avgHealth,
            topics_covered: total,
            study_minutes_this_week: weekTotal,
            consistency: streakInfo.current_streak,
            note: total === 0 ? "Add topics and study to get accurate rank predictions" : "Rank improves as you study more consistently",
          },
        };

        // ─── Build pricing for all active plans (monthly + yearly + discount + per-month price) ───
        const buildPricing = (p: any) => {
          const monthly = Number(p?.price ?? 0);
          const yearly = Number(p?.yearly_price ?? 0);
          const yearlyAsMonthly = monthly > 0 ? monthly * 12 : 0;
          const yearlySavings = yearlyAsMonthly > 0 && yearly > 0 ? Math.max(0, yearlyAsMonthly - yearly) : 0;
          const yearlyDiscountPct = yearlyAsMonthly > 0 && yearly > 0 ? Math.round((yearlySavings / yearlyAsMonthly) * 100) : 0;
          const yearlyPerMonth = yearly > 0 ? Math.round(yearly / 12) : 0;
          return {
            plan_key: p?.plan_key ?? "",
            plan_name: p?.name ?? "",
            currency: p?.currency ?? "INR",
            is_popular: !!p?.is_popular,
            trial_days: Number(p?.trial_days ?? 0),
            monthly: {
              price: monthly,
              billing_period: "monthly",
              label: `${p?.currency ?? "INR"} ${monthly}/month`,
            },
            yearly: {
              price: yearly,
              per_month_price: yearlyPerMonth,
              compare_at_price: yearlyAsMonthly, // 12× monthly for strike-through display
              savings: yearlySavings,
              discount_percent: yearlyDiscountPct,
              billing_period: "yearly",
              label: `${p?.currency ?? "INR"} ${yearly}/year`,
              tagline: yearlyDiscountPct > 0 ? `Save ${yearlyDiscountPct}% — only ${p?.currency ?? "INR"} ${yearlyPerMonth}/month` : "",
            },
            features: Array.isArray(p?.features) ? p.features : [],
          };
        };

        const allPlansPricing = ((plansRes.data as any[]) || []).map(buildPricing);
        const premiumPricing = allPlansPricing.find((p) => p.plan_key === "premium") || allPlansPricing[0] || null;

        // ─── Trial / subscription progress ───
        let totalDays = 0;
        let leftDays = 0;
        if (sub?.is_trial && sub?.trial_start_date && sub?.trial_end_date) {
          totalDays = Math.max(1, Math.ceil((new Date(sub.trial_end_date).getTime() - new Date(sub.trial_start_date).getTime()) / 86400000));
          leftDays = Math.max(0, Math.ceil((new Date(sub.trial_end_date).getTime() - Date.now()) / 86400000));
        } else if (sub?.expires_at && sub?.created_at) {
          totalDays = Math.max(1, Math.ceil((new Date(sub.expires_at).getTime() - new Date(sub.created_at).getTime()) / 86400000));
          leftDays = Math.max(0, Math.ceil((new Date(sub.expires_at).getTime() - Date.now()) / 86400000));
        }

        const trialStatus = sub
          ? {
              plan_key: subPlan?.plan_key ?? "unknown",
              plan_name: subPlan?.name ?? "Unknown",
              is_trial: sub.is_trial ?? false,
              trial_days_remaining: trialDaysRemaining,
              status: sub.status,
              expires_at: sub.expires_at ?? "",
              total_days: totalDays,
              left_days: leftDays,
              billing_cycle: sub.billing_cycle ?? "monthly",
              current_amount: Number(sub.amount ?? 0),
              current_currency: sub.currency ?? "INR",
              pricing: premiumPricing,
              all_plans: allPlansPricing,
              upgrade_prompt: (sub.is_trial ?? false)
                ? `Trial ends in ${leftDays} day${leftDays === 1 ? "" : "s"} — upgrade to keep your progress.`
                : "",
            }
          : {
              plan_key: "free",
              plan_name: "Free Brain",
              is_trial: false,
              trial_days_remaining: 0,
              status: "free",
              expires_at: "",
              total_days: 0,
              left_days: 0,
              billing_cycle: "none",
              current_amount: 0,
              current_currency: "INR",
              pricing: premiumPricing,
              all_plans: allPlansPricing,
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

        return json({
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
          exam_countdown: examCountdown,
          daily_goal: {
            goal_minutes: goalMin,
            studied_minutes: studiedMin,
            completion_pct: Math.min(100, Math.round((studiedMin / goalMin) * 100)),
            status: studiedMin >= goalMin ? "completed" : studiedMin > 0 ? "in_progress" : "not_started",
          },
          streak: {
            current_streak: streakInfo.current_streak,
            longest_streak: streakInfo.longest_streak,
            today_met: streakInfo.today_met,
            auto_shield_used: false,
            freezes_available: freezeCountRes.count ?? 0,
            next_milestone: getNextMilestone(streakInfo.current_streak),
            streak_at_risk: streakAtRisk,
            motivation: streakInfo.current_streak === 0 ? "Start a study session to build your streak!" : streakAtRisk ? "Study now to keep your streak alive!" : "Nice work — keep the momentum going!",
          },
          todays_mission: todaysMission,
          ai_recommendations: {
            recommendations: allRecs,
            tip: allRecs.length === 0 ? "Complete a few study sessions to unlock AI recommendations" : "You already have AI recommendations ready.",
          },
          brain_missions: { missions: missionsRes.data || [] },
          quick_actions: {
            smart_recall: { available: total > 0, topic: weakest[0] || defaultTopic, label: total === 0 ? "Add topics first" : "Smart Recall", reward: "+3% memory" },
            risk_shield: { available: riskTopicsList.length > 0, count: riskTopicsList.length, top_topic: riskTopicsList[0] || defaultTopic, reward: riskTopicsList.length > 0 ? `${riskTopicsList.length} at risk` : "All safe" },
            rank_boost: { available: total > 0, reward: "+1 rank" },
            focus_shield: { available: true, reward: "Track focus", focus_score: null },
            overall_health: avgHealth,
            streak_days: streakInfo.current_streak,
            at_risk_count: atRisk,
            total_topics: total,
          },
          review_queue: { queue: reviewQueue, count: reviewQueue.length },
          risk_digest: { risk_topics: riskTopicsList, count: riskTopicsList.length },
          weekly_summary: {
            total_minutes: weekTotal,
            sessions: weekLogs.length,
            top_subjects: topSubjects,
            summary: weekLogs.length === 0 ? "No study sessions this week. Start today!" : `You studied ${weekTotal} minutes across ${weekLogs.length} sessions this week.`,
          },
          recently_studied: {
            sessions: recentLogs,
            tip: recentLogs.length === 0 ? "Your recent sessions will appear here" : "Your latest study sessions are shown here.",
          },
          brain_feed: { feed: reportsRes.data || [] },
          autopilot: {
            enabled: autopilotCfgRes.data?.is_enabled ?? false,
            today_session: safeAutopilotSession,
            completed: safeAutopilotSession.completed_sessions ?? 0,
            total: safeAutopilotSession.total_sessions ?? 0,
          },
          trial_status: trialStatus,
          completion_rate: {
            completion_rate: Math.round(compCurrent),
            trend: compCurrent > compPrev + 2 ? "improving" : compCurrent < compPrev - 2 ? "declining" : "stable",
          },
          welcome: {
            show_welcome: isNew,
            display_name: profile?.display_name?.trim() || "Learner",
            avatar_url: profile?.avatar_url || "",
            greeting,
          },
          daily_quote: quotes[dayIndex],
        });
      }

      // ─── Mission Start ───
      case "mission-start": {
        const missionId = (body.mission_id || query.mission_id) as string;
        if (!missionId) return json({ error: "mission_id is required" }, 400);

        // Verify mission belongs to user
        const { data: missionToStart } = await adminClient
          .from("brain_missions")
          .select("id, title, description, mission_type, priority, status, target_value, current_value, reward_type, reward_value, target_topic_id, target_metric, expires_at")
          .eq("id", missionId)
          .eq("user_id", userId)
          .maybeSingle();

        if (!missionToStart) return json({ error: "Mission not found" }, 404);
        if (missionToStart.status === "completed") return json({ error: "Mission already completed" }, 409);
        if (missionToStart.status === "in_progress") {
          // Already started — return current state
          return json({
            success: true,
            already_started: true,
            mission: missionToStart,
            message: `Mission "${missionToStart.title}" is already in progress`,
          });
        }
        if (missionToStart.status !== "active") {
          return json({ error: `Mission is ${missionToStart.status}, cannot start` }, 400);
        }

        // Mark as in_progress
        const startedAt = new Date().toISOString();
        await adminClient
          .from("brain_missions")
          .update({ status: "in_progress", updated_at: startedAt })
          .eq("id", missionId)
          .eq("user_id", userId);

        // Build action guidance based on mission type
        let action_hint = "";
        let navigate_to = "";
        switch (missionToStart.mission_type) {
          case "rescue":
          case "recall_boost":
          case "challenge":
            action_hint = `Review the topic to improve your ${missionToStart.target_metric ?? "memory"}`;
            navigate_to = missionToStart.target_topic_id ? `/study/${missionToStart.target_topic_id}` : "/study";
            break;
          case "consistency":
            action_hint = "Start a study session to complete this mission";
            navigate_to = "/study";
            break;
          case "recovery":
            action_hint = "Take a break, then do one easy review session";
            navigate_to = "/dashboard";
            break;
          case "exploration":
            action_hint = "Study this new topic for the first time";
            navigate_to = missionToStart.target_topic_id ? `/study/${missionToStart.target_topic_id}` : "/topics";
            break;
          default:
            action_hint = "Complete the mission objective";
            navigate_to = "/study";
        }

        return json({
          success: true,
          already_started: false,
          mission: { ...missionToStart, status: "in_progress" },
          started_at: startedAt,
          action_hint,
          navigate_to,
          message: `🚀 Mission "${missionToStart.title}" started!`,
        });
      }

      // ─── Mission Complete ───
      case "mission-complete": {
        const missionId = (body.mission_id || query.mission_id) as string;
        if (!missionId) return json({ error: "mission_id is required" }, 400);

        // Verify mission belongs to user and is active
        const { data: mission } = await adminClient
          .from("brain_missions")
          .select("id, title, mission_type, reward_value, reward_type, status, target_value, current_value")
          .eq("id", missionId)
          .eq("user_id", userId)
          .maybeSingle();

        if (!mission) return json({ error: "Mission not found" }, 404);
        if (mission.status === "completed") return json({ error: "Mission already completed", mission }, 409);
        if (mission.status !== "active" && mission.status !== "in_progress") {
          return json({ error: `Mission is ${mission.status}, cannot complete` }, 400);
        }

        // Mark as completed
        const now = new Date().toISOString();
        await adminClient
          .from("brain_missions")
          .update({
            status: "completed",
            completed_at: now,
            current_value: mission.target_value ?? mission.current_value,
          })
          .eq("id", missionId)
          .eq("user_id", userId);

        // Fetch remaining active missions count
        const { count: remainingCount } = await adminClient
          .from("brain_missions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .in("status", ["active", "in_progress"]);

        return json({
          success: true,
          completed_mission: {
            id: mission.id,
            title: mission.title,
            mission_type: mission.mission_type,
            reward_value: mission.reward_value ?? 0,
            reward_type: mission.reward_type ?? "xp",
          },
          completed_at: now,
          remaining_missions: remainingCount ?? 0,
          message: `🎉 Mission "${mission.title}" completed! +${mission.reward_value ?? 0} ${mission.reward_type ?? "XP"}`,
        });
      }

      // ─── Mission Generate (AI-powered daily mission) ───
      case "mission-generate": {
        const client = userClient(req.headers.get("authorization") || "");
        try {
          const { data: genData, error: genErr } = await client.functions.invoke("ai-brain-agent", {
            body: { action: "daily_mission" },
          });
          if (genErr) throw genErr;

          // Also check brain_missions table for any active missions generated today
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const { data: todayMissions } = await adminClient
            .from("brain_missions")
            .select("id, title, description, mission_type, priority, status, target_value, current_value, reward_type, reward_value, target_topic_id, target_metric, expires_at, reasoning, created_at")
            .eq("user_id", userId)
            .gte("created_at", todayStart.toISOString())
            .in("status", ["active", "in_progress"])
            .order("created_at", { ascending: false })
            .limit(5);

          return json({
            success: true,
            ai_mission: genData ?? {},
            active_missions: todayMissions || [],
            message: "Daily mission generated",
          });
        } catch (e: any) {
          return json({ success: false, error: e.message, ai_mission: {}, active_missions: [] }, 500);
        }
      }

      // ─── Mission Questions ───
      case "mission-questions": {
        const missionId = (body.mission_id || query.mission_id) as string | undefined;
        const rawCount = Number(body.count ?? query.count ?? 5);
        const count = Number.isFinite(rawCount) ? Math.min(Math.max(Math.trunc(rawCount), 1), 5) : 5;
        const difficulty = String(body.difficulty || query.difficulty || "medium");
        let topicName = String(body.topic_name || query.topic_name || "").trim();
        let subjectName = String(body.subject_name || query.subject_name || "").trim();
        let mission: Record<string, unknown> | null = null;

        const resolveSubjectName = async (subjectId?: string | null) => {
          if (!subjectId || subjectName) return;
          const { data: subjectRow } = await adminClient
            .from("subjects")
            .select("name")
            .eq("id", subjectId)
            .maybeSingle();
          subjectName = subjectRow?.name || "";
        };

        if (missionId) {
          const { data: missionRow } = await adminClient
            .from("brain_missions")
            .select("id, title, description, status, mission_type, target_topic_id, target_metric")
            .eq("id", missionId)
            .eq("user_id", userId)
            .maybeSingle();

          if (!missionRow) return json({ error: "Mission not found" }, 404);
          mission = missionRow;

          // Resolve topic from mission's target_topic_id
          if (missionRow.target_topic_id && !topicName) {
            const { data: topicRow } = await adminClient
              .from("topics")
              .select("id, name, subject_id")
              .eq("id", missionRow.target_topic_id)
              .eq("user_id", userId)
              .is("deleted_at", null)
              .maybeSingle();

            if (topicRow) {
              topicName = topicRow.name || "";
              await resolveSubjectName(topicRow.subject_id);
            }
          }
        }

        // Fallback: pick the user's weakest topic if none resolved
        if (!topicName) {
          const { data: fallbackTopics } = await adminClient
            .from("topics")
            .select("id, name, subject_id, memory_strength")
            .eq("user_id", userId)
            .is("deleted_at", null)
            .order("memory_strength", { ascending: true })
            .limit(3);

          if (fallbackTopics && fallbackTopics.length > 0) {
            const picked = fallbackTopics[0];
            topicName = picked.name || "";
            await resolveSubjectName(picked.subject_id);
          }
        }

        const authHeader = req.headers.get("authorization") || "";
        const aiClient = authHeader.startsWith("Bearer ")
          ? userClient(authHeader)
          : createClient(supabaseUrl, serviceKey, {
              global: { headers: { Authorization: `Bearer ${serviceKey}` } },
            });

        const { data: questionData, error: questionError } = await aiClient.functions.invoke("ai-brain-agent", {
          body: {
            action: "mission_questions",
            topic_name: topicName || undefined,
            subject_name: subjectName || undefined,
            count,
            difficulty,
            user_id: userId,
          },
        });

        // Normalize questions to consistent schema (matches web app QuickFixQuiz format)
        const rawQuestions = questionData?.questions || [];
        const questions = rawQuestions.map((q: any) => ({
          question: q.question || "",
          options: Array.isArray(q.options) ? q.options : [],
          correct_index: typeof q.correct_index === "number" ? q.correct_index : 0,
          explanation: q.explanation || "",
          difficulty: q.difficulty || difficulty,
        }));

        // Build quiz-context title & description to match web app display
        const quizTitle = topicName ? `Quick Fix: ${topicName}` : "Quick Fix Quiz";
        const quizDescription = topicName
          ? `${questions.length} ${difficulty} questions on ${topicName}${subjectName ? ` (${subjectName})` : ""}`
          : `${questions.length} ${difficulty} recall questions`;

        if (questionError || questions.length === 0) {
          return json({
            success: false,
            error: questionError?.message || "No questions generated",
            mission: mission ? {
              id: (mission as any).id,
              title: quizTitle,
              description: quizDescription,
              original_title: (mission as any).title,
              original_description: (mission as any).description || "",
              status: (mission as any).status,
              mission_type: (mission as any).mission_type,
            } : null,
            topic_name: topicName,
            subject_name: subjectName,
            difficulty,
            count,
            questions: [],
          }, questionError ? 500 : 200);
        }

        return json({
          success: true,
          mission: mission ? {
            id: (mission as any).id,
            title: quizTitle,
            description: quizDescription,
            original_title: (mission as any).title,
            original_description: (mission as any).description || "",
            status: (mission as any).status,
            mission_type: (mission as any).mission_type,
          } : null,
          topic_name: topicName,
          subject_name: subjectName,
          difficulty,
          count: questions.length,
          questions,
        });
      }

      // ─── Mission Progress (update current_value while in_progress) ───
      case "mission-progress": {
        const missionId = (body.mission_id || query.mission_id) as string;
        const progressValue = Number(body.progress_value ?? body.current_value ?? 0);
        if (!missionId) return json({ error: "mission_id is required" }, 400);

        const { data: missionProg } = await adminClient
          .from("brain_missions")
          .select("id, title, status, target_value, current_value, mission_type")
          .eq("id", missionId)
          .eq("user_id", userId)
          .maybeSingle();

        if (!missionProg) return json({ error: "Mission not found" }, 404);
        if (missionProg.status === "completed") return json({ error: "Mission already completed" }, 409);

        const newValue = progressValue || ((missionProg.current_value ?? 0) + 1);
        const targetReached = missionProg.target_value ? newValue >= missionProg.target_value : false;

        await adminClient
          .from("brain_missions")
          .update({ current_value: newValue, updated_at: new Date().toISOString() })
          .eq("id", missionId)
          .eq("user_id", userId);

        return json({
          success: true,
          mission_id: missionId,
          current_value: newValue,
          target_value: missionProg.target_value ?? 0,
          target_reached: targetReached,
          progress_pct: missionProg.target_value ? Math.min(100, Math.round((newValue / missionProg.target_value) * 100)) : 0,
          message: targetReached ? "🎯 Target reached! You can now complete this mission." : `Progress updated: ${newValue}/${missionProg.target_value ?? "∞"}`,
        });
      }

      // ─── Today's Mission Flow (complete end-to-end guide) ───
      case "todays-mission-flow": {
        // Return full lifecycle documentation + current state for this user
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // Fetch ALL active/in_progress missions (regardless of creation date)
        const [activeRes, completedTodayRes] = await Promise.all([
          adminClient
            .from("brain_missions")
            .select("id, title, description, mission_type, priority, status, target_value, current_value, reward_type, reward_value, target_topic_id, target_metric, expires_at, reasoning, completed_at, created_at, updated_at")
            .eq("user_id", userId)
            .in("status", ["active", "in_progress"])
            .order("priority", { ascending: true })
            .order("created_at", { ascending: false })
            .limit(10),
          adminClient
            .from("brain_missions")
            .select("id, title, description, mission_type, priority, status, target_value, current_value, reward_type, reward_value, target_topic_id, target_metric, expires_at, reasoning, completed_at, created_at, updated_at")
            .eq("user_id", userId)
            .eq("status", "completed")
            .gte("completed_at", todayStart.toISOString())
            .order("completed_at", { ascending: false })
            .limit(10),
        ]);

        const activeMissionsList = activeRes.data || [];
        const completedToday = completedTodayRes.data || [];
        const allMissions = [...activeMissionsList, ...completedToday];
        const currentMission = activeMissionsList.find((m: any) => m.status === "in_progress") || activeMissionsList.find((m: any) => m.status === "active") || null;

        return json({
          current_state: {
            has_mission: !!currentMission,
            current_mission: currentMission,
            active_missions_count: activeMissionsList.length,
            completed_today: completedToday.length,
            all_active_missions: activeMissionsList,
            completed_today_missions: completedToday,
            all_todays_missions: allMissions,
          },
          flow_steps: [
            {
              step: 1,
              name: "Generate Mission",
              endpoint: "POST /home-api/mission-generate",
              description: "Generate AI-powered daily mission. Call once per day or when no active mission exists.",
              request: {},
              when_to_call: "On app launch if no active mission found",
            },
            {
              step: 2,
              name: "Fetch Active Missions",
              endpoint: "POST /home-api/brain-missions",
              description: "Get list of active missions with their IDs. Use the mission ID for subsequent steps.",
              request: { status: "active" },
              response_key: "missions[0].id → use as mission_id",
            },
            {
              step: 3,
              name: "Start Mission",
              endpoint: "POST /home-api/mission-start",
              description: "Mark mission as in_progress. Returns action_hint (what to do) and navigate_to (where to go in app).",
              request: { mission_id: "uuid-from-step-2" },
              response_keys: ["action_hint", "navigate_to", "mission.status"],
            },
            {
              step: 4,
              name: "Fetch Mission Questions",
              endpoint: "POST /home-api/mission-questions",
              description: "Fetch topic-based questions for the mission. Pass mission_id and optionally count/difficulty.",
              request: { mission_id: "uuid-from-step-2", count: 4, difficulty: "medium" },
              response_keys: ["questions", "topic_name", "subject_name"],
            },
            {
              step: 5,
              name: "Update Progress (Optional)",
              endpoint: "POST /home-api/mission-progress",
              description: "Update current_value while user is working. Returns target_reached boolean when done.",
              request: { mission_id: "uuid", progress_value: 3 },
              response_keys: ["current_value", "target_value", "target_reached", "progress_pct"],
            },
            {
              step: 6,
              name: "Complete Mission",
              endpoint: "POST /home-api/mission-complete",
              description: "Mark mission as completed. Returns reward info (XP) and remaining mission count.",
              request: { mission_id: "uuid" },
              response_keys: ["completed_mission", "remaining_missions", "message"],
            },
          ],
          flutter_example: {
            code: `
// Step 1: Generate (once per day)
await api.post('/home-api/mission-generate');

// Step 2: Fetch missions
final missions = await api.post('/home-api/brain-missions', body: {"status": "active"});
final missionId = missions['missions'][0]['id'];

// Step 3: Start
final start = await api.post('/home-api/mission-start', body: {"mission_id": missionId});
final navigateTo = start['navigate_to'];

// Step 4: Fetch questions
final questionRes = await api.post('/home-api/mission-questions', body: {
  "mission_id": missionId,
  "count": 4,
  "difficulty": "medium"
});
final questions = questionRes['questions'];

// Step 5: Progress (optional, during study)
await api.post('/home-api/mission-progress', body: {"mission_id": missionId, "progress_value": 2});

// Step 6: Complete
final result = await api.post('/home-api/mission-complete', body: {"mission_id": missionId});
// Show reward: result['completed_mission']['reward_value']
`,
          },
        });
      }

      // ═══════════════════════════════════════════════════════════════
      // ─── UNIFIED TODAY'S MISSION API (Single Endpoint) ───
      // All mission actions via: POST /home-api/todays-mission-api
      // Body: { "action": "fetch|start|questions|progress|complete|brain-impact|history" }
      // ═══════════════════════════════════════════════════════════════
      case "todays-mission-api": {
        const action = String(body.action || query.action || "fetch");

        // ── Helper: resolve topic info ──
        const resolveTopic = async (topicId: string) => {
          if (!topicId) return { topic_name: "", subject_name: "", topic_id: "" };
          const { data: t } = await adminClient.from("topics").select("id, name, subject_id, memory_strength").eq("id", topicId).maybeSingle();
          if (!t) return { topic_name: "", subject_name: "", topic_id: topicId };
          let sName = "";
          if (t.subject_id) {
            const { data: s } = await adminClient.from("subjects").select("name").eq("id", t.subject_id).maybeSingle();
            sName = s?.name || "";
          }
          return { topic_name: t.name || "", subject_name: sName, topic_id: t.id, memory_strength: t.memory_strength };
        };

        // ── Helper: build mission object from various sources ──
        const buildMissionPayload = async () => {
          // Priority 1: Active brain missions
          const { data: activeMissions } = await adminClient
            .from("brain_missions")
            .select("id, title, description, mission_type, priority, target_topic_id, status, reasoning, reward_value, reward_type, target_value, current_value, target_metric, expires_at, created_at")
            .eq("user_id", userId)
            .in("status", ["active", "in_progress"])
            .order("created_at", { ascending: false })
            .limit(1);

          if (activeMissions && activeMissions.length > 0) {
            const bm = activeMissions[0];
            const info = await resolveTopic(bm.target_topic_id || "");
            const minMatch = (bm.description || "").match(/(\d+)[\s-]*min/i);
            const estMin = minMatch ? parseInt(minMatch[1]) : (bm.target_value || 15);
            return {
              mission: {
                id: bm.id, title: bm.title,
                description: bm.description || `Complete this ${bm.mission_type} mission`,
                type: bm.mission_type || "review", priority: bm.priority || "medium",
                status: bm.status,
                topic_id: bm.target_topic_id || "", topic_name: info.topic_name, subject_name: info.subject_name,
                estimated_minutes: estMin, brain_improvement_pct: bm.reward_value || 5,
                reward_value: bm.reward_value || 0, reward_type: bm.reward_type || "xp",
                target_value: bm.target_value, current_value: bm.current_value || 0,
                reasoning: bm.reasoning || "Personalized by your AI brain agent.",
                expires_at: bm.expires_at || "",
              },
              source: "brain_mission", is_real_mission: true,
            };
          }

          // Priority 2: AI recommendation
          const { data: recs } = await adminClient
            .from("ai_recommendations")
            .select("id, title, description, type, priority, topic_id")
            .eq("user_id", userId).eq("completed", false)
            .order("created_at", { ascending: false }).limit(1);
          if (recs && recs.length > 0) {
            const rec = recs[0];
            const info = await resolveTopic(rec.topic_id || "");
            return {
              mission: {
                id: rec.id, title: rec.title,
                description: rec.description || "AI recommendation based on your learning patterns.",
                type: rec.type || "review", priority: rec.priority || "medium", status: "active",
                topic_id: rec.topic_id || "", topic_name: info.topic_name, subject_name: info.subject_name,
                estimated_minutes: 15, brain_improvement_pct: 5,
                reward_value: 10, reward_type: "xp", target_value: 1, current_value: 0,
                reasoning: rec.description || "AI recommendation.",
                expires_at: "",
              },
              source: "ai_recommendation", is_real_mission: false,
            };
          }

          // Priority 3: Risk topics (memory < 40)
          const { data: riskTopics } = await adminClient
            .from("topics").select("id, name, memory_strength, subject_id")
            .eq("user_id", userId).is("deleted_at", null)
            .lt("memory_strength", 40).order("memory_strength", { ascending: true }).limit(1);
          if (riskTopics && riskTopics.length > 0) {
            const t = riskTopics[0];
            const info = await resolveTopic(t.id);
            const brainPct = Number(t.memory_strength) < 20 ? 15 : 10;
            return {
              mission: {
                id: `risk-${t.id}`, title: `Review: ${t.name}`,
                description: `Memory at ${Math.round(t.memory_strength ?? 0)}% — needs urgent review`,
                type: "review", priority: Number(t.memory_strength) < 20 ? "critical" : "high",
                status: "active", topic_id: t.id, topic_name: info.topic_name, subject_name: info.subject_name,
                estimated_minutes: 15, brain_improvement_pct: brainPct,
                reward_value: 15, reward_type: "xp", target_value: 1, current_value: 0,
                reasoning: `${t.name} memory is critically low at ${Math.round(t.memory_strength ?? 0)}%. Review now.`,
                expires_at: "",
              },
              source: "risk_topic", is_real_mission: false,
            };
          }

          // Priority 4: Weak topics (< 60)
          const { data: weakTopics } = await adminClient
            .from("topics").select("id, name, memory_strength, subject_id")
            .eq("user_id", userId).is("deleted_at", null)
            .lt("memory_strength", 60).order("memory_strength", { ascending: true }).limit(1);
          if (weakTopics && weakTopics.length > 0) {
            const w = weakTopics[0];
            const info = await resolveTopic(w.id);
            return {
              mission: {
                id: `weak-${w.id}`, title: `Strengthen: ${w.name}`,
                description: `Memory at ${Math.round(w.memory_strength ?? 0)}%. A quick review will help!`,
                type: "review", priority: Number(w.memory_strength) < 30 ? "high" : "medium",
                status: "active", topic_id: w.id, topic_name: info.topic_name, subject_name: info.subject_name,
                estimated_minutes: 10, brain_improvement_pct: 8,
                reward_value: 10, reward_type: "xp", target_value: 1, current_value: 0,
                reasoning: `Strengthening ${w.name} will boost your brain health.`,
                expires_at: "",
              },
              source: "weak_topic", is_real_mission: false,
            };
          }

          // Priority 5: Topics due for review
          const nowIso = new Date().toISOString();
          const { data: dueTopics } = await adminClient
            .from("topics").select("id, name, memory_strength, subject_id, next_predicted_drop_date")
            .eq("user_id", userId).is("deleted_at", null)
            .not("next_predicted_drop_date", "is", null)
            .lte("next_predicted_drop_date", nowIso)
            .order("next_predicted_drop_date", { ascending: true }).limit(1);
          if (dueTopics && dueTopics.length > 0) {
            const d = dueTopics[0];
            const info = await resolveTopic(d.id);
            return {
              mission: {
                id: `review-${d.id}`, title: `Review: ${d.name}`,
                description: `Scheduled for spaced repetition review`,
                type: "review", priority: "medium", status: "active",
                topic_id: d.id, topic_name: info.topic_name, subject_name: info.subject_name,
                estimated_minutes: 10, brain_improvement_pct: 5,
                reward_value: 10, reward_type: "xp", target_value: 1, current_value: 0,
                reasoning: `${d.name} is due for spaced repetition.`,
                expires_at: "",
              },
              source: "review_queue", is_real_mission: false,
            };
          }

          // Priority 6: Practice mode (all strong)
          const { data: anyTopics } = await adminClient
            .from("topics").select("id, name, memory_strength, subject_id")
            .eq("user_id", userId).is("deleted_at", null).limit(5);
          if (anyTopics && anyTopics.length > 0) {
            const pick = anyTopics[Math.floor(Math.random() * anyTopics.length)];
            const info = await resolveTopic(pick.id);
            return {
              mission: {
                id: `practice-${pick.id}`, title: `Practice: ${info.subject_name || pick.name}`,
                description: `Complete practice questions on ${pick.name}.`,
                type: "practice", priority: "low", status: "active",
                topic_id: pick.id, topic_name: info.topic_name, subject_name: info.subject_name,
                estimated_minutes: 15, brain_improvement_pct: 3,
                reward_value: 5, reward_type: "xp", target_value: 1, current_value: 0,
                reasoning: `All topics are strong! Practice keeps your skills sharp.`,
                expires_at: "",
              },
              source: "maintenance", is_real_mission: false,
            };
          }

          // Priority 7: No topics
          return {
            mission: {
              id: "onboard-start", title: "🚀 Add Your First Topic",
              description: "Start by adding a subject and topic to begin your AI-powered study journey!",
              type: "onboarding", priority: "high", status: "system",
              topic_id: "", topic_name: "", subject_name: "",
              estimated_minutes: 5, brain_improvement_pct: 0,
              reward_value: 0, reward_type: "xp", target_value: 0, current_value: 0,
              reasoning: "You haven't added any topics yet.", expires_at: "",
            },
            source: "system", is_real_mission: false,
          };
        };

        // ════════════════════════════════════════
        // ACTION: fetch — Get today's mission
        // ════════════════════════════════════════
        if (action === "fetch") {
          const result = await buildMissionPayload();
          return json(result);
        }

        // ════════════════════════════════════════
        // ACTION: generate — Force AI mission generation
        // ════════════════════════════════════════
        if (action === "generate") {
          const client = userClient(req.headers.get("authorization") || "");
          try {
            const { data: genData, error: genErr } = await client.functions.invoke("ai-brain-agent", {
              body: { action: "daily_mission" },
            });
            if (genErr) throw genErr;

            const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
            const { data: todayMissions } = await adminClient
              .from("brain_missions")
              .select("id, title, description, mission_type, priority, status, target_value, current_value, reward_type, reward_value, target_topic_id, reasoning, expires_at, created_at")
              .eq("user_id", userId).gte("created_at", todayStart.toISOString())
              .in("status", ["active", "in_progress"])
              .order("created_at", { ascending: false }).limit(5);

            // Return the first mission with full details
            const missions = todayMissions || [];
            let topMission = null;
            if (missions.length > 0) {
              const m = missions[0];
              const info = await resolveTopic(m.target_topic_id || "");
              topMission = {
                id: m.id, title: m.title, description: m.description || "",
                type: m.mission_type || "review", priority: m.priority || "medium", status: m.status,
                topic_id: m.target_topic_id || "", topic_name: info.topic_name, subject_name: info.subject_name,
                estimated_minutes: m.target_value || 15, brain_improvement_pct: m.reward_value || 5,
                reward_value: m.reward_value || 0, reward_type: m.reward_type || "xp",
                target_value: m.target_value, current_value: m.current_value || 0,
                reasoning: m.reasoning || "", expires_at: m.expires_at || "",
              };
            }

            return json({
              success: true, mission: topMission,
              all_active_missions: missions, source: "ai_generated",
              message: topMission ? `Mission ready: ${topMission.title}` : "Mission generated but none active",
            });
          } catch (e: any) {
            return json({ success: false, error: e.message, mission: null }, 500);
          }
        }

        // ════════════════════════════════════════
        // ACTION: start — Mark mission as in_progress
        // ════════════════════════════════════════
        if (action === "start") {
          const missionId = String(body.mission_id || query.mission_id || "");
          if (!missionId) return json({ error: "mission_id is required" }, 400);

          // For synthetic IDs, just acknowledge and return guidance
          const isSynthetic = /^(risk|weak|review|practice|onboard)-/.test(missionId);
          if (isSynthetic) {
            const topicId = missionId.replace(/^(risk|weak|review|practice)-/, "");
            const info = await resolveTopic(topicId);
            return json({
              success: true, already_started: false, is_synthetic: true,
              mission_id: missionId, topic_id: topicId,
              topic_name: info.topic_name, subject_name: info.subject_name,
              action_hint: "Start a study session on this topic",
              navigate_to: topicId ? `/study/${topicId}` : "/study",
              message: `Mission started for ${info.topic_name || "topic"}`,
            });
          }

          // Real mission
          const { data: m } = await adminClient.from("brain_missions")
            .select("id, title, description, mission_type, priority, status, target_value, current_value, reward_type, reward_value, target_topic_id, target_metric, expires_at")
            .eq("id", missionId).eq("user_id", userId).maybeSingle();
          if (!m) return json({ error: "Mission not found" }, 404);
          if (m.status === "completed") return json({ error: "Mission already completed" }, 409);
          if (m.status === "in_progress") {
            const info = await resolveTopic(m.target_topic_id || "");
            return json({ success: true, already_started: true, is_synthetic: false, mission: { ...m, topic_name: info.topic_name, subject_name: info.subject_name }, message: `Mission "${m.title}" already in progress` });
          }
          if (m.status !== "active") return json({ error: `Mission is ${m.status}` }, 400);

          await adminClient.from("brain_missions").update({ status: "in_progress", updated_at: new Date().toISOString() }).eq("id", missionId).eq("user_id", userId);
          const info = await resolveTopic(m.target_topic_id || "");

          let action_hint = "Complete the mission objective";
          let navigate_to = "/study";
          if (["rescue", "recall_boost", "challenge"].includes(m.mission_type || "")) {
            action_hint = `Review to improve your ${m.target_metric ?? "memory"}`;
            navigate_to = m.target_topic_id ? `/study/${m.target_topic_id}` : "/study";
          } else if (m.mission_type === "consistency") {
            action_hint = "Start a study session"; navigate_to = "/study";
          } else if (m.mission_type === "recovery") {
            action_hint = "Take a break, then do one easy review"; navigate_to = "/dashboard";
          } else if (m.mission_type === "exploration") {
            action_hint = "Study this new topic"; navigate_to = m.target_topic_id ? `/study/${m.target_topic_id}` : "/topics";
          }

          return json({
            success: true, already_started: false, is_synthetic: false,
            mission: { ...m, status: "in_progress", topic_name: info.topic_name, subject_name: info.subject_name },
            started_at: new Date().toISOString(), action_hint, navigate_to,
            message: `🚀 Mission "${m.title}" started!`,
          });
        }

        // ════════════════════════════════════════
        // ACTION: questions — Fetch AI quiz questions
        // ════════════════════════════════════════
        if (action === "questions") {
          const missionId = String(body.mission_id || query.mission_id || "");
          const rawCount = Number(body.count ?? query.count ?? 5);
          const count = Number.isFinite(rawCount) ? Math.min(Math.max(Math.trunc(rawCount), 1), 10) : 5;
          const difficulty = String(body.difficulty || query.difficulty || "medium");
          let topicName = String(body.topic_name || query.topic_name || "").trim();
          let subjectName = String(body.subject_name || query.subject_name || "").trim();

          // Resolve from mission_id
          if (missionId && !topicName) {
            const isSynthetic = /^(risk|weak|review|practice)-/.test(missionId);
            if (isSynthetic) {
              const topicId = missionId.replace(/^(risk|weak|review|practice)-/, "");
              const info = await resolveTopic(topicId);
              topicName = info.topic_name;
              subjectName = info.subject_name;
            } else {
              const { data: mRow } = await adminClient.from("brain_missions")
                .select("target_topic_id").eq("id", missionId).eq("user_id", userId).maybeSingle();
              if (mRow?.target_topic_id) {
                const info = await resolveTopic(mRow.target_topic_id);
                topicName = info.topic_name;
                subjectName = info.subject_name;
              }
            }
          }

          // Fallback: weakest topic
          if (!topicName) {
            const { data: fb } = await adminClient.from("topics")
              .select("id, name, subject_id").eq("user_id", userId).is("deleted_at", null)
              .order("memory_strength", { ascending: true }).limit(1);
            if (fb && fb.length > 0) {
              topicName = fb[0].name || "";
              if (fb[0].subject_id) {
                const { data: s } = await adminClient.from("subjects").select("name").eq("id", fb[0].subject_id).maybeSingle();
                subjectName = s?.name || "";
              }
            }
          }

          const authHeader = req.headers.get("authorization") || "";
          const aiClient = authHeader.startsWith("Bearer ")
            ? userClient(authHeader)
            : createClient(supabaseUrl, serviceKey, { global: { headers: { Authorization: `Bearer ${serviceKey}` } } });

          const { data: qData, error: qErr } = await aiClient.functions.invoke("ai-brain-agent", {
            body: { action: "mission_questions", topic_name: topicName || undefined, subject_name: subjectName || undefined, count, difficulty, user_id: userId },
          });

          const rawQ = qData?.questions || [];
          const questions = rawQ.map((q: any) => ({
            question: q.question || "", options: Array.isArray(q.options) ? q.options : [],
            correct_index: typeof q.correct_index === "number" ? q.correct_index : 0,
            explanation: q.explanation || "", difficulty: q.difficulty || difficulty,
          }));

          return json({
            success: !qErr && questions.length > 0,
            error: qErr?.message || (questions.length === 0 ? "No questions generated" : ""),
            mission_id: missionId || "", topic_name: topicName, subject_name: subjectName,
            difficulty, count: questions.length, questions,
            quiz_title: topicName ? `Quick Fix: ${topicName}` : "Quick Fix Quiz",
            quiz_description: `${questions.length} ${difficulty} questions${topicName ? ` on ${topicName}` : ""}`,
          });
        }

        // ════════════════════════════════════════
        // ACTION: progress — Update mission progress
        // ════════════════════════════════════════
        if (action === "progress") {
          const missionId = String(body.mission_id || query.mission_id || "");
          const progressValue = Number(body.progress_value ?? body.current_value ?? 0);
          if (!missionId) return json({ error: "mission_id is required" }, 400);

          // Synthetic missions: acknowledge but no DB update
          if (/^(risk|weak|review|practice)-/.test(missionId)) {
            return json({ success: true, mission_id: missionId, is_synthetic: true, current_value: progressValue, target_value: 1, target_reached: progressValue >= 1, progress_pct: Math.min(100, progressValue * 100), message: "Progress tracked" });
          }

          const { data: mp } = await adminClient.from("brain_missions")
            .select("id, title, status, target_value, current_value, mission_type")
            .eq("id", missionId).eq("user_id", userId).maybeSingle();
          if (!mp) return json({ error: "Mission not found" }, 404);
          if (mp.status === "completed") return json({ error: "Mission already completed" }, 409);

          const newVal = progressValue || ((mp.current_value ?? 0) + 1);
          const targetReached = mp.target_value ? newVal >= mp.target_value : false;
          await adminClient.from("brain_missions").update({ current_value: newVal, updated_at: new Date().toISOString() }).eq("id", missionId).eq("user_id", userId);

          return json({
            success: true, mission_id: missionId, is_synthetic: false,
            current_value: newVal, target_value: mp.target_value ?? 0,
            target_reached: targetReached,
            progress_pct: mp.target_value ? Math.min(100, Math.round((newVal / mp.target_value) * 100)) : 0,
            message: targetReached ? "🎯 Target reached! Complete the mission." : `Progress: ${newVal}/${mp.target_value ?? "∞"}`,
          });
        }

        // ════════════════════════════════════════
        // ACTION: complete — Finalize mission
        // ════════════════════════════════════════
        if (action === "complete") {
          const missionId = String(body.mission_id || query.mission_id || "");
          if (!missionId) return json({ error: "mission_id is required" }, 400);

          const score = Number(body.score ?? 0);
          const accuracy = Number(body.accuracy ?? 0);
          const time_taken_seconds = Number(body.time_taken_seconds ?? 0);
          const questions_attempted = Number(body.questions_attempted ?? 0);
          const questions_correct = Number(body.questions_correct ?? 0);

          // Synthetic missions: log study session + return brain impact
          if (/^(risk|weak|review|practice)-/.test(missionId)) {
            const topicId = missionId.replace(/^(risk|weak|review|practice)-/, "");
            const info = await resolveTopic(topicId);

            // Log study session
            if (time_taken_seconds > 0 || questions_attempted > 0) {
              await adminClient.from("study_logs").insert({
                user_id: userId, topic_id: topicId || null,
                topic_name: info.topic_name || "Mission",
                duration_minutes: Math.max(1, Math.round(time_taken_seconds / 60)),
                study_mode: "mission", confidence_level: accuracy > 80 ? 5 : accuracy > 60 ? 4 : accuracy > 40 ? 3 : 2,
              });
            }

            return json({
              success: true, mission_id: missionId, is_synthetic: true,
              completed_at: new Date().toISOString(),
              reward: { value: accuracy > 70 ? 15 : 10, type: "xp" },
              brain_impact: {
                topic_name: info.topic_name, subject_name: info.subject_name,
                score, accuracy, questions_attempted, questions_correct,
                memory_boost_pct: accuracy > 80 ? 12 : accuracy > 60 ? 8 : 5,
                estimated_rank_change: accuracy > 70 ? -50 : -20,
              },
              message: `🎉 Mission completed! +${accuracy > 70 ? 15 : 10} XP`,
            });
          }

          // Real mission
          const { data: m } = await adminClient.from("brain_missions")
            .select("id, title, mission_type, reward_value, reward_type, status, target_value, current_value, target_topic_id")
            .eq("id", missionId).eq("user_id", userId).maybeSingle();
          if (!m) return json({ error: "Mission not found" }, 404);
          if (m.status === "completed") return json({ error: "Mission already completed" }, 409);
          if (m.status !== "active" && m.status !== "in_progress") return json({ error: `Mission is ${m.status}` }, 400);

          const completedAt = new Date().toISOString();
          await adminClient.from("brain_missions").update({
            status: "completed", completed_at: completedAt,
            current_value: m.target_value ?? m.current_value,
          }).eq("id", missionId).eq("user_id", userId);

          const info = await resolveTopic(m.target_topic_id || "");

          // Log study session
          if (time_taken_seconds > 0 || questions_attempted > 0) {
            await adminClient.from("study_logs").insert({
              user_id: userId, topic_id: m.target_topic_id || null,
              topic_name: info.topic_name || "Mission",
              duration_minutes: Math.max(1, Math.round(time_taken_seconds / 60)),
              study_mode: "mission", confidence_level: accuracy > 80 ? 5 : accuracy > 60 ? 4 : accuracy > 40 ? 3 : 2,
            });
          }

          const { count: remaining } = await adminClient.from("brain_missions")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId).in("status", ["active", "in_progress"]);

          return json({
            success: true, mission_id: m.id, is_synthetic: false,
            completed_at: completedAt,
            reward: { value: m.reward_value ?? 0, type: m.reward_type ?? "xp" },
            remaining_missions: remaining ?? 0,
            brain_impact: {
              topic_name: info.topic_name, subject_name: info.subject_name,
              score, accuracy, questions_attempted, questions_correct,
              memory_boost_pct: accuracy > 80 ? 15 : accuracy > 60 ? 10 : 5,
              estimated_rank_change: accuracy > 70 ? -75 : -30,
            },
            message: `🎉 Mission "${m.title}" completed! +${m.reward_value ?? 0} ${m.reward_type ?? "XP"}`,
          });
        }

        // ════════════════════════════════════════
        // ACTION: brain-impact — Post-mission brain report
        // ════════════════════════════════════════
        if (action === "brain-impact") {
          const missionId = String(body.mission_id || query.mission_id || "");

          // Fetch latest completed mission
          let completedMission: any = null;
          if (missionId && !/^(risk|weak|review|practice)-/.test(missionId)) {
            const { data } = await adminClient.from("brain_missions")
              .select("id, title, mission_type, reward_value, target_topic_id, completed_at, status")
              .eq("id", missionId).eq("user_id", userId).maybeSingle();
            completedMission = data;
          }

          // Get overall brain health
          const { data: topics } = await adminClient.from("topics")
            .select("memory_strength").eq("user_id", userId).is("deleted_at", null);
          const allT = topics || [];
          const avgHealth = allT.length > 0 ? Math.round(allT.reduce((s: number, t: any) => s + (t.memory_strength ?? 0), 0) / allT.length) : 0;

          // Get today's stats
          const today = new Date().toISOString().split("T")[0];
          const { data: todayLogs } = await adminClient.from("study_logs")
            .select("duration_minutes").eq("user_id", userId).gte("created_at", `${today}T00:00:00Z`);
          const todayMinutes = (todayLogs || []).reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0);

          // Get streak
          const { data: streak } = await adminClient.from("study_streaks")
            .select("current_streak, longest_streak, today_met").eq("user_id", userId).maybeSingle();

          // Completed today count
          const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
          const { count: completedToday } = await adminClient.from("brain_missions")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId).eq("status", "completed")
            .gte("completed_at", todayStart.toISOString());

          return json({
            brain_health: avgHealth,
            today_study_minutes: todayMinutes,
            missions_completed_today: completedToday ?? 0,
            streak: {
              current: streak?.current_streak ?? 0,
              longest: streak?.longest_streak ?? 0,
              today_met: streak?.today_met ?? false,
            },
            completed_mission: completedMission ? {
              id: completedMission.id, title: completedMission.title,
              type: completedMission.mission_type, reward: completedMission.reward_value ?? 0,
              completed_at: completedMission.completed_at,
            } : null,
            motivational_message: (completedToday ?? 0) >= 3
              ? "🔥 You're on fire! 3+ missions completed today!"
              : (completedToday ?? 0) >= 1
                ? "💪 Great work! Keep the momentum going."
                : "🚀 Complete a mission to boost your brain!",
          });
        }

        // ════════════════════════════════════════
        // ACTION: history — Today's mission history
        // ════════════════════════════════════════
        if (action === "history") {
          const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
          const [activeRes, completedRes] = await Promise.all([
            adminClient.from("brain_missions")
              .select("id, title, description, mission_type, priority, status, target_value, current_value, reward_value, reward_type, target_topic_id, reasoning, expires_at, created_at")
              .eq("user_id", userId).in("status", ["active", "in_progress"])
              .order("created_at", { ascending: false }).limit(10),
            adminClient.from("brain_missions")
              .select("id, title, description, mission_type, priority, status, target_value, current_value, reward_value, reward_type, target_topic_id, reasoning, completed_at, created_at")
              .eq("user_id", userId).eq("status", "completed")
              .gte("completed_at", todayStart.toISOString())
              .order("completed_at", { ascending: false }).limit(10),
          ]);

          return json({
            active_missions: activeRes.data || [],
            completed_today: completedRes.data || [],
            active_count: (activeRes.data || []).length,
            completed_today_count: (completedRes.data || []).length,
          });
        }

        return json({ error: `Unknown action: ${action}`, available_actions: ["fetch", "generate", "start", "questions", "progress", "complete", "brain-impact", "history"] }, 400);
      }

      default:
        return json({ error: `Unknown home route: ${route}`, available_routes: [
          "dashboard", "all",
          "brain-health", "rank-prediction", "exam-countdown", "refresh-ai",
          "ai-recommendations", "burnout-status", "streak-status", "streak-details",
          "daily-goal", "todays-mission", "quick-actions", "review-queue",
          "brain-missions", "mission-generate", "mission-start", "mission-questions", "mission-progress", "mission-complete", "todays-mission-flow",
          "todays-mission-api",
          "cognitive-embedding", "rl-policy", "auto-study-summary",
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
