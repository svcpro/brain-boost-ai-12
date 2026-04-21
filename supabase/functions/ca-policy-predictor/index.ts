import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiFetch } from "../_shared/aiFetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResp({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authErr } = await anonClient.auth.getClaims(token);
    if (authErr || !claims?.claims?.sub) return jsonResp({ error: "Unauthorized" }, 401);

    const { action, ...params } = await req.json();

    switch (action) {
      case "analyze_policy": return await analyzePolicy(supabase, params);
      case "get_dashboard": return await getDashboard(supabase, params);
      case "apply_adjustments": return await applyAdjustments(supabase, params);
      case "revert_adjustments": return await revertAdjustments(supabase, params);
      default: return jsonResp({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    console.error("CA 3.0 error:", e);
    return jsonResp({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function jsonResp(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function aiCall(systemPrompt: string, userPrompt: string) {
  const resp = await aiFetch({
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 6000,
    }),
  });
  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || "";
  const match = text.match(/[\[{][\s\S]*[\]}]/);
  return match ? JSON.parse(match[0]) : null;
}

// ─── FULL POLICY ANALYSIS PIPELINE ───
async function analyzePolicy(supabase: any, params: any) {
  const { event_id, exam_types = ["UPSC CSE"] } = params;

  // Get event
  const { data: event } = await supabase.from("ca_events").select("*").eq("id", event_id).single();
  if (!event) return jsonResp({ error: "Event not found" }, 404);

  const content = event.raw_content || event.summary || event.title;

  // Step 1: Create policy analysis record
  const { data: analysis, error: aErr } = await supabase.from("ca_policy_analyses").insert({
    event_id,
    policy_title: event.title,
    policy_summary: event.summary,
    policy_category: event.category,
    exam_types,
    similarity_scan_status: "processing",
    impact_scan_status: "pending",
  }).select().single();

  if (aErr || !analysis) return jsonResp({ error: "Failed to create analysis", details: aErr }, 500);
  const analysisId = analysis.id;

  // ── MODULE 1: POLICY SIMILARITY ENGINE ──
  console.log("[CA 3.0] Running similarity engine...");
  const similarities = await aiCall(
    `You are a Policy Similarity Engine for competitive exam intelligence. Given a new policy/event, find historically similar policies/events that appeared in exams.

For each match provide:
- historical_policy_name: Name of the similar historical policy/event
- historical_policy_year: Approximate year
- similarity_score: 0-1 (how similar)
- match_dimensions: JSON object with keys "structural" (same type of policy), "thematic" (same theme), "constitutional" (same legal basis), "economic" (same economic impact) — each 0-1
- pattern_type: "recurring", "cyclical", "precedent", "reform_chain"
- exam_appearance_count: estimated times this pattern appeared in exams

Return JSON array of 3-8 matches, sorted by similarity_score descending.`,
    `New Policy/Event:\nTitle: ${event.title}\nSummary: ${content}\nCategory: ${event.category || "general"}`
  );

  let simCount = 0;
  if (Array.isArray(similarities)) {
    const simRows = similarities.map((s: any) => ({
      policy_analysis_id: analysisId,
      historical_policy_name: s.historical_policy_name,
      historical_policy_year: s.historical_policy_year,
      similarity_score: Math.min(1, Math.max(0, s.similarity_score || 0)),
      match_dimensions: s.match_dimensions || {},
      pattern_type: s.pattern_type || "precedent",
      exam_appearance_count: s.exam_appearance_count || 0,
    }));
    await supabase.from("ca_policy_similarities").insert(simRows);
    simCount = simRows.length;

    const topScore = Math.max(...simRows.map((s: any) => s.similarity_score));
    await supabase.from("ca_policy_analyses").update({
      similarity_scan_status: "completed",
      top_similarity_score: topScore,
      impact_scan_status: "processing",
    }).eq("id", analysisId);
  }

  // ── MODULE 2: IMPACT FORECAST MODEL ──
  console.log("[CA 3.0] Running impact forecast...");
  const impact = await aiCall(
    `You are an Impact Forecast Model for exam intelligence. Predict the exam impact of this policy/event.

Classify impacts as:
1. "direct" — topics directly affected
2. "indirect_ripple" — topics indirectly affected (second/third-order effects)
3. "controversy" — controversial angles that examiners love

For each impact provide:
- impact_type: "direct" | "indirect_ripple" | "controversy"
- topic_name: The affected topic
- subject: Subject area (Polity, Economy, Environment, Science, Geography, History, Society, International Relations)
- predicted_tpi_shift: 0-1 how much this increases Topic Probability Index
- confidence: 0-1
- time_horizon: "immediate" | "3_months" | "6_months" | "1_year"
- reasoning: Why this topic is affected
- micro_topics: Array of 2-4 related micro-topics

Also produce a meta-analysis:
- controversy_likelihood: 0-1
- predicted_exam_framing: How examiners will frame questions
- question_probability_increase: percentage increase in question probability (0-100)

Return JSON object: { impacts: [...], meta: { controversy_likelihood, predicted_exam_framing, question_probability_increase } }`,
    `Policy: ${event.title}\nContent: ${content}\nCategory: ${event.category}\nExam Types: ${exam_types.join(", ")}\n\nHistorical Similarities: ${JSON.stringify(similarities?.slice(0, 3) || [])}`
  );

  let impactCount = 0;
  if (impact) {
    const impacts = impact.impacts || impact;
    const meta = impact.meta || {};

    if (Array.isArray(impacts)) {
      const impactRows = impacts.map((f: any) => ({
        policy_analysis_id: analysisId,
        impact_type: f.impact_type || "direct",
        topic_name: f.topic_name,
        subject: f.subject,
        predicted_tpi_shift: Math.min(1, Math.max(0, f.predicted_tpi_shift || 0)),
        confidence: Math.min(1, Math.max(0, f.confidence || 0)),
        time_horizon: f.time_horizon || "immediate",
        reasoning: f.reasoning,
        micro_topics: f.micro_topics || [],
      }));
      await supabase.from("ca_impact_forecasts").insert(impactRows);
      impactCount = impactRows.length;
    }

    await supabase.from("ca_policy_analyses").update({
      impact_scan_status: "completed",
      overall_impact_score: Math.max(...(Array.isArray(impacts) ? impacts.map((i: any) => i.predicted_tpi_shift || 0) : [0])),
      controversy_likelihood: meta.controversy_likelihood || 0,
      predicted_exam_framing: meta.predicted_exam_framing || "",
      question_probability_increase: meta.question_probability_increase || 0,
      ai_reasoning: meta.predicted_exam_framing,
    }).eq("id", analysisId);
  }

  // ── MODULE 3: PROBABILITY ADJUSTMENTS ──
  console.log("[CA 3.0] Generating probability adjustments...");
  const impacts = impact?.impacts || impact || [];
  if (Array.isArray(impacts)) {
    const adjustments = impacts
      .filter((f: any) => (f.predicted_tpi_shift || 0) > 0.05)
      .map((f: any) => ({
        policy_analysis_id: analysisId,
        exam_type: exam_types[0] || "UPSC CSE",
        subject: f.subject,
        topic_name: f.topic_name,
        old_probability: f.current_tpi || 0,
        new_probability: Math.min(1, (f.current_tpi || 0) + (f.predicted_tpi_shift || 0)),
        adjustment_reason: f.reasoning || `Policy impact from: ${event.title}`,
        status: "pending",
      }));

    if (adjustments.length > 0) {
      await supabase.from("ca_probability_adjustments").insert(adjustments);
    }
  }

  return jsonResp({
    success: true,
    analysis_id: analysisId,
    similarities: simCount,
    impacts: impactCount,
    status: "completed",
  });
}

// ─── APPLY ADJUSTMENTS TO TPI ───
async function applyAdjustments(supabase: any, params: any) {
  const { analysis_id } = params;

  const { data: adjs } = await supabase.from("ca_probability_adjustments")
    .select("*")
    .eq("policy_analysis_id", analysis_id)
    .eq("status", "pending");

  if (!adjs || adjs.length === 0) return jsonResp({ applied: 0 });

  let applied = 0;
  for (const adj of adjs) {
    // Try to update exam_intel_topic_scores if table exists
    try {
      if (adj.topic_id) {
        await supabase.from("exam_intel_topic_scores").update({
          probability_score: adj.new_probability,
        }).eq("topic_id", adj.topic_id);
      }
    } catch { /* table may not exist for all topics */ }

    await supabase.from("ca_probability_adjustments").update({
      status: "applied",
      applied_at: new Date().toISOString(),
    }).eq("id", adj.id);
    applied++;
  }

  return jsonResp({ success: true, applied });
}

// ─── REVERT ADJUSTMENTS ───
async function revertAdjustments(supabase: any, params: any) {
  const { analysis_id } = params;

  const { data: adjs } = await supabase.from("ca_probability_adjustments")
    .select("*")
    .eq("policy_analysis_id", analysis_id)
    .eq("status", "applied");

  if (!adjs || adjs.length === 0) return jsonResp({ reverted: 0 });

  let reverted = 0;
  for (const adj of adjs) {
    if (adj.topic_id) {
      try {
        await supabase.from("exam_intel_topic_scores").update({
          probability_score: adj.old_probability,
        }).eq("topic_id", adj.topic_id);
      } catch {}
    }
    await supabase.from("ca_probability_adjustments").update({ status: "reverted" }).eq("id", adj.id);
    reverted++;
  }

  return jsonResp({ success: true, reverted });
}

// ─── DASHBOARD ───
async function getDashboard(supabase: any, _params: any) {
  const [analyses, similarities, forecasts, adjustments] = await Promise.all([
    supabase.from("ca_policy_analyses").select("*", { count: "exact" }).order("created_at", { ascending: false }).limit(20),
    supabase.from("ca_policy_similarities").select("*", { count: "exact" }),
    supabase.from("ca_impact_forecasts").select("*", { count: "exact" }),
    supabase.from("ca_probability_adjustments").select("*", { count: "exact" }),
  ]);

  const appliedCount = (adjustments.data || []).filter((a: any) => a.status === "applied").length;
  const pendingCount = (adjustments.data || []).filter((a: any) => a.status === "pending").length;

  // Impact type distribution
  const impactDist: Record<string, number> = {};
  (forecasts.data || []).forEach((f: any) => {
    impactDist[f.impact_type] = (impactDist[f.impact_type] || 0) + 1;
  });

  return jsonResp({
    analyses: { data: analyses.data, count: analyses.count },
    similarities: { count: similarities.count },
    forecasts: { count: forecasts.count, by_type: impactDist },
    adjustments: { count: adjustments.count, applied: appliedCount, pending: pendingCount },
  });
}
