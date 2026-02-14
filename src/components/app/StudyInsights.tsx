import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, AlertTriangle, Clock, Sparkles, TrendingUp, RefreshCw, ChevronDown, ChevronUp, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { setCache, getCache } from "@/lib/offlineCache";
import { formatDistanceToNow } from "date-fns";

interface Insight {
  type: "urgent" | "optimization" | "encouragement" | "schedule";
  title: string;
  body: string;
  topic?: string | null;
  priority: number;
}

interface CachedInsights {
  insights: Insight[];
  fetchedAt: number;
}

const CACHE_KEY = "study-insights-cache";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const typeConfig = {
  urgent: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20", label: "Urgent" },
  optimization: { icon: TrendingUp, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20", label: "Optimize" },
  encouragement: { icon: Sparkles, color: "text-success", bg: "bg-success/10", border: "border-success/20", label: "Great Work" },
  schedule: { icon: Clock, color: "text-warning", bg: "bg-warning/10", border: "border-warning/20", label: "Schedule" },
};

interface StudyInsightsProps {
  onReviewTopic?: (topicName: string, subjectName?: string) => void;
}

const StudyInsights = ({ onReviewTopic }: StudyInsightsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);

  // Load cached insights on mount, auto-fetch if stale or missing
  useEffect(() => {
    if (!user) return;
    const cached = getCache<CachedInsights>(CACHE_KEY);
    if (cached?.insights?.length) {
      setInsights(cached.insights);
      setLastFetchedAt(cached.fetchedAt);
      setHasLoaded(true);
      // If cache is older than TTL, refresh in background
      if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) {
        fetchInsights(true);
      }
    } else {
      // No cache — auto-fetch
      fetchInsights(false);
    }
  }, [user]);

  const fetchInsights = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("study-insights");
      if (error) throw error;
      if (data?.error) {
        if (!silent) toast({ title: "AI Insights", description: data.error, variant: "destructive" });
        return;
      }
      const fetched = data?.insights || [];
      const now = Date.now();
      setInsights(fetched);
      setLastFetchedAt(now);
      setHasLoaded(true);
      setCache(CACHE_KEY, { insights: fetched, fetchedAt: now } as CachedInsights);
    } catch (e) {
      console.error("Failed to fetch insights:", e);
      if (!silent) toast({ title: "Failed to load insights", description: "Please try again later.", variant: "destructive" });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user, toast]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl neural-border overflow-hidden"
    >
      <button
        onClick={() => {
          if (!hasLoaded && !loading) fetchInsights(false);
          setExpanded(!expanded);
        }}
        className="w-full flex items-center justify-between p-4"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <span className="text-sm font-semibold text-foreground">Smart Study Insights</span>
          {lastFetchedAt && hasLoaded && (
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              Updated {formatDistanceToNow(lastFetchedAt, { addSuffix: true })}
            </span>
          )}
          {insights.some(i => i.type === "urgent") && (
            <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasLoaded && (
            <button
              onClick={(e) => { e.stopPropagation(); fetchInsights(false); }}
              className="p-1 rounded-lg hover:bg-secondary/50 transition-colors"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
            </button>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {loading && !hasLoaded && (
                <div className="flex flex-col items-center py-8 gap-3">
                  <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                  <p className="text-xs text-muted-foreground">Analyzing your study patterns…</p>
                </div>
              )}

              {!loading && !hasLoaded && (
                <button
                  onClick={() => fetchInsights(false)}
                  className="w-full py-6 rounded-xl border border-dashed border-primary/30 hover:bg-primary/5 transition-colors flex flex-col items-center gap-2"
                >
                  <Sparkles className="w-6 h-6 text-primary" />
                  <span className="text-sm font-medium text-foreground">Generate AI Insights</span>
                  <span className="text-[10px] text-muted-foreground">Analyze weak topics & optimal revision times</span>
                </button>
              )}

              {hasLoaded && insights.length === 0 && !loading && (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground">No insights available yet. Add more topics and study sessions!</p>
                </div>
              )}

              {insights.map((insight, i) => {
                const config = typeConfig[insight.type] || typeConfig.optimization;
                const Icon = config.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className={`rounded-xl border ${config.border} ${config.bg} p-3 space-y-1`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${config.color}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${config.color}`}>{config.label}</span>
                      {insight.topic && (
                        <span className="text-[10px] text-muted-foreground ml-auto truncate max-w-[120px]">
                          {insight.topic}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{insight.body}</p>
                    {(insight.type === "urgent" || insight.type === "schedule") && insight.topic && onReviewTopic && (
                      <button
                        onClick={() => onReviewTopic(insight.topic!)}
                        className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/20 border border-destructive/30 hover:bg-destructive/30 transition-all text-xs font-semibold text-destructive active:scale-95"
                      >
                        <Play className="w-3 h-3" />
                        Review Now
                      </button>
                    )}
                  </motion.div>
                );
              })}

              {loading && hasLoaded && (
                <div className="flex items-center justify-center py-3">
                  <RefreshCw className="w-4 h-4 text-primary animate-spin mr-2" />
                  <span className="text-xs text-muted-foreground">Refreshing insights…</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default StudyInsights;
