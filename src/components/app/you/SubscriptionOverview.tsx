import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown, Check, ChevronRight, Sparkles, Zap, Lock, Shield,
  Loader2, Star, Gauge, BarChart3, ArrowUpRight, AlertTriangle, Award, Brain,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface SubscriptionOverviewProps {
  currentPlan: string;
  onManagePlan: () => void;
}

interface FeatureGate {
  name: string;
  unlocked: boolean;
  ultraOnly?: boolean;
}

const ALL_FEATURES: FeatureGate[] = [
  { name: "AI Brain Agent", unlocked: true },
  { name: "Smart Recall", unlocked: true },
  { name: "Study Insights", unlocked: true },
  { name: "Voice Notifications", unlocked: true },
  { name: "Data Backup", unlocked: true },
  { name: "Cognitive Twin", unlocked: false, ultraOnly: true },
  { name: "ML Dashboard", unlocked: false, ultraOnly: true },
  { name: "Priority Support", unlocked: false, ultraOnly: true },
  { name: "Advanced Analytics", unlocked: false, ultraOnly: true },
  { name: "Deep Focus Mode", unlocked: false, ultraOnly: true },
];

const SubscriptionOverview = ({ currentPlan, onManagePlan }: SubscriptionOverviewProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isTrial, setIsTrial] = useState(false);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [resolvedPlan, setResolvedPlan] = useState(currentPlan);
  const [showFeatures, setShowFeatures] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [showDowngradeWarning, setShowDowngradeWarning] = useState(false);
  const [studyMinutes, setStudyMinutes] = useState(0);
  const [topicCount, setTopicCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    // Load subscription
    supabase.from("user_subscriptions")
      .select("plan_id, is_trial, trial_end_date, expires_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data) return;
        setIsTrial(data.is_trial || false);
        let planKey = data.plan_id;
        if (planKey?.includes("-") && planKey.length > 10) {
          const { data: planData } = await supabase.from("subscription_plans").select("plan_key").eq("id", planKey).maybeSingle();
          planKey = planData?.plan_key || "none";
        }
        setResolvedPlan(planKey || "none");
        const endDate = data.is_trial ? data.trial_end_date : data.expires_at;
        if (endDate) {
          const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          setDaysLeft(days > 0 ? days : 0);
        }
      });

    // Load usage stats for simulator
    supabase.from("study_logs").select("duration_minutes").eq("user_id", user.id).then(({ data }) => {
      setStudyMinutes((data || []).reduce((s, l) => s + (l.duration_minutes || 0), 0));
    });
    supabase.from("topics").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("deleted_at", null).then(({ count }) => {
      setTopicCount(count || 0);
    });
  }, [user, currentPlan]);

  const isUltra = resolvedPlan === "ultra";
  const isPro = resolvedPlan === "pro";
  const isUpgradeable = !isUltra;

  // Gamified power unlock
  const features = ALL_FEATURES.map(f => ({
    ...f,
    unlocked: isUltra ? true : f.ultraOnly ? false : true,
  }));
  const unlockedCount = features.filter(f => f.unlocked).length;
  const powerPct = Math.round((unlockedCount / features.length) * 100);

  // Performance projections
  const currentRetention = Math.min(95, Math.round(40 + (studyMinutes / 60) * 0.8));
  const projectedRetention = Math.min(99, currentRetention + 18);
  const currentEfficiency = Math.min(90, Math.round(30 + topicCount * 1.2));
  const projectedEfficiency = Math.min(98, currentEfficiency + 22);

  const planLabel = isUltra ? "Ultra Brain" : isPro ? "Pro Brain" : "No Active Plan";
  const PlanIcon = isUltra ? Sparkles : isPro ? Zap : Crown;

  const handleGetRecommendation = useCallback(async () => {
    if (loadingRecommendation) return;
    setLoadingRecommendation(true);
    try {
      const { data } = await supabase.functions.invoke("ai-brain-agent", {
        body: {
          action: "chat",
          message: `Based on ${studyMinutes} total study minutes, ${topicCount} topics, and ${resolvedPlan} plan, give a single personalized sentence (max 25 words) explaining what upgrading to Ultra would specifically improve for this student. Be data-driven and specific. No generic marketing.`
        },
      });
      setRecommendation(data?.reply?.trim() || "Ultra Brain would unlock Cognitive Twin and ML Dashboard, boosting your retention by an estimated 15-20%.");
    } catch {
      setRecommendation("With your study volume, Ultra's Cognitive Twin could predict and prevent knowledge decay 3x faster.");
    } finally {
      setLoadingRecommendation(false);
    }
  }, [loadingRecommendation, studyMinutes, topicCount, resolvedPlan]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.28 }}
      className="space-y-3"
    >
      {/* ══════ PLAN STATUS + POWER METER ══════ */}
      <div className="glass rounded-2xl neural-border overflow-hidden">
        <div className={`p-5 ${isUltra ? "bg-gradient-to-r from-warning/10 via-primary/5 to-transparent" : "bg-gradient-to-r from-primary/10 via-transparent to-transparent"}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center ${isUltra ? "bg-warning/15 neural-border" : "bg-primary/15"}`}>
              <PlanIcon className={`w-5 h-5 ${isUltra ? "text-warning" : "text-primary"}`} />
              {isUltra && (
                <motion.div
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-warning flex items-center justify-center"
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Award className="w-3 h-3 text-warning-foreground" />
                </motion.div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">{planLabel}</h3>
                {isUltra && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-warning/20 text-warning border border-warning/30 uppercase tracking-wider">
                    Elite
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {isTrial && daysLeft !== null ? `Trial · ${daysLeft} days left` : daysLeft !== null ? `${daysLeft} days remaining` : "Active"}
              </p>
            </div>
          </div>

          {/* Power Unlock Meter */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                <Gauge className="w-3 h-3" /> Power Unlocked
              </span>
              <span className={`text-xs font-bold ${isUltra ? "text-warning" : "text-primary"}`}>{powerPct}%</span>
            </div>
            <div className="h-2.5 bg-secondary/50 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${isUltra ? "bg-gradient-to-r from-warning to-warning/70" : "bg-gradient-to-r from-primary to-primary/70"}`}
                initial={{ width: 0 }}
                animate={{ width: `${powerPct}%` }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
            </div>
            <p className="text-[9px] text-muted-foreground mt-1">
              {unlockedCount}/{features.length} features active
            </p>
          </div>
        </div>

        {/* Feature Impact Grid */}
        <div className="px-5 pb-4">
          <button
            onClick={() => setShowFeatures(!showFeatures)}
            className="w-full flex items-center justify-between py-2"
          >
            <span className="text-[11px] font-semibold text-muted-foreground">Feature Impact</span>
            <motion.div animate={{ rotate: showFeatures ? 90 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </motion.div>
          </button>

          <AnimatePresence>
            {showFeatures && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {features.map((f, i) => (
                    <motion.div
                      key={f.name}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className={`relative flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-[10px] ${
                        f.unlocked
                          ? "bg-secondary/20 border-border/20 text-foreground"
                          : "bg-secondary/10 border-border/10 text-muted-foreground/50"
                      }`}
                    >
                      {f.unlocked ? (
                        <Check className="w-3 h-3 text-success shrink-0" />
                      ) : (
                        <Lock className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                      )}
                      <span className={!f.unlocked ? "line-through" : ""}>{f.name}</span>
                      {!f.unlocked && (
                        <div className="absolute inset-0 rounded-lg bg-background/20 backdrop-blur-[1px]" />
                      )}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ══════ PERFORMANCE SIMULATOR ══════ */}
      {isUpgradeable && (
        <div className="glass rounded-2xl p-4 neural-border">
          <button
            onClick={() => setShowSimulator(!showSimulator)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold text-foreground">Performance Projection</span>
            </div>
            <motion.div animate={{ rotate: showSimulator ? 90 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </motion.div>
          </button>

          <AnimatePresence>
            {showSimulator && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="pt-3 space-y-3">
                  {/* Retention comparison */}
                  <div className="rounded-xl bg-secondary/30 border border-border/20 p-3">
                    <p className="text-[10px] font-semibold text-muted-foreground mb-2">Memory Retention</p>
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-foreground/70">Current ({isPro ? "Pro" : "Free"})</span>
                          <span className="font-semibold text-foreground">{currentRetention}%</span>
                        </div>
                        <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                          <motion.div className="h-full rounded-full bg-primary/60" initial={{ width: 0 }} animate={{ width: `${currentRetention}%` }} transition={{ duration: 0.8 }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-warning/80 flex items-center gap-1"><Sparkles className="w-2.5 h-2.5" /> With Ultra</span>
                          <span className="font-semibold text-warning">{projectedRetention}%</span>
                        </div>
                        <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                          <motion.div className="h-full rounded-full bg-warning/70" initial={{ width: 0 }} animate={{ width: `${projectedRetention}%` }} transition={{ duration: 1, delay: 0.3 }} />
                        </div>
                      </div>
                    </div>
                    <p className="text-[9px] text-success mt-2 flex items-center gap-1">
                      <ArrowUpRight className="w-2.5 h-2.5" /> +{projectedRetention - currentRetention}% projected improvement
                    </p>
                  </div>

                  {/* Efficiency comparison */}
                  <div className="rounded-xl bg-secondary/30 border border-border/20 p-3">
                    <p className="text-[10px] font-semibold text-muted-foreground mb-2">Study Efficiency</p>
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-foreground/70">Current</span>
                          <span className="font-semibold text-foreground">{currentEfficiency}%</span>
                        </div>
                        <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                          <motion.div className="h-full rounded-full bg-primary/60" initial={{ width: 0 }} animate={{ width: `${currentEfficiency}%` }} transition={{ duration: 0.8 }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-warning/80 flex items-center gap-1"><Sparkles className="w-2.5 h-2.5" /> With Ultra</span>
                          <span className="font-semibold text-warning">{projectedEfficiency}%</span>
                        </div>
                        <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                          <motion.div className="h-full rounded-full bg-warning/70" initial={{ width: 0 }} animate={{ width: `${projectedEfficiency}%` }} transition={{ duration: 1, delay: 0.3 }} />
                        </div>
                      </div>
                    </div>
                    <p className="text-[9px] text-success mt-2 flex items-center gap-1">
                      <ArrowUpRight className="w-2.5 h-2.5" /> +{projectedEfficiency - currentEfficiency}% projected improvement
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ══════ AI UPGRADE RECOMMENDATION ══════ */}
      {isUpgradeable && (
        <div className="glass rounded-2xl p-4 neural-border">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">AI Recommendation</span>
          </div>

          {recommendation ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-primary/5 border border-primary/15 p-3 mb-3"
            >
              <p className="text-[11px] text-foreground/85 leading-relaxed italic">"{recommendation}"</p>
              <p className="text-[9px] text-muted-foreground mt-1.5 flex items-center gap-1">
                <Star className="w-2.5 h-2.5 text-primary" /> Personalized based on your usage data
              </p>
            </motion.div>
          ) : (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleGetRecommendation}
              disabled={loadingRecommendation}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-secondary/40 hover:bg-secondary/60 text-sm font-medium text-foreground border border-border/20 transition-all mb-3 disabled:opacity-60"
            >
              {loadingRecommendation ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-primary" />
              )}
              {loadingRecommendation ? "Analyzing your data..." : "Get AI Upgrade Insight"}
            </motion.button>
          )}

          {/* Upgrade CTA */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onManagePlan}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-warning/90 to-warning text-warning-foreground text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-warning/15"
          >
            <Zap className="w-4 h-4" />
            <span>Unlock Ultra Brain</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      )}

      {/* ══════ ULTRA ELITE STATUS (for Ultra users) ══════ */}
      {isUltra && (
        <div className="glass rounded-2xl p-4 neural-border">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-10 h-10 rounded-xl bg-warning/15 neural-border flex items-center justify-center"
              animate={{ boxShadow: ["0 0 0px hsl(var(--warning)/0)", "0 0 15px hsl(var(--warning)/0.3)", "0 0 0px hsl(var(--warning)/0)"] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <Award className="w-5 h-5 text-warning" />
            </motion.div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">Elite Member</p>
              <p className="text-[10px] text-muted-foreground">All AI features unlocked · Maximum brain power</p>
            </div>
          </div>

          {/* Manage button for Ultra users */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setShowDowngradeWarning(true);
              setTimeout(() => setShowDowngradeWarning(false), 4000);
            }}
            className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-secondary/40 hover:bg-secondary/60 text-sm font-medium text-foreground border border-border/20 transition-all"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Manage Subscription</span>
          </motion.button>

          <AnimatePresence>
            {showDowngradeWarning && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 rounded-xl bg-destructive/8 border border-destructive/20 p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-semibold text-destructive">Downgrade Warning</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Downgrading will disable Cognitive Twin, ML Dashboard, and Advanced Analytics. Your brain evolution data may be affected.
                    </p>
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={onManagePlan}
                      className="mt-2 text-[10px] font-semibold text-destructive/80 hover:text-destructive underline underline-offset-2"
                    >
                      Continue to manage plan →
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
};

export default SubscriptionOverview;