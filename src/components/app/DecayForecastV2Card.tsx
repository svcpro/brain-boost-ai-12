import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Activity, AlertTriangle, Clock, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import QuickFixQuiz from "./QuickFixQuiz";

interface TopicDecay {
  topic_id: string;
  topic_name: string;
  subject_name: string | null;
  predicted_retention: number;
  predicted_retention_pct: number;
  hours_until_optimal_review: number;
  risk_level: string;
  review_urgency: string;
  memory_strength: number;
}

interface DashboardData {
  overall_retention: number;
  overall_retention_pct: number;
  total_topics: number;
  urgent_count: number;
  topic_decays: TopicDecay[];
  risk_alert: { type: string; message: string } | null;
  model_version: string;
}

export default function DecayForecastV2Card() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [fixSession, setFixSession] = useState<{ subject: string; topic: string; retention: number } | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: apiData, error } = await supabase.functions.invoke("forgetting-curve", {
        body: { action: "dashboard" },
      });
      if (!error && apiData?.success) {
        setData(apiData.data);
      }
    } catch (e) {
      console.error("Forgetting curve fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!hasLoaded && user) {
      setHasLoaded(true);
      fetchDashboard();
    }
  }, [hasLoaded, user, fetchDashboard]);

  

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 animate-pulse">
        <div className="h-20 bg-secondary rounded" />
      </div>
    );
  }

  if (!data || data.topic_decays.length === 0) return null;

  const overallPct = Math.round(data.overall_retention * 100);
  const urgentTopics = data.topic_decays.filter(t => t.predicted_retention < 0.5);
  const displayTopics = expanded ? data.topic_decays.slice(0, 10) : data.topic_decays.slice(0, 3);

  const getRetentionColor = (r: number) => {
    if (r >= 0.7) return "text-chart-2";
    if (r >= 0.5) return "text-chart-5";
    return "text-destructive";
  };

  const getRetentionBg = (r: number) => {
    if (r >= 0.7) return "bg-chart-2";
    if (r >= 0.5) return "bg-chart-5";
    return "bg-destructive";
  };

  const handleFix = (topic: typeof data.topic_decays[0]) => {
    setFixSession({
      subject: topic.subject_name || "",
      topic: topic.topic_name,
      retention: Math.round(topic.predicted_retention * 100),
    });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border overflow-hidden"
        style={{ background: "linear-gradient(135deg, hsl(var(--chart-3) / 0.04), hsl(var(--card)))" }}
      >
        <div className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-chart-3/15 flex items-center justify-center">
                <Activity className="w-5 h-5 text-chart-3" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Forgetting Curve 2.0</h3>
                <p className="text-[10px] text-muted-foreground">5-Factor Decay Model</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-xl font-bold ${getRetentionColor(data.overall_retention)}`}>{overallPct}%</p>
              <p className="text-[9px] text-muted-foreground">Overall Retention</p>
            </div>
          </div>

          {/* Urgent alert */}
          {urgentTopics.length > 0 && (
            <div className="flex items-center gap-2 mb-3 px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
              <span className="text-[10px] text-destructive font-medium">
                {urgentTopics.length} topic{urgentTopics.length > 1 ? "s" : ""} below 50% — review needed
              </span>
            </div>
          )}

          {/* Topic list */}
          <div className="space-y-2">
            {displayTopics.map((topic) => {
              const retPct = Math.round(topic.predicted_retention * 100);
              return (
                <motion.div
                  key={topic.topic_id}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleFix(topic)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-secondary/30 border border-border/30 cursor-pointer hover:border-primary/30 hover:bg-secondary/50 transition-all active:bg-secondary/60"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-foreground truncate">{topic.topic_name}</span>
                      {topic.subject_name && (
                        <span className="text-[8px] text-muted-foreground px-1.5 py-0.5 rounded bg-secondary shrink-0">{topic.subject_name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
                        <div className={`h-full rounded-full ${getRetentionBg(topic.predicted_retention)}`} style={{ width: `${retPct}%` }} />
                      </div>
                      <span className={`text-[9px] font-medium ${getRetentionColor(topic.predicted_retention)} w-8 text-right`}>{retPct}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {topic.hours_until_optimal_review > 0
                        ? `${Math.round(topic.hours_until_optimal_review)}h`
                        : "Now"
                      }
                    </span>
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors">
                      <Zap className="w-3 h-3 text-primary" />
                      <span className="text-[9px] font-semibold text-primary">Fix</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Expand */}
          {data.topic_decays.length > 3 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-center gap-1 py-2 mt-2 text-[10px] text-muted-foreground hover:text-primary transition-colors"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? "Show less" : `Show ${data.topic_decays.length - 3} more`}
            </button>
          )}

          {/* Version badge */}
          <div className="flex items-center justify-end mt-2">
            <span className="text-[9px] text-muted-foreground">{data.model_version}</span>
          </div>
        </div>
      </motion.div>

      {/* Quick Fix Quiz popup */}
      <QuickFixQuiz
        open={!!fixSession}
        onClose={() => {
          setFixSession(null);
          fetchDashboard();
          window.dispatchEvent(new Event("insights-refresh"));
        }}
        topicName={fixSession?.topic || ""}
        subjectName={fixSession?.subject || ""}
        retentionPct={fixSession?.retention || 0}
      />
    </>
  );
}
