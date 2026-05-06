import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  onAction: () => void;
}

const EmailUrgentPopup = ({ onAction }: Props) => {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  // Reappear every session — but allow snooze for 30 min
  useEffect(() => {
    const snoozedUntil = Number(sessionStorage.getItem("email_urgent_snooze") || 0);
    if (snoozedUntil && Date.now() < snoozedUntil) setDismissed(true);
  }, []);

  if (!user) return null;

  const email = user.email || "";
  const isVerified = !!(user as any)?.email_confirmed_at || !!(user as any)?.confirmed_at;
  const missing = !email;
  const unverified = !!email && !isVerified;

  if (!missing && !unverified) return null;
  if (dismissed) return null;

  const title = missing ? "Add your email — urgent" : "Verify your email — urgent";
  const subtitle = missing
    ? "Required to secure your account & receive alerts."
    : `Tap to verify ${email}. Unverified accounts may lose access.`;

  const handleSnooze = () => {
    sessionStorage.setItem("email_urgent_snooze", String(Date.now() + 30 * 60 * 1000));
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
        className="fixed left-1/2 -translate-x-1/2 bottom-20 z-[60] w-[calc(100%-2rem)] max-w-sm pointer-events-auto"
      >
        <motion.div
          animate={{
            boxShadow: [
              "0 0 0 0 hsl(var(--destructive) / 0.5)",
              "0 0 0 10px hsl(var(--destructive) / 0)",
            ],
          }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
          className="relative rounded-2xl overflow-hidden border border-destructive/40 bg-gradient-to-br from-destructive/20 via-background/95 to-background/95 backdrop-blur-xl shadow-2xl"
        >
          {/* shimmer overlay */}
          <motion.div
            aria-hidden
            className="absolute inset-0 pointer-events-none opacity-40"
            animate={{ backgroundPosition: ["0% 50%", "200% 50%"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            style={{
              background:
                "linear-gradient(110deg, transparent 30%, hsl(var(--destructive) / 0.25) 50%, transparent 70%)",
              backgroundSize: "200% 100%",
            }}
          />

          <div className="relative p-3.5 flex items-center gap-3">
            <motion.div
              animate={{ rotate: [0, -8, 8, -6, 6, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.6 }}
              className="w-10 h-10 rounded-xl bg-destructive/20 border border-destructive/40 flex items-center justify-center shrink-0"
            >
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </motion.div>

            <button
              onClick={onAction}
              className="flex-1 min-w-0 text-left"
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-destructive flex items-center gap-1">
                Action needed
              </p>
              <p className="text-sm font-bold text-foreground truncate">{title}</p>
              <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
            </button>

            <button
              onClick={onAction}
              className="shrink-0 px-3 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-bold flex items-center gap-1 hover:opacity-90 active:scale-95 transition"
            >
              Fix
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleSnooze}
              aria-label="Snooze"
              className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EmailUrgentPopup;
