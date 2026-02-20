import { motion } from "framer-motion";
import { Mic } from "lucide-react";
import NeuralPulse from "../NeuralPulse";

const Step1VoiceSpotlight = () => (
  <motion.div
    className="flex flex-col items-center justify-center h-full gap-8"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    {/* Mic with neural pulse */}
    <div className="relative flex items-center justify-center">
      <NeuralPulse size={140} />
      <motion.div
        className="w-20 h-20 rounded-full flex items-center justify-center z-10"
        style={{
          background: "linear-gradient(135deg, hsl(187 100% 50% / 0.25), hsl(262 100% 65% / 0.15))",
          border: "1px solid hsl(187 100% 50% / 0.4)",
          boxShadow: "0 0 40px hsl(187 100% 50% / 0.3), inset 0 0 20px hsl(187 100% 50% / 0.1)",
        }}
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <Mic className="w-8 h-8 text-primary" />
      </motion.div>
    </div>

    {/* Text animations */}
    <div className="flex flex-col items-center gap-4 text-center px-6">
      <motion.p
        className="text-2xl font-display font-bold text-foreground"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        🎙 Just tell me what you studied.
      </motion.p>

      <div className="flex flex-col gap-2">
        {["No uploads.", "No typing.", "No stress."].map((text, i) => (
          <motion.p
            key={text}
            className="text-muted-foreground text-sm"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8 + i * 0.3 }}
          >
            {text}
          </motion.p>
        ))}
      </div>
    </div>

    {/* Sound wave hint */}
    <motion.div
      className="flex items-center gap-1"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1.8 }}
    >
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="w-1 rounded-full bg-primary/50"
          animate={{ height: [8, 20 + Math.random() * 16, 8] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </motion.div>
  </motion.div>
);

export default Step1VoiceSpotlight;
