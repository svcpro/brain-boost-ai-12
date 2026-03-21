import { useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Lock, Crown, Sparkles, Shield, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import ACRYLogo from "@/components/landing/ACRYLogo";
import SubscriptionPlan from "@/components/app/SubscriptionPlan";

interface ExpiredTrialGateProps {
  onUpgraded: () => void;
}

const ExpiredTrialGate = ({ onUpgraded }: ExpiredTrialGateProps) => {
  const { signOut } = useAuth();
  const [showPlanModal, setShowPlanModal] = useState(false);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-primary/8 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full bg-primary/5 blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", damping: 20, stiffness: 200 }}
        className="relative w-full max-w-sm"
      >
        <div className="glass rounded-3xl neural-border overflow-hidden">
          {/* Header gradient */}
          <div className="relative px-6 pt-8 pb-6 bg-gradient-to-b from-primary/15 via-primary/5 to-transparent">
            {/* Lock icon */}
            <motion.div
              className="mx-auto w-20 h-20 rounded-2xl bg-primary/10 neural-border flex items-center justify-center mb-5 relative"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <Lock className="w-9 h-9 text-primary" />
              <motion.div
                className="absolute inset-0 rounded-2xl border border-primary/20"
                animate={{ scale: [1, 1.3], opacity: [0.5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.div>

            <div className="text-center space-y-2">
              <h1 className="text-xl font-bold text-foreground">Trial Expired</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your free trial has ended. Upgrade to ACRY Premium to continue your preparation journey.
              </p>
            </div>
          </div>

          {/* Features preview */}
          <div className="px-6 py-4 space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              What you'll unlock
            </p>
            {[
              { icon: Sparkles, label: "AI-Powered Study Engine" },
              { icon: Shield, label: "Full Access to All Features" },
              { icon: Crown, label: "Unlimited Practice & Missions" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-primary/5 border border-primary/10">
                <Icon className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-medium text-foreground/80">{label}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="px-6 pb-6 pt-2 space-y-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowPlanModal(true)}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <Crown className="w-4 h-4" />
              Upgrade Now
            </motion.button>

            <button
              onClick={() => signOut()}
              className="w-full py-2.5 rounded-xl text-muted-foreground hover:text-foreground text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Logo */}
        <div className="flex justify-center mt-6 opacity-40">
          <ACRYLogo variant="icon" className="w-8 h-8" />
        </div>
      </motion.div>

      {showPlanModal &&
        createPortal(
          <SubscriptionPlan
            currentPlan="none"
            onClose={() => setShowPlanModal(false)}
            onPlanChanged={() => {
              setShowPlanModal(false);
              onUpgraded();
            }}
          />,
          document.body
        )}
    </div>
  );
};

export default ExpiredTrialGate;
