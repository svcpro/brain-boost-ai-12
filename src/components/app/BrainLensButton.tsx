import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scan } from "lucide-react";
import BrainLensModal from "./BrainLensModal";

export default function BrainLensButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
        style={{
          background: "linear-gradient(135deg, hsl(262 100% 65%), hsl(187 100% 50%))",
        }}
        whileTap={{ scale: 0.9 }}
        animate={{
          boxShadow: [
            "0 0 15px hsl(262 100% 65% / 0.4), 0 0 30px hsl(187 100% 50% / 0.2)",
            "0 0 25px hsl(262 100% 65% / 0.6), 0 0 50px hsl(187 100% 50% / 0.3)",
            "0 0 15px hsl(262 100% 65% / 0.4), 0 0 30px hsl(187 100% 50% / 0.2)",
          ],
        }}
        transition={{ boxShadow: { duration: 2, repeat: Infinity, ease: "easeInOut" } }}
      >
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full border border-primary/30"
        />
        <Scan className="w-6 h-6 text-primary-foreground relative z-10" />
      </motion.button>

      <AnimatePresence>
        {open && <BrainLensModal onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
