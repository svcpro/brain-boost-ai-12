import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  initOneSignal,
  setOneSignalUser,
  getOneSignalSubscription,
  getOneSignalLastError,
  requestPushPermission,
  optInPush,
  registerPlayerWithBackend,
  onSubscriptionChange,
  registerNativePushSubscription,
} from "@/lib/onesignal";

const PROMPT_KEY = "acry_push_prompt_shown_v1";

const OneSignalBootstrap = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    (async () => {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        registerNativePushSubscription();
      }

      const ok = await initOneSignal();
      if (!ok || cancelled) {
        const reason = getOneSignalLastError();
        if (reason) console.warn("[OneSignal] bootstrap skipped:", reason);
        return;
      }

      await setOneSignalUser(user.id);

      // Idempotent prefs row.
      supabase
        .from("push_user_prefs")
        .upsert({ user_id: user.id, master_enabled: true }, { onConflict: "user_id", ignoreDuplicates: true })
        .then(() => {});

      // Listen for any subscription change → auto-register player_id with backend.
      unsubscribe = onSubscriptionChange(async (s) => {
        if (s.subscribed && s.playerId) {
          await registerPlayerWithBackend(s.playerId);
        }
      });

      // Existing subscription check.
      const sub = await getOneSignalSubscription();
      if (sub.subscribed && sub.playerId) {
        registerPlayerWithBackend(sub.playerId);
        return;
      }

      // Auto-prompt once per device.
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        if (localStorage.getItem(PROMPT_KEY)) return;
        localStorage.setItem(PROMPT_KEY, "1");
        setTimeout(async () => {
          const granted = await requestPushPermission();
          if (!granted) return;
          await registerNativePushSubscription();
          await optInPush();
          const s = await getOneSignalSubscription();
          if (s.playerId) registerPlayerWithBackend(s.playerId);
        }, 4000);
      } else if (Notification.permission === "granted") {
        await optInPush();
        const s = await getOneSignalSubscription();
        if (s.playerId) registerPlayerWithBackend(s.playerId);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [user]);

  return null;
};

export default OneSignalBootstrap;
