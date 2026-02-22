import { motion } from "framer-motion";
import { Database, CheckCircle2, AlertTriangle, Clock, FileText } from "lucide-react";

const STATUS_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  processed: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  error: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
  pending: { icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10" },
};

interface Props {
  datasets: any[];
}

export default function DatasetListPanel({ datasets }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="relative overflow-hidden rounded-2xl p-5"
      style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
    >
      {/* Subtle animated gradient */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-400 to-cyan-500 opacity-50"
        animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
        style={{ backgroundSize: "200% 200%" }}
        transition={{ duration: 5, repeat: Infinity }}
      />

      <div className="relative z-10">
        <div className="flex items-center gap-2.5 mb-4">
          <motion.div
            className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-400 flex items-center justify-center shadow-lg shadow-cyan-500/20"
            whileHover={{ scale: 1.1 }}
          >
            <Database className="w-4 h-4 text-white" />
          </motion.div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Uploaded Datasets</h3>
            <p className="text-[10px] text-muted-foreground">{datasets?.length || 0} datasets available</p>
          </div>
        </div>

        {datasets && datasets.length > 0 ? (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {datasets.map((d: any, i: number) => {
              const statusCfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.pending;
              const StatusIcon = statusCfg.icon;
              return (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ x: 3 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-background/40 hover:bg-background/70 transition-all ring-1 ring-transparent hover:ring-border group"
                >
                  <div className={`shrink-0 w-9 h-9 rounded-lg ${statusCfg.bg} flex items-center justify-center`}>
                    <FileText className={`w-4 h-4 ${statusCfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">
                      {d.exam_type} {d.year}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{d.subject || "All subjects"}</p>
                  </div>
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${statusCfg.bg}`}>
                    <StatusIcon className={`w-3 h-3 ${statusCfg.color}`} />
                    <span className={`text-[10px] font-semibold ${statusCfg.color} capitalize`}>{d.status}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">No datasets uploaded yet</p>
            <p className="text-[10px] mt-1">Use CSV/PDF upload or manual entry</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
