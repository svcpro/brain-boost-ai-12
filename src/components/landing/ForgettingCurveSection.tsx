import { useRef, useState, useEffect } from "react";
import { AlertTriangle, Shield } from "lucide-react";

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

const ForgettingCurveSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref);

  return (
    <section id="features" ref={ref} className="relative py-32 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className={`text-center mb-16 transition-all duration-700 ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full neural-border neural-gradient text-xs text-primary uppercase tracking-wider mb-4">
            <AlertTriangle className="w-3 h-3" /> Memory Intelligence
          </span>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
            Your Memory is <span className="gradient-text">Fading</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            ACRY detects memory drops before they happen and intervenes automatically.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className={`relative transition-all duration-700 delay-200 ${isInView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10"}`}>
            <div className="glass rounded-2xl p-8 neural-border">
              <svg viewBox="0 0 400 200" className="w-full">
                {[0.25, 0.5, 0.75].map((y) => (
                  <line key={y} x1="40" y1={y * 180} x2="380" y2={y * 180} stroke="hsl(222, 30%, 16%)" strokeWidth="0.5" />
                ))}
                <path
                  d="M 40 20 Q 100 20, 150 80 Q 200 140, 300 160 Q 350 170, 380 175"
                  fill="none" stroke="hsl(0, 72%, 51%)" strokeWidth="2" opacity="0.6"
                  className={isInView ? "animate-[draw_2s_0.5s_ease-out_both]" : ""}
                  strokeDasharray="500" strokeDashoffset="500"
                  style={isInView ? { strokeDashoffset: 0, transition: "stroke-dashoffset 2s ease-out 0.5s" } : {}}
                />
                <path
                  d="M 40 20 Q 100 20, 150 60 Q 180 75, 200 50 Q 230 25, 260 40 Q 290 55, 320 35 Q 350 20, 380 25"
                  fill="none" stroke="hsl(175, 80%, 50%)" strokeWidth="2.5"
                  strokeDasharray="500" strokeDashoffset="500"
                  style={isInView ? { strokeDashoffset: 0, transition: "stroke-dashoffset 2s ease-out 1s" } : {}}
                />
                <circle cx="150" cy="60" r="6" fill="hsl(175, 80%, 50%)"
                  className={`transition-all duration-500 ${isInView ? "opacity-100 scale-100" : "opacity-0 scale-0"}`}
                  style={{ transitionDelay: "1.5s", transformOrigin: "150px 60px" }}
                />
                <text x="42" y="195" fill="hsl(215, 20%, 55%)" fontSize="10">Day 1</text>
                <text x="350" y="195" fill="hsl(215, 20%, 55%)" fontSize="10">Day 30</text>
                <text x="42" y="15" fill="hsl(215, 20%, 55%)" fontSize="10">100%</text>
              </svg>
              <div className="flex gap-6 mt-4 justify-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-0.5 bg-destructive/60" />
                  <span className="text-xs text-muted-foreground">Without ACRY</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-0.5 bg-primary" />
                  <span className="text-xs text-muted-foreground">With ACRY</span>
                </div>
              </div>
            </div>
          </div>

          <div className={`space-y-4 transition-all duration-700 delay-300 ${isInView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"}`}>
            {[
              { icon: AlertTriangle, title: "Forget Risk Detection", desc: "AI predicts exactly when you'll forget a topic" },
              { icon: Shield, title: "Auto Intervention", desc: "Precision review sessions triggered before memory drops" },
            ].map((item, i) => (
              <div
                key={i}
                className="glass rounded-xl p-6 neural-border hover:glow-primary transition-all duration-500 group"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg neural-gradient neural-border">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ForgettingCurveSection;
