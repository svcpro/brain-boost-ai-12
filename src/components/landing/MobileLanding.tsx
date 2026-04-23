import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Rocket, Brain, Target, Zap, Sparkles, TrendingUp, Shield, ChevronRight, Play } from "lucide-react";
import SplashScreen from "@/components/splash/SplashScreen";
import ACRYLogo from "./ACRYLogo";

const SPLASH_KEY = "acry_mobile_splash_seen_v1";

const MobileLanding = () => {
  const [showSplash, setShowSplash] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const seen = sessionStorage.getItem(SPLASH_KEY);
    if (!seen) {
      setShowSplash(true);
    } else {
      setReady(true);
    }
  }, []);

  const handleSplashComplete = () => {
    sessionStorage.setItem(SPLASH_KEY, "1");
    setShowSplash(false);
    setReady(true);
  };

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  if (!ready) return null;

  return (
    <div
      className="fixed inset-0 z-0 overflow-y-auto overflow-x-hidden"
      style={{
        background: "linear-gradient(180deg, #0B0F1A 0%, #111827 100%)",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute top-[-10%] left-[-20%] w-[400px] h-[400px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-[10%] right-[-20%] w-[400px] h-[400px] rounded-full bg-accent/10 blur-[120px]" />
      </div>

      {/* Top bar */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#0B0F1A]/70 border-b border-white/5">
        <div className="flex items-center justify-between px-5 py-3.5">
          <ACRYLogo variant="navbar" animate={false} />
          <Link
            to="/auth?splash=1"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold"
            style={{
              background: "linear-gradient(135deg, #00E5FF, #7C4DFF)",
              color: "#0B0F1A",
              boxShadow: "0 0 18px #00E5FF30",
            }}
          >
            <Rocket className="w-3 h-3" />
            Start
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative px-6 pt-10 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5"
          style={{ background: "#00E5FF08", border: "1px solid #00E5FF20" }}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00FF94] opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#00FF94]" />
          </span>
          <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[#00E5FF]">
            AI Powered Learning
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-[34px] leading-[1.1] font-bold tracking-tight"
        >
          <span style={{ color: "#ffffffee" }}>Your AI</span>
          <br />
          <span style={{ color: "#ffffffee" }}>Second Brain for </span>
          <span
            style={{
              background: "linear-gradient(90deg, #00E5FF, #7C4DFF)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Every Exam.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-4 text-[15px] leading-relaxed"
          style={{ color: "#ffffff80" }}
        >
          ACRY learns how you learn and builds a personalized second brain — so you remember more, forget less, and outperform your competition.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-7 flex flex-col gap-2.5"
        >
          <Link
            to="/auth?splash=1"
            className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-[15px]"
            style={{
              background: "linear-gradient(135deg, #00E5FF, #7C4DFF)",
              color: "#0B0F1A",
              boxShadow: "0 8px 30px #00E5FF25, 0 0 60px #7C4DFF15",
            }}
          >
            <Rocket className="w-4 h-4" />
            Start Free — It's Instant
          </Link>
          <button
            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-[14px]"
            style={{
              background: "#ffffff05",
              border: "1px solid #ffffff10",
              color: "#ffffffcc",
            }}
          >
            <Play className="w-3.5 h-3.5" />
            Watch 30s Demo
          </button>
        </motion.div>

        {/* Trust strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-6 flex items-center gap-4 text-[10px] uppercase tracking-[0.12em]"
          style={{ color: "#ffffff45" }}
        >
          <span>10K+ Learners</span>
          <span className="w-1 h-1 rounded-full bg-white/20" />
          <span>+34% Avg Boost</span>
          <span className="w-1 h-1 rounded-full bg-white/20" />
          <span>Free Forever</span>
        </motion.div>
      </section>

      {/* Feature cards */}
      <section className="px-5 pb-10">
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Brain, title: "Memory Engine", desc: "Beats forgetting curve", color: "#00E5FF" },
            { icon: Target, title: "SureShot", desc: "Predicts exam questions", color: "#FF3B30" },
            { icon: Zap, title: "Auto-Pilot", desc: "AI plans every day", color: "#FFD60A" },
            { icon: TrendingUp, title: "MyRank", desc: "Live rank prediction", color: "#00FF94" },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i, duration: 0.4 }}
              className="rounded-2xl p-4"
              style={{
                background: "#ffffff04",
                border: "1px solid #ffffff10",
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{
                  background: `${f.color}12`,
                  border: `1px solid ${f.color}25`,
                }}
              >
                <f.icon className="w-4 h-4" style={{ color: f.color }} />
              </div>
              <div className="text-[13px] font-semibold" style={{ color: "#ffffffee" }}>
                {f.title}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: "#ffffff60" }}>
                {f.desc}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Stat band */}
      <section className="px-5 pb-10">
        <div
          className="rounded-2xl p-5 flex items-center justify-between"
          style={{
            background:
              "linear-gradient(135deg, rgba(0,229,255,0.08), rgba(124,77,255,0.08))",
            border: "1px solid #ffffff10",
          }}
        >
          {[
            { v: "847", l: "Brain updates / hr" },
            { v: "10K+", l: "Active learners" },
            { v: "+34%", l: "Score boost" },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <div className="text-[18px] font-bold" style={{ color: "#ffffffee" }}>
                {s.v}
              </div>
              <div className="text-[9px] uppercase tracking-wider mt-0.5" style={{ color: "#ffffff55" }}>
                {s.l}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-5 pb-10">
        <div className="text-[11px] uppercase tracking-[0.18em] font-semibold mb-4" style={{ color: "#00E5FF" }}>
          How it works
        </div>
        {[
          { n: "01", t: "Tell ACRY your exam", d: "30 second onboarding" },
          { n: "02", t: "Practice & learn", d: "AI watches every signal" },
          { n: "03", t: "Brain auto-revives", d: "Forgetting becomes obsolete" },
        ].map((step, i) => (
          <motion.div
            key={step.n}
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="flex gap-4 py-3.5"
            style={{ borderBottom: i < 2 ? "1px solid #ffffff08" : "none" }}
          >
            <div
              className="text-[11px] font-bold tracking-wider w-8 shrink-0"
              style={{ color: "#7C4DFF" }}
            >
              {step.n}
            </div>
            <div className="flex-1">
              <div className="text-[14px] font-semibold" style={{ color: "#ffffffee" }}>
                {step.t}
              </div>
              <div className="text-[12px] mt-0.5" style={{ color: "#ffffff60" }}>
                {step.d}
              </div>
            </div>
            <ChevronRight className="w-4 h-4 mt-0.5" style={{ color: "#ffffff30" }} />
          </motion.div>
        ))}
      </section>

      {/* Social proof */}
      <section className="px-5 pb-10">
        <div
          className="rounded-2xl p-5"
          style={{
            background: "#ffffff04",
            border: "1px solid #ffffff10",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="flex -space-x-1.5">
              {["#00E5FF", "#7C4DFF", "#00FF94"].map((c) => (
                <div
                  key={c}
                  className="w-6 h-6 rounded-full"
                  style={{ background: c, border: "2px solid #0B0F1A" }}
                />
              ))}
            </div>
            <Sparkles className="w-3.5 h-3.5" style={{ color: "#FFD60A" }} />
            <span className="text-[11px] font-medium" style={{ color: "#ffffff80" }}>
              4.9 from 2,400+ learners
            </span>
          </div>
          <p className="text-[13px] leading-relaxed italic" style={{ color: "#ffffffcc" }}>
            "I went from rank 8K to 1.2K in 4 months. ACRY genuinely understands what I forget and brings it back exactly when needed."
          </p>
          <p className="text-[11px] mt-2" style={{ color: "#ffffff50" }}>
            — Priya R., NEET aspirant
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-5 pb-12">
        <div
          className="rounded-2xl p-6 text-center"
          style={{
            background:
              "linear-gradient(135deg, rgba(0,229,255,0.1), rgba(124,77,255,0.1))",
            border: "1px solid #ffffff10",
          }}
        >
          <Shield className="w-6 h-6 mx-auto mb-3" style={{ color: "#00E5FF" }} />
          <div className="text-[18px] font-bold mb-1" style={{ color: "#ffffffee" }}>
            Ready to outperform?
          </div>
          <div className="text-[12px] mb-5" style={{ color: "#ffffff70" }}>
            Free to start. No credit card. 60 second setup.
          </div>
          <Link
            to="/auth?splash=1"
            className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-[14px]"
            style={{
              background: "linear-gradient(135deg, #00E5FF, #7C4DFF)",
              color: "#0B0F1A",
              boxShadow: "0 8px 30px #00E5FF25",
            }}
          >
            <Rocket className="w-4 h-4" />
            Build My Second Brain
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-5 pb-8 pt-2 text-center">
        <div className="text-[10px] uppercase tracking-[0.15em]" style={{ color: "#ffffff35" }}>
          © ACRY — AI for every exam
        </div>
      </footer>
    </div>
  );
};

export default MobileLanding;
