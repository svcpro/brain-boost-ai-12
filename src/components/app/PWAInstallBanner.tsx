import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "pwa-install-dismissed";
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // Re-show after 24 hours

const PWAInstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already running as installed PWA
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    setIsStandalone(standalone);
    if (standalone) return;

    // Check if dismissed recently (within 24h)
    const dismissedAt = localStorage.getItem(DISMISSED_KEY);
    if (dismissedAt && Date.now() - parseInt(dismissedAt) < DISMISS_DURATION_MS) return;

    // Detect iOS
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(ios);

    if (ios) {
      // Always show install instructions on iOS Safari
      const timer = setTimeout(() => setShowBanner(true), 1500);
      return () => clearTimeout(timer);
    }

    // Check if event was captured globally before this component mounted
    const earlyPrompt = (window as any).__pwaInstallPrompt;
    if (earlyPrompt) {
      setDeferredPrompt(earlyPrompt as BeforeInstallPromptEvent);
      (window as any).__pwaInstallPrompt = null;
      setTimeout(() => setShowBanner(true), 1500);
      return;
    }

    // Listen for the event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // On Android Chrome, if no prompt fires within 3s, show a manual instruction banner
    const fallbackTimer = setTimeout(() => {
      setShowBanner(true);
    }, 3000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(fallbackTimer);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // Fallback: no native prompt available, show manual instructions
      setDeferredPrompt(null);
      return;
    }
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowBanner(false);
        localStorage.setItem(DISMISSED_KEY, Date.now().toString());
      }
    } catch (err) {
      console.warn("PWA install prompt failed:", err);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
  };

  if (isStandalone) return null;

  const isAndroid = /android/i.test(navigator.userAgent);

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
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Tap{" "}
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-secondary text-foreground text-[10px] font-medium">
                    <Share className="w-3 h-3" /> Share
                  </span>{" "}
                  then{" "}
                  <span className="inline-block px-1.5 py-0.5 rounded bg-secondary text-foreground text-[10px] font-medium">
                    Add to Home Screen
                  </span>{" "}
                  to install.
                </p>
              ) : deferredPrompt ? (
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
              ) : isAndroid ? (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Tap{" "}
                  <span className="inline-block px-1.5 py-0.5 rounded bg-secondary text-foreground text-[10px] font-medium">
                    ⋮ Menu
                  </span>{" "}
                  →{" "}
                  <span className="inline-block px-1.5 py-0.5 rounded bg-secondary text-foreground text-[10px] font-medium">
                    Install app
                  </span>{" "}
                  or{" "}
                  <span className="inline-block px-1.5 py-0.5 rounded bg-secondary text-foreground text-[10px] font-medium">
                    Add to Home screen
                  </span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Use your browser menu to add this app to your home screen for the best experience.
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
