import { motion, AnimatePresence } from "framer-motion";
import { Brain } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const AIAssistantButton = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Hide on chat page itself
  if (location.pathname === "/chat") return null;

  return (
    <AnimatePresence>
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        onClick={() => navigate("/chat")}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] w-16 h-16 rounded-full bg-gradient-to-br from-primary via-primary/90 to-accent text-primary-foreground flex items-center justify-center transition-all duration-300 shadow-[0_0_25px_hsl(var(--primary)/0.4),0_0_50px_hsl(var(--primary)/0.15)]"
      >
        {/* Outer orbital ring */}
        <motion.div
          className="absolute inset-[-4px] rounded-full border-2 border-primary/40"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
        </motion.div>
        {/* Inner pulse ring */}
        <motion.div
          className="absolute inset-0 rounded-full border border-primary/30"
          animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
        />
        {/* Second pulse ring */}
        <motion.div
          className="absolute inset-0 rounded-full border border-accent/20"
          animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut", delay: 0.5 }}
        />
        {/* Brain icon */}
        <div className="relative z-10">
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          >
            <Brain className="w-7 h-7 drop-shadow-[0_0_6px_hsl(var(--primary))]" />
          </motion.div>
          {/* Online dot */}
          <motion.div
            className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background"
            animate={{ scale: [1, 1.3, 1], boxShadow: ["0 0 0px #4ade80", "0 0 8px #4ade80", "0 0 0px #4ade80"] }}
            transition={{ repeat: Infinity, duration: 2 }}
          />
        </div>
        {/* Sparkle particles */}
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-primary/60"
            style={{ top: "50%", left: "50%" }}
            animate={{
              x: [0, Math.cos((i * 120 * Math.PI) / 180) * 28],
              y: [0, Math.sin((i * 120 * Math.PI) / 180) * 28],
              opacity: [0, 1, 0],
              scale: [0.5, 1, 0.5],
            }}
            transition={{ repeat: Infinity, duration: 2.5, delay: i * 0.8, ease: "easeOut" }}
          />
        ))}
      </motion.button>
    </AnimatePresence>
  );
};

export default AIAssistantButton;
