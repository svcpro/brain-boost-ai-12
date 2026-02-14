import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Try multiple sources for the VAPID public key
const getVapidPublicKey = (): string | null => {
  // 1. Build-time env var
  const envKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (envKey && envKey.length > 10) return envKey;
  
  // 2. Check localStorage cache from a previous successful fetch
  const cached = localStorage.getItem("vapid_public_key");
  if (cached && cached.length > 10) return cached;
  
  return null;
};

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if already subscribed
  useEffect(() => {
    if (!user || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.ready.then(async (reg: any) => {
      const sub = await reg.pushManager?.getSubscription();
      setSubscribed(!!sub);
    });
  }, [user]);

  // Try to fetch VAPID key from edge function and cache it
  useEffect(() => {
    const fetchVapidKey = async () => {
      if (getVapidPublicKey()) return; // Already have it
      try {
        const { data } = await supabase.functions.invoke("send-push-notification", {
          body: { action: "get-vapid-key" },
        });
        if (data?.vapidPublicKey) {
          localStorage.setItem("vapid_public_key", data.vapidPublicKey);
        }
      } catch {
        // Silent - will handle in subscribe
      }
    };
    fetchVapidKey();
  }, []);

  const subscribe = useCallback(async () => {
    setError(null);

    if (!user) {
      setError("Please sign in to enable notifications");
      return false;
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setError("Push notifications are not supported in this browser");
      return false;
    }

    const vapidKey = getVapidPublicKey();
    if (!vapidKey) {
      setError("Push notification service is not configured yet. Please try again later.");
      console.warn("VAPID public key not available from env or cache");
      return false;
    }

    try {
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setError("Notification permission was denied. Enable it in browser settings.");
        return false;
      }

      // Get service worker registration
      const reg: any = await navigator.serviceWorker.ready;

      // Subscribe to push
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const subJson = sub.toJSON();
      const p256dh = subJson.keys?.p256dh;
      const auth = subJson.keys?.auth;

      if (!p256dh || !auth || !subJson.endpoint) {
        setError("Failed to create push subscription");
        return false;
      }

      // Store in database
      const { error: dbError } = await (supabase as any)
        .from("push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            endpoint: subJson.endpoint,
            p256dh,
            auth,
          },
          { onConflict: "user_id,endpoint" }
        );

      if (dbError) {
        console.error("Failed to save push subscription:", dbError);
        setError("Failed to save subscription. Please try again.");
        return false;
      }

      setSubscribed(true);
      return true;
    } catch (err) {
      console.error("Push subscription failed:", err);
      setError("Something went wrong. Please try again.");
      return false;
    }
  }, [user]);

  const unsubscribe = useCallback(async () => {
    if (!user || !("serviceWorker" in navigator)) return;

    try {
      const reg: any = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager?.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        
        await (supabase as any)
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", endpoint);
      }
      setSubscribed(false);
    } catch (err) {
      console.error("Unsubscribe failed:", err);
    }
  }, [user]);

  return {
    permission,
    subscribed,
    supported: "serviceWorker" in navigator && "PushManager" in window,
    error,
    subscribe,
    unsubscribe,
  };
};
