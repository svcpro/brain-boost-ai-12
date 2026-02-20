import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Brain, TrendingUp, Zap, Clock, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { setCache, getCache } from "@/lib/offlineCache";

interface InsightCard {
  title: string;
  insight: string;
  type: "strength" | "opportunity" | "pattern" | "tip";
}

const typeConfig = {
  strength: { icon: TrendingUp, color: "text-success", bg: "bg-success/10", border: "hsl(142 50% 30% / 0.2)" },
  opportunity: { icon: Zap, color: "text-warning", bg: "bg-warning/10", border: "hsl(38 50% 35% / 0.2)" },
  pattern: { icon: Brain, color: "text-primary", bg: "bg-primary/10", border: "hsl(175 50% 35% / 0.2)" },
  tip: { icon: Sparkles, color: "text-accent-foreground", bg: "bg-accent/10", border: "hsl(var(--border))" },
};

const CACHE_KEY = "brain-ai-insights";

export default function AIIntelligenceInsights() {
  const { user } = useAuth();
  const [insights, setInsights] = useState<InsightCard[]>(() => getCache(CACHE_KEY) || []);
  const [loading, setLoading] = useState(false);

  const fetchInsights = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-brain-agent", {
        body: { action: "brain_feed" },
      });
      if (!error && data?.cards && Array.isArray(data.cards)) {
        const mapped: InsightCard[] = data.cards.slice(0, 4).map((c: any) => ({
          title: c.title || "Insight",
          insight: c.content || c.insight || "",
          type: c.category === "strength" ? "strength"
            : c.category === "opportunity" ? "opportunity"
            : c.category === "pattern" ? "pattern"
            : "tip",
        }));
        setInsights(mapped);
        setCache(CACHE_KEY, mapped);
      }
    } catch (e) {
      console.error("AI insights fetch failed:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (insights.length === 0) fetchInsights();
  }, []);

  // Fallback insights if AI returns nothing
  const displayInsights = insights.length > 0 ? insights : [
    { title: "Getting Started", insight: "Study consistently to unlock personalized AI insights about your learning patterns.", type: "tip" as const },
    { title: "Pattern Analysis", insight: "Your AI brain agent will analyze memory decay and suggest optimal review times.", type: "pattern" as const },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">AI Intelligence</h3>
            <p className="text-[10px] text-muted-foreground">Personalized behavioral insights</p>
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={fetchInsights}
          disabled={loading}
          className="p-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </motion.button>
      </div>

      {/* Insight cards */}
      <div className="space-y-2.5">
        {loading && insights.length === 0 ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl p-4 border border-border/40 animate-pulse" style={{ background: "hsl(var(--card) / 0.6)" }}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-secondary/50" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-secondary/50 rounded w-1/3" />
                  <div className="h-3 bg-secondary/30 rounded w-full" />
                  <div className="h-3 bg-secondary/30 rounded w-2/3" />
                </div>
              </div>
            </div>
          ))
        ) : (
          displayInsights.map((card, i) => {
            const config = typeConfig[card.type];
            const Icon = config.icon;

            return (
              <motion.div
                key={`${card.title}-${i}`}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                className="rounded-xl p-4 border"
                style={{
                  background: "hsl(var(--card) / 0.6)",
                  borderColor: config.border,
                }}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">{card.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{card.insight}</p>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </motion.section>
  );
}
