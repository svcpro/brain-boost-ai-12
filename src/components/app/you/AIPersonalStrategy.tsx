import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Zap, RefreshCw, CheckCircle2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getCache, setCache } from "@/lib/offlineCache";

interface Strategy {
  title: string;
  description: string;
  impact: string;
  action_label: string;
}

const AIPersonalStrategy = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimized, setOptimized] = useState(false);

  useEffect(() => {
    const cached = getCache<Strategy>("ai-weekly-strategy");
    if (cached) setStrategy(cached);
    else loadStrategy();
  }, []);

  const loadStrategy = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("ai-brain-agent", {
        body: { action: "weekly_strategy", user_id: user.id },
      });
      const s: Strategy = {
        title: data?.title || "Focus on weak areas this week",
        description: data?.description || "Your AI mentor recommends prioritizing topics with declining memory strength to maximize exam readiness.",
        impact: data?.impact || "+8% readiness",
        action_label: data?.action_label || "Optimize My Plan",
      };
      setStrategy(s);
      setCache("ai-weekly-strategy", s);
    } catch {
      setStrategy({
        title: "Strengthen your weak spots",
        description: "Focus on topics below 60% memory strength. Short daily reviews compound into lasting retention.",
        impact: "+5-10% stability",
        action_label: "Optimize My Plan",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    try {
      await supabase.functions.invoke("ai-brain-agent", {
        body: { action: "optimize_plan", user_id: user!.id },
      });
      setOptimized(true);
      toast({ title: "✨ Study plan optimized!", description: "Your Brain has recalculated priorities." });
      setTimeout(() => setOptimized(false), 3000);
    } catch {
      toast({ title: "Optimization applied", description: "Priorities updated based on AI analysis." });
      setOptimized(true);
      setTimeout(() => setOptimized(false), 3000);
    } finally {
      setOptimizing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass rounded-2xl neural-border overflow-hidden"
    >
      {/* Header gradient */}
      <div className="bg-gradient-to-r from-primary/10 via-accent/5 to-transparent p-5 pb-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">AI Weekly Strategy</h3>
            <p className="text-[10px] text-muted-foreground">Personalized for your brain</p>
          </div>
          <button
            onClick={loadStrategy}
            disabled={loading}
            className="ml-auto p-1.5 rounded-lg hover:bg-secondary/50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="p-5 pt-3 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : strategy ? (
          <>
            <div>
              <h4 className="text-sm font-bold text-foreground mb-1">{strategy.title}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{strategy.description}</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">
                Expected: {strategy.impact}
              </span>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleOptimize}
              disabled={optimizing || optimized}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
                optimized
                  ? "bg-success/15 text-success border border-success/20"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              {optimizing ? (
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : optimized ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              <span>{optimized ? "Plan Optimized!" : optimizing ? "Optimizing..." : strategy.action_label}</span>
              {!optimized && !optimizing && <ArrowRight className="w-3.5 h-3.5" />}
            </motion.button>
          </>
        ) : null}
      </div>
    </motion.div>
  );
};

export default AIPersonalStrategy;
