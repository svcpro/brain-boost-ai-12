import { useEffect } from "react";
import { motion } from "framer-motion";

interface Props {
  onComplete?: () => void;
  message?: string;
}

/**
 * Apple iPhone-style boot loader.
 * Pure black background, glowing Apple logo, and the classic iOS
 * 12-blade spinner. Mirrors the real iPhone power-on experience.
 */
const NeuralBootLoader = ({ onComplete }: Props) => {
  // Keep the original contract: notify parent when min animation time elapses.
  useEffect(() => {
    const t = setTimeout(() => onComplete?.(), 1800);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{ background: "#000" }}
    >
      {/* iOS-style spinner (centered) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <IOSSpinner />
      </motion.div>
    </div>
  );
};

/** Classic 12-blade iOS activity indicator */
const IOSSpinner = () => {
  const blades = Array.from({ length: 12 });
  return (
    <div className="relative" style={{ width: 28, height: 28 }}>
      {blades.map((_, i) => (
        <span
          key={i}
          className="absolute left-1/2 top-1/2"
          style={{
            width: 2.4,
            height: 7.5,
            borderRadius: 2,
            background: "#fff",
            transform: `translate(-50%, -50%) rotate(${i * 30}deg) translateY(-9.5px)`,
            opacity: 0.15,
            animation: `iosSpinnerFade 1s linear infinite`,
            animationDelay: `${(i * 1) / 12 - 1}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes iosSpinnerFade {
          0% { opacity: 1; }
          100% { opacity: 0.15; }
        }
      `}</style>
    </div>
  );
};

export default NeuralBootLoader;
