import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, handleCors, jsonResponse, errorResponse } from "../_shared/auth.ts";
import { rateLimitMiddleware } from "../_shared/rateLimit.ts";
import { callAI, getAIText, getAIToolArgs } from "../_shared/aiClient.ts";
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

    // Build prompt based on input type
    let questionText = content || "";
    
    const messages: any[] = [
      {
        role: "system",
        content: `You are ACRY BrainLens – an expert academic question solver for competitive exams (UPSC, NEET, JEE, CAT, GATE, etc.).

Given a question, you MUST return a JSON object with these fields:
{
  "detected_topic": "main subject area (e.g. Physics, Polity, Economics)",
  "detected_subtopic": "specific subtopic (e.g. Thermodynamics, Fundamental Rights)",
  "detected_difficulty": "easy|medium|hard",
  "detected_exam_type": "most likely exam this question appears in",
  "short_answer": "direct answer in 1-2 sentences",
  "step_by_step": ["step 1...", "step 2...", ...],
  "concept_clarity": "brief concept explanation that makes the underlying principle crystal clear",
  "option_elimination": "if MCQ, explain why each wrong option is wrong",
  "shortcut_tricks": "any memory tricks or shortcuts for similar questions",
  "confidence": 0.95
}

Always respond with valid JSON only. No markdown, no code blocks.`
      }
    ];

    if (image_base64) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: "Extract the question from this image and solve it completely. Return JSON as instructed." },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image_base64}` } }
        ]
      });
    } else {
      messages.push({
        role: "user",
        content: `Solve this question completely. Return JSON as instructed.\n\nQuestion: ${questionText}`
      });
    }

    const aiResult = await callAI({
      messages,
      model: "google/gemini-2.5-flash",
      temperature: 0.3,
      maxTokens: 4000,
      timeoutMs: 50000,
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
      parsed = { short_answer: rawText, step_by_step: [], concept_clarity: "", option_elimination: "", shortcut_tricks: "" };
    }

    const processingTime = Date.now() - startTime;

    // Update query record
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
        confidence: parsed.confidence || 0.8,
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
      confidence: parsed.confidence || 0.8,
      processing_time_ms: processingTime,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("BrainLens error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
