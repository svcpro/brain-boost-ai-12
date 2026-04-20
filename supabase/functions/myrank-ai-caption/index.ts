const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Body {
  rank: number;
  percentile: number;
  category: string;
  ai_tag: string;
  user_name: string;
  channel: "whatsapp" | "instagram" | "telegram";
  tone?: "flex" | "humble" | "challenge";
  share_url?: string;
}

const fallbackCaption = (b: Body) => {
  const top = Math.max(1, 100 - Math.round(b.percentile));
  const url = b.share_url || "https://acry.ai/myrank";
  return `🏆 Rank #${b.rank.toLocaleString("en-IN")} on ACRY MyRank — Top ${top}% in ${b.category}!
🧠 ${b.ai_tag}
Think you can beat me? 👉 ${url}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ caption: fallbackCaption(body), source: "fallback" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const top = Math.max(1, 100 - Math.round(body.percentile));
    const url = body.share_url || "https://acry.ai/myrank";
    const tone = body.tone || "flex";

    const channelGuide: Record<string, string> = {
      whatsapp:
        "WhatsApp Group: warm, conversational. Use *bold* for emphasis (single asterisks). 4-6 short lines, 2-4 emojis. End with shareable URL on its own line. Friendly challenge tone.",
      instagram:
        "Instagram Caption: punchy 1st line as a hook, dramatic gap, then result. End with 5-8 trending hashtags (#NEET #JEE #UPSC #StudyMotivation #ACRY etc. matched to category). Include URL on its own line above hashtags. Use 3-5 emojis.",
      telegram:
        "Telegram Group: crisp and informative. Use **bold** (double asterisks) and bullet points (•). 5-7 lines. Include URL clearly. Tone: confident, study-group friendly.",
    };

    const toneGuide: Record<string, string> = {
      flex: "Confident flex — celebrate the rank but stay likable, not arrogant.",
      humble: "Grateful + humble — acknowledge effort, invite others to join.",
      challenge: "Bold challenge — directly dare friends to beat the rank.",
    };

    const prompt = `Write ONE viral social-media caption for an Indian student sharing their AI exam rank.

DATA:
- Name: ${body.user_name}
- All-India Rank: #${body.rank.toLocaleString("en-IN")}
- Percentile: ${body.percentile}% (Top ${top}%)
- Exam category: ${body.category}
- AI personality tag: "${body.ai_tag}"
- Share URL (must include verbatim): ${url}

CHANNEL FORMATTING: ${channelGuide[body.channel]}
TONE: ${toneGuide[tone]}

RULES:
- Output the caption ONLY — no preface, no explanation, no quotation marks.
- Must include the URL exactly: ${url}
- Must include the rank number and the "Top ${top}%" framing.
- Max 600 characters total.
- Indian-English friendly. No hindi script.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a viral social-media copywriter for Indian Gen-Z students. Output only the final caption, no commentary." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ caption: fallbackCaption(body), source: "rate_limited" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ caption: fallbackCaption(body), source: "no_credits" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      return new Response(JSON.stringify({ caption: fallbackCaption(body), source: "ai_error" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    let caption: string = data?.choices?.[0]?.message?.content?.trim() || "";
    // Strip wrapping quotes if model added them
    caption = caption.replace(/^["'`]+|["'`]+$/g, "").trim();
    if (!caption || caption.length < 20) caption = fallbackCaption(body);
    if (!caption.includes(url)) caption += `\n${url}`;

    return new Response(JSON.stringify({ caption, source: "ai" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-caption error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
