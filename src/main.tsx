import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ─── Cache version: bump to force stale SW cache purge ───
const CACHE_VERSION = "v3";
const CACHE_VERSION_KEY = "acry_cache_version";

const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
if (storedVersion !== CACHE_VERSION) {
  localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
  // Purge all caches so stale index.html / old JS chunks are removed
  if ("caches" in window) {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
  }
  // Force the current SW (if any) to unregister so fresh one installs
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.unregister());
    });
  }
}

// Capture the beforeinstallprompt event early, before React mounts.
// Lazy-loaded components can miss this event if it fires before they mount.
(window as any).__pwaInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  (window as any).__pwaInstallPrompt = e;
});

createRoot(document.getElementById("root")!).render(<App />);
