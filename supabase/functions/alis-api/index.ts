import { createClient } from "npm:@supabase/supabase-js@2";
import { callAI as sharedCallAI, getAIText } from "../_shared/aiClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-api-key, api-key, x-api-token, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const adminClient = createClient(supabaseUrl, serviceKey);

/* ───── response helpers ───── */

function ok(data: unknown) {
  return new Response(JSON.stringify(sanitize(data)), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function err(msg: string, status = 400) {
  return new Response(JSON.stringify({ success: false, error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function sanitize(obj: unknown): unknown {
  if (obj === null || obj === undefined) return "";
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) out[k] = sanitize(v);
    return out;
  }
  return obj;
}

async function formDataToBody(formData: FormData): Promise<Record<string, unknown>> {
  const entries = await Promise.all(
    Array.from(formData.entries()).map(async ([key, value]) => {
      if (value instanceof File) {
        const bytes = new Uint8Array(await value.arrayBuffer());
        const base64 = btoa(String.fromCharCode(...bytes));
        return [key, base64] as const;
      }
      return [key, value] as const;
    }),
  );

  const body = Object.fromEntries(entries);
  const uploadedFile = body.file || body.image || body.pdf || body.document;

  if (uploadedFile && !body.image_base64) {
    body.image_base64 = uploadedFile;
  }

  return body;
}

async function parseRequestBody(req: Request): Promise<Record<string, unknown>> {
  if (!["POST", "PUT", "PATCH"].includes(req.method)) return {};

  const contentType = (req.headers.get("content-type") || "").toLowerCase();

  if (contentType.includes("multipart/form-data")) {
    return await formDataToBody(await req.formData());
  }

  const raw = await req.text();
  if (!raw.trim()) return {};

  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw).entries());
  }

  try {
    return JSON.parse(raw);
  } catch {
    if (contentType.includes("text/plain")) {
      try {
        return JSON.parse(raw);
      } catch {
        return { content: raw };
      }
    }

    return Object.fromEntries(new URLSearchParams(raw).entries());
  }
}

function resolveAction(body: Record<string, unknown>): string {
  const rawAction = typeof body.action === "string" ? body.action.trim().toLowerCase() : "";

  if (["solve", "query", "analyze", "analyse"].includes(rawAction)) return "solve";
  if (["init", "suggest", "history", "stats"].includes(rawAction)) return rawAction;

  const hasSolvePayload = Boolean(
    body.input_type ||
    body.content ||
    body.image_base64 ||
    body.url ||
    body.file ||
    body.image ||
    body.pdf ||
    body.document,
  );

  return hasSolvePayload ? "solve" : "init";
}

/* ───── auth ───── */

async function resolveUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization") || "";
  const apiKey = req.headers.get("x-api-key") || req.headers.get("api-key") || "";

  if (authHeader.startsWith("Bearer ey")) {
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await adminClient.auth.getUser(token);
    if (user?.id) return user.id;
  }
  if (apiKey.startsWith("acry_") || authHeader.startsWith("acry_")) {
    const raw = apiKey || authHeader;
    const prefix = raw.substring(0, 10) + "...";
    const { data } = await adminClient.from("api_keys").select("created_by").eq("key_prefix", prefix).eq("is_active", true).maybeSingle();
    if (data?.created_by) return data.created_by;
  }
  return null;
}

async function callAIWrapper(messages: any[], model: string, temperature: number, maxTokens: number, timeoutMs: number) {
  const result = await sharedCallAI({ messages, model, temperature, maxTokens, timeoutMs });
  if (!result.ok) return { ok: false, error: result.error || "AI failed" };
  return { ok: true, text: getAIText(result) };
}

/* ═══════════════════════════════════════════
   MAIN HANDLER
   ═══════════════════════════════════════════ */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const userId = await resolveUserId(req);
    if (!userId) return err("Unauthorized", 401);

    const body = await parseRequestBody(req);
    const action = resolveAction(body);

    switch (action) {
      case "init":       return await handleInit(userId);
      case "suggest":    return await handleSuggest(userId);
      case "solve":      return await handleSolve(userId, body);
      case "history":    return await handleHistory(userId, body);
      case "stats":      return await handleStats(userId);
      default:           return err(`Unknown action: ${action}`);
    }
  } catch (e: any) {
    console.error("ALIS API error:", e);
    return err(e.message || "Internal error", 500);
  }
});

/* ═══════════════════════════════════════════
   ACTION: init — Dashboard bootstrap
   ═══════════════════════════════════════════ */

async function handleInit(userId: string) {
  const today = new Date().toISOString().split("T")[0];

  const [configRes, countRes, profileRes, recentRes, statsRes] = await Promise.all([
    adminClient.from("brainlens_config").select("is_enabled, max_daily_queries_per_user").single(),
    adminClient.from("brainlens_queries").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", `${today}T00:00:00Z`),
    adminClient.from("profiles").select("display_name, exam_type, exam_date").eq("id", userId).maybeSingle(),
    adminClient.from("brainlens_queries").select("id, input_type, detected_topic, detected_subtopic, detected_difficulty, short_answer, confidence_score, processing_time_ms, created_at, status").eq("user_id", userId).eq("status", "completed").order("created_at", { ascending: false }).limit(5),
    adminClient.from("brainlens_queries").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  const config = configRes.data;
  const dailyUsed = countRes.count || 0;
  const dailyLimit = config?.max_daily_queries_per_user || 50;

  return ok({
    success: true,
    alis: {
      status: config?.is_enabled ? "ready" : "disabled",
      version: "v4.0 Ω",
      engine: "Cognitive Intelligence",
      daily_queries_used: dailyUsed,
      daily_queries_limit: dailyLimit,
      daily_queries_remaining: Math.max(0, dailyLimit - dailyUsed),
      total_queries_all_time: statsRes.count || 0,
      user: {
        display_name: profileRes.data?.display_name || "",
        exam_type: profileRes.data?.exam_type || "",
        exam_date: profileRes.data?.exam_date || "",
      },
      input_modes: [
        { key: "scan", label: "Scan", description: "Capture question with camera", icon: "📷" },
        { key: "text", label: "Type", description: "Type your question", icon: "✏️" },
        { key: "upload", label: "PDF", description: "Upload document/image", icon: "📄" },
        { key: "url", label: "URL", description: "Paste a web link", icon: "🌐" },
      ],
      recent_queries: (recentRes.data || []).map((q: any) => ({
        id: q.id,
        input_type: q.input_type,
        topic: q.detected_topic || "",
        subtopic: q.detected_subtopic || "",
        difficulty: q.detected_difficulty || "",
        short_answer: q.short_answer || "",
        confidence: q.confidence_score || 0,
        processing_time_ms: q.processing_time_ms || 0,
        created_at: q.created_at,
      })),
    },
  });
}

/* ═══════════════════════════════════════════
   ACTION: suggest — AI-generated practice questions
   ═══════════════════════════════════════════ */

async function handleSuggest(userId: string) {
  const [profileRes, subjectsRes, weakTopicsRes] = await Promise.all([
    adminClient.from("profiles").select("exam_type").eq("id", userId).maybeSingle(),
    adminClient.from("subjects").select("name").eq("user_id", userId).is("deleted_at", null).limit(6),
    adminClient.from("topics").select("name, memory_strength").eq("user_id", userId).is("deleted_at", null).order("memory_strength", { ascending: true }).limit(6),
  ]);

  const examType = profileRes.data?.exam_type || "General";
  const subjects = subjectsRes.data?.map((s: any) => s.name) || [];
  const weakTopics = weakTopicsRes.data?.map((t: any) => `${t.name}(${t.memory_strength || 0}%)`) || [];
  const seed = Math.floor(Math.random() * 100000);

  const prompt = `${examType} exam. Seed=${seed}. ${subjects.length ? `Subjects:${subjects.join(",")}.` : ""} ${weakTopics.length ? `Weak:${weakTopics.join(",")}.` : ""}
Generate 6 unique practice MCQs. Prioritize weak topics. Mix easy/medium/hard.
Return ONLY JSON array: [{"question":"...","subject":"...","topic":"...","difficulty":"easy|medium|hard"}]
Concise questions (1 line max). No markdown.`;

  const aiResult = await callAIWrapper(
    [{ role: "user", content: prompt }],
    "google/gemini-2.5-flash-lite",
    0.9, 600, 6000,
  );

  let suggestions: any[] = [];
  if (aiResult.ok && aiResult.text) {
    try {
      const cleaned = aiResult.text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
      const match = cleaned.match(/\[[\s\S]*\]/);
      suggestions = match ? JSON.parse(match[0]) : [];
    } catch { suggestions = []; }
  }

  // Fallback suggestions
  if (suggestions.length === 0) {
    suggestions = [
      { question: "What is the SI unit of force?", subject: "Physics", topic: "Units", difficulty: "easy" },
      { question: "What is the chemical formula of water?", subject: "Chemistry", topic: "Basic Chemistry", difficulty: "easy" },
      { question: "What is the powerhouse of the cell?", subject: "Biology", topic: "Cell Biology", difficulty: "easy" },
      { question: "Solve: 2x + 5 = 15", subject: "Math", topic: "Algebra", difficulty: "easy" },
      { question: "Who wrote the Indian Constitution?", subject: "Polity", topic: "Constitution", difficulty: "medium" },
      { question: "What causes seasons on Earth?", subject: "Geography", topic: "Earth Science", difficulty: "medium" },
    ];
  }

  return ok({
    success: true,
    suggestions,
    meta: {
      exam_type: examType,
      weak_topics_used: weakTopics.length,
      subjects_used: subjects.length,
    },
  });
}

/* ═══════════════════════════════════════════
   ACTION: solve — Full ALIS cognitive solve
   Supports: scan, text, upload (PDF), url
   ═══════════════════════════════════════════ */

async function handleSolve(userId: string, body: any) {
  const inferredInputType =
    body.input_type ||
    (body.image_base64 || body.file || body.image || body.pdf || body.document ? "upload" : body.url ? "url" : body.content ? "text" : "");

  const normalizedInputType = String(inferredInputType || "").trim().toLowerCase();
  const normalizedImageBase64 = body.image_base64 || body.file || body.image || body.pdf || body.document || "";
  const normalizedUrl = body.url || body.link || "";
  const normalizedContent = typeof body.content === "string" ? body.content : "";

  const input_type = normalizedInputType;
  const content = normalizedContent;
  const image_base64 = normalizedImageBase64;
  const url = normalizedUrl;

  if (!input_type) return err("Missing input_type (scan|text|upload|url)");
  if (!["scan", "text", "upload", "url"].includes(input_type)) return err("Invalid input_type. Use scan, text, upload, or url");
  if (!content && !image_base64 && !url) return err("Missing content, image_base64, or url");

  const today = new Date().toISOString().split("T")[0];

  // Parallel: config check + rate limit + profile + memory + recent queries
  const [configRes, countRes, profileRes, memoryRes, recentQueriesRes] = await Promise.all([
    adminClient.from("brainlens_config").select("is_enabled, max_daily_queries_per_user").single(),
    adminClient.from("brainlens_queries").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", `${today}T00:00:00Z`),
    adminClient.from("profiles").select("exam_type").eq("id", userId).maybeSingle(),
    adminClient.from("memory_scores").select("topic_id, score").eq("user_id", userId).order("recorded_at", { ascending: false }).limit(8),
    adminClient.from("brainlens_queries").select("detected_topic, cognitive_gap_type").eq("user_id", userId).eq("status", "completed").order("created_at", { ascending: false }).limit(3),
  ]);

  const config = configRes.data;
  if (!config?.is_enabled) return err("ALIS is currently disabled", 403);
  if ((countRes.count || 0) >= (config.max_daily_queries_per_user || 50)) return err("Daily query limit reached. Try again tomorrow.", 429);

  const startTime = Date.now();

  // Build question text based on input type
  let questionText = content || "";
  let resolvedInputType = input_type;

  // URL mode: extract content from URL description
  if (input_type === "url" && url && !content) {
    questionText = `Analyze and solve the question from this URL: ${url}`;
  }

  // Build system prompt
  const systemPrompt = buildALISPrompt(profileRes.data, memoryRes.data || [], recentQueriesRes.data || []);

  // Build messages
  const messages: any[] = [{ role: "system", content: systemPrompt }];

  if (image_base64) {
    // Scan or PDF upload with image
    messages.push({
      role: "user",
      content: [
        { type: "text", text: "Extract the question from this image. Solve it completely and return JSON." },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image_base64}` } },
      ],
    });
  } else {
    messages.push({ role: "user", content: `Solve:\n${questionText}` });
  }

  // Insert query record + call AI in parallel
  const [insertResult, aiResult] = await Promise.all([
    adminClient.from("brainlens_queries")
      .insert({
        user_id: userId,
        input_type: resolvedInputType,
        input_content: content || url || "[image]",
        status: "processing",
        alis_version: "v4.0",
      })
      .select("id")
      .single(),
    callAIWrapper(messages, "google/gemini-2.5-pro", 0.0, 4096, 45000),
  ]);

  const queryId = insertResult.data?.id;

  if (!aiResult.ok) {
    // Update failed status
    if (queryId) {
      adminClient.from("brainlens_queries").update({
        status: "failed",
        error_message: aiResult.error || "AI processing failed",
        processing_time_ms: Date.now() - startTime,
      }).eq("id", queryId).then(() => {});
    }
    return err("AI processing failed. Please try again.", 500);
  }

  // Parse AI response
  const parsed = parseALISResponse(aiResult.text || "");
  const processingTime = Date.now() - startTime;
  const confidence = parsed.confidence || 0.8;

  // Fire-and-forget DB update with all parsed fields
  if (queryId) {
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
    }).eq("id", queryId).then(() => {});
  }

  // Return complete response
  return ok({
    success: true,
    query_id: queryId || "",
    input_type: resolvedInputType,
    processing_time_ms: processingTime,

    // ── Core Answer ──
    answer: {
      short_answer: parsed.short_answer || "",
      step_by_step: parsed.step_by_step || [],
      concept_clarity: parsed.concept_clarity || "",
      option_elimination: parsed.option_elimination || "",
      shortcut_tricks: parsed.shortcut_tricks || "",
      confidence,
      cross_validation_note: parsed.cross_validation_note || "",
      explanation_depth: parsed.explanation_depth || "standard",
    },

    // ── Detection ──
    detection: {
      topic: parsed.detected_topic || "General",
      subtopic: parsed.detected_subtopic || "",
      difficulty: parsed.detected_difficulty || "medium",
      exam_type: parsed.detected_exam_type || "",
      extracted_question: image_base64 ? (parsed.extracted_question || questionText) : questionText,
    },

    // ── Cognitive Gap Analysis ──
    cognitive_gap: {
      type: parsed.cognitive_gap?.type || "conceptual_gap",
      code: parsed.cognitive_gap?.code || "CG-001",
      explanation: parsed.cognitive_gap?.explanation || "",
      severity: parsed.cognitive_gap?.severity || "medium",
    },

    // ── Micro Concepts & Knowledge Graph ──
    micro_concepts: {
      core: parsed.micro_concepts?.core || "",
      adjacent_nodes: parsed.micro_concepts?.adjacent_nodes || [],
      reinforcement_questions: parsed.micro_concepts?.reinforcement_questions || [],
    },

    // ── Exam Impact ──
    exam_impact: {
      topic_probability_index: parsed.exam_impact?.topic_probability_index || 0.5,
      estimated_mastery_boost: parsed.exam_impact?.estimated_mastery_boost || "5%",
      readiness_impact: parsed.exam_impact?.readiness_impact || "medium",
      related_pyq_patterns: parsed.exam_impact?.related_pyq_patterns || [],
    },

    // ── Pre-Query Predictions ──
    pre_query_predictions: {
      weak_concepts: parsed.pre_query_predictions?.weak_concepts || [],
      preventive_challenge: parsed.pre_query_predictions?.preventive_challenge || "",
      prediction_confidence: parsed.pre_query_predictions?.prediction_confidence || 0,
    },

    // ── Silent Repair Plan ──
    silent_repair_plan: {
      stealth_questions: parsed.silent_repair_plan?.stealth_questions || [],
      unstable_nodes: parsed.silent_repair_plan?.unstable_nodes || [],
      repair_strategy: parsed.silent_repair_plan?.repair_strategy || "",
    },

    // ── Future Style Questions ──
    future_style_questions: (parsed.future_style_questions || []).map((q: any) => ({
      question: q.question || "",
      difficulty: q.difficulty || "medium",
      exam_probability: q.exam_probability || 0,
      question_dna: q.question_dna || "",
      topic_momentum: q.topic_momentum || "",
    })),

    // ── Cognitive Drift ──
    cognitive_drift: {
      drift_detected: parsed.cognitive_drift?.drift_detected || false,
      drift_magnitude: parsed.cognitive_drift?.drift_magnitude || 0,
      drift_direction: parsed.cognitive_drift?.drift_direction || "",
      recalibration: parsed.cognitive_drift?.recalibration || "",
      spacing_adjustment: parsed.cognitive_drift?.spacing_adjustment || "",
    },

    // ── Personal Examiner ──
    personal_examiner: {
      trap_questions: (parsed.personal_examiner?.trap_questions || []).map((q: any) => ({
        question: q.question || "",
        trap_type: q.trap_type || "",
      })),
      conceptual_depth_score: parsed.personal_examiner?.conceptual_depth_score || 0,
      robustness_rating: parsed.personal_examiner?.robustness_rating || "developing",
    },

    // ── Strategic Mastery Index ──
    strategic_mastery_index: {
      smi_score: parsed.strategic_mastery_index?.smi_score || 0,
      multi_step_reasoning: parsed.strategic_mastery_index?.multi_step_reasoning || 0,
      transfer_learning: parsed.strategic_mastery_index?.transfer_learning || 0,
      trap_resistance: parsed.strategic_mastery_index?.trap_resistance || 0,
      mastery_verdict: parsed.strategic_mastery_index?.mastery_verdict || "",
    },

    // ── Strategy Switch ──
    strategy_switch: {
      recommended_mode: parsed.strategy_switch?.recommended_mode || "",
      reasoning: parsed.strategy_switch?.reasoning || "",
      urgency: parsed.strategy_switch?.urgency || "low",
    },
  });
}

/* ═══════════════════════════════════════════
   ACTION: history — Past queries with full data
   ═══════════════════════════════════════════ */

async function handleHistory(userId: string, body: any) {
  const limit = Math.min(body.limit || 20, 50);
  const offset = body.offset || 0;

  const { data: queries, count } = await adminClient
    .from("brainlens_queries")
    .select("id, input_type, input_content, extracted_text, detected_topic, detected_subtopic, detected_difficulty, detected_exam_type, short_answer, detailed_explanation, cognitive_gap_type, cognitive_gap_code, micro_concepts, reinforcement_questions, exam_impact, explanation_depth, confidence_score, cross_validated, knowledge_graph_node, pre_query_predictions, silent_repair_plan, future_style_questions, cognitive_drift, personal_examiner, strategic_mastery_index, strategy_switch, processing_time_ms, status, created_at", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const items = (queries || []).map((q: any) => ({
    id: q.id,
    input_type: q.input_type,
    input_content: q.input_content || "",
    status: q.status,
    created_at: q.created_at,
    processing_time_ms: q.processing_time_ms || 0,
    detection: {
      topic: q.detected_topic || "",
      subtopic: q.detected_subtopic || "",
      difficulty: q.detected_difficulty || "",
      exam_type: q.detected_exam_type || "",
      extracted_text: q.extracted_text || "",
    },
    answer: {
      short_answer: q.short_answer || "",
      step_by_step: q.detailed_explanation?.step_by_step || [],
      concept_clarity: q.detailed_explanation?.concept_clarity || "",
      option_elimination: q.detailed_explanation?.option_elimination || "",
      shortcut_tricks: q.detailed_explanation?.shortcut_tricks || "",
      confidence: q.confidence_score || 0,
      explanation_depth: q.explanation_depth || "standard",
    },
    cognitive_gap: {
      type: q.cognitive_gap_type || "",
      code: q.cognitive_gap_code || "",
    },
    micro_concepts: q.micro_concepts || {},
    exam_impact: q.exam_impact || {},
    knowledge_graph_node: q.knowledge_graph_node || {},
    future_style_questions: q.future_style_questions || [],
    cognitive_drift: q.cognitive_drift || {},
    personal_examiner: q.personal_examiner || {},
    strategic_mastery_index: q.strategic_mastery_index || {},
    strategy_switch: q.strategy_switch || {},
  }));

  return ok({
    success: true,
    total: count || 0,
    limit,
    offset,
    queries: items,
  });
}

/* ═══════════════════════════════════════════
   ACTION: stats — Usage analytics
   ═══════════════════════════════════════════ */

async function handleStats(userId: string) {
  const today = new Date().toISOString().split("T")[0];

  const [totalRes, todayRes, completedRes, topicsRes, gapsRes] = await Promise.all([
    adminClient.from("brainlens_queries").select("id", { count: "exact", head: true }).eq("user_id", userId),
    adminClient.from("brainlens_queries").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", `${today}T00:00:00Z`),
    adminClient.from("brainlens_queries").select("detected_topic, detected_difficulty, confidence_score, processing_time_ms, input_type").eq("user_id", userId).eq("status", "completed").order("created_at", { ascending: false }).limit(100),
  ]);

  const completed = completedRes.data || [];

  // Topic distribution
  const topicCounts: Record<string, number> = {};
  const difficultyCounts: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
  const inputTypeCounts: Record<string, number> = { scan: 0, text: 0, upload: 0, url: 0 };
  let totalConfidence = 0;
  let totalProcessingTime = 0;

  for (const q of completed) {
    const topic = q.detected_topic || "Other";
    topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    const diff = q.detected_difficulty || "medium";
    if (diff in difficultyCounts) difficultyCounts[diff]++;
    const iType = q.input_type || "text";
    if (iType in inputTypeCounts) inputTypeCounts[iType]++;
    totalConfidence += q.confidence_score || 0;
    totalProcessingTime += q.processing_time_ms || 0;
  }

  const topTopics = Object.entries(topicCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([topic, count]) => ({ topic, count }));

  return ok({
    success: true,
    stats: {
      total_queries: totalRes.count || 0,
      today_queries: todayRes.count || 0,
      completed_queries: completed.length,
      avg_confidence: completed.length > 0 ? Math.round((totalConfidence / completed.length) * 100) / 100 : 0,
      avg_processing_time_ms: completed.length > 0 ? Math.round(totalProcessingTime / completed.length) : 0,
      difficulty_distribution: difficultyCounts,
      input_type_distribution: inputTypeCounts,
      top_topics: topTopics,
    },
  });
}

/* ═══════════════════════════════════════════
   ALIS v4.0 System Prompt Builder
   ═══════════════════════════════════════════ */

function buildALISPrompt(profile: any, memoryScores: any[], recentQueries: any[]): string {
  const avgStr = memoryScores?.length
    ? (memoryScores.reduce((a: number, s: any) => a + (s.score || 0), 0) / memoryScores.length).toFixed(0)
    : null;
  const gaps = recentQueries?.map((q: any) => q.cognitive_gap_type).filter(Boolean).slice(0, 3) || [];

  return `You are a world-class subject matter expert and exam coach. Your answers MUST be 100% accurate. Follow these rules strictly:

ACCURACY PROTOCOL:
1. THINK step-by-step before answering. Show your complete reasoning chain.
2. VERIFY your answer by solving the problem using TWO different methods when possible.
3. If multiple-choice: eliminate wrong options with explicit reasoning for each.
4. If numerical: double-check every calculation step.
5. If conceptual: cite the exact principle/law/theorem with its standard definition.
6. Set confidence=1.0 ONLY if you are absolutely certain. Otherwise set lower and explain why in cross_validation_note.
7. In cross_validation_note, state your verification method and any edge cases considered.

Return ONLY raw JSON, no markdown/code fences.
short_answer: precise 1-2 sentence answer with the correct option/value stated clearly.
step_by_step: 3-6 steps, each showing clear reasoning. Include verification step.
concept_clarity: the core concept/formula/law used, stated precisely.
option_elimination: for MCQs, explain why each wrong option is wrong.
shortcut_tricks: exam-relevant shortcuts if applicable.

Keys:detected_topic,detected_subtopic,detected_difficulty(easy|medium|hard),detected_exam_type,short_answer,step_by_step[],concept_clarity,option_elimination,shortcut_tricks,cognitive_gap{type,code,explanation,severity},micro_concepts{core,adjacent_nodes[],reinforcement_questions[{question,difficulty}]},exam_impact{topic_probability_index,estimated_mastery_boost,readiness_impact,related_pyq_patterns[]},explanation_depth,confidence,cross_validation_note,pre_query_predictions{weak_concepts[],preventive_challenge,prediction_confidence},silent_repair_plan{stealth_questions[],unstable_nodes[],repair_strategy},future_style_questions[{question,difficulty,exam_probability}],cognitive_drift{drift_detected,drift_magnitude,recalibration},personal_examiner{trap_questions[{question,trap_type}],conceptual_depth_score,robustness_rating},strategic_mastery_index{smi_score,multi_step_reasoning,transfer_learning,trap_resistance},strategy_switch{recommended_mode,reasoning,urgency}
${profile?.exam_type ? `Exam:${profile.exam_type}.` : ""}${avgStr ? `Mem:${avgStr}%.` : ""}${gaps.length ? `Gaps:${gaps.join(",")}.` : ""}`;
}

/* ═══════════════════════════════════════════
   ALIS Response Parser (brace-matching)
   ═══════════════════════════════════════════ */

function parseALISResponse(rawText: string): any {
  if (!rawText || rawText.trim().length === 0) return fallbackResponse("Empty response");

  let cleaned = rawText.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();

  try { return JSON.parse(cleaned); } catch { /* continue */ }

  const jsonStart = cleaned.indexOf("{");
  if (jsonStart === -1) return fallbackResponse(rawText);

  // Brace-depth matching
  let depth = 0, inString = false, escape = false, endIdx = -1;
  for (let i = jsonStart; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (escape) { escape = false; continue; }
    if (c === '\\' && inString) { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
  }

  if (endIdx > jsonStart) {
    const extracted = cleaned.substring(jsonStart, endIdx + 1);
    try { return JSON.parse(extracted); } catch { /* continue */ }
  }

  // Repair truncated JSON
  let s = cleaned.substring(jsonStart);
  try { return JSON.parse(s); } catch { /* continue */ }

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
