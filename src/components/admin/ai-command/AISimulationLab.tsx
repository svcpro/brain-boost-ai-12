import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FlaskConical, Play, Loader2, TrendingUp, Brain, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Simulation {
  id: string;
  scenario_type: string;
  predicted_retention: number | null;
  predicted_rank_change: number | null;
  confidence: number | null;
  created_at: string;
  input_params: any;
}

export default function AISimulationLab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [scenario, setScenario] = useState("balanced");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("learning_simulations").select("*").order("created_at", { ascending: false }).limit(20);
      setSimulations((data || []) as Simulation[]);
      setLoading(false);
    })();
  }, []);

  const runSimulation = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("world-model-simulation", {
        body: { scenario: scenario, days: 30 },
      });
      if (error) throw error;
      toast({ title: "🧪 Simulation Complete", description: `${scenario} scenario analyzed successfully` });
      // Refetch
      const { data: refreshed } = await supabase.from("learning_simulations").select("*").order("created_at", { ascending: false }).limit(20);
      setSimulations((refreshed || []) as Simulation[]);
    } catch (e: any) {
      toast({ title: "Simulation failed", description: e.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* Run Simulation */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-xl neural-border p-4">
        <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-primary" />
          Run World Model Simulation
        </h4>
        <div className="flex items-center gap-3">
          <select
            value={scenario}
            onChange={e => setScenario(e.target.value)}
            className="flex-1 text-sm bg-secondary border border-border rounded-lg px-3 py-2 text-foreground"
          >
            <option value="relaxed">Relaxed (Light Study)</option>
            <option value="balanced">Balanced (Moderate)</option>
            <option value="intensive">Intensive (Heavy Study)</option>
            <option value="cramming">Cramming (Last-minute)</option>
          </select>
          <button
            onClick={runSimulation}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-all"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Simulate
          </button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass rounded-xl neural-border p-3 text-center">
          <FlaskConical className="w-4 h-4 mx-auto mb-1 text-primary" />
          <p className="text-lg font-bold text-primary">{simulations.length}</p>
          <p className="text-[10px] text-muted-foreground">Simulations</p>
        </div>
        <div className="glass rounded-xl neural-border p-3 text-center">
          <TrendingUp className="w-4 h-4 mx-auto mb-1 text-success" />
          <p className="text-lg font-bold text-success">
            {simulations.length > 0 ? `${Math.round((simulations.filter(s => (s.predicted_retention || 0) > 60).length / simulations.length) * 100)}%` : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground">Good Outcomes</p>
        </div>
        <div className="glass rounded-xl neural-border p-3 text-center">
          <Brain className="w-4 h-4 mx-auto mb-1 text-accent" />
          <p className="text-lg font-bold text-accent">
            {simulations.length > 0 ? `${Math.round(simulations.reduce((s, sim) => s + (sim.confidence || 0), 0) / simulations.length * 100)}%` : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground">Avg Confidence</p>
        </div>
      </div>

      {/* Simulation History */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-foreground">Recent Simulations</h4>
        {simulations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No simulations run yet</p>
        ) : (
          simulations.map((sim, i) => (
            <motion.div key={sim.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
              className="glass rounded-xl neural-border p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    sim.scenario_type === "intensive" ? "bg-destructive/15 text-destructive" :
                    sim.scenario_type === "relaxed" ? "bg-success/15 text-success" :
                    sim.scenario_type === "cramming" ? "bg-warning/15 text-warning" :
                    "bg-primary/15 text-primary"
                  }`}>{sim.scenario_type}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{new Date(sim.created_at).toLocaleDateString()}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="text-center">
                  <p className="text-xs font-bold text-foreground">{sim.predicted_retention != null ? `${Math.round(sim.predicted_retention)}%` : "—"}</p>
                  <p className="text-[9px] text-muted-foreground">Retention</p>
                </div>
                <div className="text-center">
                  <p className={`text-xs font-bold ${(sim.predicted_rank_change || 0) > 0 ? "text-success" : "text-destructive"}`}>
                    {sim.predicted_rank_change != null ? `${sim.predicted_rank_change > 0 ? "+" : ""}${sim.predicted_rank_change}` : "—"}
                  </p>
                  <p className="text-[9px] text-muted-foreground">Rank Change</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-foreground">{sim.confidence != null ? `${Math.round(sim.confidence * 100)}%` : "—"}</p>
                  <p className="text-[9px] text-muted-foreground">Confidence</p>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
