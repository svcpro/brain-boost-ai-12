import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Zap, Play, Shield, Clock, ChevronRight, Loader2, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAutopilot } from "@/hooks/useAutopilot";
import { toast } from "sonner";

const intensityColors: Record<string, string> = {
  gentle: "text-emerald-400",
  balanced: "text-primary",
  intense: "text-orange-400",
  beast: "text-destructive",
};

const modeIcons: Record<string, any> = {
  focus: Zap,
  revision: Clock,
  mock: Shield,
  rescue: AlertTriangle,
};

export default function AutopilotWidget() {
  const { status, loading, generatePlan, toggleAutopilot, checkEmergency } = useAutopilot();
  const [generating, setGenerating] = useState(false);

  const isEnabled = status ? (status.globally_enabled && status.user_enabled) : true;
  const today = status?.today;
  const NextIcon = today?.next_session ? (modeIcons[today.next_session.mode] || Bot) : Bot;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generatePlan();
      if (result?.status === "generated") {
        toast.success("Daily autopilot plan generated!");
      } else if (result?.status === "exists") {
        toast.info("Today's plan already exists");
      }
      const emergency = await checkEmergency();
      if (emergency?.emergency) {
        toast.warning(`Emergency: ${emergency.trigger_topic?.name} needs rescue!`, {
          duration: 6000,
        });
      }
    } catch {
      toast.error("Failed to generate plan");
    } finally {
      setGenerating(false);
    }
  };

  const handleStartSession = () => {
    if (!today?.next_session) return;
    const mode = today.next_session.mode;
    const topicName = today.next_session.topic_name;
    const duration = today.next_session.duration_minutes;
    toast.success(`Starting ${mode} mode: ${topicName} (${duration}min)`, { duration: 3000 });
    // First switch to Action tab, then dispatch session event after it mounts
    window.dispatchEvent(new CustomEvent("switch-dashboard-tab", { detail: "action" }));
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("autopilot-start-session", {
        detail: { mode, topic_id: today.next_session!.topic_id, topic_name: topicName, duration },
      }));
    }, 300);
  };

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">AI Autopilot</h3>
              <p className="text-[10px] text-muted-foreground">
                Zero-input brain automation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status && (
              <Badge variant="outline" className={`text-[10px] ${intensityColors[status.intensity] || "text-primary"}`}>
                {status.intensity}
              </Badge>
            )}
            <Switch
              checked={isEnabled}
              onCheckedChange={(v) => toggleAutopilot(v)}
              className="scale-75"
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {isEnabled && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-3"
            >
              {/* Daily Progress */}
              {today?.has_plan ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {today?.completed_sessions || 0}/{today?.total_sessions || 0} sessions
                    </span>
                    <span className="text-foreground font-medium">{today?.progress_percent || 0}%</span>
                  </div>
                  <Progress value={today?.progress_percent || 0} className="h-1.5" />

                  {today?.emergency_triggered && (
                    <div className="flex items-center gap-1.5 text-[10px] text-destructive bg-destructive/10 rounded-md px-2 py-1">
                      <AlertTriangle className="w-3 h-3" />
                      Emergency rescue triggered
                    </div>
                  )}

                  {/* Next Session Card */}
                  {today?.next_session && (
                    <button
                      onClick={handleStartSession}
                      className="w-full flex items-center gap-3 bg-secondary/50 hover:bg-secondary rounded-lg p-2.5 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                        <NextIcon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground capitalize">
                          {today.next_session.mode} Mode
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {today.next_session.topic_name} · {today.next_session.duration_minutes}min
                        </p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    </button>
                  )}

                  {!today?.next_session && (
                    <div className="text-center text-xs text-muted-foreground py-2">
                      ✅ All sessions completed today!
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="w-full flex items-center justify-center gap-2 bg-primary/15 hover:bg-primary/25 text-primary rounded-lg py-3 text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {generating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  {generating ? "Generating plan..." : "Generate Today's Plan"}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
