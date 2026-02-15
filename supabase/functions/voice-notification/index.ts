import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, language, tone, voiceId: requestedVoiceId, context } = await req.json();
    // type: "daily_reminder" | "forget_risk" | "exam_countdown" | "motivation" | "test"
    // language: "en" | "hi" | "auto"
    // tone: "soft" | "energetic" | "calm"
    // context: { subject?, topic?, memory_score?, exam_days?, rank_change?, daily_minutes?, daily_topic? }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Generate dynamic voice text using Lovable AI
    const userName = context?.userName || "";
    const nameClause = userName ? ` The student's name is "${userName}" — address them by name naturally (use first name only).` : "";
    const lang = language === "hi" ? "Hindi (written in Devanagari script mixed with simple English words where natural, Hinglish conversational style)" : "English (clear, natural American English)";
    const toneDesc = tone === "energetic" ? "energetic, upbeat, and lively" : tone === "calm" ? "very calm, composed, and soothing" : "soft, warm, and gentle";

    const promptMap: Record<string, string> = {
      daily_reminder: `Generate a short (1-2 sentences) ${toneDesc} study reminder in ${lang}.${nameClause} Context: The student should study ${context?.daily_topic || "their planned topics"} for about ${context?.daily_minutes || 20} minutes today. Subject: ${context?.subject || "general"}. Be motivating, varied, and natural. Don't use generic greetings every time — vary the opening.`,
      forget_risk: `Generate a short (1-2 sentences) ${toneDesc} memory risk alert in ${lang}.${nameClause} Context: The topic "${context?.topic || "a topic"}" in ${context?.subject || "a subject"} has a memory score of ${context?.memory_score ?? 40}%. It may drop soon. Recommend a quick review. Sound slightly urgent but caring.`,
      exam_countdown: `Generate a short (1-2 sentences) ${toneDesc} exam countdown alert in ${lang}.${nameClause} Context: The student has ${context?.exam_days ?? 7} days until their exam. Be focused and confident. Suggest activating Focus Mode if exam is close.`,
      motivation: `Generate a short (1-2 sentences) ${toneDesc} motivational notification in ${lang}.${nameClause} Context: ${context?.rank_change ? `Their predicted rank improved by ${context.rank_change} positions.` : "They've been consistent with their studies."} Be encouraging and warm.`,
      test: `Generate a short (1 sentence) ${toneDesc} test notification in ${lang}.${nameClause} Say something like "Your ACRY voice notifications are working perfectly." Make it sound premium and intelligent.`,
    };

    const aiPrompt = promptMap[type] || promptMap.test;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are ACRY, an AI Second Brain voice assistant. Rules:
1. Output ONLY the spoken text — no quotes, no labels, no formatting, no asterisks.
2. Keep it 1-2 sentences, natural and conversational.
3. For Hindi: Write in Devanagari script. Use simple English loanwords naturally (like "focus", "topic", "minutes") but keep the sentence structure Hindi.
4. For English: Use clear, flowing sentences. Avoid overly formal or stilted phrasing.
5. Never start with "Hey" or "Hi" every time — vary openings naturally.
6. Pronounce numbers as words (e.g., "twenty" not "20").
7. Avoid abbreviations, symbols, or special characters.`
          },
          { role: "user", content: aiPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again later" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const spokenText = aiData.choices?.[0]?.message?.content?.trim() || "Your ACRY brain is active.";

    // Track Lovable AI usage (fire-and-forget)
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    adminClient.rpc("increment_api_usage", { p_service_name: "lovable_ai" }).then(() => {}).catch(() => {});

    // Step 2: Convert text to speech using ElevenLabs
    const allowedVoices = ["EXAVITQu4vr4xnSDxMaL", "Xb7hH8MSUJpSbSDYk0k2", "nPczCjzI2devNBz1zQrb", "onwK4e9ZLuTAKqWW03F9"];
    const voiceId = allowedVoices.includes(requestedVoiceId) ? requestedVoiceId : "EXAVITQu4vr4xnSDxMaL";

    // Adjust voice settings based on tone — tuned for clearer multilingual speech
    const voiceSettings = {
      soft: { stability: 0.55, similarity_boost: 0.8, style: 0.25, speed: 0.92 },
      calm: { stability: 0.65, similarity_boost: 0.85, style: 0.15, speed: 0.88 },
      energetic: { stability: 0.35, similarity_boost: 0.75, style: 0.55, speed: 1.0 },
    };
    const settings = voiceSettings[tone as keyof typeof voiceSettings] || voiceSettings.soft;

    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: spokenText,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            ...settings,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!ttsResponse.ok) {
      const errText = await ttsResponse.text();
      console.error("ElevenLabs error:", ttsResponse.status, errText);
      // Return text-only fallback
      return new Response(JSON.stringify({ text: spokenText, audio: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Track ElevenLabs usage (fire-and-forget)
    adminClient.rpc("increment_api_usage", { p_service_name: "elevenlabs" }).then(() => {}).catch(() => {});

    const audioBuffer = await ttsResponse.arrayBuffer();

    // Encode to base64 using Deno's standard library approach
    const bytes = new Uint8Array(audioBuffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      const chunk = bytes.subarray(i, Math.min(i + 8192, bytes.length));
      for (let j = 0; j < chunk.length; j++) {
        binary += String.fromCharCode(chunk[j]);
      }
    }
    const base64Audio = btoa(binary);

    return new Response(JSON.stringify({ text: spokenText, audio: base64Audio }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("voice-notification error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
