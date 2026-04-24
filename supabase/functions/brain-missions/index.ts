import { authenticateRequest, handleCors, jsonResponse, errorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId, supabase } = await authenticateRequest(req);

    const body = await req.json();
    const { action } = body;

    if (action === "generate") {
      return new Response(JSON.stringify(await generateMissions(supabase, userId)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      const { data } = await supabase
        .from("brain_missions")
        .select("*")
        .eq("user_id", userId)
        .in("status", ["active", "in_progress"])
        .order("priority", { ascending: true })
        .limit(10);
      return new Response(JSON.stringify(data || []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "complete") {
      const mission_id = body.mission_id;
      if (mission_id) {
        await supabase.from("brain_missions").update({
          status: "completed",
          completed_at: new Date().toISOString(),
        }).eq("id", mission_id).eq("user_id", userId);
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("brain-missions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function generateMissions(supabase: any, userId: string) {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Expire old missions
  await supabase.from("brain_missions")
    .update({ status: "expired" })
    .eq("user_id", userId)
    .eq("status", "active")
    .lt("expires_at", now.toISOString());

  // Fetch user's cognitive state
  const [twinRes, featuresRes, topicsRes, logsRes, embeddingRes] = await Promise.all([
    supabase.from("cognitive_twins").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("user_features").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("topics").select("id, name, memory_strength, last_revision_date, subject_id, next_predicted_drop_date").eq("user_id", userId).is("deleted_at", null),
    supabase.from("study_logs").select("duration_minutes, created_at, topic_id, confidence_level").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    supabase.from("user_cognitive_embeddings").select("cluster_id, embedding").eq("user_id", userId).maybeSingle(),
  ]);

  const twin = twinRes.data;
  const features = featuresRes.data;
  const topics: any[] = (topicsRes.data as any[]) || [];
  const logs: any[] = (logsRes.data as any[]) || [];
  const embedding = embeddingRes.data;
  const topicModels = (twin?.topic_models as any[]) || [];

  const missions: any[] = [];

  // === MISSION 1: Critical topic rescue ===
  const criticalTopics = topics
    .filter(t => Number(t.memory_strength) < 40)
    .sort((a, b) => Number(a.memory_strength) - Number(b.memory_strength));

  if (criticalTopics.length > 0) {
    const target = criticalTopics[0];
    missions.push({
      user_id: userId,
      title: `🚨 Rescue: ${target.name}`,
      description: `Memory at ${Math.round(Number(target.memory_strength))}%. A quick review now can boost it by 15-25% based on your learning speed.`,
      mission_type: "rescue",
      priority: "critical",
      target_topic_id: target.id,
      target_metric: "memory_strength",
      target_value: Math.min(100, Number(target.memory_strength) + 20),
      current_value: Number(target.memory_strength),
      expires_at: tomorrow.toISOString(),
      reward_value: 25,
      reasoning: `Your personal decay rate for this topic is ${topicModels.find((m: any) => m.topic_id === target.id)?.decay_rate ?? 'unknown'}. Without action, it will drop further.`,
    });
  }

  // === MISSION 2: Consistency streak ===
  const todayLogs = logs.filter(l => new Date(l.created_at).toDateString() === now.toDateString());
  if (todayLogs.length === 0) {
    const optimalDuration = twin?.optimal_session_duration ?? 25;
    missions.push({
      user_id: userId,
      title: "📚 Daily Study Session",
      description: `Start a ${optimalDuration}-min session at your optimal time (${twin?.optimal_study_hour ?? 9}:00). Your brain works best then!`,
      mission_type: "consistency",
      priority: "high",
      target_metric: "daily_session",
      target_value: 1,
      current_value: 0,
      expires_at: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString(),
      reward_value: 15,
      reasoning: `Your consistency score is ${Math.round(features?.study_consistency_score ?? 0)}%. Studying today keeps it strong.`,
    });
  }

  // === MISSION 3: Strengthen weak recall ===
  const lowRecall = topicModels
    .filter((t: any) => t.recall_success_rate < 0.5 && t.review_count >= 2)
    .sort((a: any, b: any) => a.recall_success_rate - b.recall_success_rate);

  if (lowRecall.length > 0) {
    const weakest = lowRecall[0];
    missions.push({
      user_id: userId,
      title: `🎯 Recall Challenge: ${weakest.topic_name}`,
      description: `Your recall rate is ${Math.round(weakest.recall_success_rate * 100)}%. Take a quick test to improve it.`,
      mission_type: "recall_boost",
      priority: "medium",
      target_topic_id: weakest.topic_id,
      target_metric: "recall_rate",
      target_value: 0.7,
      current_value: weakest.recall_success_rate,
      expires_at: tomorrow.toISOString(),
      reward_value: 20,
      reasoning: `Based on your learning speed of ${weakest.learning_speed}, focused practice should raise recall by 15-20%.`,
    });
  }

  // === MISSION 4: Anti-burnout mission ===
  if (features && features.burnout_risk_score > 60) {
    missions.push({
      user_id: userId,
      title: "🧘 Recovery Break",
      description: "Your cognitive fatigue is high. Take a 30-min break, then do one easy review session.",
      mission_type: "recovery",
      priority: "high",
      target_metric: "burnout_score",
      target_value: 40,
      current_value: features.burnout_risk_score,
      expires_at: tomorrow.toISOString(),
      reward_value: 10,
      reasoning: `Burnout risk at ${Math.round(features.burnout_risk_score)}%. Rest now will improve tomorrow's efficiency.`,
    });
  }

  // === MISSION 5: Cluster-specific mission ===
  const cluster = embedding?.cluster_id;
  if (cluster === "memory_master" || cluster === "stable_memory") {
    // Push to expand knowledge
    const unstudiedRecent = topics.filter(t => !t.last_revision_date).slice(0, 1);
    if (unstudiedRecent.length > 0) {
      missions.push({
        user_id: userId,
        title: `🌱 Explore: ${unstudiedRecent[0].name}`,
        description: "Your memory is strong! Time to expand into new territory.",
        mission_type: "exploration",
        priority: "low",
        target_topic_id: unstudiedRecent[0].id,
        target_metric: "first_review",
        target_value: 1,
        current_value: 0,
        expires_at: tomorrow.toISOString(),
        reward_value: 15,
        reasoning: `Your cognitive cluster is "${cluster}" — you retain well, so exploring new topics is optimal.`,
      });
    }
  } else if (cluster === "fast_learner" || cluster === "efficiency_expert") {
    // Challenge with harder topics
    const hardTopics = topicModels.filter((t: any) => t.decay_rate > 0.08).slice(0, 1);
    if (hardTopics.length > 0) {
      missions.push({
        user_id: userId,
        title: `💪 Master Challenge: ${hardTopics[0].topic_name}`,
        description: "Your learning speed is high — tackle this fast-decaying topic to master it.",
        mission_type: "challenge",
        priority: "medium",
        target_topic_id: hardTopics[0].topic_id,
        target_metric: "memory_strength",
        target_value: 80,
        current_value: hardTopics[0].memory_strength,
        expires_at: tomorrow.toISOString(),
        reward_value: 30,
        reasoning: `This topic decays ${Math.round(hardTopics[0].decay_rate * 100)}x faster than average. Perfect challenge for a fast learner.`,
      });
    }
  }

  // Insert missions (max 5)
  const toInsert = missions.slice(0, 5);
  if (toInsert.length > 0) {
    await supabase.from("brain_missions").insert(toInsert);
  }

  return { missions: toInsert, generated_at: now.toISOString() };
}
