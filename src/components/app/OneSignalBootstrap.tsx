import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  initOneSignal,
  setOneSignalUser,
  getOneSignalSubscription,
  requestPushPermission,
  optInPush,
  registerPlayerWithBackend,
} from "@/lib/onesignal";

const PROMPT_KEY = "acry_push_prompt_shown_v1";

const OneSignalBootstrap = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const ok = await initOneSignal();
      if (!ok || cancelled) return;

      await setOneSignalUser(user.id);

      // Ensure prefs row exists & enabled by default for every user (idempotent).
      supabase
        .from("push_user_prefs")
        .upsert({ user_id: user.id, master_enabled: true }, { onConflict: "user_id", ignoreDuplicates: true })
        .then(() => {});

      // If already subscribed, just register the player and exit.
      const sub = await getOneSignalSubscription();
      if (sub.subscribed && sub.playerId) {
        registerPlayerWithBackend(sub.playerId);
        return;
      }

      // Browsers require a user gesture for the prompt on most platforms; OneSignal
      // handles native prompt. We trigger it once per device. If the browser blocks
      // (no gesture / denied), it silently fails — user can still enable from You tab.
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        if (localStorage.getItem(PROMPT_KEY)) return;
        localStorage.setItem(PROMPT_KEY, "1");

        // Delay slightly so app is interactive before prompting.
        setTimeout(async () => {
          const granted = await requestPushPermission();
          if (!granted) return;
          await optInPush();
          const s = await getOneSignalSubscription();
          if (s.playerId) registerPlayerWithBackend(s.playerId);
        }, 4000);
      } else if (Notification.permission === "granted") {
        // Permission already granted but not opted-in — opt them in.
        await optInPush();
        const s = await getOneSignalSubscription();
        if (s.playerId) registerPlayerWithBackend(s.playerId);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return null;
};

export default OneSignalBootstrap;
