import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "pwa-install-dismissed";
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // Re-show after 24 hours

const PWAInstallBanner = () => {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [hasNativePrompt, setHasNativePrompt] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    setIsStandalone(standalone);
    if (standalone) return;

    const dismissedAt = localStorage.getItem(DISMISSED_KEY);
    if (dismissedAt && Date.now() - parseInt(dismissedAt) < DISMISS_DURATION_MS) return;

    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const android = /android/i.test(ua);
    setIsIOS(ios);

    if (ios) {
      const timer = setTimeout(() => setShowBanner(true), 1500);
      return () => clearTimeout(timer);
    }

    const capturePrompt = (e: BeforeInstallPromptEvent) => {
      console.log("[PWA] beforeinstallprompt captured");
      deferredPromptRef.current = e;
      setHasNativePrompt(true);
      setShowBanner(true);
    };

    // Check if event was captured globally before this component mounted
    const earlyPrompt = (window as any).__pwaInstallPrompt;
    if (earlyPrompt) {
      capturePrompt(earlyPrompt as BeforeInstallPromptEvent);
      (window as any).__pwaInstallPrompt = null;
    }

    // Listen for the event
    const handler = (e: Event) => {
      e.preventDefault();
      capturePrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // On non-Android browsers (desktop etc), show generic instructions after timeout
    // On Android, ONLY show banner when native prompt is captured (no fallback)
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    if (!android) {
      fallbackTimer = setTimeout(() => setShowBanner(true), 3000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    const prompt = deferredPromptRef.current;
    console.log("[PWA] Install clicked, prompt exists:", !!prompt);
    if (!prompt) {
      setHasNativePrompt(false);
      return;
    }
    try {
      console.log("[PWA] Calling prompt()...");
      await prompt.prompt();
      const choiceResult = await prompt.userChoice;
      console.log("[PWA] userChoice:", choiceResult.outcome);
      if (choiceResult.outcome === "accepted") {
        setShowBanner(false);
        localStorage.setItem(DISMISSED_KEY, Date.now().toString());
      }
    } catch (err: any) {
      console.error("[PWA] prompt() error:", err?.message || err);
    }
    deferredPromptRef.current = null;
    setHasNativePrompt(false);
  }, []);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
  }, []);

  if (isStandalone) return null;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-20 left-4 right-4 z-50 rounded-2xl p-4 shadow-2xl max-w-md mx-auto border border-border/50 bg-card/95 backdrop-blur-xl"
        >
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-secondary/50 transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
              <Download className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground mb-0.5">Install ACRY App</h3>

          {isIOS ? (
                <>
                  <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                    Install ACRY for offline access & push reminders:
                  </p>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 border border-border/30">
                    <span className="text-xs text-foreground">
                      1. Tap{" "}
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold">
                        <Share className="w-3 h-3" /> Share
                      </span>
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-xs text-foreground">
                      2.{" "}
                      <span className="inline-block px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold">
                        Add to Home Screen
                      </span>
                    </span>
                  </div>
                </>
              ) : hasNativePrompt ? (
                <>
                  <p className="text-xs text-muted-foreground mb-2.5">
                    Get push reminders, offline access & a faster experience.
                  </p>
                  <button
                    onClick={handleInstall}
                    className="w-full py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                  >
                    Install App
                  </button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Use your browser's menu to install this app for the best experience.
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PWAInstallBanner;
