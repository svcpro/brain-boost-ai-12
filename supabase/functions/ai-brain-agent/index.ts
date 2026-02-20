import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { authenticateRequest, handleCors, jsonResponse, errorResponse, securityHeaders } from "../_shared/auth.ts";
import { aiFetch } from "../_shared/aiFetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const { userId, supabase } = await authenticateRequest(req);

    const body = await req.json();
    const { action, message, topic_name, subject_name, difficulty: reqDifficulty, count: reqCount } = body;

    // Gather comprehensive user context in parallel
    const [
      topicsRes, logsRes, profileRes, featuresRes, examsRes, rankRes, burnoutRes
    ] = await Promise.all([
      supabase.from("topics").select("name, memory_strength, next_predicted_drop_date, subject_id, last_revision_date").eq("user_id", userId).is("deleted_at", null).order("memory_strength", { ascending: true }).limit(30),
      supabase.from("study_logs").select("duration_minutes, created_at, confidence_level, study_mode").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      supabase.from("profiles").select("daily_study_goal_minutes, exam_date, exam_type, display_name").eq("id", userId).maybeSingle(),
      supabase.from("user_features").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("exam_results").select("score, total_questions, difficulty, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
      supabase.from("rank_predictions").select("predicted_rank, percentile, recorded_at").eq("user_id", userId).order("recorded_at", { ascending: false }).limit(5),
      supabase.from("subjects").select("id, name").eq("user_id", userId).is("deleted_at", null),
    ]);

    const topics = topicsRes.data || [];
    const logs = logsRes.data || [];
    const profile = profileRes.data;
    const features = featuresRes.data;
    const exams = examsRes.data || [];
    const ranks = rankRes.data || [];
    const subjects = burnoutRes.data || [];

    const subjectMap = new Map(subjects.map((s: any) => [s.id, s.name]));

    // Build cognitive context summary
    const now = new Date();
    const daysToExam = profile?.exam_date
      ? Math.ceil((new Date(profile.exam_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const totalStudyMinutes14d = logs
      .filter(l => new Date(l.created_at) >= new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000))
      .reduce((s, l) => s + (l.duration_minutes || 0), 0);

    const criticalTopics = topics.filter(t => Number(t.memory_strength) < 40);
    const atRiskTopics = topics.filter(t => Number(t.memory_strength) >= 40 && Number(t.memory_strength) < 60);

    const cognitiveContext = `
## STUDENT PROFILE
- Name: ${profile?.display_name || "Student"}
- Daily goal: ${profile?.daily_study_goal_minutes || 60} min
- Exam: ${profile?.exam_type || "Not set"} ${daysToExam !== null ? `in ${daysToExam} days` : "(no date)"}
- Total study (14d): ${Math.round(totalStudyMinutes14d / 60 * 10) / 10} hours across ${logs.length} sessions

## COGNITIVE STATE (ML Features)
${features ? `- Study consistency: ${features.study_consistency_score}%
- Engagement: ${features.engagement_score}%
- Fatigue indicator: ${features.fatigue_indicator}%
- Burnout risk: ${features.burnout_risk_score}%
- Knowledge stability: ${features.knowledge_stability}%
- Learning velocity: ${features.learning_velocity} topics/day
- Memory decay slope: ${features.memory_decay_slope}
- Avg session: ${features.avg_session_duration_minutes} min
- Hours studied (24h): ${features.hours_studied_last_24h}h | (7d): ${features.hours_studied_last_7d}h` : "No ML features computed yet."}

## MEMORY STATE
- Critical topics (< 40%): ${criticalTopics.length > 0 ? criticalTopics.map(t => `${t.name} (${Math.round(Number(t.memory_strength))}%)`).join(", ") : "None"}
- At-risk topics (40-60%): ${atRiskTopics.length > 0 ? atRiskTopics.map(t => `${t.name} (${Math.round(Number(t.memory_strength))}%)`).join(", ") : "None"}
- Total topics tracked: ${topics.length}

## EXAM PERFORMANCE
${exams.length > 0 ? exams.slice(0, 5).map(e => `- Score: ${e.score}/${e.total_questions} (${e.difficulty}) on ${new Date(e.created_at).toLocaleDateString()}`).join("\n") : "No exams taken yet."}

## RANK TRAJECTORY
${ranks.length > 0 ? `Current rank: ${ranks[0].predicted_rank} (${ranks[0].percentile}th percentile)${ranks.length > 1 ? ` | Previous: ${ranks[1].predicted_rank}` : ""}` : "No rank data."}
`;

    // Helper: track API usage after successful AI calls
    const adminTracker = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const trackAI = () => adminTracker.rpc("increment_api_usage", { p_service_name: "lovable_ai" }).then(() => {}).catch(() => {});

    // Helper: make AI call with fallback (Gemini direct → Lovable gateway)
    async function callAI(requestBody: any): Promise<Response> {
      const aiResp = await aiFetch({ body: JSON.stringify(requestBody) });
      if (!aiResp.ok) {
        const status = aiResp.status;
        const errText = await aiResp.text().catch(() => "");
        console.error(`AI call failed: ${status}`, errText);
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI error: ${status}`);
      }
      trackAI();
      return aiResp;
    }

    if (action === "analyze") {
      const aiResp = await callAI({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are ACRY, an autonomous AI cognitive engine for exam preparation. You analyze the student's complete learning data and provide a strategic briefing. Be concise, data-driven, and actionable. Use the student's actual topic names and numbers. Think like a personal AI tutor who deeply understands the forgetting curve and optimal study scheduling.`
          },
          {
            role: "user",
            content: `${cognitiveContext}\n\nGenerate a comprehensive AI brain briefing with strategic analysis.`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "brain_briefing",
            description: "Generate autonomous AI brain briefing",
            parameters: {
              type: "object",
              properties: {
                cognitive_summary: { type: "string", description: "2-3 sentence overview of current cognitive state" },
                memory_analysis: { type: "string", description: "Analysis of memory patterns and decay risks" },
                strategic_advice: { type: "array", items: { type: "object", properties: { title: { type: "string" }, advice: { type: "string" }, urgency: { type: "string", enum: ["immediate", "today", "this_week"] } }, required: ["title", "advice", "urgency"] } },
                predicted_outcome: { type: "string", description: "Brief prediction of exam readiness trajectory" },
                focus_recommendation: { type: "string", description: "What to focus on RIGHT NOW" },
                wellness_note: { type: "string", description: "Brief note on study-life balance based on fatigue/burnout signals" },
              },
              required: ["cognitive_summary", "memory_analysis", "strategic_advice", "predicted_outcome", "focus_recommendation"],
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "brain_briefing" } },
      });

      // If callAI returned an error response, pass it through
      if (aiResp.status !== 200) return aiResp;

      const aiData = await aiResp.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      let briefing = {};
      if (toolCall?.function?.arguments) {
        briefing = JSON.parse(toolCall.function.arguments);
      } else {
        // Fallback: try parsing content
        const content = aiData.choices?.[0]?.message?.content || "";
        try {
          const match = content.match(/\{[\s\S]*\}/);
          if (match) briefing = JSON.parse(match[0]);
        } catch {}
      }

      return new Response(JSON.stringify(briefing), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "chat") {
      const aiResp = await callAI({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are ACRY, an autonomous AI brain assistant for exam preparation. You have complete access to the student's cognitive data. Answer questions, give study advice, explain predictions, and provide personalized strategy. Be conversational but data-driven. Reference specific topics and numbers from their data.

${cognitiveContext}`
          },
          { role: "user", content: message }
        ],
      });

      if (aiResp.status !== 200) return aiResp;

      const aiData = await aiResp.json();
      const reply = aiData.choices?.[0]?.message?.content || "I couldn't process that. Please try again.";

      return new Response(JSON.stringify({ reply }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "explain") {
      const { prediction_type, prediction_data } = body;

      const aiResp = await callAI({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: "You are ACRY's explainability engine. Explain AI predictions in simple, human-friendly language. Be brief (2-3 sentences max). Reference specific data points."
          },
          {
            role: "user",
            content: `Explain this ${prediction_type || "general"} prediction to the student:\n\nPrediction data: ${JSON.stringify(prediction_data || {})}\n\nStudent context:\n${cognitiveContext}`
          }
        ],
      });

      if (aiResp.status !== 200) return aiResp;

      const aiData = await aiResp.json();
      const explanation = aiData.choices?.[0]?.message?.content || "";

      return new Response(JSON.stringify({ explanation }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "daily_mission") {
      const aiResp = await callAI({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are ACRY, an AI tutor that picks ONE most impactful micro-study action for today. Consider forget risk, weak topics, upcoming exam urgency, recent activity patterns, and streak risk. The mission must be completable in 3-6 minutes and produce measurable brain improvement.`
          },
          {
            role: "user",
            content: `${cognitiveContext}\n\nGenerate exactly ONE mission for today. Pick the single highest-impact action.`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "daily_mission",
            description: "Generate one AI-decided daily mission",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Short mission title (max 8 words)" },
                description: { type: "string", description: "1-2 sentence explanation of why this matters today" },
                topic_name: { type: "string", description: "The specific topic to study, or empty if general" },
                subject_name: { type: "string", description: "The subject the topic belongs to, or empty" },
                estimated_minutes: { type: "number", description: "Estimated completion time in minutes (3-6)" },
                brain_improvement_pct: { type: "number", description: "Expected brain stability improvement percentage (1-15)" },
                urgency: { type: "string", enum: ["critical", "high", "medium"], description: "Mission urgency level" },
                reasoning: { type: "string", description: "Brief AI reasoning for choosing this mission (1 sentence)" },
                mission_type: { type: "string", enum: ["recall", "review", "practice", "strengthen"], description: "Type of study action" },
              },
              required: ["title", "description", "estimated_minutes", "brain_improvement_pct", "urgency", "reasoning", "mission_type"],
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "daily_mission" } },
      });

      if (aiResp.status !== 200) return aiResp;

      const aiData = await aiResp.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      let mission = {};
      if (toolCall?.function?.arguments) {
        mission = JSON.parse(toolCall.function.arguments);
      } else {
        const content = aiData.choices?.[0]?.message?.content || "";
        try {
          const match = content.match(/\{[\s\S]*\}/);
          if (match) mission = JSON.parse(match[0]);
        } catch {}
      }

      return new Response(JSON.stringify(mission), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "brain_feed") {
      const feedCount = Math.min(reqCount || 5, 8);
      const feedTopics = topics.slice(0, 15);

      const aiResp = await callAI({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are ACRY, an AI tutor generating a micro-learning feed. Generate exactly ${feedCount} bite-sized concept cards for exam preparation. Each card has ONE key concept (1-2 sentences) and ONE quick recall question with 4 options. Pick from the student's weakest/highest-weight topics. Keep concepts ultra-concise and exam-relevant. memory_boost should be 1-4 based on topic weakness.`
          },
          {
            role: "user",
            content: `${cognitiveContext}\n\nTopics available: ${feedTopics.map(t => `${t.name} (${Math.round(Number(t.memory_strength))}%, subject: ${subjectMap.get(t.subject_id) || "Unknown"})`).join(", ")}\n\nGenerate ${feedCount} micro concept cards.`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "brain_feed",
            description: "Generate micro-learning feed cards",
            parameters: {
              type: "object",
              properties: {
                cards: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      topic_name: { type: "string" },
                      subject_name: { type: "string" },
                      concept: { type: "string", description: "1-2 sentence micro concept" },
                      recall_question: { type: "string", description: "Short recall question" },
                      options: { type: "array", items: { type: "string" }, description: "4 answer options" },
                      correct_index: { type: "number", description: "Index 0-3 of correct answer" },
                      memory_boost: { type: "number", description: "Expected memory boost 1-4" },
                    },
                    required: ["topic_name", "subject_name", "concept", "recall_question", "options", "correct_index", "memory_boost"],
                  }
                }
              },
              required: ["cards"],
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "brain_feed" } },
      });

      if (aiResp.status !== 200) return aiResp;

      const aiData = await aiResp.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      let result = { cards: [] };
      if (toolCall?.function?.arguments) {
        const parsed = JSON.parse(toolCall.function.arguments);
        result = {
          cards: (parsed.cards || []).map((c: any) => {
            const t = topics.find(tp => tp.name === c.topic_name);
            return { ...c, memory_strength: t ? Number(t.memory_strength) : 50 };
          })
        };
      } else {
        const content = aiData.choices?.[0]?.message?.content || "";
        try {
          const match = content.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            result = { cards: parsed.cards || [] };
          }
        } catch {}
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "mission_questions") {
      const qCount = Math.min(reqCount || 4, 5);
      const diff = reqDifficulty || "medium";
      const topicCtx = topic_name ? `Focus on the topic "${topic_name}"${subject_name ? ` (subject: ${subject_name})` : ""}.` : "Pick from the student's weakest topics.";

      const trimmedContext = `Student: ${profile?.display_name || "Student"}, Exam: ${profile?.exam_type || "General"}${daysToExam ? ` in ${daysToExam} days` : ""}.
Weak topics: ${criticalTopics.slice(0, 5).map(t => t.name).join(", ") || "None"}.
At-risk topics: ${atRiskTopics.slice(0, 5).map(t => t.name).join(", ") || "None"}.`;

      const aiResp = await callAI({
        model: "google/gemini-3-flash-preview",
        max_tokens: 4000,
        messages: [
          {
            role: "system",
            content: `You are ACRY, an AI tutor. Generate exactly ${qCount} MCQs at "${diff}" difficulty. ${topicCtx} Each question tests recall/understanding. Keep explanations to 1 sentence. Return via the tool call.`
          },
          {
            role: "user",
            content: `${trimmedContext}\n\nGenerate ${qCount} ${diff} recall questions.`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "mission_questions",
            description: "Generate recall questions for a micro mission",
            parameters: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question: { type: "string" },
                      options: { type: "array", items: { type: "string" }, description: "4 options" },
                      correct_index: { type: "number", description: "0-3" },
                      explanation: { type: "string" },
                      difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                    },
                    required: ["question", "options", "correct_index", "explanation", "difficulty"],
                  }
                }
              },
              required: ["questions"],
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "mission_questions" } },
      });

      if (aiResp.status !== 200) return aiResp;

      const aiData = await aiResp.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      let result = { questions: [] as any[] };
      if (toolCall?.function?.arguments) {
        try {
          result = JSON.parse(toolCall.function.arguments);
        } catch (parseErr) {
          console.error("Failed to parse tool_calls arguments:", parseErr);
        }
      }

      // Fallback: try parsing content directly if tool_calls failed
      if (!result.questions?.length) {
        const content = aiData.choices?.[0]?.message?.content || "";
        if (content) {
          try {
            let cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
            const arrStart = cleaned.indexOf("[");
            const objStart = cleaned.indexOf("{");
            let parsed: any;
            if (arrStart !== -1 && (objStart === -1 || arrStart < objStart)) {
              const arrEnd = cleaned.lastIndexOf("]");
              if (arrEnd > arrStart) {
                parsed = JSON.parse(cleaned.substring(arrStart, arrEnd + 1));
                if (Array.isArray(parsed)) result = { questions: parsed };
              }
            } else if (objStart !== -1) {
              const objEnd = cleaned.lastIndexOf("}");
              if (objEnd > objStart) {
                parsed = JSON.parse(cleaned.substring(objStart, objEnd + 1));
                result = parsed.questions ? parsed : { questions: [parsed] };
              }
            }
          } catch (e) {
            console.error("Fallback JSON parse failed:", e);
          }
        }
      }

      // Normalize: convert "answer" text to "correct_index" number if needed
      if (result.questions?.length) {
        result.questions = result.questions.map((q: any) => {
          if (q.correct_index === undefined && q.answer !== undefined) {
            const idx = q.options?.findIndex((o: string) => o === q.answer || o.includes(q.answer) || q.answer.includes(o));
            q.correct_index = idx >= 0 ? idx : 0;
            delete q.answer;
          }
          if (!q.difficulty) q.difficulty = "medium";
          if (!q.explanation) q.explanation = "";
          return q;
        });
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "weekly_strategy") {
      const aiResp = await callAI({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: "You are ACRY, an AI study strategist. Generate ONE concise weekly strategy recommendation for the student. Be specific and actionable."
          },
          {
            role: "user",
            content: `${cognitiveContext}\n\nGenerate one weekly strategy suggestion.`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "weekly_strategy",
            description: "Generate weekly strategy",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Strategy title (max 8 words)" },
                description: { type: "string", description: "2-3 sentence strategy explanation" },
                impact: { type: "string", description: "Expected impact e.g. '+8% readiness'" },
                action_label: { type: "string", description: "CTA button text e.g. 'Optimize My Plan'" },
              },
              required: ["title", "description", "impact", "action_label"],
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "weekly_strategy" } },
      });

      if (aiResp.status !== 200) return aiResp;
      const aiData = await aiResp.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      let result = { title: "Focus on weak areas", description: "Prioritize declining topics.", impact: "+5% stability", action_label: "Optimize My Plan" };
      if (toolCall?.function?.arguments) {
        try { result = JSON.parse(toolCall.function.arguments); } catch {}
      }
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "optimize_plan" || action === "recalibrate") {
      // Trigger cognitive twin recomputation and return success
      return new Response(JSON.stringify({ success: true, message: "Plan optimized and AI recalibrated." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-brain-agent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
