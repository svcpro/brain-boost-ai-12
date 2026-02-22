import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Plus, Trash2, Loader2, Sparkles, BarChart3 } from "lucide-react";
import { UseMutationResult } from "@tanstack/react-query";

interface Props {
  trends: any[];
  addTrend: UseMutationResult<any, any, void>;
  deleteTrend: UseMutationResult<any, any, string>;
  newTrend: any;
  setNewTrend: (fn: (prev: any) => any) => void;
}

function getProbColor(prob: number) {
  if (prob >= 75) return { bar: "from-emerald-500 to-green-400", text: "text-emerald-400", bg: "bg-emerald-500/10" };
  if (prob >= 50) return { bar: "from-amber-500 to-yellow-400", text: "text-amber-400", bg: "bg-amber-500/10" };
  return { bar: "from-rose-500 to-red-400", text: "text-rose-400", bg: "bg-rose-500/10" };
}

export default function TrendPatternsPanel({ trends, addTrend, deleteTrend, newTrend, setNewTrend }: Props) {
  const [showForm, setShowForm] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="relative overflow-hidden rounded-2xl p-5"
      style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
    >
      {/* Animated accent strip */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500"
        animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
        style={{ backgroundSize: "200% 200%" }}
        transition={{ duration: 4, repeat: Infinity }}
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <motion.div
              className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shadow-lg shadow-orange-500/20"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              <TrendingUp className="w-4 h-4 text-white" />
            </motion.div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Exam Trend Patterns</h3>
              <p className="text-[10px] text-muted-foreground">{trends?.length || 0} patterns tracked</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 text-white text-xs font-semibold shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Pattern
          </motion.button>
        </div>

        {/* Add Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-4"
            >
              <div className="p-4 rounded-xl bg-background/60 ring-1 ring-border space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <select
                    value={newTrend.exam_type}
                    onChange={e => setNewTrend(p => ({ ...p, exam_type: e.target.value }))}
                    className="p-2.5 rounded-lg bg-secondary/50 border border-border text-xs text-foreground focus:ring-2 focus:ring-primary/30 transition-all"
                  >
                    <option>JEE</option><option>NEET</option><option>UPSC</option><option>general</option>
                  </select>
                  <input
                    placeholder="Subject"
                    value={newTrend.subject}
                    onChange={e => setNewTrend(p => ({ ...p, subject: e.target.value }))}
                    className="p-2.5 rounded-lg bg-secondary/50 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30 transition-all"
                  />
                  <input
                    placeholder="Topic"
                    value={newTrend.topic}
                    onChange={e => setNewTrend(p => ({ ...p, topic: e.target.value }))}
                    className="p-2.5 rounded-lg bg-secondary/50 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30 transition-all"
                  />
                  <input
                    type="number" placeholder="Year"
                    value={newTrend.year}
                    onChange={e => setNewTrend(p => ({ ...p, year: +e.target.value }))}
                    className="p-2.5 rounded-lg bg-secondary/50 border border-border text-xs text-foreground focus:ring-2 focus:ring-primary/30 transition-all"
                  />
                  <input
                    type="number" placeholder="Frequency"
                    value={newTrend.frequency_count}
                    onChange={e => setNewTrend(p => ({ ...p, frequency_count: +e.target.value }))}
                    className="p-2.5 rounded-lg bg-secondary/50 border border-border text-xs text-foreground focus:ring-2 focus:ring-primary/30 transition-all"
                  />
                  <input
                    type="number" placeholder="Probability %"
                    value={newTrend.predicted_probability}
                    onChange={e => setNewTrend(p => ({ ...p, predicted_probability: +e.target.value }))}
                    className="p-2.5 rounded-lg bg-secondary/50 border border-border text-xs text-foreground focus:ring-2 focus:ring-primary/30 transition-all"
                  />
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { addTrend.mutate(); setShowForm(false); }}
                  disabled={addTrend.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
                >
                  {addTrend.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Save Pattern
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Trends List */}
        {trends && trends.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
            {trends.map((t: any, i: number) => {
              const color = getProbColor(t.predicted_probability);
              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  whileHover={{ x: 4 }}
                  className="group flex items-center gap-3 p-3 rounded-xl bg-background/40 hover:bg-background/70 transition-all ring-1 ring-transparent hover:ring-border"
                >
                  {/* Probability badge */}
                  <div className={`shrink-0 w-12 h-12 rounded-xl ${color.bg} flex flex-col items-center justify-center`}>
                    <span className={`text-base font-black ${color.text}`}>{t.predicted_probability}%</span>
                  </div>

                  {/* Progress bar */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{t.topic}</p>
                    <p className="text-[10px] text-muted-foreground">{t.subject} · {t.exam_type} · {t.year}</p>
                    <div className="mt-1.5 h-1 rounded-full bg-secondary/50 overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full bg-gradient-to-r ${color.bar}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(t.predicted_probability, 100)}%` }}
                        transition={{ delay: i * 0.05 + 0.2, duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                  </div>

                  {/* Frequency */}
                  <div className="shrink-0 flex flex-col items-center">
                    <BarChart3 className="w-3 h-3 text-muted-foreground mb-0.5" />
                    <span className="text-[10px] font-bold text-muted-foreground">×{t.frequency_count}</span>
                  </div>

                  {/* Delete */}
                  <motion.button
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => deleteTrend.mutate(t.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </motion.button>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">No trend patterns yet. Add your first one!</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
