import { motion } from "framer-motion";
import { Rocket, ArrowRight } from "lucide-react";
import NeuralPulse from "../NeuralPulse";

interface Step7ActivationProps {
  onActivate: () => void;
  onExplore: () => void;
}

const Step7Activation = ({ onActivate, onExplore }: Step7ActivationProps) => (
  <motion.div
    className="flex flex-col items-center justify-center h-full gap-8 px-6"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    {/* Neural background glow */}
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <motion.div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full"
        style={{
          background: "radial-gradient(circle, hsl(187 100% 50% / 0.12), transparent 70%)",
          filter: "blur(40px)",
        }}
        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-1/3 left-1/3 w-60 h-60 rounded-full"
        style={{
          background: "radial-gradient(circle, hsl(262 100% 65% / 0.08), transparent 70%)",
          filter: "blur(40px)",
        }}
        animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 5, repeat: Infinity }}
      />
    </div>

    <div className="relative flex items-center justify-center z-10">
      <NeuralPulse size={100} />
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <Rocket className="w-12 h-12 text-primary" />
      </motion.div>
    </div>

    <motion.h2
      className="text-2xl font-display font-bold text-foreground text-center z-10"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.3 }}
    >
      Ready to Activate Your{" "}
      <span className="gradient-text">AI Second Brain</span>?
    </motion.h2>

    <div className="flex flex-col gap-3 w-full max-w-xs z-10">
      <motion.button
        onClick={onActivate}
        className="w-full py-3.5 rounded-2xl font-display font-bold text-sm flex items-center justify-center gap-2 text-primary-foreground"
        style={{
          background: "linear-gradient(135deg, hsl(187 100% 50%), hsl(187 100% 40%))",
          boxShadow: "0 0 30px hsl(187 100% 50% / 0.4), 0 4px 20px hsl(0 0% 0% / 0.3)",
        }}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6, type: "spring" }}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
      >
        🚀 Activate My Brain
      </motion.button>

      <motion.button
        onClick={onExplore}
        className="w-full py-3 rounded-2xl font-display text-sm text-muted-foreground flex items-center justify-center gap-2 glass hover:text-foreground transition-colors"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
      >
        Explore First <ArrowRight className="w-4 h-4" />
      </motion.button>
    </div>
  </motion.div>
);

export default Step7Activation;
