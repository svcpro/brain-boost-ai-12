import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Bot, Power, PowerOff, RefreshCw, Loader2, Settings, Activity, Zap, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AgentConfig {
  name: string;
  key: string;
  description: string;
  status: "active" | "paused" | "error";
  lastRun: string | null;
  runsToday: number;
  avgLatency: number;
}

const AGENTS: Omit<AgentConfig, "status" | "lastRun" | "runsToday" | "avgLatency">[] = [
  { name: "Brain Agent", key: "ai-brain-agent", description: "Autonomous brain briefings & cognitive analysis" },
  { name: "RL Agent", key: "rl-agent", description: "Reinforcement learning for study optimization" },
  { name: "Burnout Detector", key: "burnout-detection", description: "Monitors fatigue and burnout risk" },
  { name: "Memory Engine", key: "memory-engine", description: "Forgetting curve & memory strength predictions" },
  { name: "Adaptive Difficulty", key: "adaptive-difficulty", description: "Dynamic question difficulty adjustment" },
  { name: "Cognitive Twin", key: "cognitive-twin", description: "Digital brain model computation" },
  { name: "Meta Learner", key: "meta-learning", description: "Strategy optimization & self-improvement" },
  { name: "Continual Learning", key: "continual-learning", description: "Model drift detection & auto-retrain" },
];

export default function AgentControlCenter() {
  const { toast } = useToast();
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchAgentStatus = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const [predsRes, flagsRes] = await Promise.all([
        supabase.from("model_predictions").select("model_name, latency_ms, created_at").gte("created_at", today).limit(500),
        supabase.from("feature_flags").select("flag_key, enabled"),
      ]);

      const preds = predsRes.data || [];
      const flags = flagsRes.data || [];

      const agentList: AgentConfig[] = AGENTS.map(a => {
        const agentPreds = preds.filter(p => p.model_name === a.key || p.model_name.includes(a.key.split("-")[0]));
        const flag = flags.find(f => f.flag_key === `agent_${a.key.replace(/-/g, "_")}`);
        const latencies = agentPreds.filter(p => p.latency_ms).map(p => p.latency_ms!);
        return {
          ...a,
          status: flag?.enabled === false ? "paused" : "active",
          lastRun: agentPreds.length > 0 ? agentPreds[0].created_at : null,
          runsToday: agentPreds.length,
          avgLatency: latencies.length > 0 ? Math.round(latencies.reduce((s, l) => s + l, 0) / latencies.length) : 0,
        };
      });
      setAgents(agentList);
    } catch (e) {
      console.error("Agent status fetch failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAgentStatus(); }, [fetchAgentStatus]);

  const toggleAgent = async (agentKey: string, currentStatus: string) => {
    setToggling(agentKey);
    try {
      const flagKey = `agent_${agentKey.replace(/-/g, "_")}`;
      const newEnabled = currentStatus !== "active";
      const { error } = await supabase.from("feature_flags").upsert({
        flag_key: flagKey,
        enabled: newEnabled,
        label: `AI Agent: ${agentKey}`,
      }, { onConflict: "flag_key" });
      if (error) throw error;
      toast({ title: newEnabled ? "Agent Activated" : "Agent Paused", description: `${agentKey} is now ${newEnabled ? "active" : "paused"}` });
      await fetchAgentStatus();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setToggling(null);
    }
  };

  const invokeAgent = async (agentKey: string) => {
    setToggling(agentKey);
    try {
      await supabase.functions.invoke(agentKey, { body: { action: "manual_trigger" } });
      toast({ title: "🤖 Agent Triggered", description: `${agentKey} execution started` });
      setTimeout(fetchAgentStatus, 2000);
    } catch (e: any) {
      toast({ title: "Invoke failed", description: e.message, variant: "destructive" });
    } finally {
      setToggling(null);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  const activeCount = agents.filter(a => a.status === "active").length;
  const totalRuns = agents.reduce((s, a) => s + a.runsToday, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active Agents", value: `${activeCount}/${agents.length}`, icon: Bot, color: "text-success" },
          { label: "Runs Today", value: totalRuns, icon: Zap, color: "text-primary" },
          { label: "Avg Latency", value: `${Math.round(agents.reduce((s, a) => s + a.avgLatency, 0) / (agents.length || 1))}ms`, icon: Activity, color: "text-warning" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass rounded-xl p-3 neural-border text-center">
            <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="space-y-2">
        {agents.map((agent, i) => (
          <motion.div key={agent.key} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
            className="glass rounded-xl neural-border p-4">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${agent.status === "active" ? "bg-success animate-pulse" : agent.status === "paused" ? "bg-warning" : "bg-destructive"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{agent.name}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    agent.status === "active" ? "bg-success/15 text-success" : agent.status === "paused" ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive"
                  }`}>{agent.status}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{agent.description}</p>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                  <span>{agent.runsToday} runs today</span>
                  {agent.avgLatency > 0 && <span>· {agent.avgLatency}ms avg</span>}
                  {agent.lastRun && <span>· Last: {new Date(agent.lastRun).toLocaleTimeString()}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => invokeAgent(agent.key)}
                  disabled={toggling === agent.key || agent.status === "paused"}
                  className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-colors disabled:opacity-40"
                  title="Run Now"
                >
                  {toggling === agent.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => toggleAgent(agent.key, agent.status)}
                  disabled={toggling === agent.key}
                  className={`p-2 rounded-lg transition-colors ${agent.status === "active" ? "hover:bg-destructive/10 text-destructive" : "hover:bg-success/10 text-success"}`}
                  title={agent.status === "active" ? "Pause Agent" : "Activate Agent"}
                >
                  {agent.status === "active" ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
