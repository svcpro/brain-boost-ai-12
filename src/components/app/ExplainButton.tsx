import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import AIProgressBar from "./AIProgressBar";
import { useAIAgent } from "@/hooks/useAIAgent";

interface ExplainButtonProps {
  predictionType: string;
  predictionData: any;
  label?: string;
}

const ExplainButton = ({ predictionType, predictionData, label = "Explain" }: ExplainButtonProps) => {
  const { explain } = useAIAgent();
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleExplain = async () => {
    if (explanation) {
      setOpen(!open);
      return;
    }
    setOpen(true);
    setLoading(true);
    try {
      const result = await explain(predictionType, predictionData);
      setExplanation(result || "No explanation available right now.");
    } catch {
      setExplanation("Couldn't generate explanation. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <button
        onClick={handleExplain}
        disabled={loading}
        className="flex items-center gap-1 text-[9px] text-primary/80 hover:text-primary transition-colors mt-1 disabled:opacity-50"
      >
        {loading ? (
          <div className="w-2.5 h-2.5 rounded-full border border-primary border-t-transparent animate-spin" />
        ) : (
          <Sparkles className="w-2.5 h-2.5" />
        )}
        <span>{label}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 p-2.5 rounded-lg bg-primary/5 border border-primary/10 relative">
              <button
                onClick={() => setOpen(false)}
                className="absolute top-1 right-1 p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
              {loading ? (
                <AIProgressBar label="AI is analyzing" compact estimatedSeconds={6} />
              ) : (
                <p className="text-[10px] leading-relaxed text-foreground/80 pr-4">
                  {explanation}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExplainButton;
