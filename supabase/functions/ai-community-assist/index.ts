import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const aiCall = async (key: string, messages: any[], maxTokens = 200, temp = 0.7) => {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-2.5-flash-lite", messages, max_tokens: maxTokens, temperature: temp }),
  });
  if (!res.ok) throw new Error("AI request failed");
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
};

const extractJson = (text: string) => {
  const m = text.match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : null;
};

const extractArray = (text: string) => {
  const m = text.match(/\[[\s\S]*\]/);
  return m ? JSON.parse(m[0]) : [];
};

serve(async (req) => {
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
