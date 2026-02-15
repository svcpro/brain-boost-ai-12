import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, TrendingUp, TrendingDown, AlertTriangle, Sparkles, RefreshCw, Clock, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCache, setCache } from "@/lib/offlineCache";

interface DigestData {
  twin: {
    brain_evolution_score: number | null;
    learning_efficiency_score: number | null;
    memory_growth_rate: number | null;
  } | null;
  evolutionChange: number | null;
  totalMinutes: number;
  sessions: number;
  atRisk: Array<{
    name: string;
    memory_strength: number;
    subject_name?: string;
  }>;
  recommendations: string;
}

const CACHE_KEY = "weekly-digest-preview";

const WeeklyDigestPreview = () => {
  const { user } = useAuth();
  const [data, setData] = useState<DigestData | null>(() => getCache(CACHE_KEY));
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadDigest = useCallback(async () => {
    if (!user || loading) return;
    setLoading(true);
    try {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const [twinRes, reportsRes, topicsRes, logsRes, profileRes] = await Promise.all([
        supabase.from("cognitive_twins")
          .select("brain_evolution_score, learning_efficiency_score, memory_growth_rate")
          .eq("user_id", user.id).maybeSingle(),
        supabase.from("brain_reports")
          .select("metrics, created_at")
          .eq("user_id", user.id).eq("report_type", "cognitive_snapshot")
          .gte("created_at", twoWeeksAgo.toISOString())
          .order("created_at", { ascending: true }),
        supabase.from("topics")
          .select("name, memory_strength, next_predicted_drop_date, subject_id")
          .eq("user_id", user.id).is("deleted_at", null)
          .order("memory_strength", { ascending: true }),
        supabase.from("study_logs")
          .select("duration_minutes")
          .eq("user_id", user.id)
          .gte("created_at", weekAgo.toISOString()),
        supabase.from("profiles")
          .select("display_name, exam_type, exam_date, daily_study_goal_minutes")
          .eq("id", user.id).maybeSingle(),
      ]);

      const twin = twinRes.data;
      const reports = reportsRes.data || [];
      const topics = topicsRes.data || [];
      const logs = logsRes.data || [];

      const totalMinutes = logs.reduce((s, l) => s + (l.duration_minutes || 0), 0);
      const sessions = logs.length;

      // Evolution change
      let evolutionChange: number | null = null;
      if (reports.length >= 2) {
        const oldM = reports[0].metrics as Record<string, number> | null;
        const newM = reports[reports.length - 1].metrics as Record<string, number> | null;
        if (oldM?.brain_evolution_score != null && newM?.brain_evolution_score != null) {
          evolutionChange = Math.round(newM.brain_evolution_score - oldM.brain_evolution_score);
        }
      }

      // At-risk topics
      const threeDaysOut = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const atRiskRaw = topics.filter(t => {
        const str = Number(t.memory_strength);
        const drop = t.next_predicted_drop_date ? new Date(t.next_predicted_drop_date) : null;
        return str < 50 || (drop && drop <= threeDaysOut);
      }).slice(0, 6);

      // Get subject names
      const subjectIds = [...new Set(atRiskRaw.map(t => t.subject_id).filter(Boolean))];
      const { data: subjects } = subjectIds.length > 0
        ? await supabase.from("subjects").select("id, name").in("id", subjectIds)
        : { data: [] };
      const subjectMap: Record<string, string> = {};
      for (const s of subjects || []) subjectMap[s.id] = s.name;

      const atRisk = atRiskRaw.map(t => ({
        name: t.name,
        memory_strength: Number(t.memory_strength),
        subject_name: subjectMap[t.subject_id] || undefined,
      }));

      // Generate AI recommendations
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

      let recommendations = "";
      try {
        const contextStr = `Student: ${profileRes.data?.display_name || "Student"}
Exam: ${profileRes.data?.exam_type || "Not set"}${profileRes.data?.exam_date ? `, ${Math.ceil((new Date(profileRes.data.exam_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} days away` : ""}
Weekly study: ${timeStr} across ${sessions} sessions
Brain evolution: ${twin?.brain_evolution_score != null ? `${Math.round(twin.brain_evolution_score)}/100` : "N/A"}${evolutionChange != null ? ` (${evolutionChange >= 0 ? "+" : ""}${evolutionChange})` : ""}
Efficiency: ${twin?.learning_efficiency_score != null ? `${Math.round(twin.learning_efficiency_score)}%` : "N/A"}
At-risk topics: ${atRisk.length > 0 ? atRisk.slice(0, 4).map(t => `${t.name} (${Math.round(t.memory_strength)}%)`).join(", ") : "None"}`;

        const aiResp = await supabase.functions.invoke("ai-brain-agent", {
          body: {
            messages: [
              { role: "system", content: "Generate 3 specific, actionable study recommendations for this student's upcoming week. Each should be 1 sentence. Number them 1-3. Be specific about topic names and time durations. No greetings." },
              { role: "user", content: contextStr },
            ],
          },
        });
        if (aiResp.data?.reply) {
          recommendations = aiResp.data.reply;
        }
      } catch { /* fallback */ }

      if (!recommendations) {
        recommendations = atRisk.length > 0
          ? `1. Priority review: ${atRisk[0].name} (${Math.round(atRisk[0].memory_strength)}% strength) — 20 min session\n2. Consolidate your strongest topics to maintain momentum\n3. Aim for ${profileRes.data?.daily_study_goal_minutes || 60} min daily to stay on track`
          : "1. Keep reviewing your existing topics to maintain high retention\n2. Consider adding new study material to expand coverage\n3. Use Focus Mode for deeper learning sessions";
      }

      const result: DigestData = {
        twin: twin ? {
          brain_evolution_score: twin.brain_evolution_score,
          learning_efficiency_score: twin.learning_efficiency_score,
          memory_growth_rate: twin.memory_growth_rate,
        } : null,
        evolutionChange,
        totalMinutes,
        sessions,
        atRisk,
        recommendations,
      };

      setData(result);
      setCache(CACHE_KEY, result);
    } catch (err) {
      console.error("Weekly digest preview error:", err);
    } finally {
      setLoading(false);
    }
  }, [user, loading]);

  useEffect(() => {
    if (!data) loadDigest();
  }, [user]);

  if (!data && !loading) return null;

  const hours = Math.floor((data?.totalMinutes || 0) / 60);
  const mins = (data?.totalMinutes || 0) % 60;
  const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  const evoScore = data?.twin?.brain_evolution_score;
  const evoChange = data?.evolutionChange;
  const efficiency = data?.twin?.learning_efficiency_score;
  const growth = data?.twin?.memory_growth_rate;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl neural-border overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-accent/10 px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
          <Brain className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground">Weekly Brain Digest</h3>
          <p className="text-[10px] text-muted-foreground">Live preview — same as your email report</p>
        </div>
        <button
          onClick={loadDigest}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && !data ? (
        <div className="p-6 text-center">
          <RefreshCw className="w-5 h-5 text-primary animate-spin mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Building your digest…</p>
        </div>
      ) : data ? (
        <div className="p-4 space-y-3">
          {/* Cognitive Scores Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-secondary/30 border border-border/40 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Brain className="w-3 h-3 text-primary" />
                <span className="text-[10px] text-muted-foreground">Evolution</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-foreground">
                  {evoScore != null ? Math.round(evoScore) : "—"}
                </span>
                <span className="text-[10px] text-muted-foreground">/100</span>
                {evoChange != null && (
                  <span className={`text-[10px] font-semibold flex items-center gap-0.5 ml-auto ${evoChange >= 0 ? "text-success" : "text-destructive"}`}>
                    {evoChange >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                    {evoChange >= 0 ? "+" : ""}{evoChange}
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-lg bg-secondary/30 border border-border/40 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap className="w-3 h-3 text-warning" />
                <span className="text-[10px] text-muted-foreground">Efficiency</span>
              </div>
              <span className="text-lg font-bold text-foreground">
                {efficiency != null ? `${Math.round(efficiency)}%` : "—"}
              </span>
            </div>

            <div className="rounded-lg bg-secondary/30 border border-border/40 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3 h-3 text-success" />
                <span className="text-[10px] text-muted-foreground">Memory Growth</span>
              </div>
              <span className={`text-lg font-bold ${(growth || 0) >= 0 ? "text-success" : "text-destructive"}`}>
                {growth != null ? `${growth > 0 ? "+" : ""}${growth.toFixed(1)}%` : "—"}
              </span>
            </div>

            <div className="rounded-lg bg-secondary/30 border border-border/40 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3 h-3 text-primary" />
                <span className="text-[10px] text-muted-foreground">Study Time</span>
              </div>
              <span className="text-lg font-bold text-foreground">{timeStr}</span>
              <span className="text-[10px] text-muted-foreground ml-1">({data.sessions})</span>
            </div>
          </div>

          {/* At-Risk Topics */}
          {data.atRisk.length > 0 ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-3 h-3 text-destructive" />
                <span className="text-xs font-semibold text-foreground">
                  {data.atRisk.length} Topic{data.atRisk.length !== 1 ? "s" : ""} at Risk
                </span>
              </div>
              <div className="space-y-1.5">
                {data.atRisk.slice(0, expanded ? 6 : 3).map((t, i) => {
                  const str = Math.round(t.memory_strength);
                  const barColor = str < 25 ? "bg-destructive" : str < 40 ? "bg-warning" : "bg-yellow-500";
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-[11px] text-foreground font-medium truncate">
                            {t.name}
                            {t.subject_name && <span className="text-muted-foreground font-normal ml-1">({t.subject_name})</span>}
                          </span>
                          <span className={`text-[10px] font-bold ${str < 30 ? "text-destructive" : "text-warning"}`}>{str}%</span>
                        </div>
                        <div className="h-1 rounded-full bg-secondary">
                          <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${str}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {data.atRisk.length > 3 && (
                  <button
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center justify-center gap-1 w-full pt-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {expanded ? <>Show less <ChevronUp className="w-3 h-3" /></> : <>+{data.atRisk.length - 3} more <ChevronDown className="w-3 h-3" /></>}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-success/20 bg-success/5 p-3 text-center">
              <p className="text-xs text-success font-medium">✅ No topics at risk this week!</p>
            </div>
          )}

          {/* AI Recommendations */}
          <div className="rounded-lg border border-border/40 bg-secondary/20 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3 h-3 text-primary" />
              <span className="text-xs font-semibold text-foreground">AI Recommendations</span>
            </div>
            <p className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-line">
              {data.recommendations}
            </p>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
};

export default WeeklyDigestPreview;
