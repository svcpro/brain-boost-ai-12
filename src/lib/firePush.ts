import { supabase } from "@/integrations/supabase/client";

/**
 * Fire a registered push trigger for a user via push-automation-engine.
 *
 * - Honours admin-configured cooldowns, templates, AI personalisation, queueing & analytics.
 * - Always fire-and-forget (zero UI latency). Never throws.
 *
 * Use this instead of calling `send-push-notification` directly so triggers
 * stay centrally manageable from the Push Notification Command Center.
 */
export type PushTriggerKey =
  // user_action
  | "user_signup" | "profile_setup" | "exam_setup"
  | "study_session_start" | "study_session_complete" | "user_login"
  // ai_prediction
  | "memory_forget_risk" | "memory_strength_decreased" | "memory_strength_improved"
  | "weak_topic_detected" | "brain_performance_improved" | "brain_performance_declined"
  // study_reminder
  | "study_reminder" | "inactive_hours" | "inactive_days" | "revision_reminder"
  // improvement
  | "improvement_detected" | "fix_session_recommended" | "fix_session_completed"
  // rank_exam
  | "rank_improved" | "rank_declined" | "rank_prediction_updated"
  | "exam_approaching" | "exam_countdown"
  // engagement
  | "streak_at_risk" | "streak_milestone" | "streak_broken"
  // community
  | "community_reply" | "community_comment" | "community_mention" | "ai_answer_posted"
  // billing
  | "payment_successful" | "payment_failed" | "subscription_activated" | "subscription_expiring"
  // security
  | "new_device_login" | "password_changed" | "suspicious_activity"
  // admin
  | "admin_announcement";

export const firePush = (
  trigger_key: PushTriggerKey,
  user_id: string,
  variables: Record<string, unknown> = {}
): void => {
  if (!user_id) return;
  // Fire-and-forget. Network errors must never block UI.
  void supabase.functions
    .invoke("push-automation-engine", {
      body: { action: "fire_trigger", trigger_key, user_id, variables },
    })
    .catch((err) => {
      // Silent — admin can re-fire from logs.
      if (typeof console !== "undefined") {
        console.warn(`[firePush:${trigger_key}]`, err?.message ?? err);
      }
    });
};

/**
 * Fire a trigger for many users at once (e.g. broadcast to followers).
 */
export const firePushBulk = (
  trigger_key: PushTriggerKey,
  target_user_ids: string[],
  variables: Record<string, unknown> = {}
): void => {
  if (!target_user_ids?.length) return;
  void supabase.functions
    .invoke("push-automation-engine", {
      body: { action: "bulk_trigger", trigger_key, target_user_ids, variables },
    })
    .catch((err) => {
      if (typeof console !== "undefined") {
        console.warn(`[firePushBulk:${trigger_key}]`, err?.message ?? err);
      }
    });
};
