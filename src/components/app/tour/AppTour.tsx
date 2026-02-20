import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import TourStepIndicator from "./TourStepIndicator";
import Step2AICapture from "./steps/Step2AICapture";
import Step3BrainActivation from "./steps/Step3BrainActivation";
import Step4ActionPreview from "./steps/Step4ActionPreview";
import Step5DecayForecast from "./steps/Step5DecayForecast";
import Step6Reinforcement from "./steps/Step6Reinforcement";
import Step7Activation from "./steps/Step7Activation";
import NeuralPulse from "./NeuralPulse";
import { Mic } from "lucide-react";

const TOTAL_STEPS = 7;
const AUTO_ADVANCE_MS = 5500;
const SPOTLIGHT_STEP_MS = 6000;
const TOUR_COMPLETED_KEY = "acry_tour_completed";

interface AppTourProps {
  onComplete: () => void;
}

/**
 * Step 0 (index 0): Spotlight on real "What I Studied?" section on the dashboard
 * Steps 1-6 (index 1-6): Full-screen cinematic overlays
 */
const AppTour = ({ onComplete }: AppTourProps) => {
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);

  const handleComplete = useCallback(() => {
    setExiting(true);
    localStorage.setItem(TOUR_COMPLETED_KEY, "true");
    setTimeout(onComplete, 400);
  }, [onComplete]);

  // Find and scroll to VoiceBrainCapture on step 0 (retry until found)
  useEffect(() => {
    if (step !== 0) return;
    let cancelled = false;
    let attempts = 0;

    const findAndScroll = () => {
      if (cancelled) return;
      const el = document.querySelector("[data-tour-id='voice-brain-capture']") as HTMLElement | null;
      if (!el) {
        attempts++;
        if (attempts < 20) {
          setTimeout(findAndScroll, 500);
        }
        return;
      }

      // Scroll into view first
      el.scrollIntoView({ behavior: "smooth", block: "center" });

      // Wait for scroll to settle, then capture rect
      setTimeout(() => {
        if (cancelled) return;
        setSpotlightRect(el.getBoundingClientRect());
      }, 600);
    };

    // Wait for dashboard to render fully
    const timer = setTimeout(findAndScroll, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [step]);

  // Auto-advance (wait for spotlight on step 0)
  useEffect(() => {
    if (step >= TOTAL_STEPS - 1) return;
    if (step === 0 && !spotlightRect) return; // Don't advance until spotlight visible
    const duration = step === 0 ? SPOTLIGHT_STEP_MS : AUTO_ADVANCE_MS;
    const timer = setTimeout(() => setStep((s) => s + 1), duration);
    return () => clearTimeout(timer);
  }, [step, spotlightRect]);

  // Refresh spotlight rect on scroll/resize
  useEffect(() => {
    if (step !== 0) return;
    const refresh = () => {
      const el = document.querySelector("[data-tour-id='voice-brain-capture']");
      if (el) setSpotlightRect(el.getBoundingClientRect());
    };
    const interval = setInterval(refresh, 200);
    return () => clearInterval(interval);
  }, [step]);

  const isSpotlightStep = step === 0;

  const renderFullscreenStep = () => {
    switch (step) {
      case 1: return <Step2AICapture />;
      case 2: return <Step3BrainActivation />;
      case 3: return <Step4ActionPreview />;
      case 4: return <Step5DecayForecast />;
      case 5: return <Step6Reinforcement />;
      case 6: return <Step7Activation onActivate={handleComplete} onExplore={handleComplete} />;
      default: return null;
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100]"
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* ── STEP 0: Spotlight on real "What I Studied?" ── */}
      <AnimatePresence>
        {isSpotlightStep && (
          <motion.div
            key="spotlight"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Dark overlay with spotlight cutout via SVG */}
            <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
              <defs>
                <mask id="spotlight-mask">
                  <rect width="100%" height="100%" fill="white" />
                  {spotlightRect && (
                    <rect
                      x={spotlightRect.left - 12}
                      y={spotlightRect.top - 12}
                      width={spotlightRect.width + 24}
                      height={spotlightRect.height + 24}
                      rx="24"
                      fill="black"
                    />
                  )}
                </mask>
              </defs>
              <rect
                width="100%"
                height="100%"
                fill="hsl(228 50% 5% / 0.88)"
                mask="url(#spotlight-mask)"
              />
            </svg>

            {/* Glow border around spotlight */}
            {spotlightRect && (
              <motion.div
                className="absolute rounded-3xl pointer-events-none"
                style={{
                  left: spotlightRect.left - 14,
                  top: spotlightRect.top - 14,
                  width: spotlightRect.width + 28,
                  height: spotlightRect.height + 28,
                  border: "2px solid hsl(187 100% 50% / 0.5)",
                  boxShadow: "0 0 30px hsl(187 100% 50% / 0.25), inset 0 0 30px hsl(187 100% 50% / 0.05)",
                }}
                animate={{
                  boxShadow: [
                    "0 0 20px hsl(187 100% 50% / 0.2), inset 0 0 20px hsl(187 100% 50% / 0.03)",
                    "0 0 40px hsl(187 100% 50% / 0.4), inset 0 0 40px hsl(187 100% 50% / 0.08)",
                    "0 0 20px hsl(187 100% 50% / 0.2), inset 0 0 20px hsl(187 100% 50% / 0.03)",
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            )}

            {/* Floating tooltip below spotlight */}
            {spotlightRect && (
              <motion.div
                className="absolute z-20 flex flex-col items-center gap-3 w-72"
                style={{
                  left: "50%",
                  transform: "translateX(-50%)",
                  top: spotlightRect.bottom + 28,
                }}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
              >
                {/* Pulse mic icon */}
                <div className="relative">
                  <NeuralPulse size={60} />
                  <motion.div
                    className="w-10 h-10 rounded-full flex items-center justify-center z-10 relative"
                    style={{
                      background: "linear-gradient(135deg, hsl(187 100% 50% / 0.25), hsl(262 100% 65% / 0.15))",
                      border: "1px solid hsl(187 100% 50% / 0.4)",
                    }}
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Mic className="w-5 h-5 text-primary" />
                  </motion.div>
                </div>

                <p className="text-lg font-display font-bold text-foreground text-center">
                  🎙 Just tell me what you studied.
                </p>
                <div className="flex flex-col items-center gap-1">
                  {["No uploads.", "No typing.", "No stress."].map((t, i) => (
                    <motion.p
                      key={t}
                      className="text-xs text-muted-foreground"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1 + i * 0.3 }}
                    >
                      {t}
                    </motion.p>
                  ))}
                </div>

                {/* Tap hint */}
                <motion.p
                  className="text-[10px] text-primary/60 mt-1"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  Tap to continue →
                </motion.p>
              </motion.div>
            )}

            {/* Click anywhere to proceed */}
            <div
              className="absolute inset-0 z-10 cursor-pointer"
              onClick={() => setStep(1)}
            />

            {/* Loading state while waiting for spotlight target */}
            {!spotlightRect && (
              <motion.div
                className="absolute inset-0 flex flex-col items-center justify-center gap-6 z-20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <div className="relative">
                  <NeuralPulse size={100} />
                  <motion.div
                    className="w-14 h-14 rounded-full flex items-center justify-center z-10 relative"
                    style={{
                      background: "linear-gradient(135deg, hsl(187 100% 50% / 0.25), hsl(262 100% 65% / 0.15))",
                      border: "1px solid hsl(187 100% 50% / 0.4)",
                    }}
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Mic className="w-6 h-6 text-primary" />
                  </motion.div>
                </div>
                <p className="text-lg font-display font-bold text-foreground text-center">
                  Setting up your Brain...
                </p>
                <motion.div
                  className="flex items-center gap-1"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  {[...Array(3)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-primary/60"
                      animate={{ scale: [1, 1.4, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </motion.div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── STEPS 1-6: Fullscreen cinematic overlays ── */}
      <AnimatePresence>
        {!isSpotlightStep && (
          <motion.div
            key="fullscreen"
            className="absolute inset-0 flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Background */}
            <div
              className="absolute inset-0"
              style={{
                background: "radial-gradient(ellipse at 50% 40%, hsl(228 50% 10% / 0.97), hsl(228 50% 5% / 0.99))",
              }}
            />

            {/* Content */}
            <div className="flex-1 relative z-10 flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  className="w-full h-full flex items-center justify-center"
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ duration: 0.35, ease: "easeInOut" }}
                >
                  {renderFullscreenStep()}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip button */}
      {step < TOTAL_STEPS - 1 && (
        <motion.button
          onClick={handleComplete}
          className="fixed top-5 right-5 z-[110] text-muted-foreground hover:text-foreground transition-colors text-xs flex items-center gap-1 px-3 py-1.5 rounded-full glass"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Skip <X className="w-3 h-3" />
        </motion.button>
      )}

      {/* Bottom indicator */}
      <div className="fixed bottom-6 left-0 right-0 z-[110] flex justify-center">
        <TourStepIndicator totalSteps={TOTAL_STEPS} currentStep={step} />
      </div>
    </motion.div>
  );
};

export default AppTour;
export { TOUR_COMPLETED_KEY };
