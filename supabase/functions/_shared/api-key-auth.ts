import { createClient } from "npm:@supabase/supabase-js@2";

export type AdminClient = ReturnType<typeof createClient>;

export const extractApiKey = (value: string) => value.match(/acry_[A-Za-z0-9]+/)?.[0] || "";

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
