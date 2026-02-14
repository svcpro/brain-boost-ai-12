import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Brain, Activity, Network, Clock, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMemoryEngine } from "@/hooks/useMemoryEngine";

const BrainTab = () => {
  const { user } = useAuth();
  const { prediction, loading, predict } = useMemoryEngine();
  const [subjectHealth, setSubjectHealth] = useState<{ name: string; strength: number; topicCount: number }[]>([]);

  useEffect(() => {
    predict();
    loadSubjectHealth();
  }, []);

  const loadSubjectHealth = async () => {
    if (!user) return;
    const { data: subjects } = await supabase
      .from("subjects")
      .select("id, name")
      .eq("user_id", user.id);

    if (!subjects || subjects.length === 0) {
      setSubjectHealth([]);
      return;
    }

    const health = [];
    for (const sub of subjects) {
      const { data: topics } = await supabase
        .from("topics")
        .select("memory_strength")
        .eq("user_id", user.id)
        .eq("subject_id", sub.id);

      const topicCount = topics?.length || 0;
      const avgStrength = topicCount > 0
        ? Math.round((topics!.reduce((s, t) => s + Number(t.memory_strength), 0) / topicCount))
        : 0;

      health.push({ name: sub.name, strength: avgStrength, topicCount });
    }
    setSubjectHealth(health);
  };

  const overallHealth = prediction?.overall_health ?? 0;
  const hasData = subjectHealth.length > 0;

  return (
    <div className="px-6 py-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground">Brain Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Your cognitive health at a glance.</p>
      </motion.div>

      {/* Overall Brain Score */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-2xl p-6 neural-border text-center">
        <div className="relative w-32 h-32 mx-auto mb-4">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(222, 30%, 16%)" strokeWidth="6" />
            <motion.circle
              cx="50" cy="50" r="42" fill="none"
              stroke="hsl(175, 80%, 50%)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={264}
              initial={{ strokeDashoffset: 264 }}
              animate={{ strokeDashoffset: 264 * (1 - overallHealth / 100) }}
              transition={{ duration: 1.5, delay: 0.3 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold gradient-text">{hasData ? `${overallHealth}%` : "—"}</span>
            <span className="text-[10px] text-muted-foreground">Brain Health</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {!hasData ? "Log study sessions to see your brain health" :
            overallHealth > 70 ? "Your memory network is strong 💪" :
            overallHealth > 50 ? <span>Your memory network is <span className="text-warning font-medium">moderately strong</span></span> :
            <span>Your memory network <span className="text-destructive font-medium">needs attention</span></span>
          }
        </p>
      </motion.div>

      {/* Memory Health by Subject */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass rounded-xl p-5 neural-border">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">Memory Health</h2>
        </div>
        {hasData ? (
          <div className="space-y-4">
            {subjectHealth.map((sub, i) => (
              <div key={i}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-sm text-foreground">{sub.name}</span>
                  <span className={`text-xs font-medium ${
                    sub.strength > 70 ? "text-success" :
                    sub.strength > 50 ? "text-warning" : "text-destructive"
                  }`}>{sub.strength}%</span>
                </div>
                <div className="h-2 rounded-full bg-secondary">
                  <motion.div
                    className={`h-full rounded-full ${
                      sub.strength > 70 ? "bg-success" :
                      sub.strength > 50 ? "bg-warning" : "bg-destructive"
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${sub.strength}%` }}
                    transition={{ duration: 1, delay: 0.3 + i * 0.1 }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{sub.topicCount} topics tracked</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No subjects tracked yet.</p>
        )}
      </motion.div>

      {/* Features Grid */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="grid grid-cols-2 gap-3">
        {[
          { icon: Network, label: "Knowledge Graph", desc: "Visual brain map" },
          { icon: Brain, label: "Brain Plan", desc: "AI auto schedule" },
          { icon: Layers, label: "Multi-Source Sync", desc: "PDF, YouTube, Notes" },
          { icon: Clock, label: "Passive Learning", desc: "Auto detection" },
        ].map((item, i) => (
          <button key={i} className="glass rounded-xl p-4 neural-border hover:glow-primary transition-all text-left">
            <item.icon className="w-5 h-5 text-primary mb-2" />
            <p className="text-sm font-medium text-foreground">{item.label}</p>
            <p className="text-[10px] text-muted-foreground">{item.desc}</p>
          </button>
        ))}
      </motion.div>
    </div>
  );
};

export default BrainTab;
