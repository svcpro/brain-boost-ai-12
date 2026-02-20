import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import TourStepIndicator from "./TourStepIndicator";
import Step1VoiceSpotlight from "./steps/Step1VoiceSpotlight";
import Step2AICapture from "./steps/Step2AICapture";
import Step3BrainActivation from "./steps/Step3BrainActivation";
import Step4ActionPreview from "./steps/Step4ActionPreview";
import Step5DecayForecast from "./steps/Step5DecayForecast";
import Step6Reinforcement from "./steps/Step6Reinforcement";
import Step7Activation from "./steps/Step7Activation";

const TOTAL_STEPS = 7;
const AUTO_ADVANCE_MS = 5500;
const TOUR_COMPLETED_KEY = "acry_tour_completed";

interface AppTourProps {
  onComplete: () => void;
}

const AppTour = ({ onComplete }: AppTourProps) => {
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);

  const handleComplete = useCallback(() => {
    setExiting(true);
    localStorage.setItem(TOUR_COMPLETED_KEY, "true");
    setTimeout(onComplete, 400);
  }, [onComplete]);

  // Auto-advance for steps 0-5
  useEffect(() => {
    if (step >= TOTAL_STEPS - 1) return; // Don't auto-advance final step
    const timer = setTimeout(() => setStep((s) => s + 1), AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [step]);

  const stepContent = () => {
    switch (step) {
      case 0: return <Step1VoiceSpotlight />;
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
      className="fixed inset-0 z-[100] flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at 50% 40%, hsl(228 50% 10% / 0.97), hsl(228 50% 5% / 0.99))",
        }}
      />

      {/* Skip button */}
      {step < TOTAL_STEPS - 1 && (
        <motion.button
          onClick={handleComplete}
          className="absolute top-5 right-5 z-10 text-muted-foreground hover:text-foreground transition-colors text-xs flex items-center gap-1 px-3 py-1.5 rounded-full glass"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Skip <X className="w-3 h-3" />
        </motion.button>
      )}

      {/* Step content */}
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
            {stepContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom indicator */}
      <div className="relative z-10 pb-10 flex justify-center">
        <TourStepIndicator totalSteps={TOTAL_STEPS} currentStep={step} />
      </div>
    </motion.div>
  );
};

export default AppTour;
export { TOUR_COMPLETED_KEY };
