import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

      const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");

      // Try Lovable gateway first, then fallback to direct Gemini
      let transcribeResponse: Response | null = null;
      let usedFallback = false;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 50000);
        transcribeResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          signal: controller.signal,
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
                  { type: "text", text: "Transcribe this audio recording of study notes. Provide the full transcription text." },
                  { type: "input_audio", input_audio: { data: base64, format: mimeType.includes("webm") ? "webm" : mimeType.includes("mp3") ? "mp3" : "wav" } },
                ],
              },
            ],
          }),
        });
        clearTimeout(timeout);
        console.log("Gateway transcribe status:", transcribeResponse.status);

        if (!transcribeResponse.ok && (transcribeResponse.status === 402 || transcribeResponse.status === 429)) {
          console.log("Gateway returned", transcribeResponse.status, "- trying Gemini fallback");
          transcribeResponse = null;
        }
      } catch (e) {
        console.error("Gateway transcribe error:", e);
        transcribeResponse = null;
      }

      // Fallback to direct Gemini API
      if (!transcribeResponse && GOOGLE_GEMINI_API_KEY) {
        usedFallback = true;
        console.log("Using direct Gemini API for transcription...");
        try {
          const controller2 = new AbortController();
          const timeout2 = setTimeout(() => controller2.abort(), 50000);
          transcribeResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_GEMINI_API_KEY}`,
            {
              method: "POST",
              signal: controller2.signal,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { text: "Transcribe this audio recording of study notes exactly as spoken. Preserve all subject names, topic names, and technical terms." },
                    { inline_data: { mime_type: mimeType, data: base64 } },
                  ],
                }],
              }),
            }
          );
          clearTimeout(timeout2);
          console.log("Gemini direct transcribe status:", transcribeResponse.status);
        } catch (e2) {
          console.error("Gemini direct transcribe error:", e2);
          transcribeResponse = null;
        }
      }

      if (!transcribeResponse) {
        return new Response(JSON.stringify({ error: "Audio transcription failed. AI service unavailable." }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!transcribeResponse.ok) {
        const errText = await transcribeResponse.text();
        console.error("Transcription error:", transcribeResponse.status, errText);
        return new Response(JSON.stringify({ error: "Audio transcription failed", status: transcribeResponse.status }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const transcribeData = await transcribeResponse.json();
      if (usedFallback) {
        transcription = transcribeData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      } else {
        transcription = transcribeData.choices?.[0]?.message?.content || "";
      }

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

    const extractPrompt = `You are ACRY, an AI study assistant. Extract study subjects and specific reviewable topics from transcribed voice notes.
The user already has these subjects: ${existingSubjectNames || "none"}.
If the content fits an existing subject, use that exact name. Otherwise suggest a new subject name.
Each topic should be a specific, reviewable concept — not a vague category.

Extract study subjects and topics from this transcribed voice note:
"${transcription}"

Respond ONLY with valid JSON in this format:
{"subjects":[{"name":"Subject Name","topics":[{"name":"Topic Name","importance":"high"}]}]}`;

    let extractData: any = null;
    let usedExtractFallback = false;

    // Try gateway first
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 50000);
      const extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        signal: ctrl.signal,
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You extract study subjects and topics from text. Always respond with valid JSON only." },
            { role: "user", content: extractPrompt },
          ],
        }),
      });
      clearTimeout(t);
      console.log("Gateway extract status:", extractResponse.status);
      if (extractResponse.ok) {
        const d = await extractResponse.json();
        const content = d.choices?.[0]?.message?.content || "";
        const toolCall = d.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
          extractData = JSON.parse(toolCall.function.arguments);
        } else if (content) {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) extractData = JSON.parse(jsonMatch[0]);
        }
      } else {
        console.log("Gateway extract failed:", extractResponse.status);
        await extractResponse.text();
      }
    } catch (e) {
      console.error("Gateway extract error:", e);
    }

    // Fallback to direct Gemini
    const GOOGLE_GEMINI_API_KEY2 = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!extractData && GOOGLE_GEMINI_API_KEY2) {
      usedExtractFallback = true;
      console.log("Using direct Gemini API for extraction...");
      try {
        const ctrl2 = new AbortController();
        const t2 = setTimeout(() => ctrl2.abort(), 50000);
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_GEMINI_API_KEY2}`,
          {
            method: "POST",
            signal: ctrl2.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: extractPrompt }] }],
              generationConfig: { responseMimeType: "application/json" },
            }),
          }
        );
        clearTimeout(t2);
        console.log("Gemini direct extract status:", resp.status);
        if (resp.ok) {
          const d = await resp.json();
          const text = d.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) extractData = JSON.parse(jsonMatch[0]);
        } else {
          const errText = await resp.text();
          console.error("Gemini extract error:", resp.status, errText);
        }
      } catch (e2) {
        console.error("Gemini direct extract error:", e2);
      }
    }

    if (!extractData?.subjects) {
      return new Response(JSON.stringify({ error: "AI could not extract topics from this audio. Try again." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = extractData;
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
