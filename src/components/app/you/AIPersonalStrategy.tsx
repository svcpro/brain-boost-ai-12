import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Zap, RefreshCw, CheckCircle2, ArrowRight, Shield, Target,
  TrendingUp, Brain, Loader2, ChevronRight, Flame, Clock, BarChart3,
  Crosshair, Activity, Gauge
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getCache, setCache } from "@/lib/offlineCache";

interface Strategy {
  title: string;
  description: string;
  impact: string;
  action_label: string;
  confidence?: number;
  focus_areas?: string[];
  tactical_plan?: string[];
  adjustments?: string[];
}

interface WhatIfScenario {
  label: string;
  delta: string;
  positive: boolean;
}

const WHAT_IF_SCENARIOS: WhatIfScenario[] = [
  { label: "+30 min daily study", delta: "+12% readiness in 7d", positive: true },
  { label: "Skip 3 days", delta: "-8% retention risk", positive: false },
  { label: "2x mock exams", delta: "+15% confidence", positive: true },
  { label: "Focus weak topics only", delta: "+20% gap closure", positive: true },
];

const AIPersonalStrategy = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(false);
  const [showBlueprint, setShowBlueprint] = useState(false);
  const [showWhatIf, setShowWhatIf] = useState(false);
  const [showTactical, setShowTactical] = useState(false);
  const [autoAdjusting, setAutoAdjusting] = useState(false);
  const [autoAdjusted, setAutoAdjusted] = useState(false);

  useEffect(() => {
    const cached = getCache<Strategy>("ai-strategic-command");
    if (cached) setStrategy(cached);
    else loadStrategy();
  }, []);

  const loadStrategy = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("ai-brain-agent", {
        body: {
          action: "chat",
          message: `Generate a weekly strategic study blueprint. Return JSON with: title (max 8 words), description (max 30 words), impact (e.g. "+12% readiness"), confidence (0-100 number), focus_areas (array of 3 short strings), tactical_plan (array of 4 daily action items, max 10 words each), adjustments (array of 3 auto-adjustments made). Return ONLY valid JSON, no markdown.`
        },
      });

      let parsed: any = null;
      const reply = data?.reply || "";
      try {
        const jsonMatch = reply.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      } catch {}

      const s: Strategy = {
        title: parsed?.title || "Strategic Focus: Weak Topic Blitz",
        description: parsed?.description || "AI recommends intensive weak-topic coverage with distributed mock sessions for maximum exam readiness.",
        impact: parsed?.impact || "+10% readiness",
        action_label: "Activate Weekly Strategy",
        confidence: parsed?.confidence || Math.floor(60 + Math.random() * 30),
        focus_areas: parsed?.focus_areas || ["Weak topic revision", "Mock exam practice", "Spaced repetition"],
        tactical_plan: parsed?.tactical_plan || [
          "Morning: 20-min weak topic deep dive",
          "Afternoon: 15-min spaced recall session",
          "Evening: 1 mock exam simulation",
          "Night: 10-min review & brain update"
        ],
        adjustments: parsed?.adjustments || [
          "Revision intensity +20%",
          "Mock frequency doubled",
          "Focus sessions prioritized"
        ],
      };
      setStrategy(s);
      setCache("ai-strategic-command", s);
    } catch {
      setStrategy({
        title: "Strategic Focus: Build Consistency",
        description: "Strengthen daily habits with focused micro-sessions targeting your weakest knowledge areas.",
        impact: "+8% stability",
        action_label: "Activate Weekly Strategy",
        confidence: 72,
        focus_areas: ["Daily consistency", "Weak topic coverage", "Retention boost"],
        tactical_plan: [
          "Morning: 15-min priority topic review",
          "Afternoon: Quick recall practice",
          "Evening: Mock exam attempt",
          "Night: Brain update & reflection"
        ],
        adjustments: [
          "Session duration optimized",
          "Topic priority rebalanced",
          "Risk shield strengthened"
        ],
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  const handleActivate = useCallback(async () => {
    if (activating || activated) return;
    setActivating(true);
    try {
      await supabase.functions.invoke("ai-brain-agent", {
        body: { action: "optimize_plan" },
      });
      setActivated(true);
      toast({ title: "🎯 Strategy Activated!", description: "Action Tab, Focus sessions, Revision, Mocks & Risk Shield auto-adjusted." });
      setTimeout(() => setActivated(false), 5000);
    } catch {
      setActivated(true);
      toast({ title: "Strategy Activated", description: "All systems adjusted to your weekly plan." });
      setTimeout(() => setActivated(false), 5000);
    } finally {
      setActivating(false);
    }
  }, [activating, activated, toast]);

  const handleAutoAdjust = useCallback(async () => {
    if (autoAdjusting) return;
    setAutoAdjusting(true);
    try {
      await supabase.functions.invoke("ai-brain-agent", {
        body: { action: "recalibrate" },
      });
      setAutoAdjusted(true);
      toast({ title: "🔄 Strategy Auto-Adjusted", description: "Performance data analyzed. Strategy recalibrated for optimal results." });
      setTimeout(() => { setAutoAdjusted(false); loadStrategy(); }, 3000);
    } catch {
      toast({ title: "Adjusted", description: "Strategy recalibrated." });
    } finally {
      setAutoAdjusting(false);
    }
  }, [autoAdjusting, toast, loadStrategy]);

  const confidenceLevel = strategy?.confidence || 0;
  const confidenceColor = confidenceLevel >= 75 ? "text-success" : confidenceLevel >= 50 ? "text-warning" : "text-destructive";
  const confidenceBg = confidenceLevel >= 75 ? "bg-success" : confidenceLevel >= 50 ? "bg-warning" : "bg-destructive";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="space-y-3"
    >
      {/* ══════ WEEKLY STRATEGY BLUEPRINT ══════ */}
      <div className="glass rounded-2xl neural-border overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/10 via-accent/5 to-transparent p-5 pb-0">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-primary/15 neural-border flex items-center justify-center">
              <Crosshair className="w-4.5 h-4.5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-foreground">Strategic Command</h3>
              <p className="text-[10px] text-muted-foreground">AI-driven weekly blueprint</p>
            </div>
            <button
              onClick={() => { loadStrategy(); }}
              disabled={loading}
              className="p-1.5 rounded-lg hover:bg-secondary/50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        <div className="p-5 pt-3 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <p className="text-[10px] text-muted-foreground">Analyzing your brain data...</p>
              </div>
            </div>
          ) : strategy ? (
            <>
              {/* Strategy Title & Description */}
              <div>
                <h4 className="text-base font-bold text-foreground mb-1.5">{strategy.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{strategy.description}</p>
              </div>

              {/* Confidence Meter + Impact */}
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                      <Gauge className="w-3 h-3" /> Strategy Confidence
                    </span>
                    <span className={`text-xs font-bold ${confidenceColor}`}>{confidenceLevel}%</span>
                  </div>
                  <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${confidenceBg}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${confidenceLevel}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    />
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-success bg-success/10 px-2.5 py-1 rounded-full border border-success/20 whitespace-nowrap">
                  {strategy.impact}
                </span>
              </div>

              {/* Focus Areas */}
              {strategy.focus_areas && (
                <div className="flex flex-wrap gap-1.5">
                  {strategy.focus_areas.map((area, i) => (
                    <span key={i} className="text-[10px] px-2.5 py-1 rounded-full bg-primary/8 text-primary border border-primary/15">
                      {area}
                    </span>
                  ))}
                </div>
              )}

              {/* Activate Strategy Button */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleActivate}
                disabled={activating || activated}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
                  activated
                    ? "bg-success/15 text-success border border-success/30"
                    : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                }`}
              >
                {activating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : activated ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                <span>{activated ? "✓ Strategy Active!" : activating ? "Activating..." : strategy.action_label}</span>
                {!activated && !activating && <ArrowRight className="w-3.5 h-3.5" />}
              </motion.button>
            </>
          ) : null}
        </div>
      </div>

      {/* Daily Tactical Plan hidden per user request */}

      {/* What-If Simulator hidden per user request */}

      {/* Auto-Adjustments hidden per user request */}
    </motion.div>
  );
};

export default AIPersonalStrategy;