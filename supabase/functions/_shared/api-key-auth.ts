import { createClient } from "npm:@supabase/supabase-js@2";

export type AdminClient = ReturnType<typeof createClient>;

const API_KEY_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export const extractApiKey = (value: string) => value.match(/acry_[A-Za-z0-9]+/)?.[0] || "";

const generateApiKeyValue = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(40));
  let key = "acry_";

  for (const byte of bytes) {
    key += API_KEY_CHARS[byte % API_KEY_CHARS.length];
  }

  return key;
};

async function deactivateStaleApiKey(adminClient: AdminClient, apiKeyId: string) {
  const { error } = await adminClient
    .from("api_keys")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", apiKeyId);

  if (error) {
    console.warn("[api-key-auth] Failed to deactivate stale api key", { apiKeyId, error: error.message });
  }
}

async function resolveActiveOwner(adminClient: AdminClient, apiKeyId: string, createdBy: string) {
  const { data: authUserData, error: authUserError } = await adminClient.auth.admin.getUserById(createdBy);

  if (!authUserError && authUserData?.user?.id) {
    return createdBy;
  }

  console.warn("[api-key-auth] API key owner missing, deactivating stale key", {
    apiKeyId,
    createdBy,
    error: authUserError?.message,
  });
  await deactivateStaleApiKey(adminClient, apiKeyId);
  return null;
}

export async function issueUserApiKey(
  adminClient: AdminClient,
  userId: string,
  options?: {
    environment?: string;
    keyType?: string;
    name?: string;
    permissions?: string[];
    rateLimitPerMinute?: number;
    usageLimit?: number | null;
  },
) {
  const { data: existingKeys, error: existingKeysError } = await adminClient
    .from("api_keys")
    .select("key_hash")
    .eq("created_by", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(10);

  if (existingKeysError) {
    console.warn("[api-key-auth] Failed to look up existing api keys", {
      userId,
      error: existingKeysError.message,
    });
  }

  const reusableKey = existingKeys
    ?.map((row) => typeof row.key_hash === "string" ? extractApiKey(row.key_hash) : "")
    .find(Boolean);

  if (reusableKey) {
    return reusableKey;
  }

  const rawKey = generateApiKeyValue();
  const { error: insertError } = await adminClient
    .from("api_keys")
    .insert({
      name: options?.name ?? "Mobile OTP API Key",
      key_hash: rawKey,
      key_prefix: `${rawKey.substring(0, 10)}...`,
      environment: options?.environment ?? "production",
      key_type: options?.keyType ?? "app",
      permissions: options?.permissions ?? ["user_api"],
      rate_limit_per_minute: options?.rateLimitPerMinute ?? 60,
      usage_limit: options?.usageLimit ?? null,
      notes: "Auto-issued during mobile OTP authentication",
      created_by: userId,
    });

  if (insertError) {
    throw new Error(`Failed to issue API key: ${insertError.message}`);
  }

  return rawKey;
}

export async function resolveApiKeyIdentity(adminClient: AdminClient, rawCandidates: string[]) {
  const candidates = rawCandidates
    .map((value) => value.startsWith("Bearer ") ? value.replace("Bearer ", "").trim() : value.trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    const extractedApiKey = extractApiKey(candidate);
    if (!extractedApiKey) continue;

    const storedPrefix = `${extractedApiKey.substring(0, 10)}...`;
    const { data: keyRow, error } = await adminClient
      .from("api_keys")
      .select("id, created_by")
      .eq("key_prefix", storedPrefix)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.warn("[api-key-auth] Prefix lookup failed", { storedPrefix, error: error.message });
      continue;
    }

    if (!keyRow?.created_by) continue;

    const activeOwnerId = await resolveActiveOwner(adminClient, keyRow.id, keyRow.created_by);
    if (activeOwnerId) {
      return { userId: activeOwnerId, apiKey: extractedApiKey };
    }
  }

  for (const candidate of candidates) {
    if (!candidate) continue;

    const { data: keyRow, error } = await adminClient
      .from("api_keys")
      .select("id, created_by")
      .eq("key_hash", candidate)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.warn("[api-key-auth] Hash lookup failed", { error: error.message });
      continue;
    }

    if (!keyRow?.created_by) continue;

    const activeOwnerId = await resolveActiveOwner(adminClient, keyRow.id, keyRow.created_by);
    if (activeOwnerId) {
      return { userId: activeOwnerId, apiKey: extractApiKey(candidate) };
    }
  }

  return { userId: null, apiKey: "" };
}
