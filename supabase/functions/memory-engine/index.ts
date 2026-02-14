import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { action } = await req.json();

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
      // Get all topics with memory strength
      const { data: topics } = await supabase
        .from("topics")
        .select("*, subjects(name)")
        .eq("user_id", userId);

      if (!topics || topics.length === 0) {
        return new Response(JSON.stringify({ predicted_rank: null, percentile: null, factors: {} }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get study logs for volume metrics
      const { data: studyLogs } = await supabase
        .from("study_logs")
        .select("duration_minutes, created_at")
        .eq("user_id", userId);

      const totalMinutes = (studyLogs || []).reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0);
      const totalHours = totalMinutes / 60;

      // Calculate coverage: % of topics with memory_strength > 50
      const strongTopics = topics.filter((t: any) => t.memory_strength > 50).length;
      const coverageRatio = topics.length > 0 ? strongTopics / topics.length : 0;

      // Average memory strength
      const avgStrength = topics.reduce((s: number, t: any) => s + (t.memory_strength || 0), 0) / topics.length;

      // Composite score (0-100): weighted combination
      const compositeScore = (avgStrength * 0.4) + (coverageRatio * 100 * 0.35) + (Math.min(totalHours / 200, 1) * 100 * 0.25);

      // Map composite score to rank (simulated population of 100,000)
      // Higher score = lower (better) rank
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
        },
      });

      // Weekly study data (last 7 days)
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const weekLogs = (studyLogs || []).filter((l: any) => new Date(l.created_at) >= weekAgo);
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
      const previousRank = history && history.length > 1 ? history[1].predicted_rank : null;
      const rankChange = previousRank ? previousRank - predictedRank : 0;

      return new Response(JSON.stringify({
        predicted_rank: predictedRank,
        percentile: Math.round(percentile * 10) / 10,
        rank_change: rankChange,
        factors: {
          avg_strength: Math.round(avgStrength * 100) / 100,
          coverage_ratio: Math.round(coverageRatio * 100) / 100,
          total_hours: Math.round(totalHours * 10) / 10,
          composite_score: Math.round(compositeScore * 100) / 100,
          topic_count: topics.length,
          strong_topics: strongTopics,
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
      // Get topics at risk
      const { data: topics } = await supabase
        .from("topics")
        .select("*, subjects(name)")
        .eq("user_id", userId)
        .lt("memory_strength", 60)
        .order("memory_strength", { ascending: true })
        .limit(10);

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
