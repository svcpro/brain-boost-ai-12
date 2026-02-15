import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Use service role to aggregate across all users
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date().toISOString().split("T")[0];
    const patterns: Array<{ pattern_date: string; pattern_type: string; pattern_key: string; sample_size: number; metrics: Record<string, any> }> = [];

    // 1. TOPIC DIFFICULTY PATTERNS — which topics have lowest avg memory strength
    const { data: topicStats } = await supabase
      .from("topics")
      .select("name, memory_strength")
      .is("deleted_at", null);

    if (topicStats && topicStats.length > 0) {
      const topicMap = new Map<string, number[]>();
      for (const t of topicStats) {
        const key = t.name.toLowerCase().trim();
        if (!topicMap.has(key)) topicMap.set(key, []);
        topicMap.get(key)!.push(Number(t.memory_strength));
      }

      // Only include topics with 3+ users studying them
      for (const [name, strengths] of topicMap) {
        if (strengths.length < 3) continue;
        const avg = strengths.reduce((a, b) => a + b, 0) / strengths.length;
        const min = Math.min(...strengths);
        const max = Math.max(...strengths);
        const below50 = strengths.filter(s => s < 50).length;
        patterns.push({
          pattern_date: today,
          pattern_type: "topic_difficulty",
          pattern_key: name,
          sample_size: strengths.length,
          metrics: {
            avg_strength: Math.round(avg * 10) / 10,
            min_strength: min,
            max_strength: max,
            pct_struggling: Math.round((below50 / strengths.length) * 100),
          },
        });
      }
    }

    // 2. STUDY TIMING EFFECTIVENESS — which hours produce best results
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: recentLogs } = await supabase
      .from("study_logs")
      .select("created_at, duration_minutes, confidence_level")
      .gte("created_at", sevenDaysAgo);

    if (recentLogs && recentLogs.length > 0) {
      const hourMap = new Map<number, { count: number; totalMin: number; highConf: number }>();
      for (const log of recentLogs) {
        const hour = new Date(log.created_at).getHours();
        if (!hourMap.has(hour)) hourMap.set(hour, { count: 0, totalMin: 0, highConf: 0 });
        const h = hourMap.get(hour)!;
        h.count++;
        h.totalMin += log.duration_minutes || 0;
        if (log.confidence_level === "high" || log.confidence_level === "confident") h.highConf++;
      }

      for (const [hour, stats] of hourMap) {
        if (stats.count < 3) continue;
        patterns.push({
          pattern_date: today,
          pattern_type: "study_timing",
          pattern_key: `hour_${hour}`,
          sample_size: stats.count,
          metrics: {
            avg_duration_min: Math.round(stats.totalMin / stats.count),
            high_confidence_pct: Math.round((stats.highConf / stats.count) * 100),
            total_sessions: stats.count,
          },
        });
      }
    }

    // 3. MEMORY DECAY PATTERNS — average decay rates across users
    const { data: features } = await supabase
      .from("user_features")
      .select("memory_decay_slope, knowledge_stability, learning_velocity, burnout_risk_score");

    if (features && features.length >= 3) {
      const slopes = features.map(f => Number(f.memory_decay_slope)).filter(v => !isNaN(v));
      const stabilities = features.map(f => Number(f.knowledge_stability)).filter(v => !isNaN(v));
      const velocities = features.map(f => Number(f.learning_velocity)).filter(v => !isNaN(v));
      const burnouts = features.map(f => Number(f.burnout_risk_score)).filter(v => !isNaN(v));

      const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

      patterns.push({
        pattern_date: today,
        pattern_type: "decay_patterns",
        pattern_key: "global_avg",
        sample_size: features.length,
        metrics: {
          avg_decay_slope: Math.round(avg(slopes) * 1000) / 1000,
          avg_knowledge_stability: Math.round(avg(stabilities) * 10) / 10,
          avg_learning_velocity: Math.round(avg(velocities) * 100) / 100,
          avg_burnout_risk: Math.round(avg(burnouts) * 10) / 10,
          high_burnout_pct: Math.round((burnouts.filter(b => b > 60).length / burnouts.length) * 100),
        },
      });
    }

    // 4. REVISION EFFECTIVENESS — how revision frequency correlates with retention
    const { data: topicsWithRevision } = await supabase
      .from("topics")
      .select("memory_strength, last_revision_date, created_at")
      .is("deleted_at", null)
      .not("last_revision_date", "is", null);

    if (topicsWithRevision && topicsWithRevision.length >= 5) {
      const now = Date.now();
      const buckets: Record<string, { strengths: number[]; count: number }> = {
        "within_1d": { strengths: [], count: 0 },
        "within_3d": { strengths: [], count: 0 },
        "within_7d": { strengths: [], count: 0 },
        "within_14d": { strengths: [], count: 0 },
        "over_14d": { strengths: [], count: 0 },
      };

      for (const t of topicsWithRevision) {
        const daysSince = (now - new Date(t.last_revision_date!).getTime()) / 86400000;
        const bucket = daysSince <= 1 ? "within_1d" : daysSince <= 3 ? "within_3d" : daysSince <= 7 ? "within_7d" : daysSince <= 14 ? "within_14d" : "over_14d";
        buckets[bucket].strengths.push(Number(t.memory_strength));
        buckets[bucket].count++;
      }

      for (const [bucket, data] of Object.entries(buckets)) {
        if (data.count < 3) continue;
        const avg = data.strengths.reduce((a, b) => a + b, 0) / data.strengths.length;
        patterns.push({
          pattern_date: today,
          pattern_type: "revision_effectiveness",
          pattern_key: bucket,
          sample_size: data.count,
          metrics: {
            avg_retention: Math.round(avg * 10) / 10,
            topic_count: data.count,
          },
        });
      }
    }

    // 5. EXAM PERFORMANCE TRENDS
    const { data: exams } = await supabase
      .from("exam_results")
      .select("score, total_questions, difficulty, created_at")
      .gte("created_at", sevenDaysAgo);

    if (exams && exams.length >= 3) {
      const diffMap = new Map<string, { scores: number[]; count: number }>();
      for (const e of exams) {
        if (!diffMap.has(e.difficulty)) diffMap.set(e.difficulty, { scores: [], count: 0 });
        const d = diffMap.get(e.difficulty)!;
        d.scores.push((e.score / e.total_questions) * 100);
        d.count++;
      }

      for (const [diff, data] of diffMap) {
        if (data.count < 2) continue;
        const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
        patterns.push({
          pattern_date: today,
          pattern_type: "exam_trends",
          pattern_key: diff,
          sample_size: data.count,
          metrics: {
            avg_score_pct: Math.round(avg * 10) / 10,
            exam_count: data.count,
          },
        });
      }
    }

    // Upsert all patterns
    if (patterns.length > 0) {
      const { error } = await supabase
        .from("global_learning_patterns")
        .upsert(patterns, { onConflict: "pattern_date,pattern_type,pattern_key" });

      if (error) {
        console.error("Upsert error:", error);
        throw new Error("Failed to store patterns");
      }
    }

    console.log(`Collective intelligence: stored ${patterns.length} patterns for ${today}`);

    return new Response(JSON.stringify({
      success: true,
      patterns_stored: patterns.length,
      date: today,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("collective-intelligence error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
