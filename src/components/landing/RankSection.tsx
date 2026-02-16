import { useRef, useState, useEffect } from "react";
import { TrendingUp, Target } from "lucide-react";

const useInView = (ref: React.RefObject<HTMLElement>) => {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { rootMargin: "-100px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);
  return inView;
};

const RankSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref);

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
        <div className={`text-center mb-16 transition-all duration-700 ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full neural-border neural-gradient text-xs text-primary uppercase tracking-wider mb-4">
            <TrendingUp className="w-3 h-3" /> Rank Intelligence
          </span>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
            See How Your Study <span className="gradient-text">Changes Rank</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className={`glass rounded-2xl p-8 neural-border transition-all duration-700 delay-200 ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
            <div className="flex items-end gap-3 h-64 justify-center">
              {ranks.map((rank, i) => {
                const height = ((45000 - rank.value) / 45000) * 180 + 20;
                return (
                  <div key={i} className="flex flex-col items-center gap-2 flex-1">
                    <span className="text-xs font-medium text-foreground">
                      #{rank.value.toLocaleString()}
                    </span>
                    <div
                      className={`w-full rounded-t-lg ${rank.color} transition-all duration-1000`}
                      style={{
                        height: isInView ? `${height}px` : "0px",
                        transitionDelay: `${0.5 + i * 0.15}s`,
                      }}
                    />
                    <span className="text-[10px] text-muted-foreground">{rank.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`space-y-6 transition-all duration-700 delay-500 ${isInView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"}`}>
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
          </div>
        </div>
      </div>
    </section>
  );
};

export default RankSection;
