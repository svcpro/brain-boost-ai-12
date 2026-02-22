import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket, Brain, Swords, Zap, CheckCircle2, XCircle, Loader2, Sparkles, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface PipelineStep {
  step: string;
  status: "pending" | "running" | "success" | "error";
  label: string;
  icon: any;
  gradient: string;
  detail?: string;
}

const PIPELINE_STEPS: Omit<PipelineStep, "status" | "detail">[] = [
  { step: "trend_generation", label: "AI Trend Analysis", icon: BarChart3, gradient: "from-orange-500 to-amber-400" },
  { step: "opponent_calibration", label: "Opponent Auto-Calibration", icon: Swords, gradient: "from-rose-500 to-pink-400" },
  { step: "engine_activation", label: "Engine Activation", icon: Zap, gradient: "from-emerald-500 to-green-400" },
  { step: "summary_generation", label: "Intelligence Summary", icon: Brain, gradient: "from-violet-500 to-purple-400" },
];

export default function AutoPipelinePanel() {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<PipelineStep[]>(
    PIPELINE_STEPS.map(s => ({ ...s, status: "pending" as const }))
  );
  const [summary, setSummary] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const runPipeline = async () => {
    setRunning(true);
    setSummary(null);
    setSteps(PIPELINE_STEPS.map(s => ({ ...s, status: "pending" as const })));

    // Animate steps sequentially for visual effect
    for (let i = 0; i < PIPELINE_STEPS.length; i++) {
      setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: "running" } : s));
      await new Promise(r => setTimeout(r, 800)); // Brief visual delay

      if (i === 0) {
        // Actually trigger the full pipeline on first step
        try {
          const { data, error } = await supabase.functions.invoke("competitive-intelligence", {
            body: { action: "auto_pipeline", exam_types: ["JEE", "NEET", "UPSC"] },
          });

          if (error) throw error;

          // Map results back to steps
          const resultSteps = data?.steps || [];
          setSteps(prev => prev.map(s => {
            const matching = resultSteps.filter((r: any) => r.step === s.step);
            if (matching.length > 0) {
              const hasError = matching.some((m: any) => m.status === "error");
              const detail = matching.map((m: any) =>
                m.status === "success"
                  ? (m.count ? `${m.count} patterns` : m.engines ? `${m.engines} engines` : "✓")
                  : m.error || "Failed"
              ).join(" | ");
              return { ...s, status: hasError ? "error" : "success", detail };
            }
            return { ...s, status: "success" };
          }));

          if (data?.summary) setSummary(data.summary);
          setLastRun(new Date().toLocaleString());

          // Invalidate all related queries
          qc.invalidateQueries({ queryKey: ["admin-exam-trends"] });
          qc.invalidateQueries({ queryKey: ["opponent-config"] });
          qc.invalidateQueries({ queryKey: ["intel-config"] });
          qc.invalidateQueries({ queryKey: ["exam-datasets"] });

          toast.success("🚀 AI Pipeline completed!");
        } catch (e: any) {
          setSteps(prev => prev.map(s => ({ ...s, status: "error", detail: e.message })));
          toast.error("Pipeline failed: " + e.message);
        }
        break; // Don't animate remaining steps, they're already resolved
      }
    }

    setRunning(false);
  };

  const allSuccess = steps.every(s => s.status === "success");
  const hasErrors = steps.some(s => s.status === "error");

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="relative overflow-hidden rounded-2xl p-5"
      style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
    >
      {/* Animated background */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-transparent"
        animate={running ? { opacity: [0.3, 0.6, 0.3] } : { opacity: 0.2 }}
        transition={{ duration: 2, repeat: running ? Infinity : 0 }}
      />

      {/* Top gradient strip */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-rose-500 via-emerald-500 to-violet-500"
        animate={running ? { backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] } : {}}
        style={{ backgroundSize: "200% 200%" }}
        transition={{ duration: 2, repeat: Infinity }}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20"
              animate={running ? { rotate: [0, 360] } : { rotate: 0 }}
              transition={{ duration: 3, repeat: running ? Infinity : 0, ease: "linear" }}
            >
              <Rocket className="w-5 h-5 text-white" />
            </motion.div>
            <div>
              <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                Full Auto Pipeline
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent font-bold">AI-POWERED</span>
              </h3>
              <p className="text-[10px] text-muted-foreground">Zero manual work — AI handles everything</p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={runPipeline}
            disabled={running}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg transition-all ${
              running
                ? "bg-secondary text-muted-foreground cursor-wait"
                : "bg-gradient-to-r from-primary to-accent text-white shadow-primary/25 hover:shadow-primary/40"
            }`}
          >
            {running ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Running...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Run AI Pipeline</>
            )}
          </motion.button>
        </div>

        {/* Pipeline Steps */}
        <div className="space-y-2.5">
          {steps.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`flex items-center gap-3 p-3.5 rounded-xl transition-all duration-500 ${
                step.status === "running"
                  ? "bg-primary/10 ring-1 ring-primary/30"
                  : step.status === "success"
                  ? "bg-emerald-500/5 ring-1 ring-emerald-500/20"
                  : step.status === "error"
                  ? "bg-destructive/5 ring-1 ring-destructive/20"
                  : "bg-background/40"
              }`}
            >
              {/* Step icon */}
              <motion.div
                className={`shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br ${step.gradient} flex items-center justify-center shadow-md`}
                animate={step.status === "running" ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 1, repeat: step.status === "running" ? Infinity : 0 }}
              >
                <step.icon className="w-4 h-4 text-white" />
              </motion.div>

              {/* Label & detail */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{step.label}</p>
                {step.detail && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[10px] text-muted-foreground mt-0.5 truncate"
                  >
                    {step.detail}
                  </motion.p>
                )}
              </div>

              {/* Status indicator */}
              <div className="shrink-0">
                <AnimatePresence mode="wait">
                  {step.status === "running" ? (
                    <motion.div key="loading" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    </motion.div>
                  ) : step.status === "success" ? (
                    <motion.div key="success" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </motion.div>
                  ) : step.status === "error" ? (
                    <motion.div key="error" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                      <XCircle className="w-5 h-5 text-destructive" />
                    </motion.div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-border" />
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </div>

        {/* AI Summary */}
        <AnimatePresence>
          {summary && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mt-4"
            >
              <div className="p-4 rounded-xl bg-accent/5 ring-1 ring-accent/20">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="w-4 h-4 text-accent" />
                  <span className="text-xs font-bold text-accent">AI Intelligence Summary</span>
                </div>
                <p className="text-xs text-foreground/80 leading-relaxed">{summary}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Last run info */}
        {lastRun && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[10px] text-muted-foreground mt-3 text-center"
          >
            Last automated run: {lastRun} · {allSuccess ? "All systems nominal ✅" : hasErrors ? "Some steps had errors ⚠️" : "In progress..."}
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
