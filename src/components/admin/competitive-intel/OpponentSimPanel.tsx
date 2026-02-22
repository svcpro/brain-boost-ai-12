import { motion } from "framer-motion";
import { Swords, Shield, Clock, Flame, ToggleLeft, ToggleRight } from "lucide-react";
import { UseMutationResult } from "@tanstack/react-query";

const PRESSURE_COLORS: Record<string, { gradient: string; glow: string }> = {
  low: { gradient: "from-emerald-500 to-green-400", glow: "shadow-emerald-500/20" },
  medium: { gradient: "from-amber-500 to-yellow-400", glow: "shadow-amber-500/20" },
  high: { gradient: "from-orange-500 to-red-400", glow: "shadow-orange-500/20" },
  extreme: { gradient: "from-red-600 to-rose-500", glow: "shadow-red-500/30" },
};

interface Props {
  opponentConfig: any;
  updateOpponent: UseMutationResult<any, any, any>;
}

export default function OpponentSimPanel({ opponentConfig, updateOpponent }: Props) {
  if (!opponentConfig) return null;

  const pressure = PRESSURE_COLORS[opponentConfig.pressure_level] || PRESSURE_COLORS.medium;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="relative overflow-hidden rounded-2xl p-5"
      style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
    >
      {/* Animated border glow */}
      <motion.div
        className={`absolute -inset-px rounded-2xl bg-gradient-to-r ${pressure.gradient} opacity-0`}
        animate={{ opacity: opponentConfig.is_enabled ? [0, 0.15, 0] : 0 }}
        transition={{ duration: 3, repeat: Infinity }}
        style={{ zIndex: 0 }}
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <motion.div
              className={`w-8 h-8 rounded-lg bg-gradient-to-br ${pressure.gradient} flex items-center justify-center shadow-lg ${pressure.glow}`}
              animate={opponentConfig.is_enabled ? { rotate: [0, 10, -10, 0] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Swords className="w-4 h-4 text-white" />
            </motion.div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Opponent Simulation</h3>
              <p className="text-[10px] text-muted-foreground">Competitive pressure engine</p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => updateOpponent.mutate({ is_enabled: !opponentConfig.is_enabled })}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-300 ${
              opponentConfig.is_enabled
                ? `bg-gradient-to-r ${pressure.gradient} text-white shadow-lg ${pressure.glow}`
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {opponentConfig.is_enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            {opponentConfig.is_enabled ? "Active" : "Disabled"}
          </motion.button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Pressure Level */}
          <motion.div
            whileHover={{ y: -2 }}
            className="p-4 rounded-xl bg-background/50 ring-1 ring-border space-y-2"
          >
            <div className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Pressure Level</label>
            </div>
            <select
              defaultValue={opponentConfig.pressure_level}
              onChange={e => updateOpponent.mutate({ pressure_level: e.target.value })}
              className="w-full p-2.5 rounded-lg bg-secondary/50 border border-border text-xs text-foreground font-medium focus:ring-2 focus:ring-primary/30"
            >
              <option value="low">🟢 Low</option>
              <option value="medium">🟡 Medium</option>
              <option value="high">🟠 High</option>
              <option value="extreme">🔴 Extreme</option>
            </select>
            {/* Visual meter */}
            <div className="flex gap-1 mt-1">
              {["low", "medium", "high", "extreme"].map((level, idx) => (
                <motion.div
                  key={level}
                  className={`h-1.5 flex-1 rounded-full ${
                    ["low", "medium", "high", "extreme"].indexOf(opponentConfig.pressure_level) >= idx
                      ? `bg-gradient-to-r ${pressure.gradient}`
                      : "bg-secondary"
                  }`}
                  animate={
                    ["low", "medium", "high", "extreme"].indexOf(opponentConfig.pressure_level) >= idx
                      ? { opacity: [0.7, 1, 0.7] }
                      : {}
                  }
                  transition={{ duration: 1.5, repeat: Infinity, delay: idx * 0.2 }}
                />
              ))}
            </div>
          </motion.div>

          {/* Time Pressure */}
          <motion.div
            whileHover={{ y: -2 }}
            className="p-4 rounded-xl bg-background/50 ring-1 ring-border space-y-2"
          >
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Time Pressure</label>
            </div>
            <input
              type="number" step="0.05" min="0.5" max="1.0"
              defaultValue={opponentConfig.time_pressure_multiplier}
              onBlur={e => updateOpponent.mutate({ time_pressure_multiplier: +e.target.value })}
              className="w-full p-2.5 rounded-lg bg-secondary/50 border border-border text-xs text-foreground font-mono font-bold focus:ring-2 focus:ring-primary/30"
            />
            <p className="text-[9px] text-muted-foreground">Multiplier (0.5 = intense, 1.0 = normal)</p>
          </motion.div>

          {/* Difficulty Escalation */}
          <motion.div
            whileHover={{ y: -2 }}
            className="p-4 rounded-xl bg-background/50 ring-1 ring-border space-y-2"
          >
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-rose-400" />
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Difficulty Rate</label>
            </div>
            <input
              type="number" step="0.05" min="1.0" max="2.0"
              defaultValue={opponentConfig.difficulty_escalation_rate}
              onBlur={e => updateOpponent.mutate({ difficulty_escalation_rate: +e.target.value })}
              className="w-full p-2.5 rounded-lg bg-secondary/50 border border-border text-xs text-foreground font-mono font-bold focus:ring-2 focus:ring-primary/30"
            />
            <p className="text-[9px] text-muted-foreground">Escalation (1.0 = flat, 2.0 = steep)</p>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
