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
      {/* Apple logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="relative"
      >
        {/* Soft glow behind the logo */}
        <div
          aria-hidden
          className="absolute inset-0 -m-10 rounded-full blur-2xl"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.08), transparent 70%)" }}
        />
        <svg
          width="78"
          height="96"
          viewBox="0 0 170 210"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative drop-shadow-[0_0_18px_rgba(255,255,255,0.18)]"
        >
          <path
            d="M150.37 163.06c-2.74 6.34-6 12.18-9.78 17.55-5.16 7.32-9.39 12.39-12.66 15.21-5.07 4.66-10.5 7.05-16.31 7.19-4.17 0-9.2-1.19-15.06-3.6-5.88-2.4-11.28-3.59-16.21-3.59-5.17 0-10.73 1.19-16.69 3.59-5.97 2.41-10.78 3.66-14.45 3.79-5.57.24-11.13-2.22-16.69-7.39-3.55-3.07-7.97-8.32-13.24-15.74-5.66-7.92-10.31-17.11-13.94-27.59C1.4 141.16-.5 130.32-.5 119.85c0-12 2.59-22.34 7.79-31C11.36 82 16.92 76.61 23.96 72.62c7.04-3.99 14.65-6.03 22.85-6.17 4.42 0 10.22 1.37 17.43 4.06 7.19 2.7 11.81 4.07 13.83 4.07 1.51 0 6.64-1.6 15.32-4.78 8.21-2.95 15.13-4.18 20.79-3.7 15.34 1.24 26.86 7.29 34.52 18.18-13.71 8.31-20.49 19.95-20.36 34.89.13 11.64 4.36 21.32 12.67 29 3.77 3.58 7.98 6.35 12.67 8.32-1.02 2.95-2.09 5.78-3.24 8.51zM119.41.94c0 8.95-3.27 17.31-9.79 25.04-7.87 9.19-17.39 14.5-27.71 13.66a27.85 27.85 0 0 1-.21-3.39c0-8.6 3.74-17.79 10.39-25.31 3.32-3.81 7.54-6.97 12.66-9.5C109.86 1.49 114.7.13 119.26 0c.13.31.16.62.16.94z"
            fill="#fff"
          />
        </svg>
      </motion.div>

      {/* iOS-style spinner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        className="absolute"
        style={{ bottom: "18%" }}
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
