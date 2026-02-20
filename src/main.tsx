import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Capture the beforeinstallprompt event early, before React mounts.
// Lazy-loaded components can miss this event if it fires before they mount.
(window as any).__pwaInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  (window as any).__pwaInstallPrompt = e;
});

createRoot(document.getElementById("root")!).render(<App />);
