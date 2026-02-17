// Shared WhatsApp notification dispatcher helper
// Used by edge functions to send WhatsApp notifications via the central whatsapp-notify function

export async function dispatchWhatsApp(
  eventType: string,
  userId: string | string[],
  data: Record<string, any> = {}
): Promise<void> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return;

  try {
    const body: Record<string, any> = { event_type: eventType, data };
    if (Array.isArray(userId)) {
      body.user_ids = userId;
    } else {
      body.user_id = userId;
    }

    await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-notify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.warn(`WhatsApp dispatch (${eventType}) failed:`, e);
    // Non-blocking — don't throw
  }
}
