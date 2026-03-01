/**
 * Shared AI client – tries user's own Gemini API key first,
 * falls back to Lovable AI gateway.
 *
 * Usage:
 *   import { callAI } from "../_shared/aiClient.ts";
 *   const result = await callAI({ messages, model, tools, tool_choice, maxTokens, temperature, stream });
 */

// Model mapping: Lovable gateway model → direct Gemini model name
const GATEWAY_TO_GEMINI: Record<string, string> = {
  "google/gemini-2.5-pro": "gemini-2.5-pro",
  "google/gemini-2.5-flash": "gemini-2.5-flash",
  "google/gemini-2.5-flash-lite": "gemini-2.5-flash-lite",
  "google/gemini-3-flash-preview": "gemini-2.0-flash",
  "google/gemini-3-pro-preview": "gemini-2.0-flash",
  "google/gemini-3-pro-image-preview": "gemini-2.0-flash",
};

interface AIMessage {
  role: string;
  content: string | any[];
}

interface AICallOptions {
  messages: AIMessage[];
  model?: string;
  tools?: any[];
  tool_choice?: any;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  timeoutMs?: number;
}

interface AIResult {
  ok: boolean;
  status: number;
  data?: any;
  response?: Response; // for streaming
  error?: string;
  source: "gemini" | "gateway";
}

export async function callAI(opts: AICallOptions): Promise<AIResult> {
  const {
    messages,
    model = "google/gemini-2.5-flash",
    tools,
    tool_choice,
    maxTokens,
    temperature,
    stream = false,
    timeoutMs = 55000,
  } = opts;

  const GEMINI_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");

  // --- Tier 1: Direct Gemini API ---
  if (GEMINI_KEY) {
    try {
      const result = await callGeminiDirect(GEMINI_KEY, {
        messages, model, tools, tool_choice, maxTokens, temperature, stream, timeoutMs,
      });
      if (result.ok) return result;
      console.log(`Gemini direct failed (${result.status}), trying gateway...`);
    } catch (e) {
      console.error("Gemini direct error:", e);
    }
  }

  // --- Tier 2: Lovable AI Gateway ---
  if (LOVABLE_KEY) {
    try {
      const result = await callGateway(LOVABLE_KEY, {
        messages, model, tools, tool_choice, maxTokens, temperature, stream, timeoutMs,
      });
      return result;
    } catch (e) {
      console.error("Gateway error:", e);
      return { ok: false, status: 500, error: e instanceof Error ? e.message : "Gateway error", source: "gateway" };
    }
  }

  return { ok: false, status: 500, error: "No AI keys configured", source: "gateway" };
}

// --- Direct Gemini via generativelanguage.googleapis.com ---
async function callGeminiDirect(
  apiKey: string,
  opts: Omit<AICallOptions, "stream"> & { stream: boolean }
): Promise<AIResult> {
  const { messages, model, tools, tool_choice, maxTokens, temperature, stream, timeoutMs } = opts;

  const geminiModel = GATEWAY_TO_GEMINI[model || ""] || "gemini-2.0-flash";

  // Convert OpenAI-style messages to Gemini format
  const systemParts = messages.filter(m => m.role === "system");
  const userParts = messages.filter(m => m.role !== "system");

  const systemInstruction = systemParts.length > 0
    ? { parts: systemParts.map(m => ({ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) })) }
    : undefined;

  const contents = userParts.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: typeof m.content === "string"
      ? [{ text: m.content }]
      : Array.isArray(m.content)
        ? m.content.map((c: any) => {
            if (c.type === "text") return { text: c.text };
            if (c.type === "input_audio") return { inline_data: { mime_type: `audio/${c.input_audio.format}`, data: c.input_audio.data } };
            if (c.type === "image_url") return { inline_data: { mime_type: "image/jpeg", data: c.image_url.url.replace(/^data:[^;]+;base64,/, "") } };
            return { text: JSON.stringify(c) };
          })
        : [{ text: JSON.stringify(m.content) }],
  }));

  const body: any = { contents };
  if (systemInstruction) body.system_instruction = systemInstruction;

  const generationConfig: any = {};
  if (maxTokens) generationConfig.maxOutputTokens = maxTokens;
  if (temperature !== undefined) generationConfig.temperature = temperature;

  // If tools requested with JSON output, use JSON response mode
  if (tools && tools.length > 0) {
    generationConfig.responseMimeType = "application/json";
    // Include tool schema info in the system prompt for structured output
  }
  if (Object.keys(generationConfig).length > 0) body.generationConfig = generationConfig;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const endpoint = stream ? "streamGenerateContent" : "generateContent";
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:${endpoint}?key=${apiKey}`,
      {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    clearTimeout(timeout);

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`Gemini ${resp.status}:`, errText.slice(0, 200));
      return { ok: false, status: resp.status, error: errText.slice(0, 200), source: "gemini" };
    }

    if (stream) {
      return { ok: true, status: 200, response: resp, source: "gemini" };
    }

    const data = await resp.json();
    // Gemini 2.5 Pro "thinking" models return multiple parts: thought parts first, then text.
    // We need the actual text content, not the thinking/reasoning trace.
    const parts = data.candidates?.[0]?.content?.parts || [];
    const textParts = parts.filter((p: any) => p.text !== undefined && !p.thought);
    const textContent = textParts.length > 0 
      ? textParts.map((p: any) => p.text).join("") 
      : (parts[parts.length - 1]?.text || "");

    // Normalize to OpenAI-compatible format
    const normalized: any = {
      choices: [{
        message: {
          role: "assistant",
          content: textContent,
        },
      }],
    };

    // If tools were requested, try to parse JSON and create tool_calls format
    if (tools && tools.length > 0 && textContent) {
      try {
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          normalized.choices[0].message.tool_calls = [{
            function: {
              name: tools[0].function?.name || "extract",
              arguments: JSON.stringify(parsed),
            },
          }];
        }
      } catch { /* content is plain text, not JSON */ }
    }

    return { ok: true, status: 200, data: normalized, source: "gemini" };
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

// --- Lovable AI Gateway (OpenAI-compatible) ---
async function callGateway(
  apiKey: string,
  opts: Omit<AICallOptions, "stream"> & { stream: boolean }
): Promise<AIResult> {
  const { messages, model, tools, tool_choice, maxTokens, temperature, stream, timeoutMs } = opts;

  const body: any = { messages, model };
  if (tools) body.tools = tools;
  if (tool_choice) body.tool_choice = tool_choice;
  if (maxTokens) body.max_tokens = maxTokens;
  if (temperature !== undefined) body.temperature = temperature;
  if (stream) body.stream = true;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`Gateway ${resp.status}:`, errText.slice(0, 200));
      return { ok: false, status: resp.status, error: errText.slice(0, 200), source: "gateway" };
    }

    if (stream) {
      return { ok: true, status: 200, response: resp, source: "gateway" };
    }

    const data = await resp.json();
    return { ok: true, status: 200, data, source: "gateway" };
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

/**
 * Helper: extract text content from AIResult
 */
export function getAIText(result: AIResult): string {
  if (!result.data) return "";
  return result.data.choices?.[0]?.message?.content || "";
}

/**
 * Helper: extract tool call arguments from AIResult
 */
export function getAIToolArgs(result: AIResult): any | null {
  if (!result.data) return null;
  const toolCall = result.data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) return null;
  try {
    return JSON.parse(toolCall.function.arguments);
  } catch {
    return null;
  }
}
