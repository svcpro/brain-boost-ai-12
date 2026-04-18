import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { authenticateRequest, handleCors, jsonResponse, errorResponse, securityHeaders } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const { userId, supabase } = await authenticateRequest(req);
    const user = { id: userId };

    const body = await req.json();
    const { action, target_user_id, exam_type, custom_exam, subjects: bodySubjects } = body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Determine the user to operate on (admin can target other users)
    const targetUserId = target_user_id || user.id;

    if (action === "generate_curriculum") {
      // AI generates full subject + topic tree based on exam type
      const examLabel = exam_type || "general";

      const { aiFetch } = await import("../_shared/aiFetch.ts");
      // Speed-optimized: tight prompt, capped tokens, smaller schema (no priority/totals/summary).
      // Target latency: 3-5s. Topics are intentionally limited to the most important ones —
      // the user can add more later via Manage Topics.
      const aiResp = await aiFetch({
        timeoutMs: 15000,
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          temperature: 0.3,
          max_tokens: 1200,
          messages: [
            {
              role: "system",
              content: `Curriculum designer. Output ONLY the tool call. Be concise.`
            },
            {
              role: "user",
              content: `Exam: ${examLabel}${custom_exam ? ` (${custom_exam})` : ""}. List 4-6 core subjects, each with 5-8 most important topics. For each topic give marks_impact_weight (0-10).`
            }
          ],
          tools: [{
            type: "function",
            function: {
              name: "generate_curriculum",
              description: "Return subjects and topics",
              parameters: {
                type: "object",
                properties: {
                  subjects: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        topics: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              name: { type: "string" },
                              marks_impact_weight: { type: "number" }
                            },
                            required: ["name", "marks_impact_weight"]
                          }
                        }
                      },
                      required: ["name", "topics"]
                    }
                  }
                },
                required: ["subjects"]
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "generate_curriculum" } },
        }),
      });

      if (!aiResp.ok) {
        if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("AI gateway error");
      }

      const aiData = await aiResp.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      const contentText = aiData.choices?.[0]?.message?.content || "";
      let curriculum = { subjects: [] as any[], total_topics: 0, exam_summary: `${examLabel} curriculum` };
      
      let rawParsed: any = null;
      if (toolCall?.function?.arguments) {
        rawParsed = JSON.parse(toolCall.function.arguments);
      } else if (contentText) {
        try {
          rawParsed = typeof contentText === "string" ? JSON.parse(contentText) : contentText;
        } catch {
          const match = contentText.match(/[\[\{][\s\S]*[\]\}]/);
          if (match) {
            try { rawParsed = JSON.parse(match[0]); } catch {}
          }
        }
      }
      
      if (rawParsed) {
        curriculum = normalizeCurriculum(rawParsed, examLabel);
      }
      console.log("Curriculum result:", curriculum.subjects.length, "subjects,", curriculum.total_topics, "topics");

      // Track usage
      await admin.rpc("increment_api_usage", { p_service_name: "lovable_ai" }).then(() => {}, () => {});

      return new Response(JSON.stringify(curriculum), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "save_curriculum_data") {
      const subjects = bodySubjects || [];

      for (const sub of subjects) {
        // Check if subject already exists
        const { data: existing } = await admin.from("subjects")
          .select("id")
          .eq("user_id", targetUserId)
          .eq("name", sub.name)
          .is("deleted_at", null)
          .maybeSingle();

        let subjectId: string;
        if (existing) {
          subjectId = existing.id;
        } else {
          const { data: newSub, error: subErr } = await admin.from("subjects")
            .insert({ name: sub.name, user_id: targetUserId })
            .select("id")
            .single();
          if (subErr) continue;
          subjectId = newSub.id;
        }

        for (const topic of sub.topics || []) {
          // Check if topic already exists
          const { data: existingTopic } = await admin.from("topics")
            .select("id")
            .eq("user_id", targetUserId)
            .eq("subject_id", subjectId)
            .eq("name", topic.name)
            .is("deleted_at", null)
            .maybeSingle();

          if (!existingTopic) {
            await admin.from("topics").insert({
              name: topic.name,
              subject_id: subjectId,
              user_id: targetUserId,
              marks_impact_weight: topic.marks_impact_weight || 5,
            });
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "gap_analysis") {
      // Analyze existing topics and find gaps
      const [topicsRes, subjectsRes, profileRes] = await Promise.all([
        admin.from("topics").select("name, memory_strength, marks_impact_weight, subject_id").eq("user_id", targetUserId).is("deleted_at", null),
        admin.from("subjects").select("id, name").eq("user_id", targetUserId).is("deleted_at", null),
        admin.from("profiles").select("exam_type").eq("id", targetUserId).maybeSingle(),
      ]);

      const topics = topicsRes.data || [];
      const subjects = subjectsRes.data || [];
      const examType = profileRes.data?.exam_type || "general";
      const subjectMap = new Map(subjects.map((s: any) => [s.id, s.name]));

      const topicSummary = topics.map((t: any) => ({
        name: t.name,
        subject: subjectMap.get(t.subject_id) || "Unknown",
        memory_strength: t.memory_strength,
        marks_impact_weight: t.marks_impact_weight,
      }));

      const { aiFetch } = await import("../_shared/aiFetch.ts");
      const aiResp = await aiFetch({
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are an expert exam syllabus analyzer. Given a student's current topics, identify critical gaps in their syllabus coverage. Compare against the complete ${examType} exam syllabus. Also suggest marks_impact_weight for missing topics.`
            },
            {
              role: "user",
              content: `Exam: ${examType}\nCurrent subjects: ${subjects.map((s: any) => s.name).join(", ")}\nCurrent topics (${topics.length}):\n${topicSummary.map((t: any) => `- ${t.subject}: ${t.name} (strength: ${t.memory_strength}%, weight: ${t.marks_impact_weight || "unset"})`).join("\n")}\n\nIdentify missing critical topics and any subjects that are incomplete. Also flag topics with incorrect or missing marks_impact_weight.`
            }
          ],
          tools: [{
            type: "function",
            function: {
              name: "gap_analysis",
              description: "Analyze syllabus gaps and suggest missing topics",
              parameters: {
                type: "object",
                properties: {
                  coverage_percentage: { type: "number", description: "Estimated syllabus coverage 0-100" },
                  missing_topics: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        subject: { type: "string" },
                        topic_name: { type: "string" },
                        marks_impact_weight: { type: "number" },
                        priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
                        reason: { type: "string", description: "Why this topic is important" }
                      },
                      required: ["subject", "topic_name", "marks_impact_weight", "priority", "reason"]
                    }
                  },
                  weight_corrections: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        topic_name: { type: "string" },
                        current_weight: { type: "number" },
                        suggested_weight: { type: "number" },
                        reason: { type: "string" }
                      },
                      required: ["topic_name", "suggested_weight", "reason"]
                    }
                  },
                  summary: { type: "string", description: "Overall gap analysis summary" }
                },
                required: ["coverage_percentage", "missing_topics", "weight_corrections", "summary"]
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "gap_analysis" } },
        }),
      });

      if (!aiResp.ok) {
        if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("AI gateway error");
      }

      const aiData = await aiResp.json();
      await admin.rpc("increment_api_usage", { p_service_name: "lovable_ai" }).then(() => {}, () => {});
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      let analysis = { coverage_percentage: 0, missing_topics: [], weight_corrections: [], summary: "" };
      if (toolCall?.function?.arguments) {
        analysis = JSON.parse(toolCall.function.arguments);
      }

      return new Response(JSON.stringify(analysis), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "auto_prioritize") {
      // AI re-calculates marks_impact_weight for all topics
      const [topicsRes, subjectsRes, profileRes] = await Promise.all([
        admin.from("topics").select("id, name, marks_impact_weight, subject_id").eq("user_id", targetUserId).is("deleted_at", null),
        admin.from("subjects").select("id, name").eq("user_id", targetUserId).is("deleted_at", null),
        admin.from("profiles").select("exam_type").eq("id", targetUserId).maybeSingle(),
      ]);

      const topics = topicsRes.data || [];
      const subjects = subjectsRes.data || [];
      const examType = profileRes.data?.exam_type || "general";
      const subjectMap = new Map(subjects.map((s: any) => [s.id, s.name]));

      const { aiFetch } = await import("../_shared/aiFetch.ts");
      const aiResp = await aiFetch({
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content: `You are an exam marks weightage expert. Assign accurate marks_impact_weight (0-10) to each topic based on the ${examType} exam pattern and historical question frequency.`
            },
            {
              role: "user",
              content: `Assign marks_impact_weight (0-10) to each topic:\n${topics.map((t: any) => `- ID: ${t.id} | ${subjectMap.get(t.subject_id)}: ${t.name} (current: ${t.marks_impact_weight || "unset"})`).join("\n")}`
            }
          ],
          tools: [{
            type: "function",
            function: {
              name: "prioritize_topics",
              description: "Assign marks impact weights to topics",
              parameters: {
                type: "object",
                properties: {
                  weights: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        topic_id: { type: "string" },
                        marks_impact_weight: { type: "number" }
                      },
                      required: ["topic_id", "marks_impact_weight"]
                    }
                  }
                },
                required: ["weights"]
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "prioritize_topics" } },
        }),
      });

      if (!aiResp.ok) throw new Error("AI gateway error");
      const aiData = await aiResp.json();
      await admin.rpc("increment_api_usage", { p_service_name: "lovable_ai" }).then(() => {}, () => {});
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

      if (toolCall?.function?.arguments) {
        const { weights } = JSON.parse(toolCall.function.arguments);
        let updated = 0;
        for (const w of weights || []) {
          const { error } = await admin.from("topics")
            .update({ marks_impact_weight: w.marks_impact_weight })
            .eq("id", w.topic_id)
            .eq("user_id", targetUserId);
          if (!error) updated++;
        }
        return new Response(JSON.stringify({ updated, total: weights?.length || 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ updated: 0, total: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-topic-manager error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Normalize various AI response formats into our expected curriculum structure
function normalizeCurriculum(raw: any, examLabel: string) {
  const result = { subjects: [] as any[], total_topics: 0, exam_summary: `${examLabel} curriculum` };
  
  let subjectArray: any[] = [];
  
  // Handle: { subjects: [...] } format
  if (raw?.subjects && Array.isArray(raw.subjects)) {
    subjectArray = raw.subjects;
    if (raw.exam_summary) result.exam_summary = raw.exam_summary;
  }
  // Handle: direct array of subjects [...] 
  else if (Array.isArray(raw)) {
    subjectArray = raw;
  }
  // Handle: { subject_name: { topics: [...] } } or similar object
  else if (typeof raw === "object" && !Array.isArray(raw)) {
    subjectArray = Object.entries(raw)
      .filter(([k]) => k !== "total_topics" && k !== "exam_summary")
      .map(([name, val]: [string, any]) => ({
        name,
        topics: Array.isArray(val) ? val : (val?.topics || []),
      }));
  }
  
  result.subjects = subjectArray.map((sub: any) => {
    const name = sub.name || sub.subject || sub.subject_name || "Unknown";
    const rawTopics = sub.topics || sub.chapters || [];
    const topics = rawTopics.map((t: any) => ({
      name: t.name || t.topic_name || t.topic || "Unnamed",
      marks_impact_weight: Number(t.marks_impact_weight ?? t.weight ?? t.importance ?? 5),
      priority: t.priority || (Number(t.marks_impact_weight ?? 5) >= 8 ? "critical" : Number(t.marks_impact_weight ?? 5) >= 6 ? "high" : Number(t.marks_impact_weight ?? 5) >= 4 ? "medium" : "low"),
    }));
    return { name, topics };
  });
  
  result.total_topics = result.subjects.reduce((sum, s) => sum + s.topics.length, 0);
  if (raw?.total_topics) result.total_topics = raw.total_topics;
  
  return result;
}
