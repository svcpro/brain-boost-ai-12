import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Brain, Users, Zap, Timer, Target, Loader2, RefreshCw, AlertTriangle, Heart, Languages, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function CognitiveProfileViewer() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProfiles: 0,
    styleDistribution: { conceptual: 0, memorizer: 0, hybrid: 0 } as Record<string, number>,
    avgAccuracy: 0,
    avgSpeed: 0,
    speedPatterns: {} as Record<string, number>,
    tradeoffs: {} as Record<string, number>,
    totalFatigueEvents: 0,
    totalRescues: 0,
    totalConfidenceBoosts: 0,
    langStats: [] as any[],
    recentRecalibrations: 0,
    configData: null as any,
  });
  const [configEditing, setConfigEditing] = useState(false);
  const [configForm, setConfigForm] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profilesRes, fatigueRes, confRes, langRes, recalRes, configRes] = await Promise.all([
        supabase.from("cognitive_profiles").select("learning_style, speed_pattern, speed_accuracy_tradeoff, accuracy_rate, avg_answer_speed_ms").limit(1000),
        supabase.from("fatigue_events").select("event_type").limit(1000),
        supabase.from("confidence_events").select("event_type").limit(1000),
        supabase.from("language_performance").select("language, total_questions, accuracy_rate").limit(500),
        supabase.from("ai_recalibration_logs").select("id").limit(500),
        supabase.from("fatigue_config").select("*").limit(1).maybeSingle(),
      ]);

      const profiles = profilesRes.data || [];
      const fatigue = fatigueRes.data || [];
      const conf = confRes.data || [];
      const langs = langRes.data || [];

      const styles: Record<string, number> = { conceptual: 0, memorizer: 0, hybrid: 0 };
      const speedP: Record<string, number> = {};
      const tradeoffs: Record<string, number> = {};
      let totalAcc = 0, totalSpd = 0;

      for (const p of profiles) {
        styles[p.learning_style] = (styles[p.learning_style] || 0) + 1;
        speedP[p.speed_pattern] = (speedP[p.speed_pattern] || 0) + 1;
        tradeoffs[p.speed_accuracy_tradeoff] = (tradeoffs[p.speed_accuracy_tradeoff] || 0) + 1;
        totalAcc += p.accuracy_rate || 0;
        totalSpd += p.avg_answer_speed_ms || 0;
      }

      // Aggregate language stats
      const langMap: Record<string, { total: number; accuracy: number; count: number }> = {};
      for (const l of langs) {
        if (!langMap[l.language]) langMap[l.language] = { total: 0, accuracy: 0, count: 0 };
        langMap[l.language].total += l.total_questions || 0;
        langMap[l.language].accuracy += l.accuracy_rate || 0;
        langMap[l.language].count++;
      }

      setStats({
        totalProfiles: profiles.length,
        styleDistribution: styles,
        avgAccuracy: profiles.length > 0 ? Math.round((totalAcc / profiles.length) * 100) : 0,
        avgSpeed: profiles.length > 0 ? Math.round(totalSpd / profiles.length / 1000) : 0,
        speedPatterns: speedP,
        tradeoffs: tradeoffs,
        totalFatigueEvents: fatigue.filter(f => f.event_type === "fatigue_detected").length,
        totalRescues: conf.filter(c => c.event_type === "rescue_triggered").length,
        totalConfidenceBoosts: conf.filter(c => c.event_type === "confidence_boost" || c.event_type === "struggle_detected").length,
        langStats: Object.entries(langMap).map(([lang, d]) => ({ lang, total: d.total, avgAccuracy: d.count > 0 ? Math.round((d.accuracy / d.count) * 100) : 0 })),
        recentRecalibrations: recalRes.data?.length || 0,
        configData: configRes.data,
      });
      setConfigForm(configRes.data);
    } catch (e) {
      console.error("Admin cognitive fetch failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const saveConfig = async () => {
    if (!configForm) return;
    try {
      await supabase.from("fatigue_config").update({
        delay_threshold_ms: configForm.delay_threshold_ms,
        mistake_cluster_threshold: configForm.mistake_cluster_threshold,
        session_max_minutes: configForm.session_max_minutes,
        break_suggestion_cooldown_minutes: configForm.break_suggestion_cooldown_minutes,
        rescue_mode_wrong_threshold: configForm.rescue_mode_wrong_threshold,
        confidence_boost_enabled: configForm.confidence_boost_enabled,
        auto_language_suggestion: configForm.auto_language_suggestion,
        weekly_recalibration_enabled: configForm.weekly_recalibration_enabled,
      }).eq("id", configForm.id);
      setConfigEditing(false);
      fetchData();
    } catch (e) {
      console.error("Config save failed:", e);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Profiles", value: stats.totalProfiles, icon: Users, color: "text-primary" },
          { label: "Avg Accuracy", value: `${stats.avgAccuracy}%`, icon: Target, color: "text-success" },
          { label: "Fatigue Events", value: stats.totalFatigueEvents, icon: AlertTriangle, color: "text-warning" },
          { label: "Rescues Triggered", value: stats.totalRescues, icon: Heart, color: "text-destructive" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass rounded-xl p-3 neural-border text-center">
            <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Learning Style Distribution */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl neural-border p-4">
        <h4 className="text-xs font-semibold text-foreground mb-3">Learning Style Distribution</h4>
        <div className="space-y-2">
          {Object.entries(stats.styleDistribution).map(([style, count]) => {
            const pct = stats.totalProfiles > 0 ? Math.round((count / stats.totalProfiles) * 100) : 0;
            const colors: Record<string, string> = { conceptual: "bg-blue-500", memorizer: "bg-amber-500", hybrid: "bg-primary" };
            return (
              <div key={style} className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground capitalize">{style}</span>
                  <span className="text-foreground font-medium">{count} ({pct}%)</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className={`h-full ${colors[style] || "bg-primary"} rounded-full`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Language Stats */}
      {stats.langStats.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl neural-border p-4">
          <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1">
            <Languages className="w-3.5 h-3.5" /> Language Performance (All Users)
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {stats.langStats.map(ls => (
              <div key={ls.lang} className="rounded-lg bg-secondary/30 p-3 text-center">
                <p className="text-sm font-bold text-foreground capitalize">{ls.lang}</p>
                <p className="text-[10px] text-muted-foreground">{ls.total} Qs • {ls.avgAccuracy}% avg accuracy</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Config Panel */}
      {configForm && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl neural-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-foreground">Engine Configuration</h4>
            <button onClick={() => configEditing ? saveConfig() : setConfigEditing(true)}
              className="text-[10px] px-3 py-1 rounded-lg bg-primary/15 text-primary font-medium">
              {configEditing ? "Save" : "Edit"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "delay_threshold_ms", label: "Delay Threshold (ms)", type: "number" },
              { key: "mistake_cluster_threshold", label: "Mistake Cluster Threshold", type: "number" },
              { key: "session_max_minutes", label: "Max Session (min)", type: "number" },
              { key: "rescue_mode_wrong_threshold", label: "Rescue Trigger (consecutive wrong)", type: "number" },
              { key: "break_suggestion_cooldown_minutes", label: "Break Cooldown (min)", type: "number" },
              { key: "confidence_boost_enabled", label: "Confidence Boosts", type: "toggle" },
              { key: "auto_language_suggestion", label: "Auto Language Suggest", type: "toggle" },
              { key: "weekly_recalibration_enabled", label: "Weekly Recalibration", type: "toggle" },
            ].map(field => (
              <div key={field.key} className="space-y-1">
                <label className="text-[10px] text-muted-foreground">{field.label}</label>
                {field.type === "toggle" ? (
                  <button
                    disabled={!configEditing}
                    onClick={() => setConfigForm((prev: any) => ({ ...prev, [field.key]: !prev[field.key] }))}
                    className={`w-full py-1.5 rounded-lg text-xs font-medium ${configForm[field.key] ? "bg-success/20 text-success" : "bg-secondary text-muted-foreground"}`}
                  >
                    {configForm[field.key] ? "Enabled" : "Disabled"}
                  </button>
                ) : (
                  <input
                    type="number"
                    disabled={!configEditing}
                    value={configForm[field.key] || 0}
                    onChange={e => setConfigForm((prev: any) => ({ ...prev, [field.key]: Number(e.target.value) }))}
                    className="w-full px-2 py-1.5 rounded-lg bg-secondary text-foreground text-xs border-0 outline-none"
                  />
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
            <Activity className="w-3 h-3" />
            <span>{stats.recentRecalibrations} recalibrations logged • {stats.totalConfidenceBoosts} confidence boosts sent</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
