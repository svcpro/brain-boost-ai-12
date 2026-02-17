import { useCallback } from "react";

/**
 * Hook to fire email triggers from any component.
 * Calls the trigger-email edge function which checks
 * if the trigger is enabled, respects cooldowns, and
 * queues/sends the email automatically.
 */
export function useEmailTrigger() {
  const triggerEmail = useCallback(async (
    triggerKey: string,
    userId: string,
    variables: Record<string, unknown> = {}
  ) => {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/trigger-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ trigger_key: triggerKey, user_id: userId, variables }),
        }
      );
      if (!res.ok) {
        console.warn(`Email trigger ${triggerKey} failed:`, await res.text());
      }
    } catch (e) {
      console.warn(`Email trigger ${triggerKey} error:`, e);
    }
  }, []);

  return { triggerEmail };
}
