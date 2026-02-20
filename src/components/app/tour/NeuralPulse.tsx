import { motion } from "framer-motion";

interface NeuralPulseProps {
  size?: number;
  delay?: number;
  className?: string;
}

const NeuralPulse = ({ size = 120, delay = 0, className = "" }: NeuralPulseProps) => (
  <div className={`absolute pointer-events-none ${className}`}>
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        className="absolute rounded-full border border-primary/30"
        style={{
          width: size,
          height: size,
          top: -size / 2,
          left: -size / 2,
        }}
        initial={{ scale: 0.5, opacity: 0.8 }}
        animate={{ scale: 2.5, opacity: 0 }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          delay: delay + i * 0.8,
          ease: "easeOut",
        }}
      />
    ))}
    <motion.div
      className="absolute rounded-full"
      style={{
        width: size * 0.4,
        height: size * 0.4,
        top: -(size * 0.4) / 2,
        left: -(size * 0.4) / 2,
        background: "radial-gradient(circle, hsl(187 100% 50% / 0.4), transparent 70%)",
      }}
      animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    />
  </div>
);

export default NeuralPulse;
