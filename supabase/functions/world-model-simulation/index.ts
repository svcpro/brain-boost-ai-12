import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { scenarios } = await req.json();
    // scenarios: Array<{ name: string; daily_hours: number; focus_topics: string; intensity: string; revision_frequency: string }>

    if (!scenarios || !Array.isArray(scenarios) || scenarios.length < 1) {
      throw new Error("Provide at least 1 scenario");
    }

    const userId = user.id;

    // Use service role client for global patterns (cross-user data)
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Gather user context + global intelligence in parallel
    const [topicsRes, profileRes, logsRes, rankRes, examsRes, featuresRes, globalPatternsRes] = await Promise.all([
      supabase.from("topics").select("name, memory_strength, next_predicted_drop_date, subject_id, last_revision_date")
        .eq("user_id", userId).is("deleted_at", null).order("memory_strength", { ascending: true }).limit(30),
      supabase.from("profiles").select("daily_study_goal_minutes, exam_date, exam_type, display_name")
        .eq("id", userId).maybeSingle(),
      supabase.from("study_logs").select("duration_minutes, created_at, confidence_level, study_mode")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      supabase.from("rank_predictions").select("predicted_rank, percentile, recorded_at")
        .eq("user_id", userId).order("recorded_at", { ascending: false }).limit(5),
      supabase.from("exam_results").select("score, total_questions, difficulty, created_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
      supabase.from("user_features").select("*").eq("user_id", userId).maybeSingle(),
      serviceSupabase.from("global_learning_patterns")
        .select("pattern_type, pattern_key, sample_size, metrics")
        .order("pattern_date", { ascending: false })
        .limit(50),
    ]);

    const topics = topicsRes.data || [];
    const profile = profileRes.data;
    const logs = logsRes.data || [];
    const ranks = rankRes.data || [];
    const exams = examsRes.data || [];
    const features = featuresRes.data;
    const globalPatterns = globalPatternsRes.data || [];

    const now = new Date();
    const daysToExam = profile?.exam_date
      ? Math.ceil((new Date(profile.exam_date).getTime() - now.getTime()) / 86400000)
      : null;

    const totalStudyHours14d = logs
      .filter(l => new Date(l.created_at) >= new Date(now.getTime() - 14 * 86400000))
      .reduce((s, l) => s + (l.duration_minutes || 0), 0) / 60;

    const criticalTopics = topics.filter(t => Number(t.memory_strength) < 40);
    const weakTopics = topics.filter(t => Number(t.memory_strength) >= 40 && Number(t.memory_strength) < 60);

    // Build global intelligence section
    const buildGlobalSection = () => {
      if (globalPatterns.length === 0) return "No global intelligence data available yet.";

      const sections: string[] = [];

      // Topic difficulty
      const topicDiffs = globalPatterns.filter(p => p.pattern_type === "topic_difficulty");
      if (topicDiffs.length > 0) {
        const hardest = topicDiffs
          .sort((a, b) => (a.metrics as any).avg_strength - (b.metrics as any).avg_strength)
          .slice(0, 5);
        sections.push(`### Globally Hardest Topics (across all learners)\n${hardest.map(t =>
          `- "${t.pattern_key}": avg ${(t.metrics as any).avg_strength}% retention, ${(t.metrics as any).pct_struggling}% of ${t.sample_size} learners struggling`
        ).join("\n")}`);
      }

      // Study timing
      const timings = globalPatterns.filter(p => p.pattern_type === "study_timing");
      if (timings.length > 0) {
        const best = timings
          .sort((a, b) => (b.metrics as any).high_confidence_pct - (a.metrics as any).high_confidence_pct)
          .slice(0, 3);
        sections.push(`### Best Global Study Hours\n${best.map(t => {
          const hour = parseInt(t.pattern_key.replace("hour_", ""));
          const period = hour >= 12 ? "PM" : "AM";
          const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
          return `- ${display}:00 ${period}: ${(t.metrics as any).high_confidence_pct}% high-confidence sessions (n=${t.sample_size})`;
        }).join("\n")}`);
      }

      // Decay patterns
      const decay = globalPatterns.find(p => p.pattern_type === "decay_patterns");
      if (decay) {
        const m = decay.metrics as any;
        sections.push(`### Global Cognitive Benchmarks (n=${decay.sample_size})\n- Avg knowledge stability: ${m.avg_knowledge_stability}%\n- Avg learning velocity: ${m.avg_learning_velocity}\n- Avg burnout risk: ${m.avg_burnout_risk}% (${m.high_burnout_pct}% of learners at high risk)`);
      }

      // Revision effectiveness
      const revisions = globalPatterns.filter(p => p.pattern_type === "revision_effectiveness");
      if (revisions.length > 0) {
        sections.push(`### Global Revision Effectiveness\n${revisions.map(r =>
          `- Revised ${r.pattern_key.replace("within_", "within ").replace("over_", "over ").replace("d", " days")}: avg ${(r.metrics as any).avg_retention}% retention (n=${(r.metrics as any).topic_count})`
        ).join("\n")}`);
      }

      // Exam trends
      const examTrends = globalPatterns.filter(p => p.pattern_type === "exam_trends");
      if (examTrends.length > 0) {
        sections.push(`### Global Exam Performance\n${examTrends.map(e =>
          `- ${e.pattern_key} difficulty: avg ${(e.metrics as any).avg_score_pct}% score (n=${(e.metrics as any).exam_count})`
        ).join("\n")}`);
      }

      return sections.join("\n\n");
    };

    const contextStr = `
## STUDENT STATE
- Exam: ${profile?.exam_type || "Unknown"} ${daysToExam !== null ? `in ${daysToExam} days` : "(no date set)"}
- Daily goal: ${profile?.daily_study_goal_minutes || 60} min
- Study volume (14d): ${Math.round(totalStudyHours14d * 10) / 10} hours across ${logs.length} sessions
- Current rank: ${ranks[0]?.predicted_rank || "N/A"} (${ranks[0]?.percentile || "N/A"}th percentile)

## COGNITIVE METRICS
${features ? `- Consistency: ${features.study_consistency_score}% | Engagement: ${features.engagement_score}%
- Burnout risk: ${features.burnout_risk_score}% | Knowledge stability: ${features.knowledge_stability}%
- Learning velocity: ${features.learning_velocity} | Memory decay slope: ${features.memory_decay_slope}` : "No ML features yet."}

## MEMORY STATE (${topics.length} topics)
- Critical (<40%): ${criticalTopics.length > 0 ? criticalTopics.map(t => `${t.name} (${Math.round(Number(t.memory_strength))}%)`).join(", ") : "None"}
- Weak (40-60%): ${weakTopics.length > 0 ? weakTopics.slice(0, 5).map(t => `${t.name} (${Math.round(Number(t.memory_strength))}%)`).join(", ") : "None"}
- Average strength: ${topics.length > 0 ? Math.round(topics.reduce((s, t) => s + Number(t.memory_strength), 0) / topics.length) : 0}%

## EXAM HISTORY
${exams.length > 0 ? exams.slice(0, 3).map(e => `- ${e.score}/${e.total_questions} (${e.difficulty}) on ${new Date(e.created_at).toLocaleDateString()}`).join("\n") : "No exams yet."}

## GLOBAL COLLECTIVE INTELLIGENCE (anonymized data from all learners)
${buildGlobalSection()}

## SCENARIOS TO SIMULATE
${scenarios.map((s: any, i: number) => `
### Scenario ${i + 1}: "${s.name}"
- Daily study: ${s.daily_hours} hours
- Focus: ${s.focus_topics}
- Intensity: ${s.intensity}
- Revision frequency: ${s.revision_frequency}
`).join("\n")}
`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { aiFetch } = await import("../_shared/aiFetch.ts");
    const aiResp = await aiFetch({
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are ACRY's World Model Simulation Engine. Given a student's current cognitive state, collective intelligence from all learners, and study scenarios, you simulate future learning outcomes using principles of the Ebbinghaus forgetting curve, spaced repetition science, and competitive exam preparation modeling.

IMPORTANT: Use the GLOBAL COLLECTIVE INTELLIGENCE data to calibrate your predictions. Compare this student's metrics against global averages to contextualize their performance. Use global revision effectiveness data to model retention curves more accurately. Factor in global exam performance benchmarks when predicting score ranges. If global data shows certain topics are universally difficult, weight that into your risk assessments.

Your simulations must be grounded in the actual data provided. Be realistic — don't give overly optimistic projections. Consider burnout risk, diminishing returns from over-study, and the student's historical patterns.

For each scenario, predict:
1. Predicted rank range (min-max) based on current trajectory modified by the scenario, calibrated against global benchmarks
2. Predicted average memory retention after 30 days, using global revision effectiveness patterns
3. Predicted exam score range (percentage), informed by global exam trends
4. Risk assessment (burnout, knowledge gaps, time constraints), compared to global burnout rates
5. A brief strategy recommendation that leverages collective intelligence insights (e.g. optimal study times, revision frequency)

Always select a recommended scenario and explain why, referencing global patterns where relevant.`
          },
          { role: "user", content: contextStr }
        ],
        tools: [{
          type: "function",
          function: {
            name: "simulation_results",
            description: "Return world model simulation results for each scenario",
            parameters: {
              type: "object",
              properties: {
                scenarios: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      predicted_rank_min: { type: "number", description: "Lower bound of predicted rank" },
                      predicted_rank_max: { type: "number", description: "Upper bound of predicted rank" },
                      predicted_retention: { type: "number", description: "Predicted avg memory retention % after 30 days" },
                      predicted_score_min: { type: "number", description: "Predicted exam score % lower bound" },
                      predicted_score_max: { type: "number", description: "Predicted exam score % upper bound" },
                      burnout_risk: { type: "string", enum: ["low", "moderate", "high", "critical"] },
                      knowledge_gap_risk: { type: "string", enum: ["low", "moderate", "high"] },
                      confidence: { type: "number", description: "Simulation confidence 0-1" },
                      strategy_note: { type: "string", description: "Brief actionable strategy recommendation for this scenario" },
                    },
                    required: ["name", "predicted_rank_min", "predicted_rank_max", "predicted_retention", "predicted_score_min", "predicted_score_max", "burnout_risk", "knowledge_gap_risk", "confidence", "strategy_note"],
                    additionalProperties: false
                  }
                },
                recommended_scenario: { type: "string", description: "Name of the recommended scenario" },
                recommendation_reason: { type: "string", description: "Why this scenario is recommended (2-3 sentences)" },
                overall_outlook: { type: "string", description: "One sentence overall prediction" },
              },
              required: ["scenarios", "recommended_scenario", "recommendation_reason", "overall_outlook"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "simulation_results" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limited — please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const errorText = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, errorText);
      throw new Error("AI simulation failed");
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    let result: any = { scenarios: [], recommended_scenario: "", recommendation_reason: "", overall_outlook: "" };
    if (toolCall?.function?.arguments) {
      result = JSON.parse(toolCall.function.arguments);
    }

    // Compute global calibration metadata
    const patternTypes = [...new Set(globalPatterns.map(p => p.pattern_type))];
    const totalLearners = Math.max(
      ...globalPatterns.map(p => p.sample_size || 0),
      0
    );
    result.global_calibration = {
      total_learners: totalLearners,
      patterns_used: globalPatterns.length,
      pattern_types: patternTypes,
    };

    // Store simulation in learning_simulations table
    const bestScenario = result.scenarios.find((s: any) => s.name === result.recommended_scenario) || result.scenarios[0];
    
    await supabase.from("learning_simulations").insert({
      user_id: userId,
      scenario_type: "world_model",
      input_params: { scenarios },
      simulation_result: result,
      predicted_retention: bestScenario?.predicted_retention || null,
      predicted_rank_change: bestScenario ? Math.round((bestScenario.predicted_rank_min + bestScenario.predicted_rank_max) / 2) : null,
      confidence: bestScenario?.confidence || null,
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("world-model-simulation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
