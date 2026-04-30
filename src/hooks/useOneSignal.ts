import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  initOneSignal,
  setOneSignalUser,
  requestPushPermission,
  getOneSignalSubscription,
  getOneSignalLastError,
  optInPush,
  optOutPush,
  registerPlayerWithBackend,
} from "@/lib/onesignal";

export const useOneSignal = () => {
  const { user } = useAuth();
  const [ready, setReady] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [playerId, setPlayerId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  // Init + bind user
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await initOneSignal();
      if (!ok || cancelled) {
        setError(getOneSignalLastError());
        setReady(true);
        return;
      }
      setError(null);
      if (user) await setOneSignalUser(user.id);
      const sub = await getOneSignalSubscription();
      if (cancelled) return;
      setSubscribed(sub.subscribed);
      setPlayerId(sub.playerId);
      if (sub.subscribed && sub.playerId && user) {
        registerPlayerWithBackend(sub.playerId);
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const enable = useCallback(async () => {
    const granted = await requestPushPermission();
    if (!granted) {
      setError(getOneSignalLastError());
      return false;
    }
    await optInPush();
    const sub = await getOneSignalSubscription();
    setSubscribed(sub.subscribed);
    setPlayerId(sub.playerId);
    if (sub.playerId && user) await registerPlayerWithBackend(sub.playerId);
    return sub.subscribed;
  }, [user]);

  const disable = useCallback(async () => {
    await optOutPush();
    setSubscribed(false);
  }, []);

  return { ready, subscribed, playerId, error, enable, disable, supported: typeof window !== "undefined" && "Notification" in window };
};
