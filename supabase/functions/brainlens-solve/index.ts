import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, handleCors, jsonResponse, errorResponse } from "../_shared/auth.ts";
import { rateLimitMiddleware } from "../_shared/rateLimit.ts";
import { callAI, getAIText } from "../_shared/aiClient.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const auth = await authenticateRequest(req);
    const rl = await rateLimitMiddleware(auth.userId, "brainlens-solve");
    if (rl) return rl;

    const { input_type, content, image_base64 } = await req.json();

    if (!input_type || (!content && !image_base64)) {
      return errorResponse("Missing input_type or content", 400);
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date().toISOString().split("T")[0];

    // Run ALL DB queries in parallel – config, daily count, profile, memory, recent queries
    const [configRes, countRes, profileRes, memoryRes, recentQueriesRes] = await Promise.all([
      adminClient.from("brainlens_config").select("is_enabled, max_daily_queries_per_user").single(),
      adminClient.from("brainlens_queries").select("id", { count: "exact", head: true }).eq("user_id", auth.userId).gte("created_at", `${today}T00:00:00Z`),
      adminClient.from("profiles").select("exam_type").eq("id", auth.userId).single(),
      adminClient.from("memory_scores").select("topic_id, score").eq("user_id", auth.userId).order("recorded_at", { ascending: false }).limit(10),
      adminClient.from("brainlens_queries").select("detected_topic, cognitive_gap_type").eq("user_id", auth.userId).eq("status", "completed").order("created_at", { ascending: false }).limit(5),
    ]);

    const config = configRes.data;
    if (!config?.is_enabled) {
      return errorResponse("BrainLens is currently disabled", 403);
    }
    if ((countRes.count || 0) >= (config.max_daily_queries_per_user || 50)) {
      return errorResponse("Daily query limit reached", 429);
    }

    // Insert query record (non-blocking – fire and continue)
    const insertPromise = adminClient
      .from("brainlens_queries")
      .insert({ user_id: auth.userId, input_type, input_content: content || "[image]", status: "processing", alis_version: "v3.1" })
      .select("id")
      .single();

    const startTime = Date.now();
    const questionText = content || "";
    const systemPrompt = buildALISPrompt(profileRes.data, memoryRes.data, recentQueriesRes.data);

    const messages: any[] = [{ role: "system", content: systemPrompt }];

    if (image_base64) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: "Extract question from image. Solve and return JSON." },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image_base64}` } }
        ]
      });
    } else {
      messages.push({ role: "user", content: `Solve:\n${questionText}` });
    }

    // Wait for insert to finish before AI call
    const { data: query, error: insertErr } = await insertPromise;
    if (insertErr) return errorResponse("Failed to create query record", 500);

    // Use gemini-3-flash-preview for all queries (fastest next-gen model)
    const model = "google/gemini-3-flash-preview";

    const aiResult = await callAI({
      messages,
      model,
      temperature: 0.02,
      maxTokens: 2500,
      timeoutMs: 25000,
    });

    if (!aiResult.ok) {
      // Fire-and-forget error update
      adminClient.from("brainlens_queries").update({
        status: "failed", error_message: aiResult.error || "AI call failed", processing_time_ms: Date.now() - startTime,
      }).eq("id", query.id).then(() => {});
      return errorResponse("AI processing failed", 500);
    }

    const rawText = getAIText(aiResult);
    const parsed = parseALISResponse(rawText);
    const processingTime = Date.now() - startTime;
    const confidence = parsed.confidence || 0.8;

    // Fire-and-forget DB update – don't block the response
    adminClient.from("brainlens_queries").update({
      status: "completed",
      extracted_text: image_base64 ? parsed.extracted_question || questionText : questionText,
      detected_topic: parsed.detected_topic || "General",
      detected_subtopic: parsed.detected_subtopic || "",
      detected_difficulty: parsed.detected_difficulty || "medium",
      detected_exam_type: parsed.detected_exam_type || "",
      short_answer: parsed.short_answer || "",
      detailed_explanation: {
        step_by_step: parsed.step_by_step || [],
        concept_clarity: parsed.concept_clarity || "",
        option_elimination: parsed.option_elimination || "",
        shortcut_tricks: parsed.shortcut_tricks || "",
      },
      cognitive_gap_type: parsed.cognitive_gap?.type || "conceptual_gap",
      cognitive_gap_code: parsed.cognitive_gap?.code || "CG-001",
      micro_concepts: parsed.micro_concepts || null,
      reinforcement_questions: parsed.micro_concepts?.reinforcement_questions || null,
      exam_impact: parsed.exam_impact || null,
      explanation_depth: parsed.explanation_depth || "standard",
      confidence_score: confidence,
      cross_validated: confidence < 0.7,
      knowledge_graph_node: {
        topic: parsed.detected_topic,
        subtopic: parsed.detected_subtopic,
        core_concept: parsed.micro_concepts?.core || "",
        adjacent: parsed.micro_concepts?.adjacent_nodes || [],
        gap_type: parsed.cognitive_gap?.type,
        timestamp: new Date().toISOString(),
      },
      pre_query_predictions: parsed.pre_query_predictions || null,
      silent_repair_plan: parsed.silent_repair_plan || null,
      future_style_questions: parsed.future_style_questions || null,
      cognitive_drift: parsed.cognitive_drift || null,
      personal_examiner: parsed.personal_examiner || null,
      strategic_mastery_index: parsed.strategic_mastery_index || null,
      strategy_switch: parsed.strategy_switch || null,
      processing_time_ms: processingTime,
    }).eq("id", query.id).then(() => {});

    // Return response immediately
    return jsonResponse({
      id: query.id,
      short_answer: parsed.short_answer || "",
      step_by_step: parsed.step_by_step || [],
      concept_clarity: parsed.concept_clarity || "",
      option_elimination: parsed.option_elimination || "",
      shortcut_tricks: parsed.shortcut_tricks || "",
      detected_topic: parsed.detected_topic || "General",
      detected_subtopic: parsed.detected_subtopic || "",
      detected_difficulty: parsed.detected_difficulty || "medium",
      detected_exam_type: parsed.detected_exam_type || "",
      confidence,
      processing_time_ms: processingTime,
      cognitive_gap: parsed.cognitive_gap || { type: "conceptual_gap", code: "CG-001", explanation: "", severity: "medium" },
      micro_concepts: parsed.micro_concepts || { core: "", adjacent_nodes: [], reinforcement_questions: [] },
      exam_impact: parsed.exam_impact || { topic_probability_index: 0.5, estimated_mastery_boost: "5%", readiness_impact: "medium", related_pyq_patterns: [] },
      explanation_depth: parsed.explanation_depth || "standard",
      cross_validation_note: parsed.cross_validation_note || "",
      pre_query_predictions: parsed.pre_query_predictions || { weak_concepts: [], preventive_challenge: null, prediction_confidence: 0 },
      silent_repair_plan: parsed.silent_repair_plan || { stealth_questions: [], unstable_nodes: [], repair_strategy: "" },
      future_style_questions: parsed.future_style_questions || [],
      cognitive_drift: parsed.cognitive_drift || { drift_detected: false, drift_magnitude: 0, recalibration: "" },
      personal_examiner: parsed.personal_examiner || { trap_questions: [], conceptual_depth_score: 0, robustness_rating: "" },
      strategic_mastery_index: parsed.strategic_mastery_index || { smi_score: 0, multi_step_reasoning: 0, transfer_learning: 0, trap_resistance: 0 },
      strategy_switch: parsed.strategy_switch || { recommended_mode: "", reasoning: "", urgency: "low" },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("BrainLens ALIS error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});

/* ═══ Compact ALIS Prompt ═══ */
function buildALISPrompt(profile: any, memoryScores: any[], recentQueries: any[]): string {
  const avgStr = memoryScores?.length
    ? (memoryScores.reduce((a, s) => a + (s.score || 0), 0) / memoryScores.length).toFixed(1)
    : null;
  const gaps = recentQueries?.map(q => q.cognitive_gap_type).filter(Boolean).slice(0, 3) || [];
  const topics = recentQueries?.map(q => q.detected_topic).filter(Boolean).slice(0, 3) || [];

  return `Academic solver. Return ONLY raw JSON. No markdown fences. No self-correction. No "Wait"/"Let me re-check". Compute once correctly.
Keep short_answer to 1-2 sentences. step_by_step: 3-5 steps, each max 1 sentence. All other string fields max 2 sentences.
JSON keys: detected_topic,detected_subtopic,detected_difficulty(easy|medium|hard),detected_exam_type,short_answer,step_by_step[],concept_clarity,option_elimination,shortcut_tricks,cognitive_gap{type,code,explanation,severity},micro_concepts{core,adjacent_nodes[],reinforcement_questions[{question,difficulty}]},exam_impact{topic_probability_index,estimated_mastery_boost,readiness_impact,related_pyq_patterns[]},explanation_depth,confidence,cross_validation_note,pre_query_predictions{weak_concepts[],preventive_challenge,prediction_confidence},silent_repair_plan{stealth_questions[],unstable_nodes[],repair_strategy},future_style_questions[{question,difficulty,exam_probability}],cognitive_drift{drift_detected,drift_magnitude,recalibration},personal_examiner{trap_questions[{question,trap_type}],conceptual_depth_score,robustness_rating},strategic_mastery_index{smi_score,multi_step_reasoning,transfer_learning,trap_resistance},strategy_switch{recommended_mode,reasoning,urgency}
${profile?.exam_type ? `Exam:${profile.exam_type}.` : ""}${avgStr ? `Mem:${avgStr}.` : ""}${gaps.length ? `Gaps:${gaps.join(",")}.` : ""}${topics.length ? `Topics:${topics.join(",")}.` : ""}`;
}

/* ═══ ALIS Response Parser ═══ */
function parseALISResponse(rawText: string): any {
  let cleaned = rawText.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  try { return JSON.parse(cleaned); } catch { /* continue */ }

  const jsonStart = cleaned.indexOf("{");
  if (jsonStart === -1) return fallbackResponse(rawText);
  let s = cleaned.substring(jsonStart);
  try { return JSON.parse(s); } catch { /* continue */ }

  // Repair truncated JSON
  s = s.replace(/,\s*"[^"]*"?\s*:\s*"[^"]*$/s, "");
  s = s.replace(/,\s*"[^"]*"?\s*:\s*\{[^}]*$/s, "");
  s = s.replace(/,\s*"[^"]*"?\s*:\s*\[[^\]]*$/s, "");
  s = s.replace(/,\s*$/, "");

  let braces = 0, brackets = 0;
  for (const c of s) {
    if (c === "{") braces++; else if (c === "}") braces--;
    if (c === "[") brackets++; else if (c === "]") brackets--;
  }
  while (brackets > 0) { s += "]"; brackets--; }
  while (braces > 0) { s += "}"; braces--; }

  try { return JSON.parse(s); } catch { /* continue */ }
  s = s.replace(/[\x00-\x1F\x7F]/g, " ");
  try { return JSON.parse(s); } catch { /* fallback */ }
  return fallbackResponse(rawText);
}

function fallbackResponse(rawText: string): any {
  return {
    short_answer: rawText.length > 300 ? rawText.substring(0, 200) + "..." : rawText,
    step_by_step: [], concept_clarity: "", option_elimination: "", shortcut_tricks: "",
    cognitive_gap: { type: "conceptual_gap", code: "CG-001", explanation: "", severity: "medium" },
    micro_concepts: { core: "", adjacent_nodes: [], reinforcement_questions: [] },
    exam_impact: { topic_probability_index: 0.5, estimated_mastery_boost: "5%", readiness_impact: "medium", related_pyq_patterns: [] },
    explanation_depth: "standard", confidence: 0.5, cross_validation_note: "Fallback",
    pre_query_predictions: { weak_concepts: [], preventive_challenge: null, prediction_confidence: 0 },
    silent_repair_plan: { stealth_questions: [], unstable_nodes: [], repair_strategy: "" },
    future_style_questions: [],
    cognitive_drift: { drift_detected: false, drift_magnitude: 0, recalibration: "" },
    personal_examiner: { trap_questions: [], conceptual_depth_score: 0, robustness_rating: "developing" },
    strategic_mastery_index: { smi_score: 0, multi_step_reasoning: 0, transfer_learning: 0, trap_resistance: 0 },
    strategy_switch: { recommended_mode: "deep_focus", reasoning: "Default", urgency: "low" },
  };
}
