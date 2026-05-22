// ═══════════════════════════════════════════════════════════════════
// Voice Broadcast (OBD / IVR) — proxy to obdapi2.ivrsms.com
// Multi-action endpoint: login, upload_voice, list_voices, upload_base,
// compose, list_campaigns, analysis, pause, resume, stop,
// send_to_user (one-tap re-engagement call)
// ═══════════════════════════════════════════════════════════════════
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OBD_BASE = "https://obdapi2.ivrsms.com";
const DEFAULT_OBD_LOCATION_JSON = JSON.stringify({
  locationList: [
    { locationId: 1, locationName: "ahmedabad" },
    { locationId: 3, locationName: "Bangalore" },
  ],
});

const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

class RequestError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

class ObdComposeError extends Error {
  status: number;
  response: unknown;
  payload: Record<string, unknown>;
  constructor(status: number, response: unknown, payload: Record<string, unknown>) {
    super(`compose failed: status ${status} ${JSON.stringify(response)}`);
    this.status = status;
    this.response = response;
    this.payload = payload;
  }
}

type NormalizedObdField = { ok: true; value: string } | { ok: false; error: string };

// OBD compose docs: `location` and `clis` are mandatory JSON fields, but their
// values may be empty strings. When provided, `location` must be sent as a
// JSON-encoded string shaped like: {"locationList":[{"locationId":1,"locationName":"ahmedabad"}]}.
function normalizeObdLocation(raw: unknown): NormalizedObdField {
  if (raw == null || raw === "") return { ok: true, value: "" };
  const normalizeList = (items: unknown[]) => items
    .map((it: any) => ({
      locationId: Number(it?.locationId ?? it?.id),
      locationName: String(it?.locationName ?? it?.name ?? ""),
    }))
    .filter((it) => Number.isFinite(it.locationId));
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.locationList)) {
      const list = normalizeList(obj.locationList);
      if (list.length === 0) return { ok: false, error: "locationList has no valid {locationId,locationName} entries" };
      return { ok: true, value: JSON.stringify({ locationList: list }) };
    }
    if (Array.isArray(raw)) return normalizeObdLocation(JSON.stringify(raw));
    return { ok: false, error: 'location must be a JSON string, {"locationList":[...]}, or an array of locations' };
  }
  if (typeof raw !== "string") return { ok: false, error: "location must be a string" };
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, value: "" };
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      const list = normalizeList(parsed);
      if (list.length === 0) return { ok: false, error: "location array has no valid {locationId,locationName} entries" };
      return { ok: true, value: JSON.stringify({ locationList: list }) };
    }
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as any).locationList)) {
      const list = normalizeList((parsed as any).locationList);
      if (list.length === 0) return { ok: false, error: "locationList has no valid {locationId,locationName} entries" };
      return { ok: true, value: JSON.stringify({ locationList: list }) };
    }
    return { ok: false, error: 'location must be {"locationList":[{"locationId":1,"locationName":"ahmedabad"}]} or an array of {locationId,locationName}' };
  } catch {
    return { ok: false, error: "location is not valid JSON" };
  }
}

function normalizeObdClis(raw: unknown): NormalizedObdField {
  if (raw == null || raw === "") return { ok: true, value: "" };
  if (typeof raw === "object") return { ok: true, value: JSON.stringify(raw) };
  if (typeof raw !== "string") return { ok: false, error: "clis must be a string" };
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, value: "" };
  try { JSON.parse(trimmed); return { ok: true, value: trimmed }; }
  catch { return { ok: false, error: "clis is not valid JSON" }; }
}

function getObdRoutingFields(body: Record<string, unknown> = {}) {
  const loc = normalizeObdLocation(body.location ?? Deno.env.get("OBD_LOCATION_JSON") ?? DEFAULT_OBD_LOCATION_JSON);
  if (!loc.ok) throw new RequestError(loc.error, 400);
  const cli = normalizeObdClis(body.clis ?? Deno.env.get("OBD_CLIS_JSON") ?? "");
  if (!cli.ok) throw new RequestError(cli.error, 400);
  return { location: loc.value, clis: cli.value };
}

async function getToken(forceRefresh = false): Promise<{ token: string; userId: string }> {
  const obdUserId = Deno.env.get("OBD_USER_ID") || "";
  if (!forceRefresh) {
    const { data: cached } = await supabase
      .from("voice_broadcast_token_cache")
      .select("token, user_id_obd, expires_at")
      .eq("id", 1)
      .maybeSingle();
    if (cached?.token && new Date(cached.expires_at).getTime() > Date.now() + 60_000) {
      return { token: cached.token, userId: cached.user_id_obd || obdUserId };
    }
  }
  const username = Deno.env.get("OBD_USERNAME");
  const password = Deno.env.get("OBD_PASSWORD");
  if (!username || !password) throw new Error("OBD_USERNAME / OBD_PASSWORD not configured");

  const res = await fetch(`${OBD_BASE}/api/obd/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.token) throw new Error(`OBD login failed: ${JSON.stringify(data)}`);

  const expires = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
  await supabase.from("voice_broadcast_token_cache").upsert({
    id: 1,
    token: data.token,
    user_id_obd: String(data.userid || obdUserId),
    expires_at: expires,
  });
  return { token: data.token, userId: String(data.userid || obdUserId) };
}

async function obdFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { token } = await getToken();
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  let res = await fetch(`${OBD_BASE}${path}`, { ...init, headers });
  if (res.status === 401 || res.status === 403) {
    const { token: t2 } = await getToken(true);
    headers.set("Authorization", `Bearer ${t2}`);
    res = await fetch(`${OBD_BASE}${path}`, { ...init, headers });
  }
  return res;
}

function pad2(n: number) { return n.toString().padStart(2, "0"); }
function formatSchedule(d: Date): string {
  // MSG91 OBD expects IST (Asia/Kolkata = UTC+5:30). Deno runs in UTC.
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return `${ist.getUTCFullYear()}-${pad2(ist.getUTCMonth() + 1)}-${pad2(ist.getUTCDate())} ${pad2(ist.getUTCHours())}:${pad2(ist.getUTCMinutes())}:${pad2(ist.getUTCSeconds())}`;
}

function normalizePhone(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}

function normalizeBaseUploadPhone(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  if (digits.length === 10) return digits;
  return "";
}

async function uploadBaseForPhones(phones: string[], baseName: string, userId: string) {
  const normalized = phones.map((p) => normalizeBaseUploadPhone(p)).filter(Boolean);
  if (normalized.length === 0) throw new Error("No valid 10-digit mobile numbers for base upload");
  const safeBaseName = String(baseName || `base-${Date.now()}`).replace(/[^a-zA-Z0-9]/g, "").slice(0, 45) || `base${Date.now()}`;
  // OBD baseupload sample only sends raw mobile rows; adding a header can create an empty/invalid base.
  const csv = normalized.join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const fd = new FormData();
  fd.append("baseFile", blob, `${safeBaseName}.csv`);
  fd.append("userId", userId);
  fd.append("baseName", safeBaseName);
  fd.append("contactList", "null");
  const res = await obdFetch(`/api/obd/baseupload`, { method: "POST", body: fd });
  const raw = await res.text();
  const data = raw ? JSON.parse(raw) : {};
  if (!res.ok || !data?.baseId) throw new Error(`baseupload failed: status ${res.status} ${raw || "empty response"}`);
  return String(data.baseId);
}

async function composeCampaign(payload: Record<string, unknown>) {
  const attempts = [payload];

  let lastError: ObdComposeError | null = null;
  for (const attempt of attempts) {
    const res = await obdFetch(`/api/obd/campaign/compose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(attempt),
    });
    const raw = await res.text();
    const data = raw ? JSON.parse(raw) : {};
    if (res.ok) return data;
    console.error("[voice-broadcast] compose rejected", JSON.stringify({ status: res.status, response: data, payload: attempt }));
    lastError = new ObdComposeError(res.status, data, attempt);
  }
  throw lastError || new ObdComposeError(500, { message: "empty response" }, payload);
}

async function assertPromptApproved(promptId: string | number) {
  const id = String(promptId || "").trim();
  if (!id) throw new RequestError("Voice prompt is required", 400);
  const { data: localPrompt } = await supabase
    .from("voice_broadcast_voice_files")
    .select("prompt_id, prompt_status, is_active")
    .eq("prompt_id", id)
    .maybeSingle();
  if (localPrompt && (localPrompt.prompt_status !== 1 || !localPrompt.is_active)) {
    throw new RequestError(`Voice prompt #${id} is still pending OBD admin approval. Sync Voice Library after approval, then schedule the broadcast.`, 409);
  }
}

function buildSimpleIvrComposePayload(input: {
  userId: string;
  campaignName: string;
  baseId: string | number;
  welcomePId: string | number;
  scheduleTime: string;
  templateId?: string | number;
  dtmf?: string;
  menuPId?: string | number;
  noInputPId?: string | number;
  wrongInputPId?: string | number;
  thanksPId?: string | number;
  retries?: string | number;
  retryInterval?: string | number;
  menuWaitTime?: string | number;
  rePrompt?: string | number;
  location?: string;
  clis?: string;
}) {
  // Per OBD spec sample for Simple IVR (templateId=0): IDs are strings,
  // DTMF-only values (smsDtmfApi/menuWaitTime/rePrompt) must be empty strings,
  // agentRows must be the literal JSON-string value "\"\"", and ttsRows="[]".
  const templateId = String(input.templateId ?? 0);
  const isSimpleIvr = templateId === "0";
  return {
    userId: String(input.userId),
    campaignName: String(input.campaignName).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50),
    templateId,
    dtmf: isSimpleIvr ? "" : typeof input.dtmf === "string" ? input.dtmf : "",
    baseId: String(input.baseId),
    welcomePId: String(input.welcomePId),
    menuPId: input.menuPId ? String(input.menuPId) : "",
    noInputPId: input.noInputPId ? String(input.noInputPId) : "",
    wrongInputPId: input.wrongInputPId ? String(input.wrongInputPId) : "",
    thanksPId: input.thanksPId ? String(input.thanksPId) : "",
    scheduleTime: input.scheduleTime,
    smsSuccessApi: "{}",
    smsFailApi: "{}",
    smsDtmfApi: isSimpleIvr ? "" : "{}",
    callDurationSMS: "3",
    retries: isSimpleIvr ? 0 : Number(input.retries ?? 2) || 0,
    retryInterval: isSimpleIvr ? 0 : Number(input.retryInterval ?? 10) || 0,
    agentRows: "\"\"",
    menuWaitTime: isSimpleIvr ? "" : input.menuWaitTime != null && input.menuWaitTime !== "" ? String(input.menuWaitTime) : "",
    rePrompt: isSimpleIvr ? "" : input.rePrompt != null && input.rePrompt !== "" ? String(input.rePrompt) : "",
    location: typeof input.location === "string" ? input.location : "",
    clis: typeof input.clis === "string" ? input.clis : "",
    webhook: false,
    webhookId: "",
    ttsRows: "[]",
    gender: "",
    language: "",
    noAgentId: "",
    callPatchSuccessMessage: "",
    callPatchFailMessage: "",
  };
}

// ─── ElevenLabs TTS helper (supports Hinglish via multilingual_v2) ───
async function elevenLabsTTS(text: string, voiceId: string): Promise<Uint8Array> {
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not configured");
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true },
      }),
    },
  );
  if (!res.ok) {
    const errTxt = await res.text();
    throw new Error(`ElevenLabs TTS failed: ${res.status} ${errTxt}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

const VALID_PROMPT_CATEGORIES = new Set(["welcome", "menu", "thanks", "noinput", "wronginput"]);

function normalizePromptCategory(value: unknown): string {
  const category = String(value || "welcome").trim().toLowerCase();
  return VALID_PROMPT_CATEGORIES.has(category) ? category : "welcome";
}

async function uploadPromptToOBD(opts: {
  bytes: Uint8Array; fileName: string; fileType: "mp3" | "wav"; promptCategory: string; userId: string;
}): Promise<string> {
  const promptCategory = normalizePromptCategory(opts.promptCategory);
  const blob = new Blob([opts.bytes], { type: opts.fileType === "mp3" ? "audio/mpeg" : "audio/wav" });
  const fd = new FormData();
  fd.append("waveFile", blob, `${opts.fileName}.${opts.fileType}`);
  fd.append("userId", opts.userId);
  fd.append("fileName", opts.fileName);
  fd.append("promptCategory", promptCategory);
  fd.append("fileType", opts.fileType);
  const res = await obdFetch(`/api/obd/promptupload`, { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.promptId) throw new Error(`promptupload failed: ${JSON.stringify(data)}`);
  await supabase.from("voice_broadcast_voice_files").insert({
    prompt_id: String(data.promptId),
    file_name: opts.fileName,
    prompt_category: promptCategory,
    prompt_status: 0,
    is_active: false,
  }).then(() => {}, () => {});
  return String(data.promptId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    // ─── status / config ───
    if (action === "status") {
      const hasCreds = !!(Deno.env.get("OBD_USERNAME") && Deno.env.get("OBD_PASSWORD"));
      let loggedIn = false;
      let obdUserId: string | null = null;
      let error: string | null = null;
      if (hasCreds) {
        try {
          const { userId } = await getToken();
          loggedIn = true;
          obdUserId = userId;
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
        }
      }
      return json({ ok: true, hasCreds, loggedIn, obdUserId, error });
    }

    if (action === "login") {
      const { token, userId } = await getToken(true);
      return json({ ok: true, userId, token: token.slice(0, 20) + "..." });
    }

    // ─── voice prompts ───
    if (action === "list_voices") {
      const { userId } = await getToken();
      const res = await obdFetch(`/api/obd/prompts/${userId}`, { method: "GET" });
      const data = await res.json().catch(() => ({}));
      return json({ ok: res.ok, prompts: Array.isArray(data) ? data : [], raw: data });
    }

    if (action === "upload_voice") {
      // expects: fileBase64, fileName, fileType, promptCategory
      const { fileBase64, fileName, fileType = "wav", promptCategory = "welcome" } = body;
      if (!fileBase64 || !fileName) return json({ error: "fileBase64 and fileName required" }, 400);
      const { userId } = await getToken();
      const safePromptCategory = normalizePromptCategory(promptCategory);
      const binary = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([binary], { type: fileType === "mp3" ? "audio/mpeg" : "audio/wav" });
      const fd = new FormData();
      fd.append("waveFile", blob, `${fileName}.${fileType}`);
      fd.append("userId", userId);
      fd.append("fileName", fileName);
      fd.append("promptCategory", safePromptCategory);
      fd.append("fileType", fileType);
      const res = await obdFetch(`/api/obd/promptupload`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.promptId) {
        await supabase.from("voice_broadcast_voice_files").insert({
          prompt_id: String(data.promptId),
          file_name: fileName,
          prompt_category: safePromptCategory,
          prompt_status: 0,
          is_active: false,
        }).then(() => {}, () => {});
      }
      return json({ ok: res.ok, ...data });
    }

    // ─── base file ───
    if (action === "upload_base") {
      const { phones, baseName } = body;
      if (!Array.isArray(phones) || phones.length === 0) return json({ error: "phones[] required" }, 400);
      const { userId } = await getToken();
      const baseId = await uploadBaseForPhones(phones, baseName || `base-${Date.now()}`, userId);
      return json({ ok: true, baseId });
    }

    // ─── campaign management ───
    if (action === "compose") {
      const { userId } = await getToken();
      const { campaignName, baseId, welcomePId, templateId = 0, scheduleAt, dtmf = "",
        menuPId = "", noInputPId = "", wrongInputPId = "", thanksPId = "",
        retries = 2, retryInterval = 10, menuWaitTime = 5, rePrompt = 1 } = body;
      if (!campaignName || !baseId || !welcomePId) return json({ error: "campaignName, baseId, welcomePId required" }, 400);

      const { location: locationNorm, clis: clisNorm } = getObdRoutingFields(body);

      const { data: cfg } = await supabase.from("voice_broadcast_config").select("schedule_lead_minutes").maybeSingle();
      const leadMin = cfg?.schedule_lead_minutes ?? 11;
      const schedDate = scheduleAt ? new Date(scheduleAt) : new Date(Date.now() + leadMin * 60_000);
      const scheduleTime = formatSchedule(schedDate);

      try {
        await assertPromptApproved(welcomePId);
      } catch (e) {
        if (e instanceof RequestError && e.status === 409) {
          // Persist a pending row so it shows up in the Campaigns tab
          await supabase.from("voice_broadcast_campaigns").insert({
            campaign_id_external: null,
            base_id: String(baseId),
            campaign_name: campaignName,
            template_id: templateId,
            prompt_id: String(welcomePId),
            scheduled_at: schedDate.toISOString(),
            status: "pending_approval",
            stats: { pendingApproval: true, message: e.message },
          });
          return json({ ok: false, pendingApproval: true, message: e.message }, 200);
        }
        throw e;
      }

      // OBD requires unique campaign names per account. Always suffix with timestamp
      // to prevent silent "-1" duplicate-name rejections that previously got
      // stored as `scheduled` despite never actually being scheduled.
      const uniqueCampaignName = `${String(campaignName).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 35)}_${Date.now().toString(36)}`;

      const payload = buildSimpleIvrComposePayload({
        userId, campaignName: uniqueCampaignName, templateId, dtmf, baseId, welcomePId,
        menuPId, noInputPId, wrongInputPId, thanksPId, scheduleTime,
        retries, retryInterval, menuWaitTime, rePrompt, location: locationNorm, clis: clisNorm,
      });
      let data: Record<string, unknown>;
      try {
        data = await composeCampaign(payload);
      } catch (e) {
        if (e instanceof ObdComposeError) {
          await supabase.from("voice_broadcast_campaigns").insert({
            campaign_id_external: null,
            base_id: String(baseId),
            campaign_name: uniqueCampaignName,
            template_id: templateId,
            prompt_id: String(welcomePId),
            scheduled_at: schedDate.toISOString(),
            status: "compose_failed",
            stats: { obdRejected: true, status: e.status, response: e.response, payload: e.payload },
          });
          return json({
            ok: false,
            obdRejected: true,
            message: "OBD rejected the compose request as Parameters Incorrect. The failed campaign was saved for review; verify OBD location/CLI allocation for this account.",
            response: e.response,
          }, 200);
        }
        throw e;
      }
      const externalId = String(data?.campaignId ?? data?.campId ?? "");
      // OBD returns campaignId === "-1" for duplicate-name / soft rejections.
      // Treat any non-positive id as a failed schedule rather than silently
      // recording it as "scheduled".
      const idNum = Number(externalId);
      const composeOk = externalId !== "" && Number.isFinite(idNum) && idNum > 0;
      await supabase.from("voice_broadcast_campaigns").insert({
        campaign_id_external: composeOk ? externalId : null,
        base_id: String(baseId),
        campaign_name: uniqueCampaignName,
        template_id: templateId,
        prompt_id: String(welcomePId),
        scheduled_at: schedDate.toISOString(),
        status: composeOk ? "scheduled" : "compose_failed",
        stats: composeOk ? data : { obdSoftReject: true, response: data },
      });
      if (!composeOk) {
        return json({
          ok: false,
          obdRejected: true,
          message: String((data as any)?.message || "OBD did not schedule the campaign (no campaignId returned)."),
          response: data,
        }, 200);
      }
      return json({ ok: true, response: data });
    }

    if (action === "list_campaigns") {
      const { data } = await supabase
        .from("voice_broadcast_campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return json({ ok: true, campaigns: data || [] });
    }

    if (action === "analysis") {
      const { userId } = await getToken();
      const today = new Date();
      const start = body.startDate || new Date(today.getTime() - 30 * 86400000).toISOString().slice(0, 10);
      const end = body.endDate || today.toISOString().slice(0, 10);
      const res = await obdFetch(`/api/obd/campaign/analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          startDate: start,
          endDate: end,
          campaignType: body.campaignType || "All",
          campaignName: body.campaignName || "All",
          username: body.username || "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      return json({ ok: res.ok, data });
    }

    if (action === "pause" || action === "stop" || action === "resume") {
      const { campaignId } = body;
      if (!campaignId) return json({ error: "campaignId required" }, 400);
      const { userId } = await getToken();
      const payload: Record<string, unknown> = { campaignId: Number(campaignId) };
      if (action === "resume") payload.userId = userId;
      const res = await obdFetch(`/api/obd/campaign/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await supabase.from("voice_broadcast_campaigns").update({
          status: action === "pause" ? "paused" : action === "stop" ? "stopped" : "scheduled",
        }).eq("campaign_id_external", String(campaignId));
      }
      return json({ ok: res.ok, data });
    }

    if (action === "delete_voice") {
      const { promptId } = body;
      if (!promptId) return json({ error: "promptId required" }, 400);
      let obdOk = false;
      let obdMsg = "";
      try {
        const { userId } = await getToken();
        // OBD delete endpoint (best-effort — varies by account)
        const res = await obdFetch(`/api/obd/voicefile/delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, promptId: Number(promptId) }),
        });
        const data = await res.json().catch(() => ({}));
        obdOk = res.ok;
        obdMsg = (data as any)?.message || (data as any)?.status || "";
      } catch (e) {
        obdMsg = (e as Error).message;
      }
      // Always remove local cache so UI stays clean
      await supabase
        .from("voice_broadcast_voice_files")
        .delete()
        .eq("prompt_id", String(promptId));
      return json({ ok: true, obdOk, obdMsg, message: obdOk ? "Voice deleted" : `Removed locally${obdMsg ? ` (OBD: ${obdMsg})` : ""}` });
    }

    if (action === "delete_campaign") {
      const { campaignId } = body;
      if (!campaignId) return json({ error: "campaignId required" }, 400);
      let obdOk = false;
      let obdMsg = "";
      try {
        const { userId } = await getToken();
        // Best-effort: stop first so it can be removed even if running
        await obdFetch(`/api/obd/campaign/stop`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId: Number(campaignId) }),
        }).catch(() => null);
        const res = await obdFetch(`/api/obd/campaign/delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, campaignId: Number(campaignId) }),
        });
        const data = await res.json().catch(() => ({}));
        obdOk = res.ok;
        obdMsg = (data as any)?.message || (data as any)?.status || "";
      } catch (e) {
        obdMsg = (e as Error).message;
      }
      await supabase
        .from("voice_broadcast_campaigns")
        .delete()
        .eq("campaign_id_external", String(campaignId));
      return json({ ok: true, obdOk, obdMsg, message: obdOk ? "Campaign deleted" : `Removed locally${obdMsg ? ` (OBD: ${obdMsg})` : ""}` });
    }

    // ─── AI Auto-Assign: match approved voices to events by filename + set best send windows ───
    if (action === "auto_assign_events") {
      // 1. Pull approved voices from local cache (kept in sync with OBD)
      const { data: voices } = await supabase
        .from("voice_broadcast_voice_files")
        .select("prompt_id, file_name, prompt_status")
        .eq("prompt_status", 1);
      const approved = (voices || []) as Array<{ prompt_id: string; file_name: string }>;

      // 2. AI-best windows (IST) + cooldown per event, derived from EdTech engagement research
      // Heavy windows match peak app-open hours (evening study + lunch breaks).
      const PLAN: Record<string, {
        window: [string, string];
        cooldown: number;
        match: RegExp;
      }> = {
        signup_welcome:        { window: ["09:00", "21:30"], cooldown: 168, match: /welcome.*signup|signup.*welcome|new[_ ]?signup/i },
        onboarding_incomplete: { window: ["10:00", "20:00"], cooldown: 48,  match: /not[_ ]?onboarding|onboarding[_ ]?(complete|incomplete)/i },
        inactive_24h:          { window: ["18:00", "21:00"], cooldown: 48,  match: /within[_ ]?24|inactive.*within.*24/i },
        inactive_24h_plus:     { window: ["18:00", "21:00"], cooldown: 72,  match: /more[_ ]?than[_ ]?24/i },
        inactive_3d_7d:        { window: ["11:00", "13:00"], cooldown: 96,  match: /more[_ ]?than[_ ]?3[_ ]?days?|3day|7day/i },
        daily_ai_tools_alert:  { window: ["09:00", "10:30"], cooldown: 20,  match: /daily.*ai.*tools?|ai.*tools?.*alert/i },
        leaderboard_alert:     { window: ["19:00", "21:00"], cooldown: 24,  match: /leaderboard|competition/i },
        missing_activity:      { window: ["20:00", "21:30"], cooldown: 24,  match: /missing[_ ]?activity/i },
        weekly_performance:    { window: ["18:00", "19:30"], cooldown: 144, match: /weekly[_ ]?performance|performance[_ ]?summary/i },
        trial_end:             { window: ["11:00", "19:00"], cooldown: 48,  match: /trial[_ ]?end/i },
        premium_upgrade:       { window: ["11:00", "19:00"], cooldown: 72,  match: /premium[_ ]?upgrade/i },
        final_reengagement:    { window: ["17:00", "19:00"], cooldown: 168, match: /final[_ ]?re[-_ ]?engagement|re[-_ ]?engagement/i },
      };

      const assigned: Array<{ event_key: string; voice_prompt_id: string | null; file_name: string | null; window: string }> = [];
      for (const [event_key, plan] of Object.entries(PLAN)) {
        const match = approved.find(v => plan.match.test(v.file_name || ""));
        const patch = {
          voice_prompt_id: match?.prompt_id || null,
          send_window_start: plan.window[0],
          send_window_end: plan.window[1],
          cooldown_hours: plan.cooldown,
          is_active: !!match,
          updated_at: new Date().toISOString(),
        };
        await supabase.from("voice_broadcast_event_voices")
          .update(patch).eq("event_key", event_key);
        assigned.push({
          event_key,
          voice_prompt_id: patch.voice_prompt_id,
          file_name: match?.file_name || null,
          window: `${plan.window[0]}–${plan.window[1]} IST`,
        });
      }
      const matched = assigned.filter(a => a.voice_prompt_id).length;
      return json({ ok: true, matched, total: assigned.length, assigned });
    }



    // ─── Event Automation: list / save mapping / test call / view logs ───
    if (action === "list_event_voices") {
      const { data } = await supabase
        .from("voice_broadcast_event_voices")
        .select("*")
        .order("event_key");
      return json({ ok: true, events: data || [] });
    }

    if (action === "save_event_voice") {
      const { event_key, voice_prompt_id, is_active, cooldown_hours,
        send_window_start, send_window_end, location_json } = body;
      if (!event_key) return json({ error: "event_key required" }, 400);
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (voice_prompt_id !== undefined) patch.voice_prompt_id = voice_prompt_id || null;
      if (is_active !== undefined) patch.is_active = !!is_active;
      if (cooldown_hours !== undefined) patch.cooldown_hours = Number(cooldown_hours) || 72;
      if (send_window_start !== undefined) patch.send_window_start = send_window_start;
      if (send_window_end !== undefined) patch.send_window_end = send_window_end;
      if (location_json !== undefined) patch.location_json = location_json;
      const { error } = await supabase
        .from("voice_broadcast_event_voices")
        .update(patch)
        .eq("event_key", event_key);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "test_event_call") {
      const { event_key, user_id } = body;
      if (!event_key || !user_id) return json({ error: "event_key and user_id required" }, 400);
      const { data: ev } = await supabase
        .from("voice_broadcast_event_voices")
        .select("*")
        .eq("event_key", event_key)
        .maybeSingle();
      if (!ev?.voice_prompt_id) return json({ ok: false, error: "No voice assigned to this event" }, 400);

      // Reuse send_to_user logic via internal recursion-safe path
      const { data: profile } = await supabase
        .from("profiles").select("phone").eq("id", user_id).maybeSingle();
      const phone = normalizePhone(profile?.phone || "");
      if (phone.length < 10) return json({ ok: false, error: "User has no phone" }, 400);

      const { userId: obdUserId } = await getToken();
      await assertPromptApproved(ev.voice_prompt_id);
      const baseId = await uploadBaseForPhones([phone], `test-${event_key}-${Date.now()}`, obdUserId);
      const schedDate = new Date(Date.now() + 11 * 60_000);
      const routing = getObdRoutingFields({ location: ev.location_json });
      const composeRes = await composeCampaign(buildSimpleIvrComposePayload({
        userId: obdUserId,
        campaignName: `test_${event_key}_${Date.now().toString(36)}`,
        baseId,
        welcomePId: ev.voice_prompt_id,
        scheduleTime: formatSchedule(schedDate),
        location: routing.location,
        clis: routing.clis,
      }));
      const externalId = String(composeRes?.campaignId ?? "");
      const composeOk = externalId !== "" && Number(externalId) > 0;
      await supabase.from("voice_broadcast_event_logs").insert({
        event_key, user_id,
        voice_prompt_id: ev.voice_prompt_id,
        campaign_id_external: composeOk ? externalId : null,
        status: composeOk ? "queued" : "failed",
        response: composeRes,
      });
      return json({ ok: composeOk, campaignId: externalId, response: composeRes });
    }

    if (action === "list_event_logs") {
      const { event_key, limit = 100 } = body;
      let q = supabase
        .from("voice_broadcast_event_logs")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(Math.min(Number(limit) || 100, 500));
      if (event_key) q = q.eq("event_key", event_key);
      const { data } = await q;
      return json({ ok: true, logs: data || [] });
    }

    if (action === "run_event_now") {
      const { event_key } = body;
      // event_key is optional — when omitted, scheduler runs ALL active events
      const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/voice-broadcast-scheduler`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify(event_key ? { event_key } : {}),
      });
      const data = await res.json().catch(() => ({}));
      return json({ ok: true, scheduler: data });
    }


    // ─── BATCH event broadcast: ONE OBD campaign for ALL eligible users
    // (Solves "Campaign Hourly Limit" by collapsing N campaigns → 1)
    if (action === "send_event_batch") {
      const { event_key, user_ids, prompt_id: overridePromptId } = body;
      if (!event_key || !Array.isArray(user_ids) || user_ids.length === 0) {
        return json({ error: "event_key and user_ids[] required" }, 400);
      }

      const { data: cfg } = await supabase
        .from("voice_broadcast_config").select("*").maybeSingle();
      if (!cfg?.is_enabled) {
        return json({ ok: false, skipped: true, reason: "broadcast_disabled" });
      }

      const { data: ev } = await supabase
        .from("voice_broadcast_event_voices")
        .select("*").eq("event_key", event_key).maybeSingle();
      const promptId = overridePromptId || ev?.voice_prompt_id;
      if (!promptId) return json({ ok: false, skipped: true, reason: "no_prompt_assigned" });

      // Fetch phones for all user_ids
      const { data: profiles } = await supabase
        .from("profiles").select("id, phone").in("id", user_ids);
      const phoneMap = new Map<string, string>();
      const phones: string[] = [];
      for (const p of profiles || []) {
        const ph = normalizePhone(p.phone || "");
        if (ph.length >= 10) {
          phoneMap.set(p.id, ph);
          phones.push(ph);
        }
      }

      if (phones.length === 0) {
        return json({ ok: false, skipped: true, reason: "no_valid_phones" });
      }

      const { userId: obdUserId } = await getToken();
      await assertPromptApproved(promptId);
      const baseName = `evt-${event_key}-${Date.now()}`;
      const baseId = await uploadBaseForPhones(phones, baseName, obdUserId);

      const schedDate = new Date(Date.now() + (cfg.schedule_lead_minutes ?? 11) * 60_000);
      const routing = getObdRoutingFields({ location: ev?.location_json });

      let composeRes: any;
      let composeOk = false;
      let externalId = "";
      try {
        composeRes = await composeCampaign(buildSimpleIvrComposePayload({
          userId: obdUserId,
          campaignName: `${event_key}_${Date.now().toString(36)}`,
          baseId,
          welcomePId: promptId,
          scheduleTime: formatSchedule(schedDate),
          location: routing.location,
          clis: routing.clis,
        }));
        externalId = String(composeRes?.campaignId ?? composeRes?.campId ?? "");
        composeOk = externalId !== "" && Number(externalId) > 0;
      } catch (e: any) {
        composeRes = { ok: false, message: e?.message || String(e), response: e?.response };
      }

      // Bulk insert event logs — one row per user (so cooldowns work)
      const rows = Array.from(phoneMap.entries()).map(([uid, ph]) => ({
        event_key,
        user_id: uid,
        phone: ph,
        voice_prompt_id: String(promptId),
        campaign_id_external: composeOk ? externalId : null,
        status: composeOk ? "queued" : "failed",
        response: composeOk
          ? { batched: true, campaignId: externalId, recipients: phones.length }
          : composeRes,
      }));
      await supabase.from("voice_broadcast_event_logs").insert(rows).then(() => {}, () => {});

      // Also write the campaign master row
      await supabase.from("voice_broadcast_campaigns").insert({
        campaign_id_external: composeOk ? externalId : null,
        base_id: baseId,
        campaign_name: `batch:${event_key}`,
        template_id: 0,
        prompt_id: String(promptId),
        scheduled_at: schedDate.toISOString(),
        status: composeOk ? "scheduled" : "compose_failed",
        stats: { event_key, recipients: phones.length, response: composeRes },
      }).then(() => {}, () => {});

      return json({
        ok: composeOk,
        campaignId: composeOk ? externalId : null,
        recipients: phones.length,
        scheduled_at: schedDate.toISOString(),
        message: composeOk ? "batch_scheduled" : String(composeRes?.message || "compose_failed"),
      });
    }

    // ─── one-shot per-user broadcast (used by signup & re-engagement) ───

    if (action === "send_to_user") {
      const { user_id, trigger_key = "manual", prompt_id: overridePromptId } = body;
      if (!user_id) return json({ error: "user_id required" }, 400);

      const { data: cfg } = await supabase
        .from("voice_broadcast_config")
        .select("*")
        .maybeSingle();
      if (!cfg?.is_enabled) {
        return json({ ok: false, skipped: true, reason: "broadcast_disabled" });
      }

      const promptId = overridePromptId || cfg.default_welcome_prompt_id;
      if (!promptId) return json({ ok: false, skipped: true, reason: "no_default_prompt" });

      const { data: profile } = await supabase
        .from("profiles")
        .select("phone, display_name")
        .eq("id", user_id)
        .maybeSingle();

      const phone = normalizePhone(profile?.phone || "");
      if (phone.length < 10) {
        await supabase.from("voice_broadcast_logs").insert({
          user_id, phone, trigger_key, prompt_id: promptId,
          status: "skipped", response: { reason: "no_phone" },
        }).then(() => {}, () => {});
        return json({ ok: false, skipped: true, reason: "no_phone" });
      }

      const { userId } = await getToken();
      const baseName = `auto-${trigger_key}-${user_id.slice(0, 8)}-${Date.now()}`;
      await assertPromptApproved(promptId);
      const baseId = await uploadBaseForPhones([phone], baseName, userId);

      const schedDate = new Date(Date.now() + (cfg.schedule_lead_minutes ?? 11) * 60_000);
      const routing = getObdRoutingFields(body);
      const composeRes = await composeCampaign(buildSimpleIvrComposePayload({
        userId,
        campaignName: `${trigger_key}_${user_id.slice(0, 8)}_${Date.now()}`,
        baseId,
        welcomePId: promptId,
        scheduleTime: formatSchedule(schedDate),
        location: routing.location,
        clis: routing.clis,
      }));
      const externalId = String(composeRes?.campaignId ?? composeRes?.campId ?? "");
      const idNum = Number(externalId);
      const composeOk = externalId !== "" && Number.isFinite(idNum) && idNum > 0;

      await supabase.from("voice_broadcast_logs").insert({
        user_id, phone, trigger_key,
        prompt_id: String(promptId),
        campaign_id_external: composeOk ? externalId : null,
        status: composeOk ? "queued" : "failed",
        response: composeRes,
      }).then(() => {}, () => {});

      await supabase.from("voice_broadcast_campaigns").insert({
        campaign_id_external: composeOk ? externalId : null,
        base_id: baseId,
        campaign_name: `auto:${trigger_key}:${user_id.slice(0, 8)}`,
        template_id: 0,
        prompt_id: String(promptId),
        scheduled_at: schedDate.toISOString(),
        status: composeOk ? "scheduled" : "compose_failed",
        stats: composeOk ? composeRes : { obdSoftReject: true, response: composeRes },
      }).then(() => {}, () => {});

      return json({
        ok: composeOk,
        campaignId: composeOk ? externalId : null,
        scheduled_at: schedDate.toISOString(),
        message: composeOk ? undefined : String((composeRes as any)?.message || "OBD did not schedule the campaign."),
      });
    }

    // ─── TTS Preview: generate a short sample and return as base64 (no OBD upload) ───
    if (action === "tts_preview") {
      const { text, voiceId = "pFZP5JQG7iQjIQuC4Bku" } = body;
      const sample = String(text || "Namaste! ACRY AI mein aapka swagat hai. Yeh ek sample voice preview hai.").slice(0, 400);
      const audio = await elevenLabsTTS(sample, String(voiceId));
      return json({ ok: true, audioBase64: bytesToBase64(audio), mime: "audio/mpeg" });
    }

    // ─── TTS: generate voice from Hinglish/Hindi/English text and save as OBD prompt ───
    if (action === "tts_generate_voice") {
      const { text, voiceName, voiceId = "pFZP5JQG7iQjIQuC4Bku", promptCategory = "welcome" } = body;
      if (!text || !voiceName) return json({ error: "text and voiceName required" }, 400);
      const { userId } = await getToken();
      const audio = await elevenLabsTTS(String(text), String(voiceId));
      const safeName = String(voiceName).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
      const promptId = await uploadPromptToOBD({
        bytes: audio, fileName: safeName, fileType: "mp3", promptCategory, userId,
      });
      return json({ ok: true, promptId, fileName: safeName });
    }

    // ─── TTS Broadcast: text → voice → upload → schedule campaign in one shot ───
    if (action === "tts_broadcast") {
      const {
        text, phones, campaignName,
        voiceId = "pFZP5JQG7iQjIQuC4Bku", promptCategory = "welcome",
        scheduleAt,
      } = body;
      if (!text || !campaignName) return json({ error: "text and campaignName required" }, 400);
      const phoneList: string[] = Array.isArray(phones) ? phones : [];
      if (phoneList.length === 0) return json({ error: "phones[] required" }, 400);

      const { userId } = await getToken();
      const audio = await elevenLabsTTS(String(text), String(voiceId));
      const safeName = `tts-${String(campaignName).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40)}-${Date.now()}`;
      const promptId = await uploadPromptToOBD({
        bytes: audio, fileName: safeName, fileType: "mp3", promptCategory, userId,
      });
      return json({
        ok: false,
        promptId,
        fileName: safeName,
        pendingApproval: true,
        message: `Voice generated as prompt #${promptId}. OBD requires admin approval before campaign compose; sync Voice Library after approval, then schedule the broadcast.`,
      }, 202);
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    if (e instanceof RequestError && e.status === 409) {
      return json({ ok: false, pendingApproval: true, message: e.message }, 200);
    }
    console.error("[voice-broadcast]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, e instanceof RequestError ? e.status : 500);
  }
});
