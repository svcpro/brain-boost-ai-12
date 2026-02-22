import { motion } from "framer-motion";
import { Rocket, ArrowRight, Calendar, Zap, Target, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAccelerator } from "@/hooks/useCompetitiveIntel";

export default function AcceleratorWidget() {
  const navigate = useNavigate();
  const { enrollment, isLoading, enroll, isEnrolling } = useAccelerator();

  const daysLeft = enrollment
    ? Math.max(0, Math.ceil((new Date(enrollment.end_date).getTime() - Date.now()) / 86400000))
    : null;
  const progress = enrollment?.progress_percentage || 0;

  if (isLoading) return null;

  // Active enrollment — show progress
  if (enrollment) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-primary/20 bg-card p-4 cursor-pointer hover:border-primary/40 transition-all group"
        onClick={() => navigate("/accelerator")}
        style={{
          background: "linear-gradient(135deg, hsl(var(--primary) / 0.08), hsl(var(--card)))",
        }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 relative">
            <Rocket className="w-5 h-5 text-primary" />
            <motion.div
              className="absolute inset-0 rounded-xl border-2 border-primary/40"
              animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-foreground text-sm">30-Day Accelerator</h3>
              <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-primary/15 text-primary uppercase tracking-wider">Active</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {daysLeft} days left · {enrollment.target_exam_type || "General"} mode
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">{enrollment.days_completed || 0}/30 days</span>
            <span className="font-bold text-primary">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>
      </motion.div>
    );
  }

  // Not enrolled — show CTA
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card overflow-hidden"
    >
      <div
        className="p-4 cursor-pointer hover:bg-secondary/30 transition-all group"
        onClick={() => navigate("/accelerator")}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
            <Rocket className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-foreground text-sm">30-Day Rank Accelerator</h3>
            <p className="text-[10px] text-muted-foreground">AI war mode — hyper-focused exam prep</p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
        </div>

        <div className="flex gap-2">
          {[
            { icon: Target, label: "Fix Weaknesses" },
            { icon: Calendar, label: "30-Day Plan" },
            { icon: Zap, label: "High Intensity" },
          ].map((item, i) => (
            <span key={i} className="flex items-center gap-1 text-[10px] text-muted-foreground bg-secondary/50 px-2 py-1 rounded-lg">
              <item.icon className="w-3 h-3" /> {item.label}
            </span>
          ))}
        </div>
      </div>

      {/* Quick enroll button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          enroll("general");
        }}
        disabled={isEnrolling}
        className="w-full py-2.5 bg-primary/10 hover:bg-primary/15 text-primary text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border-t border-border/50 disabled:opacity-50"
      >
        {isEnrolling ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Generating Plan…
          </>
        ) : (
          <>
            <Rocket className="w-3.5 h-3.5" />
            Start 30-Day Accelerator
          </>
        )}
      </button>
    </motion.div>
  );
}
