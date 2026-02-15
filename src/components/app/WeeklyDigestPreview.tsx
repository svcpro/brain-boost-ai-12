import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, TrendingUp, TrendingDown, AlertTriangle, Sparkles, RefreshCw, Clock, ChevronDown, ChevronUp, Zap, Share2, ArrowLeftRight } from "lucide-react";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCache, setCache } from "@/lib/offlineCache";

interface WeekStats {
  totalMinutes: number;
  sessions: number;
  evoScore: number | null;
  efficiency: number | null;
  growth: number | null;
}

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
  lastWeek: WeekStats | null;
}

const CACHE_KEY = "weekly-digest-preview";

const formatTime = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const DeltaBadge = ({ current, previous, suffix = "" }: { current: number | null; previous: number | null; suffix?: string }) => {
  if (current == null || previous == null) return null;
  const diff = Math.round(current - previous);
  if (diff === 0) return <span className="text-[9px] text-muted-foreground ml-auto">—</span>;
  return (
    <span className={`text-[9px] font-semibold flex items-center gap-0.5 ml-auto ${diff > 0 ? "text-success" : "text-destructive"}`}>
      {diff > 0 ? <TrendingUp className="w-2 h-2" /> : <TrendingDown className="w-2 h-2" />}
      {diff > 0 ? "+" : ""}{diff}{suffix}
    </span>
  );
};

const MetricCard = ({
  icon, iconColor, label, value, subValue, compare, compareValue, compareSuffix,
}: {
  icon: React.ReactNode; iconColor: string; label: string; value: React.ReactNode; subValue?: React.ReactNode;
  compare?: boolean; compareValue?: { current: number | null; previous: number | null }; compareSuffix?: string;
}) => (
  <div className="rounded-lg bg-secondary/30 border border-border/40 p-3">
    <div className="flex items-center gap-1.5 mb-1">
      <span className={iconColor}>{icon}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
      {compare && compareValue && <DeltaBadge current={compareValue.current} previous={compareValue.previous} suffix={compareSuffix} />}
    </div>
    <div className="flex items-baseline gap-1.5">
      {value}
      {subValue}
    </div>
  </div>
);

const WeeklyDigestPreview = () => {
  const { user } = useAuth();
  const [data, setData] = useState<DigestData | null>(() => getCache(CACHE_KEY));
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [comparing, setComparing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleShare = useCallback(async () => {
    if (!cardRef.current || sharing) return;
    setSharing(true);
    try {
      const canvas = await html2canvas(cardRef.current, { backgroundColor: null, scale: 2, useCORS: true });
      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, "image/png"));
      if (!blob) throw new Error("Failed to generate image");
      if (navigator.share && navigator.canShare?.({ files: [new File([blob], "brain-digest.png", { type: "image/png" })] })) {
        await navigator.share({
          title: "My Weekly Brain Digest",
          text: `Brain Evolution: ${data?.twin?.brain_evolution_score != null ? Math.round(data.twin.brain_evolution_score) : "N/A"}/100`,
          files: [new File([blob], "brain-digest.png", { type: "image/png" })],
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "brain-digest.png"; a.click();
        URL.revokeObjectURL(url);
        toast.success("Digest image downloaded!");
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") toast.error("Failed to share digest");
    } finally { setSharing(false); }
  }, [data, sharing]);

  const loadDigest = useCallback(async () => {
    if (!user || loading) return;
    setLoading(true);
    try {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 86400000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);

      const [twinRes, reportsRes, topicsRes, logsThisWeekRes, logsLastWeekRes, profileRes] = await Promise.all([
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
        supabase.from("study_logs")
          .select("duration_minutes")
          .eq("user_id", user.id)
          .gte("created_at", twoWeeksAgo.toISOString())
          .lt("created_at", weekAgo.toISOString()),
        supabase.from("profiles")
          .select("display_name, exam_type, exam_date, daily_study_goal_minutes")
          .eq("id", user.id).maybeSingle(),
      ]);

      const twin = twinRes.data;
      const reports = reportsRes.data || [];
      const topics = topicsRes.data || [];
      const logsThisWeek = logsThisWeekRes.data || [];
      const logsLastWeek = logsLastWeekRes.data || [];

      const totalMinutes = logsThisWeek.reduce((s, l) => s + (l.duration_minutes || 0), 0);
      const sessions = logsThisWeek.length;

      const lastWeekMinutes = logsLastWeek.reduce((s, l) => s + (l.duration_minutes || 0), 0);
      const lastWeekSessions = logsLastWeek.length;

      // Evolution change & last week snapshot from reports
      let evolutionChange: number | null = null;
      let lastWeekEvo: number | null = null;
      let lastWeekEfficiency: number | null = null;
      let lastWeekGrowth: number | null = null;

      if (reports.length >= 2) {
        const oldM = reports[0].metrics as Record<string, number> | null;
        const newM = reports[reports.length - 1].metrics as Record<string, number> | null;
        if (oldM?.brain_evolution_score != null && newM?.brain_evolution_score != null) {
          evolutionChange = Math.round(newM.brain_evolution_score - oldM.brain_evolution_score);
        }
        lastWeekEvo = oldM?.brain_evolution_score ?? null;
        lastWeekEfficiency = oldM?.learning_efficiency_score ?? null;
        lastWeekGrowth = oldM?.memory_growth_rate ?? null;
      }

      // At-risk topics
      const threeDaysOut = new Date(now.getTime() + 3 * 86400000);
      const atRiskRaw = topics.filter(t => {
        const str = Number(t.memory_strength);
        const drop = t.next_predicted_drop_date ? new Date(t.next_predicted_drop_date) : null;
        return str < 50 || (drop && drop <= threeDaysOut);
      }).slice(0, 6);

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

      // AI recommendations
      const timeStr = formatTime(totalMinutes);
      let recommendations = "";
      try {
        const contextStr = `Student: ${profileRes.data?.display_name || "Student"}
Exam: ${profileRes.data?.exam_type || "Not set"}${profileRes.data?.exam_date ? `, ${Math.ceil((new Date(profileRes.data.exam_date).getTime() - now.getTime()) / 86400000)} days away` : ""}
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
        if (aiResp.data?.reply) recommendations = aiResp.data.reply;
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
        lastWeek: {
          totalMinutes: lastWeekMinutes,
          sessions: lastWeekSessions,
          evoScore: lastWeekEvo,
          efficiency: lastWeekEfficiency,
          growth: lastWeekGrowth,
        },
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

  const evoScore = data?.twin?.brain_evolution_score;
  const evoChange = data?.evolutionChange;
  const efficiency = data?.twin?.learning_efficiency_score;
  const growth = data?.twin?.memory_growth_rate;
  const lw = data?.lastWeek;
  const showCompare = comparing && lw;

  return (
    <motion.div
      ref={cardRef}
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
          <p className="text-[10px] text-muted-foreground">
            {comparing ? "This week vs last week" : "Live preview — same as your email report"}
          </p>
        </div>
        <button
          onClick={() => setComparing(!comparing)}
          disabled={!data}
          className={`p-1.5 rounded-lg transition-colors ${comparing ? "bg-primary/20 text-primary" : "hover:bg-secondary/80 text-muted-foreground hover:text-foreground"}`}
          title="Compare with last week"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleShare}
          disabled={sharing || !data}
          className="p-1.5 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Share2 className={`w-3.5 h-3.5 ${sharing ? "animate-pulse" : ""}`} />
        </button>
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
          {/* Compare column headers */}
          <AnimatePresence>
            {showCompare && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground overflow-hidden"
              >
                <div className="flex-1 text-center rounded-md bg-primary/10 py-1">This Week</div>
                <div className="flex-1 text-center rounded-md bg-secondary/50 py-1">Last Week</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Cognitive Scores Grid */}
          {showCompare ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-2"
            >
              <CompareRow
                icon={<Brain className="w-3 h-3" />} iconColor="text-primary" label="Evolution"
                thisVal={evoScore != null ? `${Math.round(evoScore)}/100` : "—"}
                lastVal={lw.evoScore != null ? `${Math.round(lw.evoScore)}/100` : "—"}
                diff={evoScore != null && lw.evoScore != null ? Math.round(evoScore - lw.evoScore) : null}
              />
              <CompareRow
                icon={<Zap className="w-3 h-3" />} iconColor="text-warning" label="Efficiency"
                thisVal={efficiency != null ? `${Math.round(efficiency)}%` : "—"}
                lastVal={lw.efficiency != null ? `${Math.round(lw.efficiency)}%` : "—"}
                diff={efficiency != null && lw.efficiency != null ? Math.round(efficiency - lw.efficiency) : null}
                suffix="%"
              />
              <CompareRow
                icon={<TrendingUp className="w-3 h-3" />} iconColor="text-success" label="Memory Growth"
                thisVal={growth != null ? `${growth > 0 ? "+" : ""}${growth.toFixed(1)}%` : "—"}
                lastVal={lw.growth != null ? `${lw.growth > 0 ? "+" : ""}${lw.growth.toFixed(1)}%` : "—"}
                diff={growth != null && lw.growth != null ? +(growth - lw.growth).toFixed(1) : null}
                suffix="%"
              />
              <CompareRow
                icon={<Clock className="w-3 h-3" />} iconColor="text-primary" label="Study Time"
                thisVal={`${formatTime(data.totalMinutes)} (${data.sessions})`}
                lastVal={`${formatTime(lw.totalMinutes)} (${lw.sessions})`}
                diff={data.totalMinutes - lw.totalMinutes}
                suffix="m"
              />
            </motion.div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <MetricCard
                icon={<Brain className="w-3 h-3" />} iconColor="text-primary" label="Evolution"
                value={<span className="text-lg font-bold text-foreground">{evoScore != null ? Math.round(evoScore) : "—"}</span>}
                subValue={<span className="text-[10px] text-muted-foreground">/100</span>}
                compare={false}
              />
              <MetricCard
                icon={<Zap className="w-3 h-3" />} iconColor="text-warning" label="Efficiency"
                value={<span className="text-lg font-bold text-foreground">{efficiency != null ? `${Math.round(efficiency)}%` : "—"}</span>}
              />
              <MetricCard
                icon={<TrendingUp className="w-3 h-3" />} iconColor="text-success" label="Memory Growth"
                value={<span className={`text-lg font-bold ${(growth || 0) >= 0 ? "text-success" : "text-destructive"}`}>{growth != null ? `${growth > 0 ? "+" : ""}${growth.toFixed(1)}%` : "—"}</span>}
              />
              <MetricCard
                icon={<Clock className="w-3 h-3" />} iconColor="text-primary" label="Study Time"
                value={<span className="text-lg font-bold text-foreground">{formatTime(data.totalMinutes)}</span>}
                subValue={<span className="text-[10px] text-muted-foreground ml-1">({data.sessions})</span>}
              />
            </div>
          )}

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

/** Side-by-side comparison row */
const CompareRow = ({
  icon, iconColor, label, thisVal, lastVal, diff, suffix = "",
}: {
  icon: React.ReactNode; iconColor: string; label: string;
  thisVal: string; lastVal: string; diff: number | null; suffix?: string;
}) => (
  <div className="rounded-lg border border-border/40 bg-secondary/20 p-2.5">
    <div className="flex items-center gap-1.5 mb-1.5">
      <span className={iconColor}>{icon}</span>
      <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
      {diff != null && (
        <span className={`text-[9px] font-bold flex items-center gap-0.5 ml-auto ${diff > 0 ? "text-success" : diff < 0 ? "text-destructive" : "text-muted-foreground"}`}>
          {diff > 0 ? <TrendingUp className="w-2 h-2" /> : diff < 0 ? <TrendingDown className="w-2 h-2" /> : null}
          {diff > 0 ? "+" : ""}{diff}{suffix}
        </span>
      )}
    </div>
    <div className="flex gap-2">
      <div className="flex-1 rounded-md bg-primary/10 px-2 py-1.5 text-center">
        <span className="text-xs font-bold text-foreground">{thisVal}</span>
      </div>
      <div className="flex-1 rounded-md bg-secondary/50 px-2 py-1.5 text-center">
        <span className="text-xs font-medium text-muted-foreground">{lastVal}</span>
      </div>
    </div>
  </div>
);

export default WeeklyDigestPreview;
