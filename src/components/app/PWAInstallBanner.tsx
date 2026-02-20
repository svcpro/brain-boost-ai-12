import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "pwa-install-dismissed";

const PWAInstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Don't show if already installed or previously dismissed
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    // Detect iOS (no beforeinstallprompt on Safari)
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(ios);

    if (ios) {
      const timer = setTimeout(() => setShowBanner(true), 3000);
      return () => clearTimeout(timer);
    }

    // Check if the event was already captured globally before this component mounted
    const earlyPrompt = (window as any).__pwaInstallPrompt;
    if (earlyPrompt) {
      setDeferredPrompt(earlyPrompt as BeforeInstallPromptEvent);
      (window as any).__pwaInstallPrompt = null;
      setTimeout(() => setShowBanner(true), 2000);
      return;
    }

    // Otherwise listen for the event (in case it hasn't fired yet)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowBanner(true), 2000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
  };

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-20 left-4 right-4 z-50 glass-strong rounded-2xl p-4 neural-border shadow-2xl max-w-md mx-auto"
        >
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-secondary/50 transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 neural-border shrink-0">
              <Download className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground mb-0.5">Install ACRY</h3>
              {isIOS ? (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Tap <span className="inline-block px-1 py-0.5 rounded bg-secondary text-foreground text-[10px] font-medium">Share</span> then{" "}
                  <span className="inline-block px-1 py-0.5 rounded bg-secondary text-foreground text-[10px] font-medium">Add to Home Screen</span>{" "}
                  to install the app.
                </p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-2.5">
                    Get push reminders, offline access, and a faster experience.
                  </p>
                  <button
                    onClick={handleInstall}
                    className="w-full py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                  >
                    Install App
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PWAInstallBanner;
