import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: any;
  }
}

let pixelLoaded = false;
let pixelIdLoaded: string | null = null;

function loadPixelScript(pixelId: string) {
  if (pixelLoaded && pixelIdLoaded === pixelId) return;
  if (pixelLoaded && pixelIdLoaded !== pixelId) {
    // Pixel already loaded with different ID — re-init not supported by Meta SDK,
    // but we can update the loaded flag to allow re-init on full page refresh.
    return;
  }

  // Inject Meta Pixel base code
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  // Initialize fbq queue
  const w = window as any;
  if (!w.fbq) {
    w.fbq = function () {
      w.fbq.callMethod ? w.fbq.callMethod.apply(w.fbq, arguments) : w.fbq.queue.push(arguments);
    };
    if (!w._fbq) w._fbq = w.fbq;
    w.fbq.push = w.fbq;
    w.fbq.loaded = true;
    w.fbq.version = "2.0";
    w.fbq.queue = [];
  }

  // Wait for script load then init + PageView
  script.onload = () => {
    w.fbq("init", pixelId);
    w.fbq("track", "PageView");
  };

  // Fallback: init immediately — SDK will process once loaded
  w.fbq("init", pixelId);
  w.fbq("track", "PageView");

  pixelLoaded = true;
  pixelIdLoaded = pixelId;
}

export function useMetaPixel() {
  const location = useLocation();
  const initRef = useRef(false);

  // Fetch pixel ID from backend config and load script once
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    (async () => {
      try {
        const { data } = await supabase
          .from("meta_capi_config")
          .select("pixel_id,enabled")
          .limit(1)
          .maybeSingle();
        if (data?.enabled && data.pixel_id) {
          loadPixelScript(data.pixel_id);
        }
      } catch {
        // swallow
      }
    })();
  }, []);

  // Track page view on route changes (single-page app navigation)
  useEffect(() => {
    if (typeof window !== "undefined" && window.fbq && pixelLoaded) {
      window.fbq("track", "PageView");
    }
  }, [location.pathname]);
}

/**
 * Fire a standard or custom Meta Pixel event from anywhere in the app.
 * Falls back silently if pixel is not loaded.
 */
export function metaTrack(eventName: string, params?: Record<string, unknown>) {
  try {
    if (typeof window !== "undefined" && window.fbq) {
      if (params) {
        window.fbq("track", eventName, params);
      } else {
        window.fbq("track", eventName);
      }
    }
  } catch {
    // swallow
  }
}

/**
 * Fire a custom Meta Pixel event.
 */
export function metaTrackCustom(eventName: string, params?: Record<string, unknown>) {
  try {
    if (typeof window !== "undefined" && window.fbq) {
      window.fbq("trackCustom", eventName, params);
    }
  } catch {
    // swallow
  }
}
