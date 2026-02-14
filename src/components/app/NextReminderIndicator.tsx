import { useState, useEffect, useRef } from "react";
import { Bell, BellOff, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { getVoiceSettings } from "@/hooks/useVoiceNotification";
import { getCache } from "@/lib/offlineCache";

function getScheduleHour(settings: ReturnType<typeof getVoiceSettings>): number {
  switch (settings.schedule) {
    case "morning": return 8;
    case "afternoon": return 14;
    case "evening": return 19;
    case "custom": return settings.customHour ?? 18;
    default: return 8;
  }
}

function computeInfo() {
  const settings = getVoiceSettings();
  if (!settings.enabled) return { enabled: false } as const;

  const now = new Date();
  const todayStr = now.toLocaleDateString("en-CA");
  const firedToday = getCache<string>("voice-schedule-fired-date") === todayStr;
  const hour = getScheduleHour(settings);

  const label = settings.schedule === "custom"
    ? `${hour % 12 || 12}:00 ${hour >= 12 ? "PM" : "AM"}`
    : settings.schedule.charAt(0).toUpperCase() + settings.schedule.slice(1);

  const alreadyPassed = now.getHours() >= hour + 1;

  const targetMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour).getTime();
  const minsLeft = Math.max(0, Math.round((targetMs - now.getTime()) / 60000));
  const imminent = !firedToday && !alreadyPassed && minsLeft > 0 && minsLeft <= 60;
  const urgent = imminent && minsLeft <= 10;

  return { enabled: true, firedToday, label, alreadyPassed, imminent, urgent, minsLeft };
}

interface Props {
  onOpenVoiceSettings?: () => void;
}

const NextReminderIndicator = ({ onOpenVoiceSettings }: Props) => {
  const [info, setInfo] = useState(computeInfo);
  const prevFiredRef = useRef(info.enabled ? info.firedToday : false);
  const [justFired, setJustFired] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setInfo(computeInfo()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Detect transition to firedToday and celebrate
  useEffect(() => {
    if (!info.enabled) return;
    const wasFired = prevFiredRef.current;
    prevFiredRef.current = info.firedToday;

    if (!wasFired && info.firedToday) {
      setJustFired(true);
      confetti({ particleCount: 40, spread: 60, origin: { x: 0.15, y: 0.3 }, colors: ["#22c55e", "#3b82f6", "#eab308"] });
      setTimeout(() => setJustFired(false), 2500);
    }
  }, [info]);

  return (
    <button
      onClick={onOpenVoiceSettings}
      className="flex items-center gap-1.5 text-[10px] hover:opacity-80 transition-opacity cursor-pointer"
    >
      {!info.enabled ? (
        <>
          <BellOff className="w-3 h-3 text-muted-foreground" />
          <span className="text-muted-foreground underline decoration-dotted">Voice reminders off</span>
        </>
      ) : (
        <>
          <div className={`relative w-4 h-4 flex items-center justify-center ${info.urgent ? "drop-shadow-[0_0_4px_hsl(var(--warning))]" : ""}`}>
            {info.imminent && (
              <svg className="absolute inset-0 w-4 h-4 -rotate-90" viewBox="0 0 16 16">
                {info.urgent && (
                  <circle cx="8" cy="8" r="6.5" fill="none" stroke="hsl(var(--warning))" strokeWidth="2.5" opacity="0.3" className="animate-pulse" />
                )}
                <circle cx="8" cy="8" r="6.5" fill="none" stroke="hsl(var(--muted))" strokeWidth="1.5" />
                <circle
                  cx="8" cy="8" r="6.5" fill="none"
                  stroke="hsl(var(--warning))"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeDasharray={`${Math.PI * 13}`}
                  strokeDashoffset={`${Math.PI * 13 * (info.minsLeft / 60)}`}
                  className="transition-all duration-1000"
                />
              </svg>
            )}
            <AnimatePresence mode="wait">
              {justFired ? (
                <motion.div
                  key="check"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1.3, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 12 }}
                >
                  <CheckCircle className="w-3 h-3 text-success" />
                </motion.div>
              ) : (
                <motion.div key="bell" initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
                  <Bell className={`w-3 h-3 ${info.firedToday ? "text-success" : info.imminent ? "text-warning animate-pulse" : "text-primary"}`} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <span className="text-muted-foreground underline decoration-dotted">
            {justFired
              ? "Reminder sent! 🎉"
              : info.firedToday
                ? "Today's reminder sent ✓"
                : info.imminent
                  ? `Firing in ~${info.minsLeft} min`
                  : info.alreadyPassed
                    ? `Reminder tomorrow (${info.label})`
                    : `Next reminder: ${info.label}`}
          </span>
        </>
      )}
    </button>
  );
};

export default NextReminderIndicator;
