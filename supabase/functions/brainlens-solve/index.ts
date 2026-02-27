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

    // Check if BrainLens is enabled
    const { data: config } = await adminClient
      .from("brainlens_config")
      .select("is_enabled, max_daily_queries_per_user")
      .single();

    if (!config?.is_enabled) {
      return errorResponse("BrainLens is currently disabled", 403);
    }

    // Check daily limit
    const today = new Date().toISOString().split("T")[0];
    const { count } = await adminClient
      .from("brainlens_queries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.userId)
      .gte("created_at", `${today}T00:00:00Z`);

    if ((count || 0) >= (config.max_daily_queries_per_user || 50)) {
      return errorResponse("Daily query limit reached", 429);
    }

    // Fetch user profile for adaptive depth
    const { data: profile } = await adminClient
      .from("profiles")
      .select("exam_type")
      .eq("id", auth.userId)
      .single();

    // Fetch user memory scores for mastery context
    const { data: memoryScores } = await adminClient
      .from("memory_scores")
      .select("topic_id, memory_strength, stability_score")
      .eq("user_id", auth.userId)
      .order("last_reviewed_at", { ascending: false })
      .limit(20);

    // Insert pending query
    const { data: query, error: insertErr } = await adminClient
      .from("brainlens_queries")
      .insert({
        user_id: auth.userId,
        input_type,
        input_content: content || "[image]",
        status: "processing",
      })
      .select("id")
      .single();

    if (insertErr) {
      return errorResponse("Failed to create query record", 500);
    }

    const startTime = Date.now();
    let questionText = content || "";

    const systemPrompt = `You are ACRY ACQIS – Advanced Cognitive Query Intelligence System. You are a world-class academic solver AND cognitive diagnostician.

Given a question, return a JSON object with ALL these fields:

{
  "detected_topic": "main subject (Physics, Polity, Economics, etc.)",
  "detected_subtopic": "specific subtopic",
  "detected_difficulty": "easy|medium|hard",
  "detected_exam_type": "most likely exam (UPSC, NEET, JEE, etc.)",
  "short_answer": "direct answer in 1-3 sentences",
  "step_by_step": ["step 1...", "step 2...", ...],
  "concept_clarity": "underlying principle explained clearly",
  "option_elimination": "if MCQ, why each wrong option is wrong. Otherwise empty string.",
  "shortcut_tricks": "memory tricks or shortcuts",
  
  "cognitive_gap": {
    "type": "conceptual_gap|retrieval_failure|interference_confusion|speed_weakness|pattern_unfamiliarity",
    "code": "CG-001 through CG-005",
    "explanation": "why this gap type was identified",
    "severity": "low|medium|high"
  },
  
  "micro_concepts": {
    "core": "the core micro-concept tested",
    "adjacent_nodes": ["related high-probability concept 1", "concept 2", "concept 3"],
    "reinforcement_questions": [
      {"question": "personalized follow-up Q1", "difficulty": "easy|medium|hard"},
      {"question": "personalized follow-up Q2", "difficulty": "easy|medium|hard"},
      {"question": "personalized follow-up Q3", "difficulty": "easy|medium|hard"}
    ]
  },
  
  "exam_impact": {
    "topic_probability_index": 0.0 to 1.0,
    "estimated_mastery_boost": "percentage boost if mastered",
    "readiness_impact": "low|medium|high|critical",
    "related_pyq_patterns": ["brief PYQ pattern 1", "pattern 2"]
  },
  
  "explanation_depth": "beginner|standard|advanced|expert",
  
  "confidence": 0.0 to 1.0,
  "cross_validation_note": "brief note on answer reliability"
}

${profile?.exam_type ? `User is preparing for: ${profile.exam_type}. Tailor exam impact accordingly.` : ""}
${memoryScores?.length ? `User has studied ${memoryScores.length} topics. Avg memory strength: ${(memoryScores.reduce((a, s) => a + (s.memory_strength || 0), 0) / memoryScores.length).toFixed(2)}. Adjust explanation depth based on this.` : "User is new. Use standard explanation depth."}

Respond ONLY with valid JSON. No markdown, no code blocks.`;

    const messages: any[] = [{ role: "system", content: systemPrompt }];

    if (image_base64) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: "Extract the question from this image. Parse any math symbols, equations, diagrams, or tables. Solve completely and return JSON as instructed." },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image_base64}` } }
        ]
      });
    } else {
      messages.push({
        role: "user",
        content: `Solve this question completely. If it's a URL about policy/current affairs, also extract policy impact and generate exam questions.\n\nQuestion: ${questionText}`
      });
    }

    const aiResult = await callAI({
      messages,
      model: "google/gemini-2.5-flash",
      temperature: 0.3,
      maxTokens: 6000,
      timeoutMs: 55000,
    });

    if (!aiResult.ok) {
      await adminClient.from("brainlens_queries").update({
        status: "failed",
        error_message: aiResult.error || "AI call failed",
        processing_time_ms: Date.now() - startTime,
      }).eq("id", query.id);
      return errorResponse("AI processing failed", 500);
    }

    const rawText = getAIText(aiResult);
    let parsed: any = {};

    try {
      const jsonMatch = rawText.match(/[\{][\s\S]*[\}]/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      parsed = {
        short_answer: rawText,
        step_by_step: [],
        concept_clarity: "",
        option_elimination: "",
        shortcut_tricks: "",
        cognitive_gap: { type: "conceptual_gap", code: "CG-001", explanation: "Unable to classify", severity: "medium" },
        micro_concepts: { core: "", adjacent_nodes: [], reinforcement_questions: [] },
        exam_impact: { topic_probability_index: 0.5, estimated_mastery_boost: "5%", readiness_impact: "medium", related_pyq_patterns: [] },
        explanation_depth: "standard",
        confidence: 0.5,
        cross_validation_note: "Fallback parsing used",
      };
    }

    const processingTime = Date.now() - startTime;
    const confidence = parsed.confidence || 0.8;

    // Update query record with full ACQIS data
    await adminClient.from("brainlens_queries").update({
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
      processing_time_ms: processingTime,
    }).eq("id", query.id);

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
      confidence: confidence,
      processing_time_ms: processingTime,
      // ACQIS modules
      cognitive_gap: parsed.cognitive_gap || { type: "conceptual_gap", code: "CG-001", explanation: "", severity: "medium" },
      micro_concepts: parsed.micro_concepts || { core: "", adjacent_nodes: [], reinforcement_questions: [] },
      exam_impact: parsed.exam_impact || { topic_probability_index: 0.5, estimated_mastery_boost: "5%", readiness_impact: "medium", related_pyq_patterns: [] },
      explanation_depth: parsed.explanation_depth || "standard",
      cross_validation_note: parsed.cross_validation_note || "",
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("BrainLens ACQIS error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
