import { motion, AnimatePresence } from "framer-motion";
import { Lock, ShieldAlert, ArrowRight, Crown, X, Clock, AlertTriangle } from "lucide-react";
import type { ExamPhase } from "@/hooks/useExamCountdown";

interface ExamLockModalProps {
  open: boolean;
  onClose: () => void;
  phase: ExamPhase;
  daysRemaining: number | null;
  lockMessage: string;
  recommendedMode: string;
  lockedModeName: string;
  onSwitchMode: (modeId: string) => void;
  canBypass: boolean;
}

const MODE_LABELS: Record<string, string> = {
  focus: "Focus Study Mode",
  revision: "AI Revision Mode",
  mock: "Mock Practice Mode",
  emergency: "Emergency Rescue Mode",
};

const ExamLockModal = ({
  open, onClose, phase, daysRemaining, lockMessage,
  recommendedMode, lockedModeName, onSwitchMode, canBypass,
}: ExamLockModalProps) => {
  if (!open) return null;

  const isLockdown = phase === "lockdown";
  const phaseLabel = isLockdown ? "LOCKDOWN" : "ACCELERATION";
  const phaseColor = isLockdown ? "hsl(0 80% 60%)" : "hsl(35 90% 55%)";
  const phaseBg = isLockdown
    ? "linear-gradient(135deg, hsl(0 50% 8%), hsl(0 40% 12%))"
    : "linear-gradient(135deg, hsl(35 40% 8%), hsl(35 30% 12%))";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-sm rounded-2xl overflow-hidden border"
            style={{
              background: phaseBg,
              borderColor: `${phaseColor}33`,
              boxShadow: `0 0 60px ${phaseColor}22`,
            }}
            initial={{ scale: 0.85, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 30 }}
            transition={{ type: "spring", damping: 22, stiffness: 300 }}
          >
            {/* Glow effects */}
            <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full blur-3xl pointer-events-none" style={{ background: `${phaseColor}15` }} />
            <motion.div
              className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full blur-3xl pointer-events-none"
              style={{ background: `${phaseColor}10` }}
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 3, repeat: Infinity }}
            />

            <div className="relative z-10 p-6 space-y-5">
              {/* Close */}
              <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/10 transition-colors">
                <X className="w-4 h-4 text-white/50" />
              </button>

              {/* Phase badge + Icon */}
              <div className="flex flex-col items-center text-center space-y-3">
                <motion.div
                  className="relative"
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: `${phaseColor}20`, border: `1px solid ${phaseColor}40` }}>
                    {isLockdown ? <ShieldAlert className="w-8 h-8" style={{ color: phaseColor }} /> : <AlertTriangle className="w-8 h-8" style={{ color: phaseColor }} />}
                  </div>
                  <motion.div
                    className="absolute inset-0 rounded-2xl"
                    style={{ border: `1.5px solid ${phaseColor}30` }}
                    animate={{ scale: [1, 1.4], opacity: [0.5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </motion.div>

                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-2">
                    <motion.div
                      className="w-2 h-2 rounded-full"
                      style={{ background: phaseColor }}
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                    <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: phaseColor }}>
                      {phaseLabel} MODE
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    Mode Restricted
                  </h3>
                </div>
              </div>

              {/* Lock reason card */}
              <div className="rounded-xl p-4 space-y-3" style={{ background: "hsl(0 0% 100% / 0.05)", border: "1px solid hsl(0 0% 100% / 0.08)" }}>
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4" style={{ color: phaseColor }} />
                  <span className="text-sm font-semibold text-white/90">{lockedModeName}</span>
                </div>
                <p className="text-xs text-white/60 leading-relaxed">{lockMessage}</p>
              </div>

              {/* Days remaining */}
              {daysRemaining !== null && (
                <div className="flex items-center justify-center gap-2 py-2 rounded-xl" style={{ background: `${phaseColor}10` }}>
                  <Clock className="w-4 h-4" style={{ color: phaseColor }} />
                  <span className="text-sm font-bold" style={{ color: phaseColor }}>
                    {daysRemaining} day{daysRemaining !== 1 ? "s" : ""} until exam
                  </span>
                </div>
              )}

              {/* Recommended mode CTA */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { onSwitchMode(recommendedMode); onClose(); }}
                className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 text-white transition-all"
                style={{ background: phaseColor, boxShadow: `0 4px 20px ${phaseColor}40` }}
              >
                <ArrowRight className="w-4 h-4" />
                Switch to {MODE_LABELS[recommendedMode] || recommendedMode}
              </motion.button>

              {/* Upgrade hint */}
              {!canBypass && (
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-white/40">
                  <Crown className="w-3 h-3" />
                  <span>Ultra plan members can bypass restrictions</span>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ExamLockModal;
