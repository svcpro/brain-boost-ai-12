import { motion } from "framer-motion";
import { Brain, Sparkles } from "lucide-react";

const processingSteps = [
  { text: "Analyzing subject...", delay: 0 },
  { text: "Detecting topic...", delay: 0.8 },
  { text: "Measuring confidence...", delay: 1.6 },
  { text: "Updating brain...", delay: 2.4 },
];

const Step2AICapture = () => (
  <motion.div
    className="flex flex-col items-center justify-center h-full gap-8"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    {/* Waveform simulation */}
    <motion.div
      className="flex items-end gap-[3px] h-16"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2 }}
    >
      {[...Array(24)].map((_, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full"
          style={{ background: `linear-gradient(to top, hsl(187 100% 50% / 0.3), hsl(187 100% 50%))` }}
          animate={{
            height: [4, 10 + Math.sin(i * 0.5) * 30 + Math.random() * 20, 4],
          }}
          transition={{
            duration: 0.6 + Math.random() * 0.4,
            repeat: Infinity,
            delay: i * 0.05,
            ease: "easeInOut",
          }}
        />
      ))}
    </motion.div>

    {/* Processing steps */}
    <div className="flex flex-col items-center gap-3">
      {processingSteps.map((step, i) => (
        <motion.div
          key={step.text}
          className="flex items-center gap-2"
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: step.delay, type: "spring", stiffness: 200 }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear", delay: step.delay }}
          >
            {i === processingSteps.length - 1 ? (
              <Brain className="w-4 h-4 text-primary" />
            ) : (
              <Sparkles className="w-4 h-4 text-primary/70" />
            )}
          </motion.div>
          <span className="text-sm text-foreground font-medium">{step.text}</span>
          <motion.span
            className="text-xs text-success"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: step.delay + 0.5 }}
          >
            ✓
          </motion.span>
        </motion.div>
      ))}
    </div>

    {/* Neural network glow */}
    <motion.div
      className="w-32 h-32 rounded-full absolute"
      style={{
        background: "radial-gradient(circle, hsl(187 100% 50% / 0.15), transparent 70%)",
        filter: "blur(30px)",
      }}
      animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.7, 0.3] }}
      transition={{ duration: 3, repeat: Infinity }}
    />
  </motion.div>
);

export default Step2AICapture;
