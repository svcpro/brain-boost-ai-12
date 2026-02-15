import { supabase } from "@/integrations/supabase/client";

type EventCategory = "study" | "memory" | "passive" | "behavior" | "exam";

export async function trackMLEvent(
  userId: string,
  eventType: string,
  category: EventCategory,
  payload: Record<string, any> = {}
) {
  try {
    await supabase.from("ml_events").insert({
      user_id: userId,
      event_type: eventType,
      event_category: category,
      payload,
    });
  } catch (e) {
    console.warn("ML event tracking failed:", e);
    // Non-blocking - don't throw
  }
}
