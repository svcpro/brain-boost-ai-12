import { useRef, useState, useEffect } from "react";
import { Brain } from "lucide-react";
import { Link } from "react-router-dom";

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

const CTASection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref);

  return (
    <section ref={ref} className="relative py-32 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <div
          className={`glass rounded-3xl p-12 md:p-16 neural-border relative overflow-hidden transition-all duration-700 ${isInView ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 pointer-events-none" />
          <div className="relative z-10">
            <Brain className="w-16 h-16 text-primary mx-auto mb-6 animate-pulse-glow" />
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              Install ACRY.
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Let AI Handle Your Brain.
            </p>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-lg glow-primary-strong hover:scale-105 transition-all duration-300"
            >
              <Brain className="w-5 h-5" />
              Get Started Now
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
