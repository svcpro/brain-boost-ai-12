import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown, Lock, Check, Sparkles } from "lucide-react";
import ConfidencePracticeTab from "./ConfidencePracticeTab";
import SureShotHero from "./SureShotHero";
import ColorProgressChart from "./ColorProgressChart";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanGatingContext } from "@/hooks/usePlanGating";

const ProgressTab = ({ onUpgrade }: { onUpgrade?: () => void }) => {
  const { user } = useAuth();
  const { canAccess, loading: gateLoading } = usePlanGatingContext();
  const [practicePct, setPracticePct] = useState(0);

  const allowed = canAccess("exam_practice");

  useEffect(() => {
    if (!user?.id || !allowed) return;
    (async () => {
      const { data: logs } = await supabase
        .from("study_logs")
        .select("confidence_level")
        .eq("user_id", user.id)
        .not("confidence_level", "is", null)
        .limit(200);
      if (!logs || logs.length === 0) return;
      const high = logs.filter((l: any) => l.confidence_level === "high").length;
      const med = logs.filter((l: any) => l.confidence_level === "medium").length;
      const score = ((high * 1 + med * 0.5) / logs.length) * 100;
      setPracticePct(Math.round(score));
    })();
  }, [user?.id, allowed]);

  if (gateLoading) {
    return <div className="px-5 pt-5 text-xs text-muted-foreground">Loading…</div>;
  }

  if (!allowed) {
    return (
      <div className="px-5 pt-6 pb-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 22 }}
          className="relative rounded-3xl overflow-hidden p-6"
          style={{
            background: "linear-gradient(180deg, hsl(230 40% 10%) 0%, hsl(230 50% 6%) 100%)",
            border: "1px solid rgba(255,215,0,0.25)",
            boxShadow: "0 0 60px rgba(255,215,0,0.08)",
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-[2px]"
            style={{ background: "linear-gradient(90deg,#FFD700,#FF8500,#7C4DFF)" }} />

          <div className="flex flex-col items-center text-center">
            <motion.div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3 relative"
              style={{ background: "linear-gradient(135deg,#FFD70018,#FF850018)", border: "1px solid #FFD70030" }}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <Lock className="w-7 h-7" style={{ color: "#FFD700" }} />
            </motion.div>

            <div className="px-3 py-1 rounded-full mb-2" style={{ background: "linear-gradient(90deg,#FFD70022,#FF850022)", border: "1px solid #FFD70040" }}>
              <span className="text-[10px] font-bold tracking-widest" style={{ color: "#FFD700" }}>PREMIUM ONLY · ₹499/mo</span>
            </div>
            <h2 className="text-xl font-bold text-foreground mb-1">Exam Practice is Premium</h2>
            <p className="text-xs text-muted-foreground mb-5 max-w-xs leading-relaxed">
              Your <span className="font-semibold text-foreground">Starter plan</span> doesn't include Exam Practice. Upgrade to <span className="font-semibold text-foreground">ACRY Premium</span> to unlock SureShot drills and Confidence Practice.
            </p>

            <ul className="w-full space-y-2 mb-5 text-left">
              {[
                "Unlimited SureShot question generation",
                "Adaptive Confidence Practice sessions",
                "AI Mentor feedback on every attempt",
                "Priority AI processing",
              ].map(f => (
                <li key={f} className="flex items-start gap-2 text-[12px] text-foreground/85">
                  <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#FFD700" }} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onUpgrade?.()}
              className="w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #FFD700, #FF8500)",
                color: "#0B0F1A",
                boxShadow: "0 0 30px rgba(255,215,0,0.25)",
              }}
            >
              <Crown className="w-4 h-4" />
              <span>Upgrade to ACRY Premium</span>
              <Sparkles className="w-4 h-4" />
            </motion.button>

            <p className="text-[10px] text-muted-foreground/60 mt-3">
              Starts at ₹499/mo · cancel anytime
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-5 space-y-5">
      <SureShotHero onUpgrade={onUpgrade} />
      <ColorProgressChart
        value={practicePct}
        label="Practice Confidence"
        sublabel="Color tier shifts as your high-confidence answers grow"
        thresholds="tier3"
        style="thermometer"
        size={120}
      />
      <ConfidencePracticeTab />
    </div>
  );
};

export default ProgressTab;
