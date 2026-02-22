import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiFetch } from "../_shared/aiFetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

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
    if (authErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { action, ...params } = await req.json();

    switch (action) {
      case "extract_entities":
        return await extractEntities(supabase, params);
      case "build_graph":
        return await buildKnowledgeGraph(supabase, params);
      case "link_syllabus":
        return await linkSyllabus(supabase, params);
      case "generate_questions":
        return await generateQuestions(supabase, params);
      case "full_pipeline":
        return await fullPipeline(supabase, params);
      case "get_dashboard":
        return await getDashboard(supabase, params);
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
    }
  } catch (e) {
    console.error("CA Intelligence error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function jsonResp(data: any) {
  return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
      max_tokens: 4000,
    }),
  });
  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || "";
  const match = text.match(/[\[{][\s\S]*[\]}]/);
  return match ? JSON.parse(match[0]) : null;
}

// ─── MODULE 1: ENTITY EXTRACTION ───
async function extractEntities(supabase: any, params: any) {
  const { event_id } = params;
  const { data: event } = await supabase.from("ca_events").select("*").eq("id", event_id).single();
  if (!event) return jsonResp({ error: "Event not found" });

  const content = event.raw_content || event.summary || event.title;

  const entities = await aiCall(
    `You are an NLP entity extraction engine for exam preparation. Extract structured entities from news content.
Return a JSON array of objects with: name, entity_type (one of: policy, scheme, govt_body, constitutional_article, act, location, economic_indicator, person, organization), description, relevance_score (0-1).`,
    `Extract all exam-relevant entities from this news:\n\nTitle: ${event.title}\n\nContent: ${content}`
  );

  if (!entities || !Array.isArray(entities)) return jsonResp({ error: "AI extraction failed" });

  let insertedCount = 0;
  for (const ent of entities) {
    // Upsert entity
    const { data: existing } = await supabase.from("ca_entities")
      .select("id").eq("name", ent.name).eq("entity_type", ent.entity_type).maybeSingle();

    let entityId: string;
    if (existing) {
      entityId = existing.id;
      await supabase.from("ca_entities").update({
        occurrence_count: (existing.occurrence_count || 1) + 1,
        last_seen_at: new Date().toISOString(),
      }).eq("id", entityId);
    } else {
      const { data: newEnt } = await supabase.from("ca_entities").insert({
        name: ent.name,
        entity_type: ent.entity_type,
        description: ent.description,
      }).select("id").single();
      entityId = newEnt?.id;
    }

    if (entityId) {
      await supabase.from("ca_event_entities").upsert({
        event_id, entity_id: entityId,
        relevance_score: ent.relevance_score || 0.5,
        context_snippet: ent.description?.substring(0, 200),
      }, { onConflict: "event_id,entity_id" });
      insertedCount++;
    }
  }

  await supabase.from("ca_events").update({
    entity_count: insertedCount,
    processing_status: "entities_extracted",
    ai_analysis: { ...(event.ai_analysis || {}), entities_extracted_at: new Date().toISOString() },
  }).eq("id", event_id);

  return jsonResp({ success: true, count: insertedCount, entities });
}

// ─── MODULE 2: KNOWLEDGE GRAPH ───
async function buildKnowledgeGraph(supabase: any, params: any) {
  const { event_id } = params;
  const { data: event } = await supabase.from("ca_events").select("*").eq("id", event_id).single();
  if (!event) return jsonResp({ error: "Event not found" });

  const { data: entities } = await supabase.from("ca_event_entities")
    .select("*, ca_entities(*)").eq("event_id", event_id);

  const entityNames = (entities || []).map((e: any) => e.ca_entities?.name).filter(Boolean);

  const graph = await aiCall(
    `You are a knowledge graph builder for exam preparation. Create connections between this news event and:
1. Static syllabus topics (edge_type: "syllabus")
2. Historical context (edge_type: "historical")
3. Previous year question patterns (edge_type: "pyq")
4. Related policies/acts (edge_type: "policy")
5. Economic or social impact (edge_type: "impact")

Return JSON array of: { edge_type, target_label, weight (0-1), description }`,
    `Event: ${event.title}\nSummary: ${event.summary || ""}\nEntities: ${entityNames.join(", ")}`
  );

  if (!graph || !Array.isArray(graph)) return jsonResp({ error: "Graph generation failed" });

  const edges = graph.map((e: any) => ({
    event_id,
    edge_type: e.edge_type,
    target_label: e.target_label,
    weight: e.weight || 0.5,
    description: e.description,
  }));

  // Clear old edges and insert new
  await supabase.from("ca_graph_edges").delete().eq("event_id", event_id);
  const { error } = await supabase.from("ca_graph_edges").insert(edges);
  if (error) console.error("Graph insert error:", error);

  return jsonResp({ success: true, count: edges.length, edges });
}

// ─── MODULE 3: SYLLABUS LINKING ───
async function linkSyllabus(supabase: any, params: any) {
  const { event_id, exam_type = "UPSC" } = params;
  const { data: event } = await supabase.from("ca_events").select("*").eq("id", event_id).single();
  if (!event) return jsonResp({ error: "Event not found" });

  const { data: entities } = await supabase.from("ca_event_entities")
    .select("*, ca_entities(*)").eq("event_id", event_id);
  const entityNames = (entities || []).map((e: any) => e.ca_entities?.name).filter(Boolean);

  const links = await aiCall(
    `You are a syllabus mapping engine for ${exam_type} exam. Map this news event to specific micro-topics in the syllabus.
For each link, detect if there is a repeated pattern (same topic appearing in news multiple times = higher exam probability).
Return JSON array of: { subject, micro_topic, relevance_score (0-1), tpi_impact (0-1, how much this changes Topic Probability Index), pattern_detected (boolean), pattern_details (string) }`,
    `Event: ${event.title}\nSummary: ${event.summary || ""}\nEntities: ${entityNames.join(", ")}\nExam: ${exam_type}`
  );

  if (!links || !Array.isArray(links)) return jsonResp({ error: "Syllabus linking failed" });

  await supabase.from("ca_syllabus_links").delete().eq("event_id", event_id);
  const rows = links.map((l: any) => ({
    event_id, exam_type,
    subject: l.subject,
    micro_topic: l.micro_topic,
    relevance_score: l.relevance_score || 0.5,
    tpi_impact: l.tpi_impact || 0,
    pattern_detected: l.pattern_detected || false,
    pattern_details: l.pattern_details,
  }));
  await supabase.from("ca_syllabus_links").insert(rows);

  await supabase.from("ca_events").update({ syllabus_link_count: rows.length }).eq("id", event_id);

  return jsonResp({ success: true, count: rows.length, links });
}

// ─── MODULE 4: QUESTION GENERATION ───
async function generateQuestions(supabase: any, params: any) {
  const { event_id, exam_type = "UPSC" } = params;
  const { data: event } = await supabase.from("ca_events").select("*").eq("id", event_id).single();
  if (!event) return jsonResp({ error: "Event not found" });

  const { data: sylLinks } = await supabase.from("ca_syllabus_links").select("*").eq("event_id", event_id);
  const topics = (sylLinks || []).map((l: any) => `${l.subject}: ${l.micro_topic}`).join(", ");

  const questions = await aiCall(
    `You are an exam question generator for ${exam_type}. Generate exam-ready questions from this current affairs event.
Generate exactly:
1. Two Prelims MCQs (question_type: "prelims_mcq", marks: 2, with 4 options as JSON array, correct_answer as option text)
2. One Mains 10-mark question (question_type: "mains_10", marks: 10)
3. One Mains 15-mark question (question_type: "mains_15", marks: 15)
4. One Interview discussion prompt (question_type: "interview", marks: 0)

Return JSON array of: { question_type, question_text, options (array of strings, MCQ only), correct_answer (MCQ only), explanation, difficulty (easy/moderate/hard), cognitive_level (factual/conceptual/application/analytical), marks }`,
    `Event: ${event.title}\nSummary: ${event.summary || ""}\nMapped Topics: ${topics}\nExam: ${exam_type}`
  );

  if (!questions || !Array.isArray(questions)) return jsonResp({ error: "Question generation failed" });

  const rows = questions.map((q: any) => ({
    event_id, exam_type,
    question_type: q.question_type,
    question_text: q.question_text,
    options: q.options ? q.options : null,
    correct_answer: q.correct_answer,
    explanation: q.explanation,
    difficulty: q.difficulty || "moderate",
    cognitive_level: q.cognitive_level || "application",
    marks: q.marks || 0,
    status: "draft",
  }));

  await supabase.from("ca_generated_questions").insert(rows);
  await supabase.from("ca_events").update({ question_count: (event.question_count || 0) + rows.length }).eq("id", event_id);

  return jsonResp({ success: true, count: rows.length, questions });
}

// ─── FULL PIPELINE ───
async function fullPipeline(supabase: any, params: any) {
  const { event_id, exam_type = "UPSC" } = params;

  await supabase.from("ca_events").update({ processing_status: "processing" }).eq("id", event_id);

  const e1 = await extractEntities(supabase, { event_id });
  const e1Data = await e1.json();
  if (!e1Data.success) return jsonResp({ error: "Entity extraction failed", details: e1Data });

  const e2 = await buildKnowledgeGraph(supabase, { event_id });
  const e2Data = await e2.json();

  const e3 = await linkSyllabus(supabase, { event_id, exam_type });
  const e3Data = await e3.json();

  const e4 = await generateQuestions(supabase, { event_id, exam_type });
  const e4Data = await e4.json();

  await supabase.from("ca_events").update({ processing_status: "completed" }).eq("id", event_id);

  return jsonResp({
    success: true,
    entities: e1Data.count,
    graph_edges: e2Data.count,
    syllabus_links: e3Data.count,
    questions: e4Data.count,
  });
}

// ─── DASHBOARD ───
async function getDashboard(supabase: any, params: any) {
  const { exam_type } = params;

  const [events, entities, graphEdges, syllabusLinks, questions] = await Promise.all([
    supabase.from("ca_events").select("*", { count: "exact" }).order("created_at", { ascending: false }).limit(20),
    supabase.from("ca_entities").select("*", { count: "exact" }),
    supabase.from("ca_graph_edges").select("*", { count: "exact" }),
    supabase.from("ca_syllabus_links").select("*", { count: "exact" }),
    supabase.from("ca_generated_questions").select("*", { count: "exact" }),
  ]);

  const entityTypes: Record<string, number> = {};
  (entities.data || []).forEach((e: any) => {
    entityTypes[e.entity_type] = (entityTypes[e.entity_type] || 0) + 1;
  });

  const edgeTypes: Record<string, number> = {};
  (graphEdges.data || []).forEach((e: any) => {
    edgeTypes[e.edge_type] = (edgeTypes[e.edge_type] || 0) + 1;
  });

  return jsonResp({
    events: { data: events.data, count: events.count },
    entities: { count: entities.count, by_type: entityTypes },
    graph_edges: { count: graphEdges.count, by_type: edgeTypes },
    syllabus_links: { count: syllabusLinks.count },
    questions: { count: questions.count },
  });
}
