/**
 * Drop-in replacement for direct gateway fetch calls.
 * Tries user's GOOGLE_GEMINI_API_KEY first, falls back to Lovable gateway.
 * 
 * Usage: Replace `fetch("https://ai.gateway.lovable.dev/v1/chat/completions", opts)` 
 *        with `aiFetch(opts.body)` — returns the same Response shape.
 */

interface AIFetchOpts {
  body: string; // JSON string of the request body
  timeoutMs?: number;
}

export async function aiFetch({ body, timeoutMs = 55000 }: AIFetchOpts): Promise<Response> {
  const parsed = JSON.parse(body);
  const GEMINI_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");

  // --- Tier 1: Direct Gemini API ---
  if (GEMINI_KEY) {
    try {
      const result = await callGeminiDirect(GEMINI_KEY, parsed, timeoutMs);
      if (result.ok) return result;
      console.log(`Gemini direct: ${result.status}, falling back to gateway`);
      // Consume body to avoid leak
      try { await result.text(); } catch {}
    } catch (e) {
      console.error("Gemini direct error:", e);
    }
  }

  // --- Tier 2: Lovable AI Gateway ---
  if (LOVABLE_KEY) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${LOVABLE_KEY}`,
          "Content-Type": "application/json",
        },
        body,
      });
      clearTimeout(timeout);
      return resp;
    } catch (e) {
      clearTimeout(timeout);
      console.error("Gateway error:", e);
    }
  }

  return new Response(JSON.stringify({ error: "AI service unavailable" }), {
    status: 503,
    headers: { "Content-Type": "application/json" },
  });
}

// Map gateway model names to Gemini direct model names
const MODEL_MAP: Record<string, string> = {
  "google/gemini-2.5-pro": "gemini-2.5-pro",
  "google/gemini-2.5-flash": "gemini-2.5-flash",
  "google/gemini-2.5-flash-lite": "gemini-2.5-flash-lite",
  "google/gemini-3-flash-preview": "gemini-2.0-flash",
  "google/gemini-3-pro-preview": "gemini-2.0-flash",
  "openai/gpt-5-nano": "gemini-2.0-flash",
  "openai/gpt-5-mini": "gemini-2.5-flash",
  "openai/gpt-5": "gemini-2.5-pro",
};

async function callGeminiDirect(apiKey: string, parsed: any, timeoutMs: number): Promise<Response> {
  const model = MODEL_MAP[parsed.model] || "gemini-2.0-flash";
  const messages: any[] = parsed.messages || [];
  const isStream = parsed.stream === true;

  // Convert OpenAI messages to Gemini format
  const systemMsgs = messages.filter((m: any) => m.role === "system");
  const otherMsgs = messages.filter((m: any) => m.role !== "system");

  const systemInstruction = systemMsgs.length > 0
    ? { parts: systemMsgs.map((m: any) => ({ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) })) }
    : undefined;

  const contents = otherMsgs.map((m: any) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: typeof m.content === "string"
      ? [{ text: m.content }]
      : Array.isArray(m.content)
        ? m.content.map((c: any) => {
            if (c.type === "text") return { text: c.text };
            if (c.type === "input_audio") return { inline_data: { mime_type: `audio/${c.input_audio.format}`, data: c.input_audio.data } };
            if (c.type === "image_url") {
              const url = c.image_url?.url || "";
              if (url.startsWith("data:")) {
                const [meta, data] = url.split(",");
                const mime = meta.match(/data:([^;]+)/)?.[1] || "image/jpeg";
                return { inline_data: { mime_type: mime, data } };
              }
              return { text: `[Image: ${url}]` };
            }
            return { text: JSON.stringify(c) };
          })
        : [{ text: JSON.stringify(m.content) }],
  }));

  const geminiBody: any = { contents };
  if (systemInstruction) geminiBody.system_instruction = systemInstruction;

  const genConfig: any = {};
  if (parsed.max_tokens) genConfig.maxOutputTokens = parsed.max_tokens;
  if (parsed.temperature !== undefined) genConfig.temperature = parsed.temperature;
  
  // If tools are used or json mode requested, use JSON response
  if (parsed.tools?.length > 0 || parsed.response_format?.type === "json_object") {
    genConfig.responseMimeType = "application/json";
  }
  if (Object.keys(genConfig).length > 0) geminiBody.generationConfig = genConfig;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const endpoint = isStream ? "streamGenerateContent?alt=sse" : "generateContent";
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:${endpoint}&key=${apiKey}`,
    {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    }
  );
  clearTimeout(timeout);

  if (!resp.ok) return resp;

  if (isStream) {
    // For streaming, return the raw response — caller handles SSE
    return resp;
  }

  // Convert Gemini response to OpenAI-compatible format
  const data = await resp.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  const normalized: any = {
    choices: [{
      message: {
        role: "assistant",
        content: textContent,
        tool_calls: undefined as any,
      },
    }],
  };

  // Try to extract tool_calls if tools were requested
  if (parsed.tools?.length > 0 && textContent) {
    try {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedJson = JSON.parse(jsonMatch[0]);
        const toolName = parsed.tool_choice?.function?.name || parsed.tools[0]?.function?.name || "extract";
        normalized.choices[0].message.tool_calls = [{
          function: { name: toolName, arguments: JSON.stringify(parsedJson) },
        }];
      }
    } catch { /* plain text response */ }
  }

  return new Response(JSON.stringify(normalized), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
