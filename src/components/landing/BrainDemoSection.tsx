import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Brain, Shield, TrendingUp } from "lucide-react";

const FloatingTag = ({ children, delay, x, y, className = "" }: { children: React.ReactNode; delay: number; x: string; y: string; className?: string }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay, duration: 0.5 }}
    className={`absolute ${x} ${y} z-20`}
  >
    <motion.div
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 3, repeat: Infinity, delay: delay * 0.5 }}
      className={`glass rounded-full px-3 py-1.5 neural-border text-xs font-semibold ${className}`}
    >
      {children}
    </motion.div>
  </motion.div>
);

const BrainDemoSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  const nodes = [
    { cx: 200, cy: 100, r: 6, label: "Physics" },
    { cx: 120, cy: 160, r: 5, label: "Maths" },
    { cx: 280, cy: 150, r: 7, label: "Chemistry" },
    { cx: 160, cy: 240, r: 4, label: "Bio" },
    { cx: 250, cy: 230, r: 5, label: "English" },
    { cx: 320, cy: 100, r: 4, label: "History" },
    { cx: 80, cy: 100, r: 3, label: "GK" },
  ];

  const connections = [
    [0, 1], [0, 2], [0, 5], [1, 3], [2, 4], [2, 5], [3, 4], [1, 6], [0, 6],
  ];

  return (
    <section ref={ref} className="relative py-28 px-6 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-accent/5 blur-[120px]" />
      </div>

      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full neural-border neural-gradient text-xs text-primary uppercase tracking-wider mb-4">
            <Brain className="w-3 h-3" /> Live Brain Intelligence
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Your Brain, <span className="gradient-text">Visualized</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Watch your neural knowledge map grow stronger in real-time.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="glass rounded-3xl p-6 md:p-10 neural-border relative overflow-hidden max-w-3xl mx-auto"
        >
          {/* Floating tags */}
          <FloatingTag delay={1.5} x="right-4 md:right-8" y="top-4 md:top-8" className="text-success">
            <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> +8% Stability</span>
          </FloatingTag>
          <FloatingTag delay={2} x="left-4 md:left-8" y="bottom-16 md:bottom-20" className="text-primary">
            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Risk Reduced</span>
          </FloatingTag>
          <FloatingTag delay={2.5} x="right-8 md:right-16" y="bottom-4 md:bottom-8" className="text-accent">
            <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Rank +2.4%</span>
          </FloatingTag>

          {/* Neural Map SVG */}
          <svg viewBox="0 0 400 340" className="w-full">
            {/* Connections */}
            {connections.map(([a, b], i) => (
              <motion.line
                key={`c-${i}`}
                x1={nodes[a].cx} y1={nodes[a].cy}
                x2={nodes[b].cx} y2={nodes[b].cy}
                stroke="hsl(187, 100%, 50%)"
                strokeWidth="1"
                strokeOpacity="0.15"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={isInView ? { pathLength: 1, opacity: 1 } : {}}
                transition={{ duration: 1, delay: 0.5 + i * 0.08 }}
              />
            ))}

            {/* Nodes */}
            {nodes.map((node, i) => (
              <g key={i}>
                <motion.circle
                  cx={node.cx} cy={node.cy} r={node.r * 3}
                  fill="hsl(187, 100%, 50%)"
                  fillOpacity="0.08"
                  initial={{ scale: 0 }}
                  animate={isInView ? { scale: [1, 1.3, 1] } : {}}
                  transition={{ duration: 3, repeat: Infinity, delay: i * 0.3 }}
                />
                <motion.circle
                  cx={node.cx} cy={node.cy} r={node.r}
                  fill="hsl(187, 100%, 50%)"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={isInView ? { scale: 1, opacity: 1 } : {}}
                  transition={{ delay: 0.3 + i * 0.1, type: "spring" }}
                />
                <motion.text
                  x={node.cx} y={node.cy + node.r + 14}
                  textAnchor="middle"
                  fill="hsl(215, 20%, 55%)"
                  fontSize="10"
                  fontFamily="Inter, sans-serif"
                  initial={{ opacity: 0 }}
                  animate={isInView ? { opacity: 1 } : {}}
                  transition={{ delay: 0.6 + i * 0.1 }}
                >
                  {node.label}
                </motion.text>
              </g>
            ))}

            {/* Decay curve */}
            <motion.path
              d="M 40 290 Q 100 260, 160 275 Q 220 290, 280 260 Q 340 230, 380 240"
              fill="none"
              stroke="hsl(262, 100%, 65%)"
              strokeWidth="2"
              strokeOpacity="0.4"
              strokeDasharray="4 4"
              initial={{ pathLength: 0 }}
              animate={isInView ? { pathLength: 1 } : {}}
              transition={{ duration: 2, delay: 1 }}
            />
            <text x="42" y="310" fill="hsl(215, 20%, 45%)" fontSize="9" fontFamily="Inter, sans-serif">Decay Forecast</text>
          </svg>
        </motion.div>
      </div>
    </section>
  );
};

export default BrainDemoSection;
