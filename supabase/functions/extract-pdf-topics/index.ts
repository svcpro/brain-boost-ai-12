import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    // Parse the multipart form data
    const formData = await req.formData();
    const pdfFile = formData.get("pdf") as File | null;

    if (!pdfFile) {
      return new Response(JSON.stringify({ error: "No PDF file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read PDF as base64 for AI processing
    const arrayBuffer = await pdfFile.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get existing subjects for the user
    const { data: existingSubjects } = await supabase
      .from("subjects")
      .select("id, name")
      .eq("user_id", userId);

    const existingSubjectNames = (existingSubjects || []).map((s: any) => s.name).join(", ");

    console.log("Sending PDF to AI for topic extraction...");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are ACRY, an AI study assistant. Extract study subjects and topics from uploaded PDF documents. 
Identify the main subject area and break the content into specific study topics.
The user already has these subjects: ${existingSubjectNames || "none"}.
If the PDF content fits an existing subject, use that exact name. Otherwise suggest a new subject name.
Each topic should be a specific, reviewable concept (not too broad, not too narrow).`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract all study subjects and topics from this PDF document. Identify the main subject and list all specific topics/concepts that a student should study and review.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${base64}`,
                },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_topics",
              description: "Extract subjects and topics from the document",
              parameters: {
                type: "object",
                properties: {
                  subjects: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: {
                          type: "string",
                          description: "Subject name (e.g. Physics, Biology, History)",
                        },
                        topics: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              name: {
                                type: "string",
                                description: "Specific topic name (e.g. Newton's Laws, Photosynthesis)",
                              },
                              importance: {
                                type: "string",
                                enum: ["high", "medium", "low"],
                                description: "How important this topic is for exams",
                              },
                            },
                            required: ["name", "importance"],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ["name", "topics"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["subjects"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_topics" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "AI could not extract topics from this PDF" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(toolCall.function.arguments);
    const results: { subject: string; topics: string[] }[] = [];
    let totalTopicsCreated = 0;

    for (const subj of extracted.subjects || []) {
      // Find or create subject
      let subjectId: string;
      const existing = (existingSubjects || []).find(
        (s: any) => s.name.toLowerCase() === subj.name.toLowerCase()
      );

      if (existing) {
        subjectId = existing.id;
      } else {
        const { data: newSubject, error: subjErr } = await supabase
          .from("subjects")
          .insert({ name: subj.name, user_id: userId })
          .select("id")
          .single();

        if (subjErr || !newSubject) {
          console.error("Failed to create subject:", subjErr);
          continue;
        }
        subjectId = newSubject.id;
      }

      // Get existing topics for this subject to avoid duplicates
      const { data: existingTopics } = await supabase
        .from("topics")
        .select("name")
        .eq("user_id", userId)
        .eq("subject_id", subjectId);

      const existingTopicNames = new Set(
        (existingTopics || []).map((t: any) => t.name.toLowerCase())
      );

      const createdTopics: string[] = [];

      for (const topic of subj.topics || []) {
        if (existingTopicNames.has(topic.name.toLowerCase())) continue;

        const weight = topic.importance === "high" ? 3 : topic.importance === "medium" ? 2 : 1;

        const { error: topicErr } = await supabase.from("topics").insert({
          name: topic.name,
          subject_id: subjectId,
          user_id: userId,
          memory_strength: 0,
          marks_impact_weight: weight,
        });

        if (!topicErr) {
          createdTopics.push(topic.name);
          totalTopicsCreated++;
        }
      }

      results.push({ subject: subj.name, topics: createdTopics });
    }

    console.log(`Extracted ${totalTopicsCreated} topics from PDF`);

    return new Response(
      JSON.stringify({
        success: true,
        totalTopicsCreated,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("extract-pdf-topics error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
