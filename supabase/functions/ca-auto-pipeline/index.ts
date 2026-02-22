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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse request body for manual trigger flag
    let forceRun = false;
    try {
      const body = await req.json();
      forceRun = body?.force === true;
    } catch { /* no body is fine */ }

    // Check if autopilot is enabled (skip check if force triggered)
    const { data: config } = await supabase
      .from("ca_autopilot_config")
      .select("*")
      .limit(1)
      .single();

    if (!forceRun && !config?.is_enabled) {
      return jsonResp({ skipped: true, reason: "Autopilot disabled" });
    }

    const categories = config?.categories || ["polity", "economy", "science", "environment", "international"];
    const examTypes = config?.exam_types || ["UPSC CSE"];

    console.log("CA Auto Pipeline: Starting auto-fetch for categories:", categories);

    // Step 1: Use AI to generate current affairs events
    const events = await fetchNewsViaAI(categories);
    if (!events || events.length === 0) {
      return jsonResp({ success: true, events_fetched: 0, message: "No new events found" });
    }

    console.log(`CA Auto Pipeline: Fetched ${events.length} events`);

    let totalEventsInserted = 0;
    let totalQuestionsGenerated = 0;

    for (const event of events) {
      // Check for duplicate by title similarity
      const { data: existing } = await supabase
        .from("ca_events")
        .select("id")
        .ilike("title", `%${event.title.substring(0, 40)}%`)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`Skipping duplicate: ${event.title}`);
        continue;
      }

      // Insert event
      const { data: inserted, error: insertErr } = await supabase
        .from("ca_events")
        .insert({
          title: event.title,
          summary: event.summary,
          raw_content: event.raw_content || event.summary,
          category: event.category,
          source_name: "AI Auto-Fetch",
          source_url: event.source_url || null,
          source: "auto",
          processing_status: "processing",
          event_date: new Date().toISOString().split("T")[0],
        })
        .select("id")
        .single();

      if (insertErr || !inserted) {
        console.error("Insert error:", insertErr);
        continue;
      }

      totalEventsInserted++;
      const eventId = inserted.id;

      // Step 2: Extract entities
      try {
        const entities = await aiCall(
          `You are an NLP entity extraction engine for exam preparation. Extract structured entities from news content.
Return a JSON array of objects with: name, entity_type (one of: policy, scheme, govt_body, constitutional_article, act, location, economic_indicator, person, organization), description, relevance_score (0-1).`,
          `Extract all exam-relevant entities from this news:\n\nTitle: ${event.title}\n\nContent: ${event.summary}`
        );

        if (entities && Array.isArray(entities)) {
          let entityCount = 0;
          for (const ent of entities) {
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
                name: ent.name, entity_type: ent.entity_type, description: ent.description,
              }).select("id").single();
              entityId = newEnt?.id;
            }

            if (entityId) {
              await supabase.from("ca_event_entities").upsert({
                event_id: eventId, entity_id: entityId,
                relevance_score: ent.relevance_score || 0.5,
                context_snippet: ent.description?.substring(0, 200),
              }, { onConflict: "event_id,entity_id" });
              entityCount++;
            }
          }
          await supabase.from("ca_events").update({
            entity_count: entityCount,
            processing_status: "entities_extracted",
          }).eq("id", eventId);
        }
      } catch (e) { console.error("Entity extraction error:", e); }

      // Step 3: Build knowledge graph
      try {
        const graph = await aiCall(
          `You are a knowledge graph builder for exam preparation. Create connections between this news event and:
1. Static syllabus topic (edge_type: "syllabus")
2. Historical context (edge_type: "historical")
3. Previous year question patterns (edge_type: "pyq")
4. Related policies/acts (edge_type: "policy")
5. Economic or social impact (edge_type: "impact")
Return JSON array of: { edge_type, target_label, weight (0-1), description }`,
          `Event: ${event.title}\nSummary: ${event.summary}`
        );

        if (graph && Array.isArray(graph)) {
          await supabase.from("ca_graph_edges").insert(
            graph.map((e: any) => ({
              event_id: eventId, edge_type: e.edge_type,
              target_label: e.target_label, weight: e.weight || 0.5, description: e.description,
            }))
          );
        }
      } catch (e) { console.error("Graph build error:", e); }

      // Step 4: Syllabus linking for each exam type
      for (const examType of examTypes) {
        try {
          const links = await aiCall(
            `You are a syllabus mapping engine for ${examType} exam. Map this news event to specific micro-topics.
Return JSON array of: { subject, micro_topic, relevance_score (0-1), tpi_impact (0-1), pattern_detected (boolean), pattern_details (string) }`,
            `Event: ${event.title}\nSummary: ${event.summary}\nExam: ${examType}`
          );

          if (links && Array.isArray(links)) {
            await supabase.from("ca_syllabus_links").insert(
              links.map((l: any) => ({
                event_id: eventId, exam_type: examType,
                subject: l.subject, micro_topic: l.micro_topic,
                relevance_score: l.relevance_score || 0.5,
                tpi_impact: l.tpi_impact || 0,
                pattern_detected: l.pattern_detected || false,
                pattern_details: l.pattern_details,
              }))
            );
            await supabase.from("ca_events").update({ syllabus_link_count: links.length }).eq("id", eventId);
          }
        } catch (e) { console.error("Syllabus link error:", e); }

        // Step 5: Generate questions
        try {
          const questions = await aiCall(
            `You are an exam question generator for ${examType}. Generate exam-ready questions.
Generate exactly:
1. Two Prelims MCQs (question_type: "prelims_mcq", marks: 2, with 4 options as JSON array, correct_answer as option text)
2. One Mains 10-mark question (question_type: "mains_10", marks: 10)
3. One Mains 15-mark question (question_type: "mains_15", marks: 15)
4. One Interview discussion prompt (question_type: "interview", marks: 0)
Return JSON array of: { question_type, question_text, options, correct_answer, explanation, difficulty, cognitive_level, marks }`,
            `Event: ${event.title}\nSummary: ${event.summary}\nExam: ${examType}`
          );

          if (questions && Array.isArray(questions)) {
            const qRows = questions.map((q: any) => ({
              event_id: eventId, exam_type: examType,
              question_type: q.question_type, question_text: q.question_text,
              options: q.options || null, correct_answer: q.correct_answer,
              explanation: q.explanation, difficulty: q.difficulty || "moderate",
              cognitive_level: q.cognitive_level || "application", marks: q.marks || 0,
              status: config.auto_approve_questions ? "approved" : "draft",
            }));
            await supabase.from("ca_generated_questions").insert(qRows);
            totalQuestionsGenerated += qRows.length;
            await supabase.from("ca_events").update({
              question_count: qRows.length,
            }).eq("id", eventId);
          }
        } catch (e) { console.error("Question gen error:", e); }
      }

      // Mark event complete
      await supabase.from("ca_events").update({ processing_status: "completed" }).eq("id", eventId);
    }

    // Update autopilot stats
    await supabase.from("ca_autopilot_config").update({
      last_auto_run_at: new Date().toISOString(),
      total_auto_runs: (config.total_auto_runs || 0) + 1,
      total_events_fetched: (config.total_events_fetched || 0) + totalEventsInserted,
      total_questions_generated: (config.total_questions_generated || 0) + totalQuestionsGenerated,
      updated_at: new Date().toISOString(),
    }).eq("id", config.id);

    console.log(`CA Auto Pipeline: Done. Events: ${totalEventsInserted}, Questions: ${totalQuestionsGenerated}`);

    return jsonResp({
      success: true,
      events_fetched: totalEventsInserted,
      questions_generated: totalQuestionsGenerated,
    });
  } catch (e) {
    console.error("CA Auto Pipeline error:", e);
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

async function fetchNewsViaAI(categories: string[]) {
  const today = new Date().toISOString().split("T")[0];
  const categoryList = categories.join(", ");

  const resp = await aiFetch({
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are a current affairs intelligence engine for competitive exam preparation in India. Generate the most important and recent current affairs events happening today or in the last 24 hours. Focus on events relevant to UPSC, NEET, JEE, SSC and other competitive exams.

Return a JSON array of 5-8 events. Each event must have:
- title: Clear, concise headline
- summary: 2-3 sentence overview with key facts, figures, and implications
- raw_content: Detailed 4-6 sentence analysis including background context, significance, and exam relevance
- category: One of [${categoryList}]
- importance_score: 0-1 based on exam relevance

Focus on: Government policies, Supreme Court verdicts, economic data, scientific discoveries, international relations, appointments, awards, defense deals, environmental policies, constitutional amendments, legislative changes.

DO NOT make up events. Only include factual, verifiable current affairs.`,
        },
        {
          role: "user",
          content: `Generate the most important current affairs events for ${today}. Categories to cover: ${categoryList}. These will be used for competitive exam preparation.`,
        },
      ],
      temperature: 0.4,
      max_tokens: 6000,
    }),
    timeoutMs: 60000,
  });

  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || "";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];

  try {
    return JSON.parse(match[0]);
  } catch {
    return [];
  }
}
