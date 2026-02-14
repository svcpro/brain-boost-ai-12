import { useState } from "react";
import { motion } from "framer-motion";
import { Play, Clock, Timer } from "lucide-react";
import FocusModeSession from "./FocusModeSession";

const QUICK_PRESETS = [
  { label: "10 min", minutes: 10, color: "bg-success/15 border-success/30 text-success" },
  { label: "25 min", minutes: 25, color: "bg-primary/15 border-primary/30 text-primary" },
  { label: "45 min", minutes: 45, color: "bg-warning/15 border-warning/30 text-warning" },
];

const QuickStartStudy = () => {
  const [sessionOpen, setSessionOpen] = useState(false);
  const [selectedMinutes, setSelectedMinutes] = useState(25);

  const handleStart = (minutes: number) => {
    setSelectedMinutes(minutes);
    setSessionOpen(true);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-xl p-4 neural-border"
      >
        <div className="flex items-center gap-2 mb-3">
          <Timer className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Quick Start</span>
        </div>

        <div className="flex gap-2">
          {QUICK_PRESETS.map((preset) => (
            <button
              key={preset.minutes}
              onClick={() => handleStart(preset.minutes)}
              className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all active:scale-95 hover:scale-[1.02] ${preset.color}`}
            >
              <Clock className="w-4 h-4" />
              <span className="text-xs font-semibold">{preset.label}</span>
            </button>
          ))}
          <button
            onClick={() => handleStart(25)}
            className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border border-border bg-secondary/30 text-foreground transition-all active:scale-95 hover:scale-[1.02]"
          >
            <Play className="w-4 h-4" />
            <span className="text-xs font-semibold">Custom</span>
          </button>
        </div>
      </motion.div>

      <FocusModeSession
        open={sessionOpen}
        onClose={() => setSessionOpen(false)}
      />
    </>
  );
};

export default QuickStartStudy;
