import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiFetch } from "../_shared/aiFetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_EVENTS_PER_RUN = 3;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let forceRun = false;
    try {
      const body = await req.json();
      forceRun = body?.force === true;
    } catch { /* no body is fine */ }

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

    console.log("CA Auto Pipeline: Starting for categories:", categories);

    // Step 1: Fetch events (limited count)
    const events = await fetchNewsViaAI(categories);
    if (!events || events.length === 0) {
      return jsonResp({ success: true, events_fetched: 0, message: "No new events found" });
    }

    // Limit events to prevent timeout
    const eventsToProcess = events.slice(0, MAX_EVENTS_PER_RUN);
    console.log(`CA Auto Pipeline: Processing ${eventsToProcess.length} of ${events.length} events`);

    let totalEventsInserted = 0;
    let totalQuestionsGenerated = 0;
    let totalPolicyAnalyses = 0;
    let totalTpiAdjustments = 0;

    for (const event of eventsToProcess) {
      // Check for duplicate
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

      // Step 2: Single combined AI call for entities + graph + syllabus
      try {
        const enrichment = await aiCall(
          `You are an exam preparation intelligence engine. Analyze this news event and return a JSON object with three keys:
1. "entities": Array of {name, entity_type (policy|scheme|govt_body|constitutional_article|act|location|economic_indicator|person|organization), description, relevance_score (0-1)}
2. "graph_edges": Array of {edge_type (syllabus|historical|pyq|policy|impact), target_label, weight (0-1), description}
3. "syllabus_links": Array of {exam_type, subject, micro_topic, relevance_score (0-1), tpi_impact (0-1), pattern_detected (boolean), pattern_details}
For syllabus_links, map to these exams: ${examTypes.join(", ")}
Return ONLY the JSON object.`,
          `Event: ${event.title}\nSummary: ${event.summary}`
        );

        if (enrichment) {
          // Process entities
          if (Array.isArray(enrichment.entities)) {
            let entityCount = 0;
            for (const ent of enrichment.entities.slice(0, 5)) {
              const { data: existingEnt } = await supabase.from("ca_entities")
                .select("id").eq("name", ent.name).eq("entity_type", ent.entity_type).maybeSingle();

              let entityId: string;
              if (existingEnt) {
                entityId = existingEnt.id;
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
            await supabase.from("ca_events").update({ entity_count: entityCount }).eq("id", eventId);
          }

          // Process graph edges
          if (Array.isArray(enrichment.graph_edges)) {
            await supabase.from("ca_graph_edges").insert(
              enrichment.graph_edges.slice(0, 5).map((e: any) => ({
                event_id: eventId, edge_type: e.edge_type,
                target_label: e.target_label, weight: e.weight || 0.5, description: e.description,
              }))
            );
          }

          // Process syllabus links
          if (Array.isArray(enrichment.syllabus_links)) {
            await supabase.from("ca_syllabus_links").insert(
              enrichment.syllabus_links.slice(0, 5).map((l: any) => ({
                event_id: eventId, exam_type: l.exam_type || examTypes[0],
                subject: l.subject, micro_topic: l.micro_topic,
                relevance_score: l.relevance_score || 0.5,
                tpi_impact: l.tpi_impact || 0,
                pattern_detected: l.pattern_detected || false,
                pattern_details: l.pattern_details,
              }))
            );
            await supabase.from("ca_events").update({ syllabus_link_count: enrichment.syllabus_links.length }).eq("id", eventId);
          }
        }
      } catch (e) { console.error("Enrichment error:", e); }

      // Step 3: Generate questions (single call for all types)
      try {
        const questions = await aiCall(
          `You are an exam question generator. Generate exactly 5 questions for this news event:
1. Two Prelims MCQs (question_type: "prelims_mcq", marks: 2, with 4 options as JSON array, correct_answer as option text)
2. One Mains 10-mark (question_type: "mains_10", marks: 10)
3. One Mains 15-mark (question_type: "mains_15", marks: 15)
4. One Interview prompt (question_type: "interview", marks: 0)
Return JSON array of: {question_type, question_text, options, correct_answer, explanation, difficulty, cognitive_level, marks}`,
          `Event: ${event.title}\nSummary: ${event.summary}\nExam: ${examTypes[0]}`
        );

        if (questions && Array.isArray(questions)) {
          const qRows = questions.map((q: any) => ({
            event_id: eventId, exam_type: examTypes[0],
            question_type: q.question_type, question_text: q.question_text,
            options: q.options || null, correct_answer: q.correct_answer,
            explanation: q.explanation, difficulty: q.difficulty || "moderate",
            cognitive_level: q.cognitive_level || "application", marks: q.marks || 0,
            status: config?.auto_approve_questions ? "approved" : "draft",
          }));
          await supabase.from("ca_generated_questions").insert(qRows);
          totalQuestionsGenerated += qRows.length;
          await supabase.from("ca_events").update({ question_count: qRows.length }).eq("id", eventId);
        }
      } catch (e) { console.error("Question gen error:", e); }

      // Mark event complete
      await supabase.from("ca_events").update({ processing_status: "completed" }).eq("id", eventId);

      // ── CA 3.0: Auto Policy Impact Analysis ──
      if (config?.auto_policy_analysis_enabled) {
        try {
          console.log(`CA 3.0 Auto: Running policy analysis for event ${eventId}`);
          const policyResp = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/ca-policy-predictor`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                action: "analyze_policy",
                event_id: eventId,
                exam_types: examTypes,
              }),
            }
          );
          const policyData = await policyResp.json();
          console.log(`CA 3.0 Auto: Analysis result:`, policyData);
          totalPolicyAnalyses++;

          // Auto-apply TPI adjustments if enabled
          if (config?.auto_apply_tpi_adjustments && policyData?.analysis_id) {
            const applyResp = await fetch(
              `${Deno.env.get("SUPABASE_URL")}/functions/v1/ca-policy-predictor`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                },
                body: JSON.stringify({
                  action: "apply_adjustments",
                  analysis_id: policyData.analysis_id,
                }),
              }
            );
            const applyData = await applyResp.json();
            totalTpiAdjustments += applyData?.applied || 0;
            console.log(`CA 3.0 Auto: Applied ${applyData?.applied || 0} TPI adjustments`);
          }
        } catch (e) { console.error("CA 3.0 Auto Policy error:", e); }
      }
    }

    // Update stats
    if (config?.id) {
      await supabase.from("ca_autopilot_config").update({
        last_auto_run_at: new Date().toISOString(),
        total_auto_runs: (config.total_auto_runs || 0) + 1,
        total_events_fetched: (config.total_events_fetched || 0) + totalEventsInserted,
        total_questions_generated: (config.total_questions_generated || 0) + totalQuestionsGenerated,
        total_policy_analyses_run: (config.total_policy_analyses_run || 0) + totalPolicyAnalyses,
        total_tpi_adjustments_applied: (config.total_tpi_adjustments_applied || 0) + totalTpiAdjustments,
        updated_at: new Date().toISOString(),
      }).eq("id", config.id);
    }

    console.log(`CA Auto Pipeline: Done. Events: ${totalEventsInserted}, Questions: ${totalQuestionsGenerated}, Policies: ${totalPolicyAnalyses}, TPI: ${totalTpiAdjustments}`);

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
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    }),
    timeoutMs: 30000,
  });
  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || "";
  const match = text.match(/[\[{][\s\S]*[\]}]/);
  return match ? JSON.parse(match[0]) : null;
}

async function fetchNewsViaAI(categories: string[]) {
  const categoryList = categories.join(", ");

  const resp = await aiFetch({
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content: `You are a current affairs content generator for competitive exam preparation in India. Return a JSON array of 3-5 events. Each must have: "title" (string), "summary" (2-3 sentences, string), "raw_content" (4-6 sentences, string), "category" (one of: ${categoryList}), "importance_score" (0-1 number). Focus on government policies, court verdicts, economic data, science, international relations. Return ONLY a JSON array.`,
        },
        {
          role: "user",
          content: `Generate 3-5 important current affairs for Indian competitive exams. Categories: ${categoryList}. Return ONLY a JSON array.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 3000,
      response_format: { type: "json_object" },
    }),
    timeoutMs: 30000,
  });

  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || "";
  if (!text) return [];

  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];

  try {
    return JSON.parse(match[0]);
  } catch {
    return [];
  }
}
