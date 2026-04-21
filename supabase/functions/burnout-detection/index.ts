import { createClient } from "npm:@supabase/supabase-js@2";
import { authenticateRequest, handleCors, corsHeaders } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const { userId, supabase } = await authenticateRequest(req);
    const now = new Date();
    const startTime = Date.now();

    // Get user features (computed by ml-feature-engine)
    const { data: features } = await supabase
      .from("user_features")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    // Get recent study logs for pattern analysis
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const { data: recentLogs } = await supabase
      .from("study_logs")
      .select("duration_minutes, created_at, confidence_level, study_mode")
      .eq("user_id", userId)
      .gte("created_at", threeDaysAgo.toISOString())
      .order("created_at", { ascending: false });

    const logs = recentLogs || [];

    // === BURNOUT DETECTION HEURISTICS ===

    // Signal 1: Hours studied in last 24h
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last24h = logs.filter(l => new Date(l.created_at) >= oneDayAgo);
    const hours24h = last24h.reduce((s, l) => s + (l.duration_minutes || 0), 0) / 60;

    // Signal 2: Declining confidence in recent sessions
    const recentConfidences = logs.slice(0, 10).map(l => 
      l.confidence_level === "high" ? 3 : l.confidence_level === "medium" ? 2 : 1
    );
    let confidenceDecline = 0;
    if (recentConfidences.length >= 4) {
      const firstHalf = recentConfidences.slice(0, Math.floor(recentConfidences.length / 2));
      const secondHalf = recentConfidences.slice(Math.floor(recentConfidences.length / 2));
      const avgFirst = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;
      confidenceDecline = Math.max(0, avgSecond - avgFirst); // positive means recent is worse
    }

    // Signal 3: Session duration getting shorter (fatigue pattern)
    const recentDurations = logs.slice(0, 10).map(l => l.duration_minutes || 0);
    let durationDecline = 0;
    if (recentDurations.length >= 4) {
      const firstHalf = recentDurations.slice(0, Math.floor(recentDurations.length / 2));
      const secondHalf = recentDurations.slice(Math.floor(recentDurations.length / 2));
      const avgFirst = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;
      durationDecline = avgSecond > 0 ? Math.max(0, 1 - avgFirst / avgSecond) : 0;
    }

    // Signal 4: Consecutive long sessions without breaks
    let consecutiveLong = 0;
    for (const l of logs) {
      if ((l.duration_minutes || 0) >= 45) consecutiveLong++;
      else break;
    }

    // Signal 5: Late night studying (after 11 PM)
    const lateNightSessions = last24h.filter(l => {
      const hour = new Date(l.created_at).getHours();
      return hour >= 23 || hour <= 4;
    }).length;

    // Signal 6: Focus fragmentation - short sessions indicate inability to focus
    const shortSessions = logs.filter(l => (l.duration_minutes || 0) < 10).length;
    const focusFragmentation = logs.length > 0 ? shortSessions / logs.length : 0;

    // Signal 7: Mode monotony - studying same mode repeatedly can cause fatigue
    const modeCounts: Record<string, number> = {};
    for (const l of logs.slice(0, 10)) {
      const mode = l.study_mode || "default";
      modeCounts[mode] = (modeCounts[mode] || 0) + 1;
    }
    const maxModeRatio = logs.length > 0 ? Math.max(...Object.values(modeCounts)) / Math.min(10, logs.length) : 0;

    // Signal 8: Session gap irregularity (high variance in gaps between sessions)
    let gapVariance = 0;
    if (logs.length >= 3) {
      const gaps: number[] = [];
      for (let i = 0; i < Math.min(logs.length - 1, 10); i++) {
        gaps.push((new Date(logs[i].created_at).getTime() - new Date(logs[i + 1].created_at).getTime()) / (1000 * 60 * 60));
      }
      const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
      gapVariance = Math.sqrt(gaps.reduce((s, g) => s + (g - avgGap) ** 2, 0) / gaps.length) / Math.max(avgGap, 1);
    }

    // === COMPUTE BURNOUT RISK (Enhanced) ===
    const burnoutScore = Math.min(100, Math.round(
      (hours24h > 5 ? 25 : hours24h > 3 ? 15 : hours24h > 1.5 ? 5 : 0) +
      (confidenceDecline > 0.5 ? 20 : confidenceDecline > 0.2 ? 10 : 0) +
      (durationDecline > 0.3 ? 15 : durationDecline > 0.1 ? 7 : 0) +
      (consecutiveLong >= 4 ? 20 : consecutiveLong >= 2 ? 10 : 0) +
      (lateNightSessions >= 2 ? 15 : lateNightSessions >= 1 ? 7 : 0) +
      (focusFragmentation > 0.4 ? 10 : focusFragmentation > 0.2 ? 5 : 0) +
      (maxModeRatio > 0.8 ? 5 : 0) +
      (gapVariance > 2 ? 5 : 0) +
      (features?.fatigue_indicator ? features.fatigue_indicator * 0.03 : 0)
    ));

    const riskLevel = burnoutScore >= 70 ? "high" : burnoutScore >= 40 ? "moderate" : "low";

    // Generate recommendations using AI
    let recommendations: string[] = [];
    if (burnoutScore >= 30) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        const { aiFetch } = await import("../_shared/aiFetch.ts");
        const aiResp = await aiFetch({
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: "You are a study wellness advisor. Give 2-3 brief, actionable tips to prevent burnout." },
              { role: "user", content: `Student burnout score: ${burnoutScore}/100. Hours studied today: ${hours24h.toFixed(1)}. Consecutive long sessions: ${consecutiveLong}. Late night sessions: ${lateNightSessions}. Confidence declining: ${confidenceDecline > 0.2 ? "yes" : "no"}. Give brief wellness tips.` }
            ],
            tools: [{
              type: "function",
              function: {
                name: "wellness_tips",
                description: "Return burnout prevention tips",
                parameters: {
                  type: "object",
                  properties: {
                    tips: { type: "array", items: { type: "string" } }
                  },
                  required: ["tips"],
                  additionalProperties: false,
                }
              }
            }],
            tool_choice: { type: "function", function: { name: "wellness_tips" } },
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          // Track Lovable AI usage (fire-and-forget)
          const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
          adminClient.rpc("increment_api_usage", { p_service_name: "lovable_ai" }).then(() => {}).catch(() => {});
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            const parsed = JSON.parse(toolCall.function.arguments);
            recommendations = parsed.tips || [];
          }
        }
      }
    }

    const latencyMs = Date.now() - startTime;

    // Store prediction for accuracy tracking
    const prediction = {
      burnout_score: burnoutScore,
      risk_level: riskLevel,
      signals: {
        hours_24h: Math.round(hours24h * 10) / 10,
        confidence_decline: Math.round(confidenceDecline * 100) / 100,
        duration_decline: Math.round(durationDecline * 100) / 100,
        consecutive_long: consecutiveLong,
        late_night_sessions: lateNightSessions,
        focus_fragmentation: Math.round(focusFragmentation * 100) / 100,
        mode_monotony: Math.round(maxModeRatio * 100) / 100,
        schedule_irregularity: Math.round(gapVariance * 100) / 100,
      },
    };

    await supabase.from("model_predictions").insert({
      user_id: userId,
      model_name: "burnout_detection",
      model_version: "v1",
      prediction,
      confidence: Math.min(1, logs.length / 10), // more data = higher confidence
      latency_ms: latencyMs,
    });

    return new Response(JSON.stringify({
      burnout_score: burnoutScore,
      risk_level: riskLevel,
      signals: prediction.signals,
      recommendations,
      confidence: Math.min(1, logs.length / 10),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("burnout-detection error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
