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
let lastInitError: string | null = null;

function isAlreadyInitializedError(error: unknown): boolean {
  return errorMessage(error).toLowerCase().includes("sdk already initialized");
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try { return JSON.stringify(error); } catch { return "Unknown OneSignal error"; }
}

async function fetchAppId(): Promise<string | null> {
  try {
    const { data } = await supabase.functions.invoke("onesignal-dispatch", {
      body: { action: "get_app_config" },
    });
    if (data?.app_id) {
      localStorage.setItem("onesignal_app_id", data.app_id);
      return data.app_id;
    }
  } catch { /* ignore */ }
  return localStorage.getItem("onesignal_app_id");
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
      lastInitError = null;
      const appId = await fetchAppId();
      if (!appId) {
        lastInitError = "OneSignal App ID missing";
        return false;
      }
      await loadScript();
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      await new Promise<void>((resolve, reject) => {
        window.OneSignalDeferred!.push(async (OneSignal: any) => {
          try {
            await OneSignal.init({
              appId,
              allowLocalhostAsSecureOrigin: true,
              serviceWorkerParam: { scope: "/onesignal/" },
              serviceWorkerPath: "OneSignalSDKWorker.js",
            });
            resolve();
          } catch (e) {
            if (isAlreadyInitializedError(e)) {
              resolve();
              return;
            }
            reject(e);
          }
        });
      });
      lastInitError = null;
      return true;
    } catch (e) {
      if (isAlreadyInitializedError(e)) {
        lastInitError = null;
        return true;
      }
      lastInitError = errorMessage(e);
      initPromise = null;
      console.warn("[OneSignal] failed to init", e);
      return false;
    }
  })();
  return initPromise;
}

export function getOneSignalLastError(): string | null {
  return lastInitError;
}

export async function setOneSignalUser(userId: string): Promise<void> {
  const ok = await initOneSignal();
  if (!ok || !window.OneSignal) return;

  // Wait for User namespace to be ready (SDK initializes it asynchronously)
  for (let i = 0; i < 25; i++) {
    if (window.OneSignal?.User && typeof window.OneSignal.login === "function") break;
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!window.OneSignal?.User) {
    console.warn("[OneSignal] User namespace not ready, skipping login");
    return;
  }

  // Skip if already logged in as this user
  try {
    const currentExternalId = window.OneSignal.User?.externalId;
    if (currentExternalId === userId) return;
  } catch { /* ignore */ }

  try {
    await window.OneSignal.login(userId);
  } catch (e) {
    // SDK internal error — try the lower-level addAlias as a fallback
    console.warn("[OneSignal] login error, trying addAlias", e);
    try {
      window.OneSignal.User?.addAlias?.("external_id", userId);
    } catch (e2) {
      console.warn("[OneSignal] addAlias also failed", e2);
    }
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
    let id = window.OneSignal.User?.PushSubscription?.id;
    // ID is async after first opt-in. Poll up to 5s.
    if (optedIn && !id) {
      for (let i = 0; i < 25; i++) {
        await new Promise(r => setTimeout(r, 200));
        id = window.OneSignal.User?.PushSubscription?.id;
        if (id) break;
      }
    }
    return { subscribed: !!optedIn, playerId: id };
  } catch {
    return { subscribed: false };
  }
}

/** Subscribe to subscription changes. Auto-registers playerId with backend. */
export function onSubscriptionChange(handler: (sub: { subscribed: boolean; playerId?: string }) => void): () => void {
  if (!window.OneSignal?.User?.PushSubscription?.addEventListener) return () => {};
  const fn = (event: any) => {
    handler({ subscribed: !!event?.current?.optedIn, playerId: event?.current?.id });
  };
  try {
    window.OneSignal.User.PushSubscription.addEventListener("change", fn);
    return () => {
      try { window.OneSignal.User.PushSubscription.removeEventListener("change", fn); } catch { /* */ }
    };
  } catch {
    return () => {};
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
