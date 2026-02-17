import { supabase } from "@/integrations/supabase/client";

/**
 * Dispatch a WhatsApp notification for a user event via the central whatsapp-notify function.
 * Non-blocking — errors are silently caught.
 */
export async function notifyWhatsApp(
  eventType: string,
  data: Record<string, any> = {}
): Promise<void> {
  try {
    await supabase.functions.invoke("whatsapp-notify", {
      body: { event_type: eventType, ...data },
    });
  } catch {
    // Non-blocking
  }
}
