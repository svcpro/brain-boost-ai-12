import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, Zap, ChevronDown, ChevronUp, Clock, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCache, setCache } from "@/lib/offlineCache";
import { safeStr } from "@/lib/safeRender";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface RiskDigestCardProps {
  onStudyTopic?: (subject?: string, topic?: string, minutes?: number) => void;
}

interface AtRiskTopic {
  id: string;
  name: string;
  memory_strength: number;
  next_predicted_drop_date: string | null;
  subject_id: string;
  subject_name?: string;
}

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

const Sparkline = ({ data, width = 48, height = 18, color }: SparklineProps) => {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 1;

  const coords = data.map((v, i) => ({
    x: padding + (i / (data.length - 1)) * (width - padding * 2),
    y: padding + (1 - (v - min) / range) * (height - padding * 2),
    value: v,
  }));

  const points = coords.map(c => `${c.x},${c.y}`).join(" ");
  const trend = data[data.length - 1] - data[0];
  const strokeColor = color || (trend > 0 ? "hsl(var(--success))" : trend < 0 ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))");
  const trendLabel = trend > 0 ? `+${trend}%` : trend < 0 ? `${trend}%` : "no change";

  const tooltipText = `${data.map(v => `${v}%`).join(" → ")}\n7-day trend: ${trendLabel}`;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <svg width={width} height={height} className="shrink-0 cursor-pointer" viewBox={`0 0 ${width} ${height}`}>
            <polyline
              points={points}
              fill="none"
              stroke={strokeColor}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Dot on last point */}
            <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r="2" fill={strokeColor} />
          </svg>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[10px] max-w-[180px] whitespace-pre-line z-50">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const RiskDigestCard = ({ onStudyTopic }: RiskDigestCardProps) => {
  const { user } = useAuth();
  const [atRiskTopics, setAtRiskTopics] = useState<AtRiskTopic[]>(() => getCache("risk-digest-topics") || []);
  const [digestBody, setDigestBody] = useState<string>(() => getCache("risk-digest-body") || "");
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [digestTime, setDigestTime] = useState<string | null>(null);
  const [trendData, setTrendData] = useState<Record<string, number[]>>(() => getCache("risk-digest-trends") || {});

  const loadDigest = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch latest risk digest notification
      const { data: digest } = await supabase
        .from("notification_history")
        .select("body, created_at")
        .eq("user_id", user.id)
        .eq("type", "risk_digest")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (digest) {
        setDigestBody(digest.body || "");
        setDigestTime(digest.created_at);
        setCache("risk-digest-body", digest.body || "");
      }

      // Fetch actual at-risk topics for one-tap actions
      const now = new Date();
      const threeDaysOut = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      const { data: topics } = await supabase
        .from("topics")
        .select("id, name, memory_strength, next_predicted_drop_date, subject_id")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .or(`memory_strength.lt.50,next_predicted_drop_date.lte.${threeDaysOut.toISOString()}`)
        .order("memory_strength", { ascending: true })
        .limit(6);

      if (topics && topics.length > 0) {
        // Fetch subject names + 7-day memory scores in parallel
        const subjectIds = [...new Set(topics.map(t => t.subject_id).filter(Boolean))];
        const topicIds = topics.map(t => t.id);
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const [subjectsRes, scoresRes] = await Promise.all([
          subjectIds.length > 0
            ? supabase.from("subjects").select("id, name").in("id", subjectIds)
            : Promise.resolve({ data: [] }),
          supabase
            .from("memory_scores")
            .select("topic_id, score, recorded_at")
            .in("topic_id", topicIds)
            .gte("recorded_at", weekAgo)
            .order("recorded_at", { ascending: true }),
        ]);

        const subjectMap: Record<string, string> = {};
        for (const s of subjectsRes.data || []) subjectMap[s.id] = s.name;

        // Group scores by topic_id
        const trends: Record<string, number[]> = {};
        for (const score of scoresRes.data || []) {
          if (!trends[score.topic_id]) trends[score.topic_id] = [];
          trends[score.topic_id].push(Math.round(score.score));
        }
        // Append current strength as latest point
        for (const t of topics) {
          if (!trends[t.id]) trends[t.id] = [];
          trends[t.id].push(Math.round(t.memory_strength));
        }
        setTrendData(trends);
        setCache("risk-digest-trends", trends);

        const enriched = topics.map(t => ({
          ...t,
          subject_name: subjectMap[t.subject_id] || undefined,
        }));
        setAtRiskTopics(enriched);
        setCache("risk-digest-topics", enriched);
      } else {
        setAtRiskTopics([]);
        setTrendData({});
        setCache("risk-digest-topics", []);
        setCache("risk-digest-trends", {});
      }
    } catch {
      // offline — cached data already loaded
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDigest();
  }, [user]);

  if (!digestBody && atRiskTopics.length === 0) return null;

  const isAllClear = digestBody.includes("All Clear") || atRiskTopics.length === 0;
  const visibleTopics = expanded ? atRiskTopics : atRiskTopics.slice(0, 3);

  const getStrengthColor = (strength: number) => {
    if (strength < 25) return "text-destructive";
    if (strength < 40) return "text-warning";
    return "text-yellow-500";
  };

  const getBarColor = (strength: number) => {
    if (strength < 25) return "bg-destructive";
    if (strength < 40) return "bg-warning";
    return "bg-yellow-500";
  };

  const getDaysUntilDrop = (dropDate: string | null) => {
    if (!dropDate) return null;
    const days = Math.max(0, Math.ceil((new Date(dropDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    return days;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18 }}
      className={`rounded-2xl neural-border overflow-hidden ${
        isAllClear
          ? "bg-gradient-to-br from-success/5 via-background to-success/5 border-success/20"
          : "bg-gradient-to-br from-destructive/5 via-background to-warning/5 border-destructive/20"
      }`}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          isAllClear ? "bg-success/15" : "bg-destructive/15"
        }`}>
          <ShieldAlert className={`w-4.5 h-4.5 ${isAllClear ? "text-success" : "text-destructive"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground">Risk Digest</h3>
          <p className="text-[10px] text-muted-foreground">
            {isAllClear ? "All topics healthy" : `${atRiskTopics.length} topic${atRiskTopics.length !== 1 ? "s" : ""} need attention`}
          </p>
        </div>
        <button
          onClick={loadDigest}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* AI Digest Summary */}
      {digestBody && (
        <div className="px-4 pb-2">
          <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-line line-clamp-3">
            {digestBody.split("\n").slice(0, 2).join("\n")}
          </p>
        </div>
      )}

      {/* At-Risk Topic Cards with One-Tap Actions */}
      {!isAllClear && atRiskTopics.length > 0 && (
        <div className="px-3 pb-3 space-y-1.5">
          <AnimatePresence initial={false}>
            {visibleTopics.map((topic, i) => {
              const daysLeft = getDaysUntilDrop(topic.next_predicted_drop_date);
              const strength = Math.round(topic.memory_strength);
              const sparkData = trendData[topic.id];

              return (
                <motion.div
                  key={topic.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-secondary/30 border border-border/40 group hover:border-primary/30 transition-colors">
                    {/* Strength indicator */}
                    <div className="w-9 h-9 rounded-lg bg-background/80 flex flex-col items-center justify-center shrink-0">
                      <span className={`text-xs font-bold ${getStrengthColor(strength)}`}>{strength}%</span>
                    </div>

                    {/* Topic info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{safeStr(topic.name)}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {topic.subject_name && (
                          <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">{safeStr(topic.subject_name)}</span>
                        )}
                        {daysLeft !== null && daysLeft <= 3 && (
                          <span className="flex items-center gap-0.5 text-[10px] text-destructive font-medium">
                            <Clock className="w-2.5 h-2.5" />
                            {daysLeft === 0 ? "Today" : `${daysLeft}d left`}
                          </span>
                        )}
                      </div>
                      {/* Mini bar */}
                      <div className="h-1 rounded-full bg-secondary mt-1 w-full">
                        <div className={`h-full rounded-full ${getBarColor(strength)} transition-all`} style={{ width: `${strength}%` }} />
                      </div>
                    </div>

                    {/* 7-day sparkline */}
                    {sparkData && sparkData.length >= 2 && (
                      <Sparkline data={sparkData} />
                    )}

                    {/* One-tap study button */}
                    <button
                      onClick={() => onStudyTopic?.(topic.subject_name, topic.name, 15)}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary text-[10px] font-semibold hover:bg-primary/20 active:scale-95 transition-all"
                    >
                      <Zap className="w-3 h-3" />
                      Study
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Show more/less toggle */}
          {atRiskTopics.length > 3 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? (
                <>Show less <ChevronUp className="w-3 h-3" /></>
              ) : (
                <>Show {atRiskTopics.length - 3} more <ChevronDown className="w-3 h-3" /></>
              )}
            </button>
          )}
        </div>
      )}

      {/* All clear state */}
      {isAllClear && (
        <div className="px-4 pb-4 text-center">
          <p className="text-xs text-success font-medium">✅ No topics at risk — keep it up!</p>
        </div>
      )}
    </motion.div>
  );
};

export default RiskDigestCard;
