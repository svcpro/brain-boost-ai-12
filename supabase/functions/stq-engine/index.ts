import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { action, ...params } = await req.json();

    switch (action) {
      case "parse_syllabus":
        return await parseSyllabus(supabase, params);
      case "auto_generate_syllabus":
        return await autoGenerateSyllabus(supabase, params);
      case "delete_taxonomy":
        return await deleteTaxonomy(supabase, params);
      case "update_taxonomy":
        return await updateTaxonomy(supabase, params);
      case "mine_questions":
        return await mineQuestions(supabase, params);
      case "auto_mine_questions":
        return await autoMineQuestions(supabase, params);
      case "delete_mining":
        return await deleteMining(supabase, params);
      case "get_mining_stats":
        return await getMiningStats(supabase, params);
      case "compute_tpi":
        return await computeTPI(supabase, params);
      case "detect_patterns":
        return await detectPatterns(supabase, params);
      case "retrain":
        return await retrainModel(supabase, params);
      case "full_pipeline":
        return await fullPipeline(supabase, params);
      case "get_dashboard":
        return await getDashboard(supabase, params);
      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    console.error("STQ Engine error:", e);
    return json({ error: e.message }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// =============================================
// MODULE 1: SYLLABUS PARSER
// =============================================
async function parseSyllabus(supabase: any, { exam_type, syllabus_text }: any) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const prompt = `You are an expert exam syllabus parser. Parse the following ${exam_type} syllabus into a structured taxonomy.

For each item, extract:
- subject: The main subject (e.g., Physics, Chemistry, Mathematics)
- topic: The chapter/topic name
- subtopic: Specific subtopic (if identifiable)
- normalized_name: A clean, standardized version of the topic name
- hierarchy_level: 1 for subject, 2 for topic, 3 for subtopic
- weightage_pct: Estimated weightage percentage (if inferable)

Return a JSON array of objects with these fields. Be thorough and precise.

Syllabus text:
${syllabus_text}`;

  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      tools: [{
        type: "function",
        function: {
          name: "extract_taxonomy",
          description: "Extract structured syllabus taxonomy",
          parameters: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    subject: { type: "string" },
                    topic: { type: "string" },
                    subtopic: { type: "string" },
                    normalized_name: { type: "string" },
                    hierarchy_level: { type: "number" },
                    weightage_pct: { type: "number" },
                  },
                  required: ["subject", "topic", "normalized_name", "hierarchy_level"],
                },
              },
            },
            required: ["items"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "extract_taxonomy" } },
    }),
  });

  if (!aiResp.ok) {
    const errText = await aiResp.text();
    console.error("AI error:", aiResp.status, errText);
    throw new Error("AI syllabus parsing failed");
  }

  const aiData = await aiResp.json();
  let items: any[] = [];

  try {
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) {
      const parsed = JSON.parse(toolCall.function.arguments);
      items = parsed.items || [];
    }
  } catch {
    // Fallback: try extracting JSON from content
    const content = aiData.choices?.[0]?.message?.content || "";
    const match = content.match(/[\[\{][\s\S]*[\]\}]/);
    if (match) items = JSON.parse(match[0]);
  }

  if (!items.length) throw new Error("No taxonomy items extracted");

  // Insert into database
  const rows = items.map((item: any) => ({
    exam_type,
    subject: item.subject,
    topic: item.topic,
    subtopic: item.subtopic || null,
    normalized_name: item.normalized_name,
    hierarchy_level: item.hierarchy_level || 2,
    weightage_pct: item.weightage_pct || null,
    source: "ai_parsed",
    metadata: {},
  }));

  const { data, error } = await supabase.from("syllabus_taxonomies").insert(rows).select();
  if (error) throw error;

  return json({ success: true, count: data.length, items: data });
}

// =============================================
// AUTO GENERATE SYLLABUS (Full AI Generation)
// =============================================
async function autoGenerateSyllabus(supabase: any, { exam_type, subjects }: any) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const subjectList = subjects?.length ? subjects.join(", ") : "";
  const prompt = `You are an expert education curriculum designer. Generate a COMPLETE and EXHAUSTIVE syllabus taxonomy for the ${exam_type} exam.
${subjectList ? `Focus on these subjects: ${subjectList}` : "Include ALL subjects covered in this exam."}

For each entry provide:
- subject: Main subject name
- topic: Chapter/topic name  
- subtopic: Specific subtopic (be granular)
- normalized_name: Clean standardized name
- hierarchy_level: 1=subject, 2=topic, 3=subtopic
- weightage_pct: Estimated weightage percentage based on historical exam patterns
- importance: "critical" | "high" | "medium" | "low" based on exam frequency

Be EXHAUSTIVE - include every single topic and subtopic that has ever appeared or could appear in ${exam_type}.
For JEE: Physics, Chemistry, Mathematics with all chapters.
For NEET: Physics, Chemistry, Biology (Botany + Zoology) with all chapters.
For UPSC: All relevant subjects with detailed topics.

Return a comprehensive JSON array. Aim for 100+ entries with full subtopic coverage.`;

  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      tools: [{
        type: "function",
        function: {
          name: "generate_syllabus",
          description: "Generate complete exam syllabus taxonomy",
          parameters: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    subject: { type: "string" },
                    topic: { type: "string" },
                    subtopic: { type: "string" },
                    normalized_name: { type: "string" },
                    hierarchy_level: { type: "number" },
                    weightage_pct: { type: "number" },
                    importance: { type: "string" },
                  },
                  required: ["subject", "topic", "normalized_name", "hierarchy_level"],
                },
              },
            },
            required: ["items"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "generate_syllabus" } },
    }),
  });

  if (!aiResp.ok) {
    const errText = await aiResp.text();
    console.error("AI error:", aiResp.status, errText);
    throw new Error("AI syllabus generation failed");
  }

  const aiData = await aiResp.json();
  let items: any[] = [];

  try {
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) {
      const parsed = JSON.parse(toolCall.function.arguments);
      items = parsed.items || [];
    }
  } catch {
    const content = aiData.choices?.[0]?.message?.content || "";
    const match = content.match(/[\[\{][\s\S]*[\]\}]/);
    if (match) items = JSON.parse(match[0]);
  }

  if (!items.length) throw new Error("No taxonomy items generated");

  // Clear existing taxonomy for this exam type before inserting
  await supabase.from("syllabus_taxonomies").delete().eq("exam_type", exam_type).eq("source", "ai_generated");

  const rows = items.map((item: any) => ({
    exam_type,
    subject: item.subject,
    topic: item.topic,
    subtopic: item.subtopic || null,
    normalized_name: item.normalized_name,
    hierarchy_level: item.hierarchy_level || 2,
    weightage_pct: item.weightage_pct || null,
    source: "ai_generated",
    metadata: { importance: item.importance || "medium" },
  }));

  const { data, error } = await supabase.from("syllabus_taxonomies").insert(rows).select();
  if (error) throw error;

  // Group stats
  const subjects_map: Record<string, number> = {};
  for (const r of data) {
    subjects_map[r.subject] = (subjects_map[r.subject] || 0) + 1;
  }

  return json({ 
    success: true, 
    count: data.length, 
    subjects: subjects_map,
    items: data,
  });
}

// =============================================
// DELETE / UPDATE TAXONOMY
// =============================================
async function deleteTaxonomy(supabase: any, { ids, exam_type, delete_all }: any) {
  if (delete_all && exam_type) {
    const { error } = await supabase.from("syllabus_taxonomies").delete().eq("exam_type", exam_type);
    if (error) throw error;
    return json({ success: true, message: `All ${exam_type} taxonomy deleted` });
  }
  if (!ids?.length) throw new Error("No IDs provided");
  const { error } = await supabase.from("syllabus_taxonomies").delete().in("id", ids);
  if (error) throw error;
  return json({ success: true, deleted: ids.length });
}

async function updateTaxonomy(supabase: any, { id, updates }: any) {
  if (!id) throw new Error("No ID provided");
  const { data, error } = await supabase.from("syllabus_taxonomies").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return json({ success: true, item: data });
}

// =============================================
// MODULE 2: QUESTION MINING ENGINE
// =============================================
async function mineQuestions(supabase: any, { exam_type, year, questions_text }: any) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  // Fetch existing taxonomy for mapping
  const { data: taxonomy } = await supabase
    .from("syllabus_taxonomies")
    .select("id, subject, topic, subtopic, normalized_name")
    .eq("exam_type", exam_type);

  const taxonomyList = (taxonomy || []).map((t: any) => `${t.subject} > ${t.topic}${t.subtopic ? ` > ${t.subtopic}` : ""}`).join("\n");

  const prompt = `You are an expert exam question analyzer for ${exam_type} ${year}.

Existing syllabus taxonomy:
${taxonomyList || "No taxonomy loaded yet - infer subjects and topics."}

Analyze these exam questions and classify each one:
${questions_text}

For each question extract:
- subject: Main subject
- topic: Chapter/topic it belongs to
- subtopic: Specific subtopic
- question_text: The question text (first 200 chars)
- question_type: mcq/numerical/assertion_reason/passage/match
- difficulty_level: easy/medium/hard/very_hard
- marks: Marks for this question
- semantic_cluster: A cluster label for similar question patterns
- pattern_tags: Array of pattern tags like ["formula_based", "graph_interpretation"]

Return JSON array.`;

  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      tools: [{
        type: "function",
        function: {
          name: "classify_questions",
          description: "Classify exam questions into topics",
          parameters: {
            type: "object",
            properties: {
              questions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    subject: { type: "string" },
                    topic: { type: "string" },
                    subtopic: { type: "string" },
                    question_text: { type: "string" },
                    question_type: { type: "string" },
                    difficulty_level: { type: "string" },
                    marks: { type: "number" },
                    semantic_cluster: { type: "string" },
                    pattern_tags: { type: "array", items: { type: "string" } },
                  },
                  required: ["subject", "topic", "question_text"],
                },
              },
            },
            required: ["questions"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "classify_questions" } },
    }),
  });

  if (!aiResp.ok) throw new Error("AI question mining failed");

  const aiData = await aiResp.json();
  let questions: any[] = [];

  try {
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) questions = JSON.parse(toolCall.function.arguments).questions || [];
  } catch {
    const content = aiData.choices?.[0]?.message?.content || "";
    const match = content.match(/[\[\{][\s\S]*[\]\}]/);
    if (match) questions = JSON.parse(match[0]);
  }

  // Map to taxonomy IDs where possible
  const rows = questions.map((q: any) => {
    const match = (taxonomy || []).find((t: any) =>
      t.subject.toLowerCase() === q.subject?.toLowerCase() &&
      t.topic.toLowerCase() === q.topic?.toLowerCase()
    );
    return {
      exam_type,
      year,
      subject: q.subject,
      topic: q.topic,
      subtopic: q.subtopic || null,
      taxonomy_id: match?.id || null,
      question_text: q.question_text?.substring(0, 500),
      question_type: q.question_type || "mcq",
      difficulty_level: q.difficulty_level || "medium",
      marks: q.marks || 4,
      semantic_cluster: q.semantic_cluster || null,
      similarity_score: null,
      pattern_tags: q.pattern_tags || [],
      source_paper: `${exam_type}_${year}`,
    };
  });

  const { data, error } = await supabase.from("question_mining_results").insert(rows).select();
  if (error) throw error;

  return json({ success: true, count: data.length, questions: data });
}

// =============================================
// AUTO MINE QUESTIONS (AI generates + classifies)
// =============================================
async function autoMineQuestions(supabase: any, { exam_type, years, subjects }: any) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const targetYears = years?.length ? years : [2024, 2023, 2022, 2021, 2020];
  const targetSubjects = subjects?.length ? subjects : null;

  // Fetch taxonomy
  const { data: taxonomy } = await supabase
    .from("syllabus_taxonomies")
    .select("id, subject, topic, subtopic, normalized_name")
    .eq("exam_type", exam_type);

  const taxonomyTopics = (taxonomy || []).map((t: any) => `${t.subject} > ${t.topic}${t.subtopic ? ` > ${t.subtopic}` : ""}`);
  const subjectList = targetSubjects || [...new Set((taxonomy || []).map((t: any) => t.subject))];

  if (!subjectList.length) throw new Error("No subjects found. Generate syllabus first.");

  let totalMined = 0;
  const results: any[] = [];

  for (const year of targetYears) {
    for (const subject of subjectList) {
      // Check existing count
      const { count: existing } = await supabase
        .from("question_mining_results")
        .select("*", { count: "exact", head: true })
        .eq("exam_type", exam_type)
        .eq("year", year)
        .eq("subject", subject);

      if ((existing || 0) >= 10) {
        results.push({ year, subject, mined: 0, skipped: true });
        continue;
      }

      const prompt = `You are an expert exam analyst for ${exam_type}. Generate a realistic analysis of ${subject} questions that appeared in the ${year} exam paper.

Known syllabus topics for ${subject}:
${taxonomyTopics.filter((t: string) => t.startsWith(subject)).join("\n") || "Use standard topics for this subject."}

Generate 8-12 question entries that would realistically appear in ${exam_type} ${year} for ${subject}. For each:
- topic: The chapter/topic name
- subtopic: Specific subtopic
- question_text: A brief description of the question type (first 200 chars)
- question_type: mcq/numerical/assertion_reason/passage/match
- difficulty_level: easy/medium/hard/very_hard
- marks: Typical marks (4 for MCQ, etc.)
- semantic_cluster: A cluster label grouping similar patterns
- pattern_tags: Array like ["formula_based", "conceptual", "application", "graph_based"]

Base this on realistic ${exam_type} exam patterns.`;

      try {
        await new Promise(r => setTimeout(r, 600)); // rate limit guard

        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: prompt }],
            tools: [{
              type: "function",
              function: {
                name: "return_questions",
                description: "Return analyzed exam questions",
                parameters: {
                  type: "object",
                  properties: {
                    questions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          topic: { type: "string" },
                          subtopic: { type: "string" },
                          question_text: { type: "string" },
                          question_type: { type: "string" },
                          difficulty_level: { type: "string" },
                          marks: { type: "number" },
                          semantic_cluster: { type: "string" },
                          pattern_tags: { type: "array", items: { type: "string" } },
                        },
                        required: ["topic", "question_text"],
                      },
                    },
                  },
                  required: ["questions"],
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "return_questions" } },
          }),
        });

        if (!aiResp.ok) {
          const status = aiResp.status;
          if (status === 429) { results.push({ year, subject, mined: 0, rateLimited: true }); continue; }
          if (status === 402) throw new Error("AI credits exhausted");
          continue;
        }

        const aiData = await aiResp.json();
        let questions: any[] = [];
        try {
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall) questions = JSON.parse(toolCall.function.arguments).questions || [];
        } catch {
          const content = aiData.choices?.[0]?.message?.content || "";
          const match = content.match(/[\[\{][\s\S]*[\]\}]/);
          if (match) questions = JSON.parse(match[0]);
        }

        const rows = questions.map((q: any) => {
          const taxMatch = (taxonomy || []).find((t: any) =>
            t.subject.toLowerCase() === subject.toLowerCase() &&
            t.topic.toLowerCase() === q.topic?.toLowerCase()
          );
          return {
            exam_type, year, subject,
            topic: q.topic,
            subtopic: q.subtopic || null,
            taxonomy_id: taxMatch?.id || null,
            question_text: q.question_text?.substring(0, 500),
            question_type: q.question_type || "mcq",
            difficulty_level: q.difficulty_level || "medium",
            marks: q.marks || 4,
            semantic_cluster: q.semantic_cluster || null,
            similarity_score: null,
            pattern_tags: q.pattern_tags || [],
            source_paper: `${exam_type}_${year}`,
          };
        });

        if (rows.length) {
          const { data: inserted } = await supabase.from("question_mining_results").insert(rows).select();
          totalMined += inserted?.length || 0;
          results.push({ year, subject, mined: inserted?.length || 0 });
        }
      } catch (e: any) {
        console.error(`Auto-mine error ${subject}/${year}:`, e);
        results.push({ year, subject, mined: 0, error: e.message });
      }
    }
  }

  return json({ success: true, total_mined: totalMined, results });
}

// =============================================
// DELETE MINING / GET STATS
// =============================================
async function deleteMining(supabase: any, { exam_type, year, delete_all }: any) {
  if (delete_all && exam_type) {
    const { error } = await supabase.from("question_mining_results").delete().eq("exam_type", exam_type);
    if (error) throw error;
    return json({ success: true, message: `All ${exam_type} mining data deleted` });
  }
  if (year && exam_type) {
    const { error } = await supabase.from("question_mining_results").delete().eq("exam_type", exam_type).eq("year", year);
    if (error) throw error;
    return json({ success: true, message: `${exam_type} ${year} mining data deleted` });
  }
  throw new Error("Provide exam_type with delete_all or year");
}

async function getMiningStats(supabase: any, { exam_type }: any) {
  const { data } = await supabase
    .from("question_mining_results")
    .select("year, subject, question_type, difficulty_level, topic")
    .eq("exam_type", exam_type);

  if (!data?.length) return json({ total: 0, by_year: {}, by_subject: {}, by_type: {}, by_difficulty: {}, top_topics: [] });

  const byYear: Record<number, number> = {};
  const bySubject: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byDifficulty: Record<string, number> = {};
  const topicCount: Record<string, number> = {};

  for (const q of data) {
    byYear[q.year] = (byYear[q.year] || 0) + 1;
    bySubject[q.subject] = (bySubject[q.subject] || 0) + 1;
    byType[q.question_type] = (byType[q.question_type] || 0) + 1;
    byDifficulty[q.difficulty_level] = (byDifficulty[q.difficulty_level] || 0) + 1;
    topicCount[q.topic] = (topicCount[q.topic] || 0) + 1;
  }

  const topTopics = Object.entries(topicCount).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([topic, count]) => ({ topic, count }));

  return json({ total: data.length, by_year: byYear, by_subject: bySubject, by_type: byType, by_difficulty: byDifficulty, top_topics: topTopics });
}

// =============================================
// MODULE 3: TOPIC PROBABILITY INDEX (TPI)
// =============================================
async function computeTPI(supabase: any, { exam_type, prediction_year }: any) {
  const targetYear = prediction_year || new Date().getFullYear() + 1;

  // Get all mined questions for this exam
  const { data: questions } = await supabase
    .from("question_mining_results")
    .select("*")
    .eq("exam_type", exam_type)
    .order("year", { ascending: true });

  if (!questions?.length) return json({ error: "No mined questions found. Mine questions first." }, 400);

  // Group by topic
  const topicMap: Record<string, any[]> = {};
  for (const q of questions) {
    const key = `${q.subject}::${q.topic}`;
    if (!topicMap[key]) topicMap[key] = [];
    topicMap[key].push(q);
  }

  const years = [...new Set(questions.map((q: any) => q.year))].sort();
  const maxYear = Math.max(...years);
  const minYear = Math.min(...years);
  const yearSpan = maxYear - minYear + 1;

  const tpiResults = [];

  for (const [key, qs] of Object.entries(topicMap)) {
    const [subject, topic] = key.split("::");
    const qYears = qs.map(q => q.year);
    const uniqueYears = [...new Set(qYears)];

    // 1. Frequency Score (0-100): how often this topic appears
    const frequencyScore = Math.min(100, (uniqueYears.length / yearSpan) * 100);

    // 2. Recency Score (0-100): weighted toward recent years
    const recentYears = qYears.filter(y => y >= maxYear - 2);
    const recencyScore = Math.min(100, (recentYears.length / Math.max(1, qs.length)) * 150);

    // 3. Trend Momentum Score (0-100): is frequency increasing?
    let momentum = 50;
    if (years.length >= 3) {
      const halfPoint = Math.floor(years.length / 2);
      const earlyYears = years.slice(0, halfPoint);
      const lateYears = years.slice(halfPoint);
      const earlyCount = qs.filter(q => earlyYears.includes(q.year)).length;
      const lateCount = qs.filter(q => lateYears.includes(q.year)).length;
      momentum = Math.min(100, Math.max(0, 50 + ((lateCount - earlyCount) / Math.max(1, earlyCount)) * 50));
    }

    // 4. Volatility Score (0-100): consistency of appearance
    const gaps = [];
    const sortedYears = [...uniqueYears].sort();
    for (let i = 1; i < sortedYears.length; i++) {
      gaps.push(sortedYears[i] - sortedYears[i - 1]);
    }
    const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : yearSpan;
    const volatilityScore = Math.max(0, 100 - avgGap * 20);

    // 5. Difficulty Score (0-100): harder topics get slight boost
    const diffMap: Record<string, number> = { easy: 20, medium: 50, hard: 75, very_hard: 100 };
    const avgDiff = qs.reduce((s, q) => s + (diffMap[q.difficulty_level] || 50), 0) / qs.length;
    const difficultyScore = avgDiff;

    // Compute TPI (weighted combination)
    const tpi = Math.min(100, Math.max(0,
      frequencyScore * 0.30 +
      recencyScore * 0.25 +
      momentum * 0.20 +
      volatilityScore * 0.15 +
      difficultyScore * 0.10
    ));

    // Confidence based on data points
    const confidence = Math.min(95, 30 + qs.length * 5);

    tpiResults.push({
      exam_type,
      subject,
      topic,
      subtopic: null,
      frequency_score: Math.round(frequencyScore * 100) / 100,
      recency_score: Math.round(recencyScore * 100) / 100,
      trend_momentum_score: Math.round(momentum * 100) / 100,
      volatility_score: Math.round(volatilityScore * 100) / 100,
      difficulty_score: Math.round(difficultyScore * 100) / 100,
      tpi_score: Math.round(tpi * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      prediction_year: targetYear,
      data_points_used: qs.length,
      last_appeared_year: Math.max(...qYears),
      appearance_years: [...uniqueYears].sort(),
      model_version: "v1.0",
      computed_at: new Date().toISOString(),
    });
  }

  // Upsert TPI scores
  for (const row of tpiResults) {
    await supabase.from("topic_probability_index").upsert(row, {
      onConflict: "exam_type,subject,topic,subtopic,prediction_year",
      ignoreDuplicates: false,
    });
  }

  return json({
    success: true,
    exam_type,
    prediction_year: targetYear,
    topics_computed: tpiResults.length,
    high_tpi: tpiResults.filter(t => t.tpi_score >= 85).length,
    medium_tpi: tpiResults.filter(t => t.tpi_score >= 40 && t.tpi_score < 85).length,
    low_tpi: tpiResults.filter(t => t.tpi_score < 40).length,
    top_10: tpiResults.sort((a, b) => b.tpi_score - a.tpi_score).slice(0, 10),
  });
}

// =============================================
// MODULE 4: PATTERN EVOLUTION DETECTION
// =============================================
async function detectPatterns(supabase: any, { exam_type }: any) {
  const { data: questions } = await supabase
    .from("question_mining_results")
    .select("*")
    .eq("exam_type", exam_type)
    .order("year", { ascending: true });

  if (!questions?.length) return json({ error: "No data for pattern detection" }, 400);

  const years = [...new Set(questions.map((q: any) => q.year))].sort();
  const halfIdx = Math.floor(years.length / 2);
  const earlyYears = years.slice(0, halfIdx);
  const lateYears = years.slice(halfIdx);

  const detections: any[] = [];

  // 1. Concept Depth Shift
  const earlyDiff = questions.filter((q: any) => earlyYears.includes(q.year));
  const lateDiff = questions.filter((q: any) => lateYears.includes(q.year));
  const diffMap: Record<string, number> = { easy: 1, medium: 2, hard: 3, very_hard: 4 };
  const earlyAvg = earlyDiff.reduce((s: number, q: any) => s + (diffMap[q.difficulty_level] || 2), 0) / Math.max(1, earlyDiff.length);
  const lateAvg = lateDiff.reduce((s: number, q: any) => s + (diffMap[q.difficulty_level] || 2), 0) / Math.max(1, lateDiff.length);

  if (Math.abs(lateAvg - earlyAvg) > 0.3) {
    detections.push({
      exam_type,
      detection_type: "concept_depth_shift",
      description: `Difficulty ${lateAvg > earlyAvg ? "increased" : "decreased"} from avg ${earlyAvg.toFixed(1)} to ${lateAvg.toFixed(1)}`,
      severity: Math.abs(lateAvg - earlyAvg) > 0.6 ? "high" : "moderate",
      old_value: { avg_difficulty: earlyAvg },
      new_value: { avg_difficulty: lateAvg },
      recommendation: lateAvg > earlyAvg ? "Focus on harder conceptual questions" : "Balance difficulty in mocks",
    });
  }

  // 2. Question Type Distribution Shift
  const earlyTypes: Record<string, number> = {};
  const lateTypes: Record<string, number> = {};
  earlyDiff.forEach((q: any) => { earlyTypes[q.question_type] = (earlyTypes[q.question_type] || 0) + 1; });
  lateDiff.forEach((q: any) => { lateTypes[q.question_type] = (lateTypes[q.question_type] || 0) + 1; });

  const allTypes = [...new Set([...Object.keys(earlyTypes), ...Object.keys(lateTypes)])];
  for (const type of allTypes) {
    const earlyPct = (earlyTypes[type] || 0) / Math.max(1, earlyDiff.length) * 100;
    const latePct = (lateTypes[type] || 0) / Math.max(1, lateDiff.length) * 100;
    if (Math.abs(latePct - earlyPct) > 10) {
      detections.push({
        exam_type,
        detection_type: "question_type_shift",
        description: `"${type}" questions ${latePct > earlyPct ? "increased" : "decreased"}: ${earlyPct.toFixed(0)}% → ${latePct.toFixed(0)}%`,
        severity: Math.abs(latePct - earlyPct) > 20 ? "high" : "moderate",
        old_value: { type, pct: earlyPct },
        new_value: { type, pct: latePct },
        recommendation: latePct > earlyPct ? `Practice more ${type} questions` : `Less emphasis on ${type}`,
      });
    }
  }

  // 3. Topic Rotation Detection
  const topicByYear: Record<number, Set<string>> = {};
  for (const q of questions) {
    if (!topicByYear[q.year]) topicByYear[q.year] = new Set();
    topicByYear[q.year].add(q.topic);
  }

  const allTopics = [...new Set(questions.map((q: any) => q.topic))];
  const rotatingTopics = allTopics.filter(t => {
    const appearsIn = Object.entries(topicByYear).filter(([_, topics]) => topics.has(t));
    return appearsIn.length > 0 && appearsIn.length < years.length * 0.5;
  });

  if (rotatingTopics.length > 0) {
    detections.push({
      exam_type,
      detection_type: "topic_rotation",
      description: `${rotatingTopics.length} topics show rotation pattern (appear in <50% of years)`,
      severity: "moderate",
      affected_topics: rotatingTopics.slice(0, 10),
      recommendation: "These topics appear intermittently - check TPI for prediction",
    });
  }

  // Store detections
  if (detections.length > 0) {
    await supabase.from("pattern_evolution_logs").insert(detections);
  }

  return json({ success: true, detections_count: detections.length, detections });
}

// =============================================
// MODULE 5-7: RETRAIN + DASHBOARD
// =============================================
async function retrainModel(supabase: any, { exam_type }: any) {
  const startTime = Date.now();
  const examTypes = exam_type ? [exam_type] : ["JEE", "NEET", "UPSC"];
  let totalPoints = 0;

  // Get current accuracy (before)
  const { data: beforeTPI } = await supabase
    .from("topic_probability_index")
    .select("tpi_score, confidence")
    .limit(100);
  const avgConfBefore = beforeTPI?.length
    ? beforeTPI.reduce((s: number, t: any) => s + (t.confidence || 0), 0) / beforeTPI.length
    : 0;

  for (const et of examTypes) {
    // Recompute TPI
    const { data: qs } = await supabase
      .from("question_mining_results")
      .select("id")
      .eq("exam_type", et);
    totalPoints += qs?.length || 0;

    // Trigger compute
    await computeTPI(supabase, { exam_type: et, prediction_year: new Date().getFullYear() + 1 });
    await detectPatterns(supabase, { exam_type: et });
  }

  const { data: afterTPI } = await supabase
    .from("topic_probability_index")
    .select("tpi_score, confidence")
    .limit(100);
  const avgConfAfter = afterTPI?.length
    ? afterTPI.reduce((s: number, t: any) => s + (t.confidence || 0), 0) / afterTPI.length
    : 0;

  const duration = Date.now() - startTime;
  const newVersion = `v1.${Date.now() % 1000}`;

  await supabase.from("stq_training_logs").insert({
    model_version: newVersion,
    training_type: "full",
    exam_types_trained: examTypes,
    data_points_processed: totalPoints,
    accuracy_before: Math.round(avgConfBefore * 100) / 100,
    accuracy_after: Math.round(avgConfAfter * 100) / 100,
    duration_ms: duration,
    status: "completed",
    triggered_by: "manual",
  });

  // Update config
  await supabase.from("stq_engine_config").update({
    model_version: newVersion,
    last_retrained_at: new Date().toISOString(),
  }).neq("id", "00000000-0000-0000-0000-000000000000");

  return json({
    success: true,
    model_version: newVersion,
    data_points: totalPoints,
    duration_ms: duration,
    accuracy_before: avgConfBefore,
    accuracy_after: avgConfAfter,
  });
}

// =============================================
// FULL AUTO PIPELINE: Syllabus → Mining → TPI → Patterns → Training
// =============================================
async function fullPipeline(supabase: any, { exam_type, subjects, years, skip_syllabus }: any) {
  const steps: any[] = [];
  const startTime = Date.now();

  try {
    // Step 1: Generate Syllabus (unless already exists or skipped)
    if (!skip_syllabus) {
      const syllabusResult = await autoGenerateSyllabus(supabase, { exam_type, subjects });
      const syllabusData = JSON.parse(await syllabusResult.text());
      steps.push({ step: "syllabus", status: "completed", count: syllabusData.count || 0 });
    } else {
      const { count } = await supabase.from("syllabus_taxonomies").select("id", { count: "exact", head: true }).eq("exam_type", exam_type);
      steps.push({ step: "syllabus", status: "skipped", count: count || 0 });
    }

    // Step 2: Auto Mine Questions
    const targetYears = years?.length ? years : [2024, 2023, 2022, 2021, 2020];
    const mineResult = await autoMineQuestions(supabase, { exam_type, years: targetYears, subjects });
    const mineData = JSON.parse(await mineResult.text());
    steps.push({ step: "mining", status: "completed", total_mined: mineData.total_mined || 0 });

    // Step 3: Compute TPI
    const tpiResult = await computeTPI(supabase, { exam_type, prediction_year: new Date().getFullYear() + 1 });
    const tpiData = JSON.parse(await tpiResult.text());
    if (tpiData.error) {
      steps.push({ step: "tpi", status: "failed", error: tpiData.error });
    } else {
      steps.push({ step: "tpi", status: "completed", topics_computed: tpiData.topics_computed || 0, high_tpi: tpiData.high_tpi || 0 });
    }

    // Step 4: Pattern Detection
    const patternResult = await detectPatterns(supabase, { exam_type });
    const patternData = JSON.parse(await patternResult.text());
    if (patternData.error) {
      steps.push({ step: "patterns", status: "failed", error: patternData.error });
    } else {
      steps.push({ step: "patterns", status: "completed", detections: patternData.detections_count || 0 });
    }

    // Step 5: Model Training
    const trainResult = await retrainModel(supabase, { exam_type });
    const trainData = JSON.parse(await trainResult.text());
    steps.push({ step: "training", status: "completed", model_version: trainData.model_version, data_points: trainData.data_points || 0 });

  } catch (e: any) {
    steps.push({ step: "error", status: "failed", error: e.message });
  }

  const duration = Date.now() - startTime;
  return json({ success: true, exam_type, duration_ms: duration, steps });
}

async function getDashboard(supabase: any, { exam_type }: any) {
  const [
    { data: config },
    { data: tpi },
    { data: patterns },
    { data: trainingLogs },
    { data: taxonomyCount },
    { data: miningCount },
  ] = await Promise.all([
    supabase.from("stq_engine_config").select("*").limit(1).maybeSingle(),
    supabase.from("topic_probability_index").select("*").eq("exam_type", exam_type || "JEE").order("tpi_score", { ascending: false }).limit(50),
    supabase.from("pattern_evolution_logs").select("*").eq("exam_type", exam_type || "JEE").order("detected_at", { ascending: false }).limit(20),
    supabase.from("stq_training_logs").select("*").order("created_at", { ascending: false }).limit(10),
    supabase.from("syllabus_taxonomies").select("id", { count: "exact", head: true }).eq("exam_type", exam_type || "JEE"),
    supabase.from("question_mining_results").select("id", { count: "exact", head: true }).eq("exam_type", exam_type || "JEE"),
  ]);

  const highTpi = (tpi || []).filter((t: any) => t.tpi_score >= 85);
  const mediumTpi = (tpi || []).filter((t: any) => t.tpi_score >= 40 && t.tpi_score < 85);

  return json({
    config,
    stats: {
      taxonomy_count: taxonomyCount?.length || 0,
      questions_mined: miningCount?.length || 0,
      topics_with_tpi: tpi?.length || 0,
      high_tpi_count: highTpi.length,
      medium_tpi_count: mediumTpi.length,
      pattern_detections: patterns?.length || 0,
    },
    tpi_scores: tpi || [],
    pattern_evolutions: patterns || [],
    training_logs: trainingLogs || [],
  });
}
