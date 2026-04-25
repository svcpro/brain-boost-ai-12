/**
 * Server-side event emitter for edge functions.
 * Calls the omnichannel-notify function to dispatch notifications.
 */
export async function emitServerEvent(
  eventType: string,
  userId: string | string[],
  data: Record<string, any> = {},
  options: { title?: string; body?: string; source?: string } = {}
): Promise<void> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) return;

  try {
    const body: Record<string, any> = {
      event_type: eventType,
      source: options.source || "system",
      data,
      title: options.title,
      body: options.body,
    };

    if (Array.isArray(userId)) {
      body.user_ids = userId;
    } else {
      body.user_id = userId;
    }

    await Promise.allSettled([
      fetch(`${SUPABASE_URL}/functions/v1/omnichannel-notify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }),
      fetch(`${SUPABASE_URL}/functions/v1/sms-event-engine`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_type: eventType,
          ...(Array.isArray(userId) ? { user_ids: userId } : { user_id: userId }),
          data,
          source: options.source || "system",
        }),
      }),
    ]);
  } catch (e) {
    console.warn(`Event dispatch (${eventType}) failed:`, e);
  }
}
