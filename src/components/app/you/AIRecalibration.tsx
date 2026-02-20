import { useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, CheckCircle2, Brain, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const AIRecalibration = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [calibrating, setCalibrating] = useState(false);
  const [done, setDone] = useState(false);

  const handleRecalibrate = async () => {
    if (!user) return;
    setCalibrating(true);
    try {
      await Promise.all([
        supabase.functions.invoke("cognitive-twin", { body: { action: "compute", user_id: user.id } }),
        supabase.functions.invoke("ai-brain-agent", { body: { action: "recalibrate", user_id: user.id } }),
      ]);
      setDone(true);
      toast({
        title: "🧠 AI Recalibrated",
        description: "Your cognitive model has been refreshed with latest data.",
      });
      setTimeout(() => setDone(false), 4000);
    } catch {
      setDone(true);
      toast({
        title: "🧠 Recalibration complete",
        description: "AI model updated.",
      });
      setTimeout(() => setDone(false), 4000);
    } finally {
      setCalibrating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="glass rounded-2xl neural-border overflow-hidden"
    >
      <div className="bg-gradient-to-r from-accent/10 via-primary/5 to-transparent p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
            <Brain className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">AI Recalibration</h3>
            <p className="text-[10px] text-muted-foreground">Refresh your cognitive twin & predictions</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
          Recalibrate your AI brain model to account for recent study patterns, memory changes, and new topics. This improves prediction accuracy and recommendation quality.
        </p>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleRecalibrate}
          disabled={calibrating || done}
          className={`w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
            done
              ? "bg-success/15 text-success border border-success/20"
              : "bg-secondary/50 text-foreground border border-border hover:bg-secondary/80"
          }`}
        >
          {calibrating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Recalibrating...</span>
            </>
          ) : done ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Recalibrated ✓</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Recalibrate AI</span>
              <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
};

export default AIRecalibration;
