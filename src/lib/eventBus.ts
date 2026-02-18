import { supabase } from "@/integrations/supabase/client";

/**
 * Central Event Bus – emits events to the Omnichannel Notification Engine.
 * Every user action flows through here to guarantee zero missed triggers.
 */
export async function emitEvent(
  eventType: string,
  data: Record<string, any> = {},
  options: { source?: string; title?: string; body?: string } = {}
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.functions.invoke("omnichannel-notify", {
      body: {
        event_type: eventType,
        user_id: user.id,
        source: options.source || "web",
        data,
        title: options.title,
        body: options.body,
      },
    });
  } catch {
    // Non-blocking – never crash the UI for notification failures
  }
}

/**
 * Admin broadcast – sends to multiple users (service-role only via edge function).
 */
export async function emitAdminEvent(
  eventType: string,
  userIds: string[],
  data: Record<string, any> = {},
  options: { title?: string; body?: string } = {}
): Promise<void> {
  try {
    await supabase.functions.invoke("omnichannel-notify", {
      body: {
        event_type: eventType,
        user_ids: userIds,
        source: "admin",
        data,
        title: options.title,
        body: options.body,
      },
    });
  } catch {
    // Non-blocking
  }
}
