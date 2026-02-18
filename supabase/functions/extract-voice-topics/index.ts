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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    // Support two modes: JSON body with pre-edited transcript, or FormData with audio
    const contentType = req.headers.get("content-type") || "";
    let transcription = "";

    if (contentType.includes("application/json")) {
      // Pre-edited transcript mode — skip transcription
      const body = await req.json();
      transcription = body.transcript || "";
      if (!transcription.trim()) {
        return new Response(JSON.stringify({ error: "Empty transcript provided" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log("Using pre-edited transcript, skipping audio transcription");
    } else {
      // Audio mode — transcribe first
      const formData = await req.formData();
      const audioFile = formData.get("audio") as File | null;

      if (!audioFile) {
        return new Response(JSON.stringify({ error: "No audio file provided" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const arrayBuffer = await audioFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) {
        const chunk = bytes.subarray(i, Math.min(i + 8192, bytes.length));
        for (let j = 0; j < chunk.length; j++) {
          binary += String.fromCharCode(chunk[j]);
        }
      }
      const base64 = btoa(binary);
      const mimeType = audioFile.type || "audio/webm";

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "AI not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("Step 1: Transcribing audio with AI...");

      const transcribeResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: "You are a precise audio transcription assistant. Transcribe the audio content exactly as spoken. If the audio contains study-related content, preserve all subject names, topic names, and technical terms accurately.",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Transcribe this audio recording of study notes. Provide the full transcription text.",
                },
                {
                  type: "input_audio",
                  input_audio: {
                    data: base64,
                    format: mimeType.includes("webm") ? "webm" : mimeType.includes("mp3") ? "mp3" : "wav",
                  },
                },
              ],
            },
          ],
        }),
      });

      if (!transcribeResponse.ok) {
        if (transcribeResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (transcribeResponse.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errText = await transcribeResponse.text();
        console.error("Transcription error:", transcribeResponse.status, errText);
        return new Response(JSON.stringify({ error: "Audio transcription failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const transcribeData = await transcribeResponse.json();
      transcription = transcribeData.choices?.[0]?.message?.content || "";

      if (!transcription.trim()) {
        return new Response(JSON.stringify({ error: "Could not transcribe audio. Try speaking more clearly." }), {
          status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch existing subjects for context
    const { data: existingSubjects } = await supabase
      .from("subjects")
      .select("id, name")
      .eq("user_id", userId);
    const existingSubjectNames = (existingSubjects || []).map((s: any) => s.name).join(", ");

    console.log("Step 2: Extracting topics from transcription...");

    // Step 2: Extract topics from the transcription
    const extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are ACRY, an AI study assistant. Extract study subjects and specific reviewable topics from transcribed voice notes.
The user already has these subjects: ${existingSubjectNames || "none"}.
If the content fits an existing subject, use that exact name. Otherwise suggest a new subject name.
Each topic should be a specific, reviewable concept — not a vague category.`,
          },
          {
            role: "user",
            content: `Extract study subjects and topics from this transcribed voice note:\n\n"${transcription}"`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_topics",
              description: "Extract subjects and topics from the transcribed voice note",
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
                              name: { type: "string", description: "Specific topic name" },
                              importance: { type: "string", enum: ["high", "medium", "low"] },
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

    if (!extractResponse.ok) {
      if (extractResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (extractResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await extractResponse.text();
      console.error("Extract error:", extractResponse.status, errText);
      return new Response(JSON.stringify({ error: "Topic extraction failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extractData = await extractResponse.json();
    const toolCall = extractData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "AI could not extract topics from this audio" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(toolCall.function.arguments);
    const results: { subject: string; topics: string[] }[] = [];
    let totalTopicsCreated = 0;

    for (const subj of extracted.subjects || []) {
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
          console.error("Subject create error:", subjErr);
          continue;
        }
        subjectId = newSubject.id;
      }

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

    console.log(`Extracted ${totalTopicsCreated} topics from voice note`);

    return new Response(
      JSON.stringify({
        success: true,
        totalTopicsCreated,
        results,
        transcription: transcription.slice(0, 500),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("extract-voice-topics error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
