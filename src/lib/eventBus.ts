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
 * Track user engagement for send-time optimization (non-blocking).
 */
export async function trackEngagement(type: string = "app_open"): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.functions.invoke("intelligent-notify-engine", {
      body: { action: "track_engagement", user_id: user.id, data: { type } },
    });
  } catch {
    // Non-blocking
  }
}

/**
 * Emit dynamic reward after a productive session.
 */
export async function emitDynamicReward(data: {
  session_duration?: number;
  topics_reviewed?: number;
  confidence_delta?: number;
  memory_points_saved?: number;
}): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const rewardRes = await supabase.functions.invoke("intelligent-notify-engine", {
      body: { action: "compute_dynamic_reward", user_id: user.id, data },
    });

    if (rewardRes.data?.rewards?.length > 0) {
      await emitEvent("dynamic_reward", {
        rewards: rewardRes.data.rewards,
        ...data,
      }, {
        title: "🏆 Session Complete!",
        body: rewardRes.data.rewards[0],
      });
    }
  } catch {
    // Non-blocking
  }
}

/**
 * Check and emit referral trigger on milestones.
 */
export async function emitReferralTrigger(milestoneType: string): Promise<{ trigger: boolean; message?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { trigger: false };

    const res = await supabase.functions.invoke("growth-engine", {
      body: { action: "check_referral_trigger", user_id: user.id, data: { milestone_type: milestoneType } },
    });
    return res.data || { trigger: false };
  } catch {
    return { trigger: false };
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
