import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/* ── Sanitize nulls recursively ── */
function sanitize(obj: any): any {
  if (obj === null || obj === undefined) return "";
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else out[k] = sanitize(v);
  }
  return out;
}

/* ── Derive sub-metrics from raw data ── */
function deriveMetrics(
  overallHealth: number,
  totalAtRisk: number,
  totalTopics: number
) {
  const conceptStrength = overallHealth;
  const recallPower =
    totalTopics > 0
      ? Math.round(
          Math.max(
            0,
            overallHealth -
              (totalAtRisk / Math.max(totalTopics, 1)) * 30
          )
        )
      : 0;
  const speedIndex =
    totalTopics > 0
      ? Math.round(
          Math.min(100, overallHealth * 1.05 + (totalTopics > 5 ? 5 : 0))
        )
      : 0;
  const riskExposure =
    totalTopics > 0
      ? Math.min(
          100,
          Math.round((totalAtRisk / Math.max(totalTopics, 1)) * 100)
        )
      : 0;
  const decayRisk = riskExposure;
  const examReadiness =
    totalTopics > 0
      ? Math.round(overallHealth * 0.85 + (100 - decayRisk) * 0.15)
      : 0;

  return {
    concept_strength: conceptStrength,
    recall_power: recallPower,
    speed_index: speedIndex,
    risk_exposure: riskExposure,
    decay_risk: decayRisk,
    exam_readiness: examReadiness,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json().catch(() => ({}));
    const action = body.action || "dashboard";

    switch (action) {
      case "dashboard":
        return await handleDashboard(user.id, userClient);
      case "ai-breakdown":
        return await handleAIBreakdown(user.id, userClient, body);
      case "neural-control":
        return await handleNeuralControl(user.id, userClient);
      case "node-detail":
        return await handleNodeDetail(user.id, userClient, adminClient, body);
      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e: any) {
    console.error("brain-intelligence error:", e);
    return json({ error: e.message || "Internal error" }, 500);
  }
});

/* ═══════════════════════════════════════════
   ACTION: dashboard
   Returns full Brain Intelligence data
   ═══════════════════════════════════════════ */
async function handleDashboard(userId: string, client: any) {
  // Parallel fetch: subjects + topics + recent study logs
  const [subjectsRes, topicsRes, logsRes] = await Promise.all([
    client
      .from("subjects")
      .select("id, name")
      .eq("user_id", userId),
    client
      .from("topics")
      .select(
        "id, name, memory_strength, next_predicted_drop_date, last_revision_date, subject_id"
      )
      .eq("user_id", userId)
      .order("memory_strength", { ascending: true }),
    client
      .from("study_logs")
      .select("id, topic_name, score, duration_seconds, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const subjects = subjectsRes.data || [];
  const topics = topicsRes.data || [];
  const recentLogs = logsRes.data || [];

  // Build subject health
  const subjectHealth = subjects.map((sub: any) => {
    const subTopics = topics.filter((t: any) => t.subject_id === sub.id);
    const topicCount = subTopics.length;
    const avgStrength =
      topicCount > 0
        ? Math.round(
            subTopics.reduce(
              (s: number, t: any) => s + Number(t.memory_strength || 0),
              0
            ) / topicCount
          )
        : 0;

    return {
      id: sub.id,
      name: sub.name,
      strength: avgStrength,
      topic_count: topicCount,
      topics: subTopics.map((t: any) => ({
        id: t.id,
        name: t.name,
        memory_strength: Number(t.memory_strength || 0),
        next_predicted_drop_date: t.next_predicted_drop_date || "",
        last_revision_date: t.last_revision_date || "",
      })),
    };
  });

  subjectHealth.sort((a: any, b: any) => a.strength - b.strength);

  // Overall metrics
  const totalTopics = topics.length;
  const now = new Date();
  const totalAtRisk = topics.filter((t: any) => {
    if (!t.next_predicted_drop_date) return false;
    return new Date(t.next_predicted_drop_date) <= now;
  }).length;

  const overallHealth =
    totalTopics > 0
      ? Math.round(
          topics.reduce(
            (s: number, t: any) => s + Number(t.memory_strength || 0),
            0
          ) / totalTopics
        )
      : 0;

  const metrics = deriveMetrics(overallHealth, totalAtRisk, totalTopics);

  // SurePass status
  const surePassLabel =
    overallHealth > 80
      ? "SUREPASS"
      : overallHealth > 60
      ? "ON_TRACK"
      : overallHealth > 40
      ? "NEEDS_WORK"
      : "CRITICAL";

  // Decay alerts (top 3)
  const decayAlerts = topics
    .filter(
      (t: any) =>
        t.next_predicted_drop_date &&
        new Date(t.next_predicted_drop_date) <= now
    )
    .slice(0, 3)
    .map((t: any) => {
      const sub = subjects.find((s: any) => s.id === t.subject_id);
      return {
        topic: t.name,
        subject: sub?.name || "Unknown",
        strength: Number(t.memory_strength || 0),
      };
    });

  // Weakest topic for boost
  const weakest =
    topics.length > 0
      ? (() => {
          const t = topics[0]; // already sorted ascending
          const sub = subjects.find((s: any) => s.id === t.subject_id);
          const boost = Math.min(
            15,
            Math.max(3, Math.round((100 - Number(t.memory_strength || 0)) * 0.2))
          );
          return {
            topic_id: t.id,
            topic_name: t.name,
            subject_name: sub?.name || "Unknown",
            current_strength: Number(t.memory_strength || 0),
            estimated_boost: boost,
          };
        })()
      : null;

  // Mission impact
  const missionImpact = weakest
    ? {
        topic: weakest.topic_name,
        boost: weakest.estimated_boost,
        message: `Fix ${weakest.topic_name} for +${weakest.estimated_boost}% stability boost`,
      }
    : null;

  // Recent activity summary
  const todayStr = now.toISOString().split("T")[0];
  const todayLogs = recentLogs.filter(
    (l: any) => l.created_at && l.created_at.startsWith(todayStr)
  );
  const todaySessions = todayLogs.length;
  const todayMinutes = Math.round(
    todayLogs.reduce(
      (s: number, l: any) => s + (Number(l.duration_seconds) || 0),
      0
    ) / 60
  );

  return json(
    sanitize({
      overall_health: overallHealth,
      total_topics: totalTopics,
      total_at_risk: totalAtRisk,
      total_subjects: subjects.length,
      has_data: totalTopics > 0,
      surepass_label: surePassLabel,
      metrics,
      subject_health: subjectHealth,
      decay_alerts: decayAlerts,
      weakest_target: weakest,
      mission_impact: missionImpact,
      today_activity: {
        sessions: todaySessions,
        minutes: todayMinutes,
      },
      quick_metrics: [
        {
          key: "memory",
          label: "Memory",
          value: totalTopics > 0 ? `${overallHealth}%` : "0%",
          status:
            overallHealth > 70
              ? "success"
              : overallHealth > 50
              ? "warning"
              : "destructive",
        },
        {
          key: "risk",
          label: "Risk",
          value: totalTopics > 0 ? `${metrics.decay_risk}%` : "100%",
          status:
            metrics.decay_risk < 20
              ? "success"
              : metrics.decay_risk < 50
              ? "warning"
              : "destructive",
        },
        {
          key: "ready",
          label: "Ready",
          value: totalTopics > 0 ? `${metrics.exam_readiness}%` : "0%",
          status:
            metrics.exam_readiness > 70
              ? "success"
              : metrics.exam_readiness > 50
              ? "warning"
              : "destructive",
        },
      ],
    })
  );
}

/* ═══════════════════════════════════════════
   ACTION: ai-breakdown
   Returns AI-powered analysis of brain state
   ═══════════════════════════════════════════ */
async function handleAIBreakdown(userId: string, client: any, body: any) {
  // Gather context
  const [topicsRes, logsRes] = await Promise.all([
    client
      .from("topics")
      .select("name, memory_strength, next_predicted_drop_date, last_revision_date, subject_id")
      .eq("user_id", userId)
      .order("memory_strength", { ascending: true })
      .limit(50),
    client
      .from("study_logs")
      .select("topic_name, score, duration_seconds, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const topics = topicsRes.data || [];
  const logs = logsRes.data || [];

  const totalTopics = topics.length;
  const now = new Date();
  const totalAtRisk = topics.filter(
    (t: any) =>
      t.next_predicted_drop_date &&
      new Date(t.next_predicted_drop_date) <= now
  ).length;
  const overallHealth =
    totalTopics > 0
      ? Math.round(
          topics.reduce(
            (s: number, t: any) => s + Number(t.memory_strength || 0),
            0
          ) / totalTopics
        )
      : 0;

  const metrics = deriveMetrics(overallHealth, totalAtRisk, totalTopics);

  // Prepare AI prompt
  const weakTopics = topics.slice(0, 5).map((t: any) => `${t.name}: ${t.memory_strength}%`);
  const recentActivity = logs.slice(0, 5).map((l: any) => `${l.topic_name}: ${l.score}% (${Math.round((l.duration_seconds || 0) / 60)}min)`);

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    // Fallback without AI
    return json(
      sanitize({
        explanation: generateFallbackExplanation(overallHealth, totalAtRisk, totalTopics, metrics),
        breakdown: buildBreakdownCards(overallHealth, totalAtRisk, totalTopics, metrics, topics),
        recommendations: generateFallbackRecommendations(overallHealth, totalAtRisk, metrics),
      })
    );
  }

  try {
    const systemPrompt = `You are an expert cognitive science AI analyzing a student's brain intelligence data. Be concise, specific, and actionable. Always reference actual data.`;

    const userPrompt = `Analyze this student's brain state and provide a detailed breakdown:

OVERALL: Health ${overallHealth}%, Topics ${totalTopics}, At-Risk ${totalAtRisk}
METRICS: Concept Strength ${metrics.concept_strength}%, Recall Power ${metrics.recall_power}%, Speed Index ${metrics.speed_index}%, Risk Exposure ${metrics.risk_exposure}%, Exam Readiness ${metrics.exam_readiness}%
WEAKEST TOPICS: ${weakTopics.join(", ") || "None"}
RECENT SESSIONS: ${recentActivity.join(", ") || "None"}

Return a JSON with:
{
  "explanation": "2-3 sentence personalized analysis of their brain state",
  "strength_analysis": "1 sentence about concept strength",
  "recall_analysis": "1 sentence about recall power", 
  "risk_analysis": "1 sentence about risk exposure",
  "readiness_analysis": "1 sentence about exam readiness",
  "top_recommendation": "Most important action to take right now",
  "predicted_improvement": "Expected % improvement if they follow advice",
  "urgency_level": "low|medium|high|critical",
  "focus_topics": ["topic1", "topic2", "topic3"],
  "optimal_strategy": "1 sentence strategy recommendation"
}`;

    const aiResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
        }),
      }
    );

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return json({ error: "Rate limited, please try again later" }, 429);
      }
      if (aiResp.status === 402) {
        return json({ error: "AI credits exhausted" }, 402);
      }
      throw new Error(`AI gateway error: ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const raw = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from AI response
    let parsed: any = {};
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      parsed = {};
    }

    const explanation = parsed.explanation || generateFallbackExplanation(overallHealth, totalAtRisk, totalTopics, metrics);

    return json(
      sanitize({
        explanation,
        strength_analysis: parsed.strength_analysis || `Concept strength at ${metrics.concept_strength}%.`,
        recall_analysis: parsed.recall_analysis || `Recall power at ${metrics.recall_power}%.`,
        risk_analysis: parsed.risk_analysis || `${totalAtRisk} topics at risk of decay.`,
        readiness_analysis: parsed.readiness_analysis || `Exam readiness at ${metrics.exam_readiness}%.`,
        top_recommendation: parsed.top_recommendation || "Focus on your weakest topics daily.",
        predicted_improvement: parsed.predicted_improvement || "+5-10%",
        urgency_level: parsed.urgency_level || (overallHealth < 40 ? "critical" : overallHealth < 60 ? "high" : "medium"),
        focus_topics: parsed.focus_topics || topics.slice(0, 3).map((t: any) => t.name),
        optimal_strategy: parsed.optimal_strategy || "Daily micro-sessions on weak topics will yield the fastest improvement.",
        breakdown: buildBreakdownCards(overallHealth, totalAtRisk, totalTopics, metrics, topics),
        recommendations: generateFallbackRecommendations(overallHealth, totalAtRisk, metrics),
      })
    );
  } catch (e: any) {
    console.error("AI breakdown error:", e);
    return json(
      sanitize({
        explanation: generateFallbackExplanation(overallHealth, totalAtRisk, totalTopics, metrics),
        breakdown: buildBreakdownCards(overallHealth, totalAtRisk, totalTopics, metrics, topics),
        recommendations: generateFallbackRecommendations(overallHealth, totalAtRisk, metrics),
      })
    );
  }
}

/* ── Helpers ── */
function generateFallbackExplanation(health: number, atRisk: number, total: number, metrics: any): string {
  if (total === 0) return "No topics tracked yet. Add subjects and start studying to unlock AI-powered brain analytics.";
  if (health > 70) return `Your brain is performing well at ${health}% overall health. ${atRisk > 0 ? `${atRisk} topics need attention to maintain momentum.` : "Keep reviewing to stay sharp."}`;
  if (health > 50) return `Brain health at ${health}% with ${atRisk} topics at risk. Focus on at-risk areas to strengthen stability. Exam readiness is at ${metrics.exam_readiness}%.`;
  return `Critical state detected: ${health}% brain health with ${atRisk} topics decaying. Immediate daily micro-sessions on weak topics will significantly improve your scores.`;
}

function buildBreakdownCards(health: number, atRisk: number, total: number, metrics: any, topics: any[]) {
  return [
    { key: "concept_strength", label: "Concept Strength", value: `${metrics.concept_strength}%`, status: metrics.concept_strength > 70 ? "success" : metrics.concept_strength > 50 ? "warning" : "destructive" },
    { key: "recall_power", label: "Recall Power", value: `${metrics.recall_power}%`, status: metrics.recall_power > 70 ? "success" : metrics.recall_power > 50 ? "warning" : "destructive" },
    { key: "speed_index", label: "Speed Index", value: `${metrics.speed_index}%`, status: metrics.speed_index > 70 ? "success" : metrics.speed_index > 50 ? "warning" : "destructive" },
    { key: "risk_exposure", label: "Risk Exposure", value: `${metrics.risk_exposure}%`, status: metrics.risk_exposure < 20 ? "success" : metrics.risk_exposure < 50 ? "warning" : "destructive" },
  ];
}

function generateFallbackRecommendations(health: number, atRisk: number, metrics: any): string[] {
  const recs: string[] = [];
  if (atRisk > 0) recs.push(`Fix ${atRisk} decaying topic${atRisk > 1 ? "s" : ""} immediately to prevent further memory loss.`);
  if (metrics.recall_power < 50) recs.push("Practice active recall with quick quizzes to boost recall power.");
  if (metrics.exam_readiness < 60) recs.push("Increase revision frequency to improve exam readiness score.");
  if (health < 40) recs.push("Start with 5-minute daily micro-sessions on your weakest topic.");
  if (recs.length === 0) recs.push("Maintain your current study rhythm. Review at-risk topics periodically.");
  return recs;
}

/* ═══════════════════════════════════════════
   ACTION: neural-control
   Full Neural Control map data with enhanced per-subject/topic metrics
   ═══════════════════════════════════════════ */
async function handleNeuralControl(userId: string, client: any) {
  const [subjectsRes, topicsRes, logsRes] = await Promise.all([
    client.from("subjects").select("id, name").eq("user_id", userId),
    client.from("topics").select("id, name, memory_strength, next_predicted_drop_date, last_revision_date, subject_id, created_at").eq("user_id", userId),
    client.from("study_logs").select("topic_id, topic_name, score, duration_seconds, confidence_level, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(500),
  ]);

  const subjects = subjectsRes.data || [];
  const topics = topicsRes.data || [];
  const logs = logsRes.data || [];
  const now = new Date();

  // Build rich subject nodes
  const subjectNodes = subjects.map((sub: any) => {
    const subTopics = topics.filter((t: any) => t.subject_id === sub.id);
    const topicCount = subTopics.length;
    const avgStrength = topicCount > 0 ? Math.round(subTopics.reduce((s: number, t: any) => s + Number(t.memory_strength || 0), 0) / topicCount) : 0;

    const subLogs = logs.filter((l: any) => subTopics.some((t: any) => t.id === l.topic_id || t.name === l.topic_name));
    const totalSessions = subLogs.length;
    const totalMinutes = Math.round(subLogs.reduce((s: number, l: any) => s + (Number(l.duration_seconds) || 0), 0) / 60);

    // At-risk topics
    const atRiskTopics = subTopics.filter((t: any) => {
      if (!t.next_predicted_drop_date) return Number(t.memory_strength || 0) < 30;
      return new Date(t.next_predicted_drop_date) <= now;
    });

    // Last activity
    const lastLog = subLogs[0];
    const lastActivityAt = lastLog?.created_at || "";
    const daysSinceActivity = lastLog ? Math.round((now.getTime() - new Date(lastLog.created_at).getTime()) / 86400000) : -1;

    // Stability trend (compare recent 5 vs older 5 sessions)
    const recent5 = subLogs.slice(0, 5);
    const older5 = subLogs.slice(5, 10);
    const recentAvgScore = recent5.length > 0 ? recent5.reduce((s: number, l: any) => s + (Number(l.score) || 0), 0) / recent5.length : 0;
    const olderAvgScore = older5.length > 0 ? older5.reduce((s: number, l: any) => s + (Number(l.score) || 0), 0) / older5.length : 0;
    const trend = recent5.length < 2 ? "neutral" : recentAvgScore > olderAvgScore + 5 ? "improving" : recentAvgScore < olderAvgScore - 5 ? "declining" : "stable";

    // Status
    const status = avgStrength > 70 ? "strong" : avgStrength > 40 ? "at_risk" : "critical";

    // Build topic nodes
    const topicNodes = subTopics.map((t: any) => {
      const tLogs = logs.filter((l: any) => l.topic_id === t.id || l.topic_name === t.name);
      const tSessions = tLogs.length;
      const lastReviewLog = tLogs[0];
      const lastReviewAt = lastReviewLog?.created_at || t.last_revision_date || "";
      const hoursSinceReview = lastReviewAt ? Math.round((now.getTime() - new Date(lastReviewAt).getTime()) / 3600000) : -1;

      const isOverdue = t.next_predicted_drop_date ? new Date(t.next_predicted_drop_date) <= now : false;
      const strength = Number(t.memory_strength || 0);

      // Decay velocity (how fast it's dropping)
      const decayVelocity = hoursSinceReview > 0 ? Math.round(Math.max(0, (100 - strength) / Math.max(hoursSinceReview, 1)) * 100) / 100 : 0;

      // Mastery index (based on high-confidence sessions)
      const highConfSessions = tLogs.filter((l: any) => l.confidence_level === "high").length;
      const masteryIndex = tSessions > 0 ? Math.round((highConfSessions / tSessions) * 100) : 0;

      // Status
      const topicStatus = strength > 70 ? "strong" : strength > 40 ? "at_risk" : "critical";

      return {
        id: t.id,
        name: t.name,
        memory_strength: strength,
        mastery_index: masteryIndex,
        sessions_count: tSessions,
        hours_since_review: hoursSinceReview,
        decay_velocity: decayVelocity,
        is_overdue: isOverdue,
        next_predicted_drop_date: t.next_predicted_drop_date || "",
        last_revision_date: lastReviewAt,
        status: topicStatus,
        created_at: t.created_at || "",
      };
    });

    topicNodes.sort((a: any, b: any) => a.memory_strength - b.memory_strength);

    return {
      id: sub.id,
      name: sub.name,
      strength: avgStrength,
      topic_count: topicCount,
      at_risk_count: atRiskTopics.length,
      total_sessions: totalSessions,
      total_minutes: totalMinutes,
      last_activity_at: lastActivityAt,
      days_since_activity: daysSinceActivity,
      trend,
      status,
      topics: topicNodes,
    };
  });

  subjectNodes.sort((a: any, b: any) => a.strength - b.strength);

  // Global metrics
  const totalTopics = topics.length;
  const totalAtRisk = subjectNodes.reduce((s: number, n: any) => s + n.at_risk_count, 0);
  const overallHealth = totalTopics > 0 ? Math.round(topics.reduce((s: number, t: any) => s + Number(t.memory_strength || 0), 0) / totalTopics) : 0;
  const strongCount = topics.filter((t: any) => Number(t.memory_strength || 0) > 70).length;
  const criticalCount = topics.filter((t: any) => Number(t.memory_strength || 0) < 30).length;
  const atRiskCount = totalTopics - strongCount - criticalCount;

  // Network connectivity score (how well-studied the brain is overall)
  const totalSessions = logs.length;
  const connectivityScore = Math.min(100, Math.round((totalSessions / Math.max(totalTopics * 3, 1)) * 100));

  return json(sanitize({
    brain_core: {
      overall_health: overallHealth,
      total_topics: totalTopics,
      total_subjects: subjects.length,
      total_at_risk: totalAtRisk,
      connectivity_score: connectivityScore,
      health_distribution: {
        strong: strongCount,
        at_risk: atRiskCount,
        critical: criticalCount,
      },
    },
    subject_nodes: subjectNodes,
    legend: [
      { key: "strong", label: "Strong", color: "hsl(142 71% 45%)", threshold: "> 70%" },
      { key: "at_risk", label: "At Risk", color: "hsl(38 92% 50%)", threshold: "40-70%" },
      { key: "critical", label: "Critical", color: "hsl(0 72% 51%)", threshold: "< 40%" },
    ],
    summary: {
      strongest_subject: subjectNodes.length > 0 ? subjectNodes[subjectNodes.length - 1].name : "",
      weakest_subject: subjectNodes.length > 0 ? subjectNodes[0].name : "",
      most_active_subject: subjectNodes.length > 0 ? [...subjectNodes].sort((a, b) => b.total_sessions - a.total_sessions)[0].name : "",
      recommendation: overallHealth < 30 ? "Start daily micro-sessions on critical topics" : overallHealth < 60 ? "Focus on at-risk subjects to prevent further decay" : "Maintain review cadence on weaker areas",
    },
  }));
}

/* ═══════════════════════════════════════════
   ACTION: node-detail
   Deep detail for a specific topic or subject node on tap
   ═══════════════════════════════════════════ */
async function handleNodeDetail(userId: string, client: any, adminClient: any, body: any) {
  const { topic_id, subject_id } = body;

  // ── TOPIC DETAIL ──
  if (topic_id) {
    const [topicRes, logsRes] = await Promise.all([
      client.from("topics").select("id, name, memory_strength, next_predicted_drop_date, last_revision_date, subject_id, created_at").eq("id", topic_id).eq("user_id", userId).maybeSingle(),
      client.from("study_logs").select("id, topic_name, score, duration_seconds, confidence_level, created_at, duration_minutes").eq("user_id", userId).order("created_at", { ascending: false }).limit(500),
    ]);

    const topic = topicRes.data;
    if (!topic) return json({ error: "Topic not found" }, 404);

    const tLogs = (logsRes.data || []).filter((l: any) => l.topic_id === topic.id || l.topic_name === topic.name);
    const now = new Date();
    const strength = Number(topic.memory_strength || 0);

    // Sessions breakdown
    const totalSessions = tLogs.length;
    const highConf = tLogs.filter((l: any) => l.confidence_level === "high").length;
    const medConf = tLogs.filter((l: any) => l.confidence_level === "medium").length;
    const lowConf = tLogs.filter((l: any) => l.confidence_level === "low").length;
    const totalMinutes = Math.round(tLogs.reduce((s: number, l: any) => s + (Number(l.duration_seconds) || Number(l.duration_minutes || 0) * 60 || 0), 0) / 60);

    // Mastery & stability metrics
    const masteryIndex = totalSessions > 0 ? Math.round((highConf / totalSessions) * 100) : 0;
    const stabilityScore = Math.round(strength * 0.6 + masteryIndex * 0.4);

    // Decay analysis
    const lastReviewDate = tLogs[0]?.created_at || topic.last_revision_date;
    const hoursSinceReview = lastReviewDate ? Math.round((now.getTime() - new Date(lastReviewDate).getTime()) / 3600000) : -1;
    const isOverdue = topic.next_predicted_drop_date ? new Date(topic.next_predicted_drop_date) <= now : false;

    // Predicted retention (Ebbinghaus model)
    const baseStability = 24;
    const masteryBoost = 1 + (masteryIndex / 100) * 3;
    const reviewBoost = 1 + Math.log2(totalSessions + 1) * 0.5;
    const stability = baseStability * masteryBoost * reviewBoost;
    const predictedRetention = hoursSinceReview > 0 ? Math.round(Math.exp(-hoursSinceReview / stability) * 100) : strength;

    // Decay risk level
    const decayRisk = predictedRetention > 70 ? "low" : predictedRetention > 50 ? "medium" : predictedRetention > 30 ? "high" : "critical";

    // Recent session history (last 5)
    const recentHistory = tLogs.slice(0, 5).map((l: any) => ({
      date: l.created_at,
      score: Number(l.score) || 0,
      confidence: l.confidence_level || "unknown",
      duration_minutes: Math.round((Number(l.duration_seconds) || Number(l.duration_minutes || 0) * 60 || 0) / 60),
    }));

    // Performance trend
    const recent3 = tLogs.slice(0, 3);
    const older3 = tLogs.slice(3, 6);
    const recentAvg = recent3.length > 0 ? recent3.reduce((s: number, l: any) => s + (Number(l.score) || 0), 0) / recent3.length : 0;
    const olderAvg = older3.length > 0 ? older3.reduce((s: number, l: any) => s + (Number(l.score) || 0), 0) / older3.length : 0;
    const performanceTrend = recent3.length < 2 ? "neutral" : recentAvg > olderAvg + 5 ? "improving" : recentAvg < olderAvg - 5 ? "declining" : "stable";

    // Optimal review time
    const hoursUntil70pct = stability * Math.log(100 / 70);
    const nextOptimalReview = lastReviewDate ? new Date(new Date(lastReviewDate).getTime() + hoursUntil70pct * 3600000).toISOString() : "";

    // Recommended actions
    const actions: any[] = [];
    if (predictedRetention < 50) {
      actions.push({ type: "stabilize", label: "Stabilize Now", description: "Quick recall session to boost retention", priority: "high", estimated_boost: Math.min(20, Math.round((100 - strength) * 0.25)) });
    }
    if (lowConf > highConf) {
      actions.push({ type: "deep_focus", label: "Deep Focus", description: "Extended study to build strong foundations", priority: "medium", estimated_boost: Math.min(15, Math.round((100 - strength) * 0.2)) });
    }
    if (hoursSinceReview > 48) {
      actions.push({ type: "quick_review", label: "Quick Review", description: "Short refresher to prevent further decay", priority: isOverdue ? "high" : "medium", estimated_boost: Math.min(10, Math.round((100 - strength) * 0.15)) });
    }
    if (actions.length === 0) {
      actions.push({ type: "maintain", label: "Practice", description: "Keep momentum with regular practice", priority: "low", estimated_boost: 5 });
    }

    // Get subject name
    const subjectRes = await client.from("subjects").select("name").eq("id", topic.subject_id).maybeSingle();

    return json(sanitize({
      topic_id: topic.id,
      topic_name: topic.name,
      subject_name: subjectRes.data?.name || "Unknown",
      memory_strength: strength,
      stability_score: stabilityScore,
      mastery_index: masteryIndex,
      predicted_retention: predictedRetention,
      decay_risk: decayRisk,
      performance_trend: performanceTrend,
      hours_since_review: hoursSinceReview,
      is_overdue: isOverdue,
      next_optimal_review: nextOptimalReview,
      session_stats: {
        total: totalSessions,
        high_confidence: highConf,
        medium_confidence: medConf,
        low_confidence: lowConf,
        total_minutes: totalMinutes,
      },
      metrics: [
        { key: "stability", label: "Stability", value: `${stabilityScore}%`, icon: "shield", color: stabilityScore > 70 ? "success" : stabilityScore > 40 ? "warning" : "destructive" },
        { key: "mastery", label: "Mastery", value: `${masteryIndex}%`, icon: "brain", color: masteryIndex > 70 ? "success" : masteryIndex > 40 ? "warning" : "destructive" },
        { key: "retention", label: "Retention", value: `${predictedRetention}%`, icon: "trending-down", color: predictedRetention > 70 ? "success" : predictedRetention > 50 ? "warning" : "destructive" },
        { key: "decay_risk", label: "Decay Risk", value: decayRisk, icon: "alert-triangle", color: decayRisk === "low" ? "success" : decayRisk === "medium" ? "warning" : "destructive" },
      ],
      recent_history: recentHistory,
      recommended_actions: actions,
      created_at: topic.created_at || "",
    }));
  }

  // ── SUBJECT DETAIL ──
  if (subject_id) {
    const [subjectRes, topicsRes, logsRes] = await Promise.all([
      client.from("subjects").select("id, name, created_at").eq("id", subject_id).eq("user_id", userId).maybeSingle(),
      client.from("topics").select("id, name, memory_strength, next_predicted_drop_date, last_revision_date, created_at").eq("subject_id", subject_id).eq("user_id", userId),
      client.from("study_logs").select("topic_id, topic_name, score, duration_seconds, confidence_level, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(500),
    ]);

    const subject = subjectRes.data;
    if (!subject) return json({ error: "Subject not found" }, 404);

    const subTopics = topicsRes.data || [];
    const now = new Date();
    const avgStrength = subTopics.length > 0 ? Math.round(subTopics.reduce((s: number, t: any) => s + Number(t.memory_strength || 0), 0) / subTopics.length) : 0;

    const subLogs = (logsRes.data || []).filter((l: any) => subTopics.some((t: any) => t.id === l.topic_id || t.name === l.topic_name));
    const totalSessions = subLogs.length;
    const totalMinutes = Math.round(subLogs.reduce((s: number, l: any) => s + (Number(l.duration_seconds) || 0), 0) / 60);

    const strongTopics = subTopics.filter((t: any) => Number(t.memory_strength || 0) > 70);
    const criticalTopics = subTopics.filter((t: any) => Number(t.memory_strength || 0) < 30);
    const atRiskTopics = subTopics.filter((t: any) => {
      const s = Number(t.memory_strength || 0);
      return s >= 30 && s <= 70;
    });

    // Weekly activity (last 7 days)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
    const weekLogs = subLogs.filter((l: any) => new Date(l.created_at) >= sevenDaysAgo);
    const activeDays = new Set(weekLogs.map((l: any) => new Date(l.created_at).toDateString())).size;

    // Topic ranking
    const topicRanking = subTopics.map((t: any) => ({
      id: t.id,
      name: t.name,
      memory_strength: Number(t.memory_strength || 0),
      status: Number(t.memory_strength || 0) > 70 ? "strong" : Number(t.memory_strength || 0) > 40 ? "at_risk" : "critical",
      next_predicted_drop_date: t.next_predicted_drop_date || "",
      last_revision_date: t.last_revision_date || "",
    })).sort((a: any, b: any) => a.memory_strength - b.memory_strength);

    return json(sanitize({
      subject_id: subject.id,
      subject_name: subject.name,
      avg_strength: avgStrength,
      status: avgStrength > 70 ? "strong" : avgStrength > 40 ? "at_risk" : "critical",
      topic_count: subTopics.length,
      health_distribution: {
        strong: strongTopics.length,
        at_risk: atRiskTopics.length,
        critical: criticalTopics.length,
      },
      activity: {
        total_sessions: totalSessions,
        total_minutes: totalMinutes,
        active_days_this_week: activeDays,
        last_activity: subLogs[0]?.created_at || "",
      },
      topic_ranking: topicRanking,
      recommended_focus: criticalTopics.length > 0
        ? { topic_id: criticalTopics[0].id, topic_name: criticalTopics[0].name, reason: "Lowest memory strength in this subject", estimated_boost: Math.min(15, Math.round((100 - Number(criticalTopics[0].memory_strength || 0)) * 0.2)) }
        : atRiskTopics.length > 0
        ? { topic_id: atRiskTopics[0].id, topic_name: atRiskTopics[0].name, reason: "At risk of further decay", estimated_boost: 10 }
        : null,
      created_at: subject.created_at || "",
    }));
  }

  return json({ error: "Provide topic_id or subject_id" }, 400);
}
