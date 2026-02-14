import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff } from "lucide-react";
import { queueLength } from "@/lib/offlineQueue";

const OfflineBanner = () => {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [pending, setPending] = useState(queueLength());

  useEffect(() => {
    const goOffline = () => { setOffline(true); setPending(queueLength()); };
    const goOnline = () => { setOffline(false); setPending(queueLength()); };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    // Poll pending count while offline
    const interval = setInterval(() => {
      if (!navigator.onLine) setPending(queueLength());
    }, 2000);

    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      clearInterval(interval);
    };
  }, []);

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 py-2 bg-destructive text-destructive-foreground text-xs font-medium"
        >
          <WifiOff className="w-3.5 h-3.5" />
          You're offline — viewing cached data
          {pending > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-destructive-foreground/20 text-[10px]">
              {pending} pending
            </span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineBanner;
