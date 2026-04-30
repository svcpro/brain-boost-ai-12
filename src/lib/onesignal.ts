// OneSignal Web SDK loader + helpers.
// Uses CDN to avoid bundle bloat. Lazily initializes once.
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    OneSignal?: any;
    OneSignalDeferred?: any[];
  }
}

let initPromise: Promise<boolean> | null = null;

async function fetchAppId(): Promise<string | null> {
  // Cache first
  const cached = localStorage.getItem("onesignal_app_id");
  if (cached) return cached;
  try {
    const { data } = await supabase.functions.invoke("onesignal-dispatch", {
      body: { action: "get_app_config" },
    });
    if (data?.app_id) {
      localStorage.setItem("onesignal_app_id", data.app_id);
      return data.app_id;
    }
  } catch { /* ignore */ }
  return null;
}

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.OneSignal) return resolve();
    const existing = document.querySelector('script[data-onesignal-sdk]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("OneSignal SDK load failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    s.async = true;
    s.defer = true;
    s.setAttribute("data-onesignal-sdk", "1");
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("OneSignal SDK load failed"));
    document.head.appendChild(s);
  });
}

export function initOneSignal(): Promise<boolean> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const appId = await fetchAppId();
      if (!appId) return false;
      await loadScript();
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      await new Promise<void>((resolve) => {
        window.OneSignalDeferred!.push(async (OneSignal: any) => {
          try {
            await OneSignal.init({
              appId,
              allowLocalhostAsSecureOrigin: true,
              serviceWorkerParam: { scope: "/onesignal/" },
              serviceWorkerPath: "OneSignalSDKWorker.js",
            });
          } catch (e) {
            console.warn("[OneSignal] init error", e);
          }
          resolve();
        });
      });
      return true;
    } catch (e) {
      console.warn("[OneSignal] failed to init", e);
      return false;
    }
  })();
  return initPromise;
}

export async function setOneSignalUser(userId: string): Promise<void> {
  const ok = await initOneSignal();
  if (!ok || !window.OneSignal) return;
  try {
    // v16: login() sets the external_id (alias). This is what
    // include_aliases.external_id targets in the REST API.
    await window.OneSignal.login(userId);
  } catch (e) {
    console.warn("[OneSignal] login error", e);
  }
}

export async function requestPushPermission(): Promise<boolean> {
  const ok = await initOneSignal();
  if (!ok || !window.OneSignal) return false;
  try {
    const permission = await window.OneSignal.Notifications.requestPermission();
    return !!permission;
  } catch (e) {
    console.warn("[OneSignal] permission error", e);
    return false;
  }
}

export async function getOneSignalSubscription(): Promise<{ subscribed: boolean; playerId?: string }> {
  const ok = await initOneSignal();
  if (!ok || !window.OneSignal) return { subscribed: false };
  try {
    const optedIn = window.OneSignal.User?.PushSubscription?.optedIn;
    const id = window.OneSignal.User?.PushSubscription?.id;
    return { subscribed: !!optedIn, playerId: id };
  } catch {
    return { subscribed: false };
  }
}

export async function optInPush(): Promise<boolean> {
  const ok = await initOneSignal();
  if (!ok || !window.OneSignal) return false;
  try {
    await window.OneSignal.User.PushSubscription.optIn();
    return true;
  } catch (e) {
    console.warn("[OneSignal] optIn error", e);
    return false;
  }
}

export async function optOutPush(): Promise<void> {
  if (!window.OneSignal) return;
  try { await window.OneSignal.User.PushSubscription.optOut(); } catch { /* ignore */ }
}

export async function registerPlayerWithBackend(playerId: string): Promise<void> {
  try {
    await supabase.functions.invoke("onesignal-register-player", {
      body: {
        player_id: playerId,
        device_type: "web",
        device_os: navigator.platform,
        browser: navigator.userAgent,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        is_subscribed: true,
      },
    });
  } catch (e) {
    console.warn("[OneSignal] register backend failed", e);
  }
}
