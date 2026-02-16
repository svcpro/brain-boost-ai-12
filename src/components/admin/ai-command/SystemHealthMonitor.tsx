import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { HeartPulse, Cpu, Database, Loader2, CheckCircle, AlertTriangle, XCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ContinualLearningMonitor from "@/components/app/ContinualLearningMonitor";

interface HealthCheck {
  name: string;
  status: "healthy" | "degraded" | "down";
  latency: number;
  details: string;
}

export default function SystemHealthMonitor() {
  const [loading, setLoading] = useState(true);
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [lastChecked, setLastChecked] = useState<string>("");

  const runHealthChecks = async () => {
    setLoading(true);
    const results: HealthCheck[] = [];

    // DB Check
    const dbStart = Date.now();
    try {
      const { error } = await supabase.from("profiles").select("id", { count: "exact", head: true });
      const lat = Date.now() - dbStart;
      results.push({ name: "Database", status: error ? "degraded" : lat > 2000 ? "degraded" : "healthy", latency: lat, details: error ? error.message : `${lat}ms response` });
    } catch {
      results.push({ name: "Database", status: "down", latency: Date.now() - dbStart, details: "Connection failed" });
    }

    // Auth Check
    const authStart = Date.now();
    try {
      const { data } = await supabase.auth.getSession();
      const lat = Date.now() - authStart;
      results.push({ name: "Authentication", status: lat > 3000 ? "degraded" : "healthy", latency: lat, details: data.session ? "Session active" : "No session" });
    } catch {
      results.push({ name: "Authentication", status: "down", latency: Date.now() - authStart, details: "Auth service unreachable" });
    }

    // ML Pipeline Check
    const mlStart = Date.now();
    try {
      const { data, error } = await supabase.from("model_predictions").select("id").order("created_at", { ascending: false }).limit(1);
      const lat = Date.now() - mlStart;
      const lastPred = data?.[0];
      results.push({ name: "ML Pipeline", status: error ? "degraded" : "healthy", latency: lat, details: lastPred ? "Predictions flowing" : "No recent predictions" });
    } catch {
      results.push({ name: "ML Pipeline", status: "down", latency: Date.now() - mlStart, details: "Pipeline unreachable" });
    }

    // Feature Engine
    const feStart = Date.now();
    try {
      const { data, error } = await supabase.from("user_features").select("id").limit(1);
      const lat = Date.now() - feStart;
      results.push({ name: "Feature Engine", status: error ? "degraded" : "healthy", latency: lat, details: data?.length ? "Features computed" : "No features" });
    } catch {
      results.push({ name: "Feature Engine", status: "down", latency: Date.now() - feStart, details: "Engine unreachable" });
    }

    // Cognitive Twin
    const ctStart = Date.now();
    try {
      const { data, error } = await supabase.from("cognitive_twins").select("id").limit(1);
      const lat = Date.now() - ctStart;
      results.push({ name: "Cognitive Twins", status: error ? "degraded" : "healthy", latency: lat, details: data?.length ? "Twins active" : "No twin data" });
    } catch {
      results.push({ name: "Cognitive Twins", status: "down", latency: Date.now() - ctStart, details: "Twin engine unreachable" });
    }

    setChecks(results);
    setLastChecked(new Date().toLocaleTimeString());
    setLoading(false);
  };

  useEffect(() => { runHealthChecks(); }, []);

  const healthyCount = checks.filter(c => c.status === "healthy").length;
  const overallStatus = checks.every(c => c.status === "healthy") ? "healthy" : checks.some(c => c.status === "down") ? "down" : "degraded";

  const statusIcon = (s: string) => {
    if (s === "healthy") return <CheckCircle className="w-4 h-4 text-success" />;
    if (s === "degraded") return <AlertTriangle className="w-4 h-4 text-warning" />;
    return <XCircle className="w-4 h-4 text-destructive" />;
  };

  return (
    <div className="space-y-4">
      {/* Overall Status */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className={`glass rounded-xl neural-border p-4 flex items-center justify-between ${
          overallStatus === "healthy" ? "border-success/30" : overallStatus === "degraded" ? "border-warning/30" : "border-destructive/30"
        }`}>
        <div className="flex items-center gap-3">
          <HeartPulse className={`w-6 h-6 ${overallStatus === "healthy" ? "text-success" : overallStatus === "degraded" ? "text-warning" : "text-destructive"}`} />
          <div>
            <p className="text-sm font-bold text-foreground capitalize">System {overallStatus}</p>
            <p className="text-[10px] text-muted-foreground">{healthyCount}/{checks.length} services healthy · Last checked: {lastChecked}</p>
          </div>
        </div>
        <button onClick={runHealthChecks} disabled={loading} className="p-2 rounded-lg hover:bg-secondary transition-colors">
          {loading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <RefreshCw className="w-4 h-4 text-muted-foreground" />}
        </button>
      </motion.div>

      {/* Individual Checks */}
      <div className="space-y-2">
        {checks.map((check, i) => (
          <motion.div key={check.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
            className="glass rounded-xl neural-border p-3 flex items-center gap-3">
            {statusIcon(check.status)}
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{check.name}</p>
              <p className="text-[10px] text-muted-foreground">{check.details}</p>
            </div>
            <div className="text-right">
              <p className={`text-xs font-bold ${check.latency < 500 ? "text-success" : check.latency < 2000 ? "text-warning" : "text-destructive"}`}>
                {check.latency}ms
              </p>
              <p className={`text-[10px] capitalize ${check.status === "healthy" ? "text-success" : check.status === "degraded" ? "text-warning" : "text-destructive"}`}>
                {check.status}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Continual Learning Monitor */}
      <div className="glass rounded-xl neural-border p-4">
        <ContinualLearningMonitor />
      </div>
    </div>
  );
}
