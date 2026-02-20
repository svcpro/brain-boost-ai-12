import { motion } from "framer-motion";
import { Brain, Sparkles } from "lucide-react";

interface AIProgressBarProps {
  label?: string;
  sublabel?: string;
  /** estimated seconds for the operation */
  estimatedSeconds?: number;
  compact?: boolean;
}

const AI_STEPS = [
  "Connecting to AI…",
  "Analyzing data…",
  "Processing results…",
  "Almost done…",
];

const AIProgressBar = ({
  label = "AI is working…",
  sublabel,
  estimatedSeconds = 8,
  compact = false,
}: AIProgressBarProps) => {
  return (
    <div className={`w-full ${compact ? "py-2" : "py-4"} space-y-3`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Brain className={`${compact ? "w-4 h-4" : "w-5 h-5"} text-primary`} />
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className={`${compact ? "text-[11px]" : "text-xs"} font-semibold text-foreground`}>
            {label}
          </p>
          {sublabel && (
            <p className="text-[10px] text-muted-foreground">{sublabel}</p>
          )}
        </div>
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <Sparkles className={`${compact ? "w-3 h-3" : "w-4 h-4"} text-primary/60`} />
        </motion.div>
      </div>

      {/* Animated progress bar */}
      <div className={`w-full ${compact ? "h-1.5" : "h-2"} rounded-full bg-secondary overflow-hidden`}>
        <motion.div
          className="h-full rounded-full"
          style={{
            background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.6), hsl(var(--primary)))",
            backgroundSize: "200% 100%",
          }}
          initial={{ width: "5%" }}
          animate={{
            width: ["5%", "40%", "65%", "80%", "92%"],
            backgroundPosition: ["0% 0%", "100% 0%", "0% 0%"],
          }}
          transition={{
            width: {
              duration: estimatedSeconds,
              ease: "easeOut",
              times: [0, 0.25, 0.5, 0.75, 1],
            },
            backgroundPosition: {
              duration: 1.5,
              repeat: Infinity,
              ease: "linear",
            },
          }}
        />
      </div>

      {/* Animated step labels */}
      {!compact && (
        <div className="flex items-center gap-1.5 overflow-hidden h-4">
          {AI_STEPS.map((step, i) => (
            <motion.span
              key={step}
              className="text-[10px] text-muted-foreground whitespace-nowrap"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, -10] }}
              transition={{
                duration: estimatedSeconds / AI_STEPS.length,
                delay: i * (estimatedSeconds / AI_STEPS.length),
                times: [0, 0.1, 0.85, 1],
              }}
              style={{ position: i === 0 ? "relative" : "absolute" }}
            >
              {step}
            </motion.span>
          ))}
        </div>
      )}
    </div>
  );
};

export default AIProgressBar;
