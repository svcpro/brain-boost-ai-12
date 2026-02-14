import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { TrendingUp, Target } from "lucide-react";

const RankSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const ranks = [
    { label: "Week 1", value: 45000, color: "bg-destructive/40" },
    { label: "Week 4", value: 28000, color: "bg-warning/60" },
    { label: "Week 8", value: 12000, color: "bg-primary/60" },
    { label: "Week 12", value: 5000, color: "bg-primary/80" },
    { label: "Week 16", value: 1200, color: "bg-success" },
  ];

  return (
    <section ref={ref} className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full neural-border neural-gradient text-xs text-primary uppercase tracking-wider mb-4">
            <TrendingUp className="w-3 h-3" /> Rank Intelligence
          </span>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
            See How Your Study <span className="gradient-text">Changes Rank</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Rank visualization */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="glass rounded-2xl p-8 neural-border"
          >
            <div className="flex items-end gap-3 h-64 justify-center">
              {ranks.map((rank, i) => (
                <motion.div
                  key={i}
                  className="flex flex-col items-center gap-2 flex-1"
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.5 + i * 0.15 }}
                >
                  <span className="text-xs font-medium text-foreground">
                    #{rank.value.toLocaleString()}
                  </span>
                  <motion.div
                    className={`w-full rounded-t-lg ${rank.color}`}
                    initial={{ height: 0 }}
                    animate={isInView ? { height: `${((45000 - rank.value) / 45000) * 180 + 20}px` } : {}}
                    transition={{ duration: 1, delay: 0.5 + i * 0.15, type: "spring" }}
                  />
                  <span className="text-[10px] text-muted-foreground">{rank.label}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="space-y-6"
          >
            <div className="glass rounded-xl p-6 neural-border">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg neural-gradient neural-border">
                  <Target className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Real-Time Rank Prediction</h3>
                  <p className="text-sm text-muted-foreground">
                    AI calculates your predicted rank based on memory strength, topic coverage, and competition data.
                  </p>
                </div>
              </div>
            </div>
            <div className="glass rounded-xl p-6 neural-border">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg neural-gradient neural-border">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Study Impact Simulation</h3>
                  <p className="text-sm text-muted-foreground">
                    See exactly how studying a specific topic will change your predicted rank.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default RankSection;
