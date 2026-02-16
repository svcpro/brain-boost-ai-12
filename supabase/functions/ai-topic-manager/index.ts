import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const { action, target_user_id, exam_type, custom_exam, subjects: bodySubjects } = body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Determine the user to operate on (admin can target other users)
    const userId = target_user_id || user.id;

    if (action === "generate_curriculum") {
      // AI generates full subject + topic tree based on exam type
      const examLabel = exam_type || "general";

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are an expert academic curriculum designer for Indian competitive exams. Generate a comprehensive, exam-specific subject and topic structure. Each topic should have a marks_impact_weight (0-10 scale, where 10 = highest exam weightage). Be thorough and cover the complete syllabus. Use real exam syllabus data.`
            },
            {
              role: "user",
              content: `Generate the complete subject and topic structure for: ${examLabel}${custom_exam ? ` (${custom_exam})` : ""}. Include ALL important topics per subject with accurate marks impact weights based on exam patterns.`
            }
          ],
          tools: [{
            type: "function",
            function: {
              name: "generate_curriculum",
              description: "Generate complete exam curriculum with subjects and topics",
              parameters: {
                type: "object",
                properties: {
                  subjects: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Subject name" },
                        topics: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              name: { type: "string", description: "Topic name" },
                              marks_impact_weight: { type: "number", description: "Importance weight 0-10 based on exam weightage" },
                              priority: { type: "string", enum: ["critical", "high", "medium", "low"], description: "Study priority" }
                            },
                            required: ["name", "marks_impact_weight", "priority"]
                          }
                        }
                      },
                      required: ["name", "topics"]
                    }
                  },
                  total_topics: { type: "number", description: "Total number of topics generated" },
                  exam_summary: { type: "string", description: "Brief 1-line exam pattern summary" }
                },
                required: ["subjects", "total_topics", "exam_summary"]
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
      let curriculum = { subjects: [], total_topics: 0, exam_summary: "" };
      if (toolCall?.function?.arguments) {
        curriculum = JSON.parse(toolCall.function.arguments);
      }

      // Track usage
      admin.rpc("increment_api_usage", { p_service_name: "lovable_ai" }).catch(() => {});

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
          .eq("user_id", userId)
          .eq("name", sub.name)
          .is("deleted_at", null)
          .maybeSingle();

        let subjectId: string;
        if (existing) {
          subjectId = existing.id;
        } else {
          const { data: newSub, error: subErr } = await admin.from("subjects")
            .insert({ name: sub.name, user_id: userId })
            .select("id")
            .single();
          if (subErr) continue;
          subjectId = newSub.id;
        }

        for (const topic of sub.topics || []) {
          // Check if topic already exists
          const { data: existingTopic } = await admin.from("topics")
            .select("id")
            .eq("user_id", userId)
            .eq("subject_id", subjectId)
            .eq("name", topic.name)
            .is("deleted_at", null)
            .maybeSingle();

          if (!existingTopic) {
            await admin.from("topics").insert({
              name: topic.name,
              subject_id: subjectId,
              user_id: userId,
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
        admin.from("topics").select("name, memory_strength, marks_impact_weight, subject_id").eq("user_id", userId).is("deleted_at", null),
        admin.from("subjects").select("id, name").eq("user_id", userId).is("deleted_at", null),
        admin.from("profiles").select("exam_type").eq("id", userId).maybeSingle(),
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

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
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
      admin.rpc("increment_api_usage", { p_service_name: "lovable_ai" }).catch(() => {});
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
        admin.from("topics").select("id, name, marks_impact_weight, subject_id").eq("user_id", userId).is("deleted_at", null),
        admin.from("subjects").select("id, name").eq("user_id", userId).is("deleted_at", null),
        admin.from("profiles").select("exam_type").eq("id", userId).maybeSingle(),
      ]);

      const topics = topicsRes.data || [];
      const subjects = subjectsRes.data || [];
      const examType = profileRes.data?.exam_type || "general";
      const subjectMap = new Map(subjects.map((s: any) => [s.id, s.name]));

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
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
      admin.rpc("increment_api_usage", { p_service_name: "lovable_ai" }).catch(() => {});
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

      if (toolCall?.function?.arguments) {
        const { weights } = JSON.parse(toolCall.function.arguments);
        let updated = 0;
        for (const w of weights || []) {
          const { error } = await admin.from("topics")
            .update({ marks_impact_weight: w.marks_impact_weight })
            .eq("id", w.topic_id)
            .eq("user_id", userId);
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
