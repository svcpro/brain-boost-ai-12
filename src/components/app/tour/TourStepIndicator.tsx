import { motion } from "framer-motion";

interface TourStepIndicatorProps {
  totalSteps: number;
  currentStep: number;
}

const TourStepIndicator = ({ totalSteps, currentStep }: TourStepIndicatorProps) => (
  <div className="flex items-center gap-2">
    {Array.from({ length: totalSteps }).map((_, i) => (
      <motion.div
        key={i}
        className="rounded-full"
        animate={{
          width: i === currentStep ? 24 : 6,
          height: 6,
          backgroundColor: i === currentStep
            ? "hsl(187 100% 50%)"
            : i < currentStep
              ? "hsl(187 100% 50% / 0.5)"
              : "hsl(228 30% 25%)",
        }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      />
    ))}
  </div>
);

export default TourStepIndicator;
