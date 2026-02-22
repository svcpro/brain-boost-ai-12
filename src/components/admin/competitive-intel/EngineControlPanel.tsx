import { motion, AnimatePresence } from "framer-motion";
import { Settings, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";
import { UseMutationResult } from "@tanstack/react-query";

interface Toggle {
  key: string;
  label: string;
  description: string;
}

const CONFIG_TOGGLES: Toggle[] = [
  { key: "trend_engine_enabled", label: "Trend Engine", description: "Analyze historical exam patterns" },
  { key: "weakness_engine_enabled", label: "Weakness Engine", description: "Predict student weak areas" },
  { key: "accelerator_enabled", label: "30-Day Accelerator", description: "Intensive exam preparation" },
  { key: "opponent_sim_enabled", label: "Opponent Simulation", description: "Competitive pressure mode" },
  { key: "rank_heatmap_enabled", label: "Rank Heatmap", description: "Visual rank distribution" },
];

interface Props {
  config: any;
  toggleConfig: UseMutationResult<any, any, { key: string; value: boolean }>;
}

export default function EngineControlPanel({ config, toggleConfig }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="relative overflow-hidden rounded-2xl p-5"
      style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
    >
      {/* Background breathing orb */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-gradient-to-br from-primary/10 to-accent/5 blur-3xl"
        animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 5, repeat: Infinity }}
      />

      <div className="relative z-10">
        <div className="flex items-center gap-2.5 mb-4">
          <motion.div
            className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20"
            whileHover={{ rotate: 90 }}
            transition={{ type: "spring" }}
          >
            <Settings className="w-4 h-4 text-white" />
          </motion.div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Engine Controls</h3>
            <p className="text-[10px] text-muted-foreground">Toggle intelligence engines on/off</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {CONFIG_TOGGLES.map((t, i) => {
            const enabled = config?.[t.key] ?? true;
            return (
              <motion.button
                key={t.key}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleConfig.mutate({ key: t.key, value: !enabled })}
                className={`relative flex items-center justify-between p-3.5 rounded-xl transition-all duration-300 overflow-hidden ${
                  enabled
                    ? "bg-primary/10 ring-1 ring-primary/20"
                    : "bg-secondary/50 hover:bg-secondary/80"
                }`}
              >
                {/* Active glow */}
                <AnimatePresence>
                  {enabled && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-transparent"
                    />
                  )}
                </AnimatePresence>

                <div className="relative z-10 text-left">
                  <span className="text-xs font-semibold text-foreground block">{t.label}</span>
                  <span className="text-[9px] text-muted-foreground">{t.description}</span>
                </div>

                <div className="relative z-10">
                  {enabled ? (
                    <motion.div layoutId={`toggle-${t.key}`}>
                      <ToggleRight className="w-6 h-6 text-primary" />
                    </motion.div>
                  ) : (
                    <motion.div layoutId={`toggle-${t.key}`}>
                      <ToggleLeft className="w-6 h-6 text-muted-foreground" />
                    </motion.div>
                  )}
                </div>

                {/* Pulse dot for enabled */}
                {enabled && (
                  <motion.div
                    className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-primary"
                    animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
