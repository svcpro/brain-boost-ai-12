import { aiFetch } from "../_shared/aiFetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const aiCall = async (_key: string, messages: any[], maxTokens = 200, temp = 0.7) => {
  const body = JSON.stringify({ model: "google/gemini-2.5-flash-lite", messages, max_tokens: maxTokens, temperature: temp });
  const res = await aiFetch({ body });
  if (!res.ok) {
    const errText = await res.text().catch(() => "unknown");
    console.error("AI call failed:", res.status, errText);
    throw new Error(`AI request failed (${res.status})`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
};

const extractJson = (text: string) => {
  let cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.search(/[\{\[]/);
  const isArray = start !== -1 && cleaned[start] === '[';
  const end = cleaned.lastIndexOf(isArray ? ']' : '}');
  if (start === -1 || end === -1) return null;
  cleaned = cleaned.substring(start, end + 1);
  try { return JSON.parse(cleaned); } catch {
    cleaned = cleaned
      .replace(/,\s*}/g, "}").replace(/,\s*]/g, "]")
      .replace(/[\x00-\x1F\x7F]/g, "");
    try { return JSON.parse(cleaned); } catch { return null; }
  }
};

const extractArray = (text: string) => {
  const r = extractJson(text);
  return Array.isArray(r) ? r : [];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI not configured");

    const body = await req.json();
    const { action, name, category, exam_type, subject, partial } = body;
    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // --- SUGGEST COMMUNITY NAMES ---
    if (action === "suggest_names") {
      const ctx = category === "exam" ? `for ${exam_type || "competitive exam"} preparation` :
        category === "subject" ? `for studying ${subject || "a subject"}` :
        category === "topic" ? `about a specific study topic` : `for general academic discussion`;
      const text = await aiCall(LOVABLE_API_KEY, [
        { role: "system", content: "You suggest creative community names for study groups. Return JSON only." },
        { role: "user", content: `Suggest 6 creative, catchy community names ${ctx}${partial ? `. User typed "${partial}", suggest names related to that.` : ""}.\nReturn JSON: { "names": ["name1","name2","name3","name4","name5","name6"] }` },
      ], 250, 0.85);
      const parsed = extractJson(text);
      return json(parsed || { names: [] });
    }

    // --- SUGGEST EXAM TYPES ---
    if (action === "suggest_exam_types") {
      const text = await aiCall(LOVABLE_API_KEY, [
        { role: "system", content: "Return JSON only." },
        { role: "user", content: `List 12 popular competitive exams in India and worldwide for students. Include JEE, NEET, UPSC, SSC, GATE, CAT, GRE, SAT, IELTS, TOEFL and 2 more.\nReturn JSON: { "exams": [{"name":"JEE","full_name":"Joint Entrance Examination","emoji":"🎯"},..] }` },
      ], 500, 0.3);
      const parsed = extractJson(text);
      return json(parsed || { exams: [] });
    }

    // --- SUGGEST SUBJECTS ---
    if (action === "suggest_subjects") {
      const ctx = exam_type ? `relevant to ${exam_type} exam` : "for general academics";
      const text = await aiCall(LOVABLE_API_KEY, [
        { role: "system", content: "Return JSON only." },
        { role: "user", content: `List 10 popular study subjects ${ctx}. Return JSON: { "subjects": [{"name":"Physics","emoji":"⚛️"},{"name":"Chemistry","emoji":"🧪"},...] }` },
      ], 300, 0.3);
      const parsed = extractJson(text);
      return json(parsed || { subjects: [] });
    }

    // --- SUGGEST TOPICS ---
    if (action === "suggest_topics") {
      const subj = body.subject || "General";
      const text = await aiCall(LOVABLE_API_KEY, [
        { role: "system", content: "Return JSON only." },
        { role: "user", content: `List 8 important topics/chapters in "${subj}"${exam_type ? ` for ${exam_type} exam` : ""}.\nReturn JSON: { "topics": [{"name":"Topic","importance":"high|medium"},..] }` },
      ], 300, 0.3);
      const parsed = extractJson(text);
      return json(parsed || { topics: [] });
    }

    // --- AI ENHANCE POST ---
    if (action === "enhance_post") {
      const { title: pTitle, content: pContent, post_type, enhance_type } = body;
      let prompt = "";
      if (enhance_type === "suggest_title") {
        prompt = `The user wants to create a "${post_type}" post in a study community. They wrote this content:\n"${pContent}"\nSuggest 4 clear, engaging titles. Return JSON: { "titles": ["title1","title2","title3","title4"] }`;
      } else if (enhance_type === "improve_content") {
        prompt = `Improve this study community ${post_type} post. Make it clearer, better formatted, and more helpful. Keep the same meaning.\nTitle: ${pTitle}\nContent: ${pContent}\nReturn JSON: { "improved_content": "improved version with proper formatting" }`;
      } else if (enhance_type === "generate_content") {
        prompt = `Generate detailed content for a study community ${post_type} post titled "${pTitle}". Include relevant details, examples, and structure it well for a learning community. Return JSON: { "generated_content": "detailed post content" }`;
      } else if (enhance_type === "quality_check") {
        prompt = `Rate this study post for quality. Title: ${pTitle}\nContent: ${pContent}\nReturn JSON: { "score": 0-100, "feedback": "brief feedback", "suggestions": ["suggestion1","suggestion2"] }`;
      }
      const text = await aiCall(LOVABLE_API_KEY, [
        { role: "system", content: "You help create high-quality study community posts. Return JSON only." },
        { role: "user", content: prompt },
      ], 500, 0.7);
      const parsed = extractJson(text);
      return json(parsed || {});
    }

    // --- SUGGEST COMMUNITY DESCRIPTION & RULES ---
    if (action === "suggest_community") {
      const context = category === "exam" ? `for ${exam_type || "competitive exam"} preparation` :
        category === "subject" ? `for studying ${subject || "the subject"}` :
        category === "topic" ? `about the specific topic "${name}"` : `for general discussion about "${name}"`;

      const text = await aiCall(LOVABLE_API_KEY, [
        { role: "system", content: "You help create engaging study communities. Return JSON only." },
        { role: "user", content: `Generate a community description and rules for "${name}" ${context}.\nReturn JSON: { "description": "2-3 sentence engaging description", "rules": ["rule1", "rule2", "rule3", "rule4"] }` },
      ], 300, 0.7);

      const parsed = extractJson(text);
      if (parsed) return json(parsed);

      return json({
        description: `A community ${context}. Join to discuss, share resources, and learn together!`,
        rules: ["Be respectful", "Stay on topic", "No spam", "Share quality content"],
      });
    }

    // --- SUGGEST POST TAGS ---
    if (action === "suggest_post_tags") {
      const { title, content } = body;
      const text = await aiCall(LOVABLE_API_KEY, [
        { role: "system", content: "Extract topic tags from educational content. Return JSON array of 3-5 tags." },
        { role: "user", content: `Title: ${title}\nContent: ${content}\nReturn JSON: ["tag1", "tag2", "tag3"]` },
      ], 100, 0.3);
      const tags = extractArray(text);
      return json({ tags });
    }

    throw new Error("Invalid action");
  } catch (e) {
    console.error("ai-community-assist error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
