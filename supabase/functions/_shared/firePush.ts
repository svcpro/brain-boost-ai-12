// Server-side helper: fire a registered push trigger via push-automation-engine.
// Fire-and-forget; never throws and never blocks the caller.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

export function firePushServer(
  trigger_key: string,
  user_id: string,
  variables: Record<string, unknown> = {}
): void {
  if (!SUPABASE_URL || !SERVICE_ROLE || !user_id) return;
  // Fire-and-forget — do NOT await
  fetch(`${SUPABASE_URL}/functions/v1/push-automation-engine`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE}`,
      apikey: SERVICE_ROLE,
    },
    body: JSON.stringify({
      action: "fire_trigger",
      trigger_key,
      user_id,
      variables,
    }),
  }).catch((e) => console.warn(`[firePushServer:${trigger_key}]`, e?.message ?? e));
}

export function firePushBulkServer(
  trigger_key: string,
  target_user_ids: string[],
  variables: Record<string, unknown> = {}
): void {
  if (!SUPABASE_URL || !SERVICE_ROLE || !target_user_ids?.length) return;
  fetch(`${SUPABASE_URL}/functions/v1/push-automation-engine`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE}`,
      apikey: SERVICE_ROLE,
    },
    body: JSON.stringify({
      action: "bulk_trigger",
      trigger_key,
      target_user_ids,
      variables,
    }),
  }).catch((e) => console.warn(`[firePushBulkServer:${trigger_key}]`, e?.message ?? e));
}
