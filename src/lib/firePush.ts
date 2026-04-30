import { supabase } from "@/integrations/supabase/client";

/**
 * Fire any OneSignal event. Non-blocking — never throws.
 * Usage: firePush("streak_at_risk", { streak: 7 })
 */
export async function firePush(eventKey: string, data: Record<string, unknown> = {}, userId?: string) {
  try {
    let uid = userId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      uid = user?.id;
    }
    if (!uid) return;
    await supabase.functions.invoke("onesignal-dispatch", {
      body: { action: "send_event", event_key: eventKey, user_id: uid, data },
    });
  } catch { /* swallow */ }
}
