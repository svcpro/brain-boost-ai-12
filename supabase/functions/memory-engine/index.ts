import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Ebbinghaus forgetting curve: R = e^(-t/S) where R=retention, t=time, S=stability
function calculateRetention(hoursSinceReview: number, stability: number): number {
  return Math.exp(-hoursSinceReview / Math.max(stability, 1));
}

function hoursUntilThreshold(stability: number, threshold: number): number {
  // R = e^(-t/S) => t = -S * ln(threshold)
  return -stability * Math.log(threshold);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const body = await req.json();
    const { action } = body;

    if (action === "predict") {
      // Get all topics with their study logs
      const { data: topics, error: topicsErr } = await supabase
        .from("topics")
        .select("*, subjects(name)")
        .eq("user_id", userId);

      if (topicsErr) throw topicsErr;
      if (!topics || topics.length === 0) {
        return new Response(JSON.stringify({ topics: [], overall_health: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get recent study logs for context
      const { data: studyLogs } = await supabase
        .from("study_logs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);

      const now = new Date();
      const updatedTopics = [];

      for (const topic of topics) {
        // Get study logs for this topic
        const topicLogs = (studyLogs || []).filter((l: any) => l.topic_id === topic.id);
        const reviewCount = topicLogs.length;

        // Calculate stability based on review count and confidence
        // More reviews = higher stability (slower forgetting)
        const baseStability = 24; // 24 hours base
        const reviewBonus = reviewCount * 12; // Each review adds ~12 hours
        const confidenceBonus = topicLogs.reduce((sum: number, l: any) => {
          if (l.confidence_level === "high") return sum + 24;
          if (l.confidence_level === "medium") return sum + 12;
          return sum + 4;
        }, 0) / Math.max(reviewCount, 1);

        const stability = baseStability + reviewBonus + confidenceBonus;

        // Calculate hours since last revision
        const lastRevision = topic.last_revision_date
          ? new Date(topic.last_revision_date)
          : topic.created_at ? new Date(topic.created_at) : now;
        const hoursSinceReview = (now.getTime() - lastRevision.getTime()) / (1000 * 60 * 60);

        // Calculate current memory strength (retention)
        const retention = calculateRetention(hoursSinceReview, stability);
        const memoryStrength = Math.round(retention * 100 * 100) / 100; // percentage with 2 decimals

        // Calculate when memory drops below 50% (danger zone)
        const hoursUntilDrop = hoursUntilThreshold(stability, 0.5);
        const dropDate = new Date(lastRevision.getTime() + hoursUntilDrop * 60 * 60 * 1000);

        // Update topic in database
        await supabase
          .from("topics")
          .update({
            memory_strength: memoryStrength,
            next_predicted_drop_date: dropDate.toISOString(),
          })
          .eq("id", topic.id);

        // Record memory score snapshot
        await supabase.from("memory_scores").insert({
          user_id: userId,
          topic_id: topic.id,
          score: memoryStrength,
          predicted_drop_date: dropDate.toISOString(),
        });

        updatedTopics.push({
          id: topic.id,
          name: topic.name,
          subject_name: topic.subjects?.name,
          memory_strength: memoryStrength,
          next_predicted_drop_date: dropDate.toISOString(),
          hours_until_drop: Math.max(0, hoursUntilDrop - hoursSinceReview),
          stability,
          review_count: reviewCount,
          risk_level: memoryStrength < 30 ? "critical" : memoryStrength < 50 ? "high" : memoryStrength < 70 ? "medium" : "low",
        });
      }

      // Overall brain health = average memory strength
      const overallHealth = updatedTopics.length > 0
        ? Math.round(updatedTopics.reduce((s, t) => s + t.memory_strength, 0) / updatedTopics.length)
        : 0;

      // Sort by risk (lowest memory strength first)
      updatedTopics.sort((a, b) => a.memory_strength - b.memory_strength);

      return new Response(JSON.stringify({
        topics: updatedTopics,
        overall_health: overallHealth,
        at_risk: updatedTopics.filter(t => t.risk_level === "critical" || t.risk_level === "high"),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "predict_rank") {
      // ═══ UPGRADED EXAM-PATTERN RANK PREDICTION ENGINE v2.0 ═══
      const { data: topics } = await supabase
        .from("topics")
        .select("*, subjects(name)")
        .eq("user_id", userId);

      if (!topics || topics.length === 0) {
        return new Response(JSON.stringify({ predicted_rank: null, percentile: null, factors: {}, trend: "neutral" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get study logs (all + recent)
      const { data: studyLogs } = await supabase
        .from("study_logs")
        .select("duration_minutes, created_at, confidence_level, topic_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(500);

      // Get user profile for exam context
      const { data: profile } = await supabase
        .from("profiles")
        .select("exam_date, exam_type")
        .eq("id", userId)
        .maybeSingle();

      const now = new Date();
      const allLogs = studyLogs || [];
      const totalMinutes = allLogs.reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0);
      const totalHours = totalMinutes / 60;

      // ── Factor 1: Memory Strength (25%) ──
      const avgStrength = topics.reduce((s: number, t: any) => s + (t.memory_strength || 0), 0) / topics.length;

      // ── Factor 2: Topic Coverage (20%) ──
      const strongTopics = topics.filter((t: any) => t.memory_strength > 50).length;
      const coverageRatio = topics.length > 0 ? strongTopics / topics.length : 0;

      // ── Factor 3: Study Volume (10%) ──
      const volumeScore = Math.min(totalHours / 200, 1) * 100;

      // ── Factor 4: Study Consistency (15%) ──
      // How many of the last 14 days had study activity
      const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
      const recentLogs = allLogs.filter((l: any) => new Date(l.created_at) >= twoWeeksAgo);
      const activeDays = new Set(recentLogs.map((l: any) => new Date(l.created_at).toDateString()));
      const consistencyScore = Math.min(100, (activeDays.size / 14) * 100);

      // ── Factor 5: Recency Momentum (10%) ──
      // Weighted scoring: recent study activity counts more
      const threeDaysAgo = new Date(now.getTime() - 3 * 86400000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
      const last3dMins = allLogs.filter((l: any) => new Date(l.created_at) >= threeDaysAgo).reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0);
      const last7dMins = allLogs.filter((l: any) => new Date(l.created_at) >= sevenDaysAgo).reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0);
      const recencyScore = last7dMins > 0 ? Math.min(100, (last3dMins / Math.max(last7dMins, 1)) * 100 * 1.5) : 0;

      // ── Factor 6: Decay Velocity (10%) ──
      // How many topics are actively decaying vs stable
      const decayingTopics = topics.filter((t: any) => {
        if (!t.next_predicted_drop_date) return false;
        return new Date(t.next_predicted_drop_date) <= now;
      }).length;
      const decayVelocityScore = topics.length > 0 ? Math.max(0, 100 - (decayingTopics / topics.length) * 100) : 0;

      // ── Factor 7: Confidence Distribution (5%) ──
      // Higher confidence in study sessions = better preparation
      const confScores = allLogs.map((l: any) => l.confidence_level === "high" ? 100 : l.confidence_level === "medium" ? 60 : 20);
      const avgConfidence = confScores.length > 0 ? confScores.reduce((a: number, b: number) => a + b, 0) / confScores.length : 50;

      // ── Factor 8: Exam Proximity Pressure (5%) ──
      // Adjusts rank based on how close the exam is vs preparedness
      let examPressureScore = 50; // neutral if no exam
      if (profile?.exam_date) {
        const daysToExam = Math.ceil((new Date(profile.exam_date).getTime() - now.getTime()) / 86400000);
        if (daysToExam > 0) {
          // More prepared + closer exam = higher score
          const preparedness = avgStrength / 100;
          const urgency = Math.max(0, 1 - daysToExam / 90); // ramps up in last 90 days
          examPressureScore = Math.min(100, (preparedness * 0.6 + (1 - urgency * (1 - preparedness)) * 0.4) * 100);
        }
      }

      // ═══ COMPOSITE SCORE (8-factor weighted) ═══
      const compositeScore =
        (avgStrength * 0.25) +
        (coverageRatio * 100 * 0.20) +
        (volumeScore * 0.10) +
        (consistencyScore * 0.15) +
        (recencyScore * 0.10) +
        (decayVelocityScore * 0.10) +
        (avgConfidence * 0.05) +
        (examPressureScore * 0.05);

      // Map composite to rank in simulated population
      const totalPopulation = 100000;
      const percentile = Math.min(99.9, Math.max(0.1, compositeScore));
      const predictedRank = Math.max(1, Math.round(totalPopulation * (1 - percentile / 100)));

      // Get historical rank predictions for trend
      const { data: history } = await supabase
        .from("rank_predictions")
        .select("predicted_rank, recorded_at")
        .eq("user_id", userId)
        .order("recorded_at", { ascending: false })
        .limit(10);

      // ── Trend Analysis ──
      const histArr = (history || []).map((h: any) => h.predicted_rank);
      let trend: "rising" | "falling" | "stable" | "neutral" = "neutral";
      if (histArr.length >= 3) {
        const recent3Avg = histArr.slice(0, 3).reduce((a: number, b: number) => a + b, 0) / 3;
        const older3Avg = histArr.slice(Math.max(0, histArr.length - 3)).reduce((a: number, b: number) => a + b, 0) / Math.min(3, histArr.length);
        const diff = older3Avg - recent3Avg; // positive = improving (rank decreasing)
        if (diff > 500) trend = "rising";
        else if (diff < -500) trend = "falling";
        else trend = "stable";
      }

      // Save current prediction
      await supabase.from("rank_predictions").insert({
        user_id: userId,
        predicted_rank: predictedRank,
        percentile,
        factors: {
          avg_strength: Math.round(avgStrength * 100) / 100,
          coverage_ratio: Math.round(coverageRatio * 100) / 100,
          total_hours: Math.round(totalHours * 10) / 10,
          composite_score: Math.round(compositeScore * 100) / 100,
          topic_count: topics.length,
          strong_topics: strongTopics,
          consistency_score: Math.round(consistencyScore),
          recency_score: Math.round(recencyScore),
          decay_velocity_score: Math.round(decayVelocityScore),
          confidence_score: Math.round(avgConfidence),
          exam_pressure_score: Math.round(examPressureScore),
        },
      });

      // Weekly study data (last 7 days)
      const weekAgo = new Date(now.getTime() - 7 * 86400000);
      const weekLogs = allLogs.filter((l: any) => new Date(l.created_at) >= weekAgo);
      const weeklyHours: Record<string, number> = {};
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      for (const log of weekLogs) {
        const day = dayNames[new Date(log.created_at).getDay()];
        weeklyHours[day] = (weeklyHours[day] || 0) + (log.duration_minutes || 0) / 60;
      }
      const weeklyData = dayNames.map(day => ({
        day,
        hours: Math.round((weeklyHours[day] || 0) * 10) / 10,
      }));
      const weekTotalHours = Math.round(weeklyData.reduce((s, d) => s + d.hours, 0) * 10) / 10;

      // Rank change from previous
      const previousRank = histArr.length > 0 ? histArr[0] : null;
      const rankChange = previousRank ? previousRank - predictedRank : 0;

      return new Response(JSON.stringify({
        predicted_rank: predictedRank,
        percentile: Math.round(percentile * 10) / 10,
        rank_change: rankChange,
        trend,
        factors: {
          avg_strength: Math.round(avgStrength * 100) / 100,
          coverage_ratio: Math.round(coverageRatio * 100) / 100,
          total_hours: Math.round(totalHours * 10) / 10,
          composite_score: Math.round(compositeScore * 100) / 100,
          topic_count: topics.length,
          strong_topics: strongTopics,
          consistency_score: Math.round(consistencyScore),
          recency_score: Math.round(recencyScore),
          decay_velocity_score: Math.round(decayVelocityScore),
          confidence_score: Math.round(avgConfidence),
          exam_pressure_score: Math.round(examPressureScore),
        },
        history: (history || []).reverse().map((h: any) => ({
          rank: h.predicted_rank,
          date: h.recorded_at,
        })),
        weekly_data: weeklyData,
        week_total_hours: weekTotalHours,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate_recommendations") {
      // Get topics – prioritise at-risk but fall back to all topics so
      // recommendations are always generated when topics exist.
      let { data: topics } = await supabase
        .from("topics")
        .select("*, subjects(name)")
        .eq("user_id", userId)
        .lt("memory_strength", 60)
        .order("memory_strength", { ascending: true })
        .limit(10);

      // If no at-risk topics, grab all topics so AI can still give proactive tips
      if (!topics || topics.length === 0) {
        const { data: allTopics } = await supabase
          .from("topics")
          .select("*, subjects(name)")
          .eq("user_id", userId)
          .order("memory_strength", { ascending: true })
          .limit(10);
        topics = allTopics;
      }

      if (!topics || topics.length === 0) {
        return new Response(JSON.stringify({ recommendations: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const topicSummary = topics.map((t: any) =>
        `- ${t.name} (${t.subjects?.name}): ${t.memory_strength}% strength, drops below 50% at ${t.next_predicted_drop_date}`
      ).join("\n");

      const { aiFetch } = await import("../_shared/aiFetch.ts");
      const aiResponse = await aiFetch({
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are ACRY, an AI memory optimization engine for exam preparation. Generate study recommendations based on forgetting curve analysis. Be concise and actionable.`
            },
            {
              role: "user",
              content: `These topics are at risk of being forgotten:\n${topicSummary}\n\nGenerate 3-5 prioritized recommendations. Each must have a type (fix/review/practice/strategy), priority (critical/high/medium/low), a short title, and a brief description.`
            }
          ],
          tools: [{
            type: "function",
            function: {
              name: "create_recommendations",
              description: "Create study recommendations for at-risk topics",
              parameters: {
                type: "object",
                properties: {
                  recommendations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        topic_name: { type: "string" },
                        type: { type: "string", enum: ["fix", "review", "practice", "strategy"] },
                        priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
                        title: { type: "string" },
                        description: { type: "string" }
                      },
                      required: ["type", "priority", "title", "description"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["recommendations"],
                additionalProperties: false
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "create_recommendations" } }
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited, try again later" }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI gateway error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      let recommendations: any[] = [];

      if (toolCall?.function?.arguments) {
        const parsed = JSON.parse(toolCall.function.arguments);
        recommendations = parsed.recommendations || [];
      }

      // Match topics and save to DB
      for (const rec of recommendations) {
        const matchedTopic = topics.find((t: any) =>
          rec.topic_name && t.name.toLowerCase().includes(rec.topic_name.toLowerCase())
        );
        await supabase.from("ai_recommendations").insert({
          user_id: userId,
          topic_id: matchedTopic?.id || null,
          type: rec.type,
          priority: rec.priority,
          title: rec.title,
          description: rec.description,
        });
      }

      return new Response(JSON.stringify({ recommendations }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate_plan") {
      const isQuick = body.quick === true;
      // Get user profile for exam date & daily goal
      const { data: profile } = await supabase
        .from("profiles")
        .select("exam_date, exam_type, daily_study_goal_minutes")
        .eq("id", userId)
        .maybeSingle();

      // Get all topics with memory data
      const { data: topics } = await supabase
        .from("topics")
        .select("*, subjects(name)")
        .eq("user_id", userId);

      // Get recent study logs for pattern analysis
      const { data: recentLogs } = await supabase
        .from("study_logs")
        .select("duration_minutes, created_at, study_mode, confidence_level")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      // ── Reinforcement Learning: analyze past plan completion patterns ──
      const { data: pastSessions } = await supabase
        .from("plan_sessions")
        .select("topic, subject, duration_minutes, mode, day_name, completed, completed_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(200);

      // Compute RL signals from historical sessions
      let rlFeedback = "";
      let rlSignals: Record<string, any> = {};
      if (pastSessions && pastSessions.length > 0) {
        const total = pastSessions.length;
        const completed = pastSessions.filter((s: any) => s.completed).length;
        const skipped = total - completed;
        const completionRate = Math.round((completed / total) * 100);

        // Completion rate by mode
        const modeStats: Record<string, { done: number; total: number }> = {};
        for (const s of pastSessions) {
          if (!modeStats[s.mode]) modeStats[s.mode] = { done: 0, total: 0 };
          modeStats[s.mode].total++;
          if (s.completed) modeStats[s.mode].done++;
        }

        // Completion rate by day of week
        const dayStats: Record<string, { done: number; total: number }> = {};
        for (const s of pastSessions) {
          if (!dayStats[s.day_name]) dayStats[s.day_name] = { done: 0, total: 0 };
          dayStats[s.day_name].total++;
          if (s.completed) dayStats[s.day_name].done++;
        }

        // Completion rate by duration bucket
        const durationBuckets: Record<string, { done: number; total: number }> = {
          "≤15min": { done: 0, total: 0 },
          "16-30min": { done: 0, total: 0 },
          "31-45min": { done: 0, total: 0 },
          "46-60min": { done: 0, total: 0 },
          ">60min": { done: 0, total: 0 },
        };
        for (const s of pastSessions) {
          const d = s.duration_minutes;
          const bucket = d <= 15 ? "≤15min" : d <= 30 ? "16-30min" : d <= 45 ? "31-45min" : d <= 60 ? "46-60min" : ">60min";
          durationBuckets[bucket].total++;
          if (s.completed) durationBuckets[bucket].done++;
        }

        // Topics most often skipped
        const topicSkips: Record<string, number> = {};
        const topicCompletions: Record<string, number> = {};
        for (const s of pastSessions) {
          if (s.completed) {
            topicCompletions[s.topic] = (topicCompletions[s.topic] || 0) + 1;
          } else {
            topicSkips[s.topic] = (topicSkips[s.topic] || 0) + 1;
          }
        }
        const mostSkipped = Object.entries(topicSkips)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([t, n]) => `${t} (skipped ${n}x)`);

        const mostCompleted = Object.entries(topicCompletions)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([t, n]) => `${t} (completed ${n}x)`);

        rlFeedback = `
REINFORCEMENT LEARNING FEEDBACK (from ${total} past plan sessions):
- Overall completion rate: ${completionRate}% (${completed} completed, ${skipped} skipped)
- Completion by study mode: ${Object.entries(modeStats).map(([m, s]) => `${m}: ${Math.round((s.done / s.total) * 100)}%`).join(", ")}
- Completion by day: ${Object.entries(dayStats).map(([d, s]) => `${d}: ${Math.round((s.done / s.total) * 100)}%`).join(", ")}
- Completion by duration: ${Object.entries(durationBuckets).filter(([, s]) => s.total > 0).map(([b, s]) => `${b}: ${Math.round((s.done / s.total) * 100)}%`).join(", ")}
- Most skipped topics: ${mostSkipped.join(", ") || "none"}
- Most completed topics: ${mostCompleted.join(", ") || "none"}

USE THIS DATA TO OPTIMIZE:
- Schedule MORE of the study modes with higher completion rates
- Prefer session durations the student actually completes
- Reduce load on days with low completion rates
- For frequently skipped topics, try shorter/lighter sessions instead
- For frequently completed topics, you can safely assign longer/deeper sessions`;

        // Build structured RL signals for storage
        const modeRates: Record<string, number> = {};
        for (const [m, s] of Object.entries(modeStats)) {
          modeRates[m] = Math.round((s.done / s.total) * 100);
        }
        const dayRates: Record<string, number> = {};
        for (const [d, s] of Object.entries(dayStats)) {
          dayRates[d] = Math.round((s.done / s.total) * 100);
        }
        const durationRates: Record<string, number> = {};
        for (const [b, s] of Object.entries(durationBuckets)) {
          if (s.total > 0) durationRates[b] = Math.round((s.done / s.total) * 100);
        }

        rlSignals = {
          sample_size: total,
          overall_completion_rate: completionRate,
          by_mode: modeRates,
          by_day: dayRates,
          by_duration: durationRates,
          most_skipped: Object.entries(topicSkips).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, n]) => ({ topic: t, count: n })),
          most_completed: Object.entries(topicCompletions).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, n]) => ({ topic: t, count: n })),
        };
      }
      // ── End RL feedback ──

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const examDate = profile?.exam_date || null;
      const dailyGoal = profile?.daily_study_goal_minutes || 60;
      const examType = profile?.exam_type || "General";

      const topicSummary = (topics || []).map((t: any) =>
        `- ${t.name} (${t.subjects?.name}): ${t.memory_strength}% strength, predicted drop: ${t.next_predicted_drop_date || "unknown"}`
      ).join("\n");

      // Analyze study patterns
      const now = new Date();
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayTotals: Record<string, number> = {};
      for (const log of (recentLogs || [])) {
        const day = dayNames[new Date(log.created_at).getDay()];
        dayTotals[day] = (dayTotals[day] || 0) + (log.duration_minutes || 0);
      }

      const daysUntilExam = examDate
        ? Math.ceil((new Date(examDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const prompt = isQuick
        ? `Create a QUICK 15-minute study plan for TODAY ONLY for a student preparing for ${examType}.

Context:
- Today: ${now.toISOString().split("T")[0]} (${dayNames[now.getDay()]})
- Total budget: 15 minutes MAXIMUM

Topics by forgetting curve priority (pick the 2-3 most critical):
${topicSummary || "No topics tracked yet — suggest general light review."}
${rlFeedback}

STRICT RULES for this quick plan:
- Generate ONLY 1 day (today)
- Maximum 2-3 sessions, each 5-8 minutes
- Total must not exceed 15 minutes
- Use only "light-review" or "review" modes
- Focus on the most at-risk topics only
- Keep it simple and achievable for a low-energy day`
        : `Create a personalized weekly study plan for a student preparing for ${examType}.

Context:
- Daily study goal: ${dailyGoal} minutes
- Exam date: ${examDate ? `${examDate} (${daysUntilExam} days away)` : "Not set"}
- Total topics tracked: ${(topics || []).length}
- Today: ${now.toISOString().split("T")[0]} (${dayNames[now.getDay()]})

Topics by forgetting curve priority:
${topicSummary || "No topics tracked yet — suggest general study structure."}

Recent study pattern (minutes by day):
${dayNames.map(d => `${d}: ${Math.round(dayTotals[d] || 0)} min`).join("\n")}
${rlFeedback}

Generate a 7-day study plan (${dayNames[now.getDay()]} through ${dayNames[(now.getDay() + 6) % 7]}) that:
1. Prioritizes topics closest to memory drop threshold
2. Spaces reviews using spaced repetition principles
3. Respects the daily study goal
4. Includes rest/light days if needed
5. Front-loads critical topics if exam is near
6. ADAPTS based on the reinforcement learning feedback above — favor modes, durations, and days that the student historically completes`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: "You are ACRY, an AI memory optimization engine. Create actionable, time-blocked study plans based on forgetting curve data. Be specific with topic names and durations."
            },
            { role: "user", content: prompt }
          ],
          tools: [{
            type: "function",
            function: {
              name: "create_study_plan",
              description: "Create a 7-day study plan with daily sessions",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string", description: "2-3 sentence overview of the plan strategy" },
                  days: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        day_name: { type: "string" },
                        date: { type: "string" },
                        focus: { type: "string", description: "Main focus for the day" },
                        total_minutes: { type: "number" },
                        sessions: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              topic: { type: "string" },
                              subject: { type: "string" },
                              duration_minutes: { type: "number" },
                              mode: { type: "string", enum: ["review", "deep-study", "practice", "light-review"] },
                              reason: { type: "string", description: "Why this session is scheduled now" }
                            },
                            required: ["topic", "subject", "duration_minutes", "mode", "reason"],
                            additionalProperties: false
                          }
                        }
                      },
                      required: ["day_name", "date", "focus", "total_minutes", "sessions"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["summary", "days"],
                additionalProperties: false
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "create_study_plan" } }
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited, try again later" }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI gateway error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      let plan = { summary: "", days: [] };

      if (toolCall?.function?.arguments) {
        plan = JSON.parse(toolCall.function.arguments);
      }

      return new Response(JSON.stringify({ plan, rl_signals: rlSignals }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "exam_simulate") {
      const topicList = body.topics || "";
      const qCount = body.questionCount || 5;
      const difficulty = body.difficulty || "medium";
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const difficultyPrompts: Record<string, string> = {
        easy: "Generate EASY questions: straightforward recall and basic understanding. Use simple language, avoid tricky options, and keep explanations brief.",
        medium: "Generate MEDIUM difficulty questions: test understanding and application of concepts. Include some analytical thinking but keep options reasonable.",
        hard: "Generate HARD questions: test deep understanding, application, and analysis. Include tricky distractors, multi-step reasoning, and edge cases. Questions should challenge even well-prepared students.",
      };

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: `You are an exam question generator. ${difficultyPrompts[difficulty] || difficultyPrompts.medium} Generate multiple-choice questions as a JSON array. Each object must have: question, options (array of 4 strings), correct (0-3 index), explanation. CRITICAL: Do NOT generate questions that reference images, diagrams, figures, graphs, or any visual content. All questions must be fully self-contained as text only. Output ONLY the JSON array, no markdown.` },
            { role: "user", content: `Generate ${qCount} ${difficulty}-difficulty exam questions based on these topics: ${topicList}. Remember: text-only questions, no image/diagram references.` }
          ],
        }),
      });
      if (!aiResponse.ok) throw new Error(`AI error: ${aiResponse.status}`);
      const aiData = await aiResponse.json();
      return new Response(JSON.stringify(aiData), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "weekly_report") {
      
      const stats = body.stats || {};
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: "You are ACRY, an AI study coach. Generate a concise weekly study report with sections: Summary, Strengths, Areas to Improve, and Next Week's Focus. Use markdown headers and bullet points. Be encouraging but honest." },
            { role: "user", content: `Weekly stats: ${stats.totalMinutes || 0} minutes studied, ${stats.totalSessions || 0} sessions, ${stats.avgStrength || 0}% avg memory strength, ${stats.topicCount || 0} topics across ${stats.subjectCount || 0} subjects. Weak topics: ${(stats.weakTopics || []).join(", ") || "none"}` }
          ],
        }),
      });
      if (!aiResponse.ok) throw new Error(`AI error: ${aiResponse.status}`);
      const aiData = await aiResponse.json();
      return new Response(JSON.stringify(aiData), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("memory-engine error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
