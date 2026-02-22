import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSupabase(authHeader?: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: authHeader ? { Authorization: authHeader } : {} } }
  );
}

async function aiCall(prompt: string, systemPrompt: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_structured",
          description: "Return structured JSON output",
          parameters: {
            type: "object",
            properties: { result: { type: "object" } },
            required: ["result"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_structured" } },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    console.error("AI error:", res.status, t);
    throw new Error(`AI gateway error: ${res.status}`);
  }

  const json = await res.json();
  const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall) {
    return JSON.parse(toolCall.function.arguments).result;
  }
  // Fallback: parse content
  const content = json.choices?.[0]?.message?.content || "{}";
  const match = content.match(/[\[{][\s\S]*[\]}]/);
  return match ? JSON.parse(match[0]) : {};
}

// MODULE 1: Multi-Angle Analysis Generator
async function generateAnalysis(supabase: any, eventId: string | null, topicTitle: string, topicContext: string) {
  const systemPrompt = `You are an expert UPSC exam analyst specializing in multi-dimensional policy analysis for Mains and Interview preparation. Generate comprehensive, exam-oriented analysis.`;

  const prompt = `Analyze the following topic for UPSC Mains and Interview preparation:

Topic: ${topicTitle}
Context: ${topicContext}

Generate a complete multi-angle analysis with:
1. pro_arguments: Array of 4-5 strong arguments in favor (each with "point" and "explanation")
2. counter_arguments: Array of 4-5 strong counter-arguments (each with "point" and "explanation")
3. ethical_dimension: 2-3 paragraph analysis of ethical aspects
4. economic_dimension: 2-3 paragraph analysis of economic impact
5. constitutional_link: Constitutional provisions, articles, and legal framework connections
6. international_perspective: How other countries handle this, international treaties/agreements
7. exam_relevance_score: 0-100 score for exam relevance

Return as JSON with these exact keys.`;

  const result = await aiCall(prompt, systemPrompt);

  const { data, error } = await supabase.from("ca_debate_analyses").insert({
    event_id: eventId || null,
    topic_title: topicTitle,
    topic_context: topicContext,
    pro_arguments: result.pro_arguments || [],
    counter_arguments: result.counter_arguments || [],
    ethical_dimension: result.ethical_dimension || "",
    economic_dimension: result.economic_dimension || "",
    constitutional_link: result.constitutional_link || "",
    international_perspective: result.international_perspective || "",
    exam_relevance_score: result.exam_relevance_score || 0,
    status: "generated",
  }).select().single();

  if (error) throw error;
  return data;
}

// MODULE 2: Framework Application
async function applyFrameworks(supabase: any, debateAnalysisId: string) {
  // Get the debate analysis
  const { data: analysis, error: fetchErr } = await supabase
    .from("ca_debate_analyses")
    .select("*")
    .eq("id", debateAnalysisId)
    .single();
  if (fetchErr) throw fetchErr;

  const frameworks = ["pestle", "stakeholder", "cost_benefit", "long_short_term"];
  const results = [];

  for (const fw of frameworks) {
    const systemPrompt = `You are an expert in structured reasoning frameworks for UPSC exam preparation.`;

    const promptMap: Record<string, string> = {
      pestle: `Apply PESTLE analysis to: "${analysis.topic_title}"
Context: ${analysis.topic_context}
Generate JSON with keys: political, economic, social, technological, legal, environmental. Each should be an object with "impact" (text), "severity" (high/medium/low), and "exam_angle" (how it may be asked in exam).`,

      stakeholder: `Apply Stakeholder Mapping to: "${analysis.topic_title}"
Context: ${analysis.topic_context}
Generate JSON with key "stakeholders": array of objects with "name", "interest" (text), "influence" (high/medium/low), "impact" (positive/negative/neutral), "exam_relevance" (text).`,

      cost_benefit: `Apply Cost-Benefit Analysis to: "${analysis.topic_title}"
Context: ${analysis.topic_context}
Generate JSON with keys: "costs" (array of {"item", "description", "magnitude": high/medium/low}), "benefits" (same format), "net_assessment" (text), "recommendation" (text).`,

      long_short_term: `Apply Long-term vs Short-term Analysis to: "${analysis.topic_title}"
Context: ${analysis.topic_context}
Generate JSON with keys: "short_term" (array of {"effect", "timeframe", "certainty": high/medium/low}), "long_term" (same format), "trade_offs" (text), "strategic_recommendation" (text).`,
    };

    const result = await aiCall(promptMap[fw], systemPrompt);

    const { data: fwData, error: fwErr } = await supabase.from("ca_framework_applications").insert({
      debate_analysis_id: debateAnalysisId,
      framework_type: fw,
      framework_data: result,
      ai_summary: result.net_assessment || result.strategic_recommendation || result.trade_offs || "",
      quality_score: 85,
    }).select().single();

    if (fwErr) throw fwErr;
    results.push(fwData);
  }

  // Update debate analysis with frameworks applied
  await supabase.from("ca_debate_analyses").update({
    frameworks_applied: frameworks,
    status: "frameworks_applied",
  }).eq("id", debateAnalysisId);

  return results;
}

// MODULE 3: Writing Evaluator
async function evaluateWriting(supabase: any, userId: string, debateAnalysisId: string | null, topicTitle: string, userAnswer: string, timeTaken?: number) {
  const systemPrompt = `You are an expert UPSC Mains answer evaluator. Evaluate the student's answer rigorously on structure, depth, evidence, clarity, and logical flow. Provide constructive feedback.`;

  const prompt = `Evaluate this UPSC Mains answer:

Topic: ${topicTitle}
Word Count: ${userAnswer.split(/\s+/).length}
${timeTaken ? `Time Taken: ${Math.floor(timeTaken / 60)} minutes` : ""}

Student's Answer:
---
${userAnswer}
---

Evaluate and return JSON with:
1. structure_score: 0-10 (introduction, body paragraphs, conclusion)
2. depth_score: 0-10 (analysis depth, multiple dimensions covered)
3. evidence_score: 0-10 (facts, data, examples, case studies cited)
4. clarity_score: 0-10 (language precision, readability)
5. logical_flow_score: 0-10 (argument progression, coherence)
6. overall_score: 0-10 (weighted average)
7. ai_feedback: Detailed 3-4 paragraph feedback
8. improvement_areas: Array of specific areas to improve (strings)
9. strengths: Array of strengths identified (strings)
10. model_answer: A model answer for this topic (300-400 words)`;

  const result = await aiCall(prompt, systemPrompt);

  const wordCount = userAnswer.split(/\s+/).length;

  const { data, error } = await supabase.from("ca_writing_evaluations").insert({
    user_id: userId,
    debate_analysis_id: debateAnalysisId,
    topic_title: topicTitle,
    user_answer: userAnswer,
    word_count: wordCount,
    time_taken_seconds: timeTaken || null,
    structure_score: result.structure_score || 0,
    depth_score: result.depth_score || 0,
    evidence_score: result.evidence_score || 0,
    clarity_score: result.clarity_score || 0,
    logical_flow_score: result.logical_flow_score || 0,
    overall_score: result.overall_score || 0,
    ai_feedback: result.ai_feedback || "",
    improvement_areas: result.improvement_areas || [],
    strengths: result.strengths || [],
    model_answer: result.model_answer || "",
    evaluated_at: new Date().toISOString(),
  }).select().single();

  if (error) throw error;
  return data;
}

// Dashboard
async function getDashboard(supabase: any) {
  const [analyses, frameworks, evaluations] = await Promise.all([
    supabase.from("ca_debate_analyses").select("id, status, exam_relevance_score, created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("ca_framework_applications").select("id, framework_type, quality_score"),
    supabase.from("ca_writing_evaluations").select("id, overall_score, created_at").order("created_at", { ascending: false }).limit(100),
  ]);

  const totalAnalyses = analyses.data?.length || 0;
  const totalFrameworks = frameworks.data?.length || 0;
  const totalEvaluations = evaluations.data?.length || 0;
  const avgWritingScore = evaluations.data?.length
    ? (evaluations.data.reduce((s: number, e: any) => s + (e.overall_score || 0), 0) / evaluations.data.length).toFixed(1)
    : "0";

  return {
    totalAnalyses,
    totalFrameworks,
    totalEvaluations,
    avgWritingScore,
    recentAnalyses: analyses.data?.slice(0, 5) || [],
    recentEvaluations: evaluations.data?.slice(0, 5) || [],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = getSupabase(authHeader);
    const { action, ...params } = await req.json();

    let result;
    switch (action) {
      case "generate_analysis":
        result = await generateAnalysis(supabase, params.event_id, params.topic_title, params.topic_context);
        break;
      case "apply_frameworks":
        result = await applyFrameworks(supabase, params.debate_analysis_id);
        break;
      case "evaluate_writing":
        result = await evaluateWriting(supabase, params.user_id, params.debate_analysis_id, params.topic_title, params.user_answer, params.time_taken_seconds);
        break;
      case "get_dashboard":
        result = await getDashboard(supabase);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ca-debate-engine error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
