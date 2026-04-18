import { useEffect, useState } from "react";
import { Brain, Sparkles, Zap } from "lucide-react";

interface UltraLoaderProps {
  category?: string;
}

const PHASES = [
  { icon: Brain, label: "Scanning neural patterns", color: "from-fuchsia-500 to-pink-500" },
  { icon: Sparkles, label: "Calibrating difficulty", color: "from-cyan-400 to-blue-500" },
  { icon: Zap, label: "Crafting your test", color: "from-amber-400 to-orange-500" },
];

const UltraLoader = ({ category = "your test" }: UltraLoaderProps) => {
  const [phase, setPhase] = useState(0);
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    const phaseT = setInterval(() => setPhase((p) => (p + 1) % PHASES.length), 1400);
    const progT = setInterval(() => {
      setProgress((p) => (p < 92 ? p + Math.random() * 4 + 1 : p + 0.2));
    }, 180);
    return () => {
      clearInterval(phaseT);
      clearInterval(progT);
    };
  }, []);

  const Active = PHASES[phase].icon;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05060f] text-white flex items-center justify-center">
      {/* Cosmic background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.25),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(6,182,212,0.2),transparent_60%)]" />
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-fuchsia-600/30 blur-3xl animate-pulse" style={{ animationDuration: "5s" }} />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-cyan-500/25 blur-3xl animate-pulse" style={{ animationDuration: "7s", animationDelay: "1s" }} />
        <div className="absolute top-1/3 right-10 w-64 h-64 rounded-full bg-amber-500/20 blur-3xl animate-pulse" style={{ animationDuration: "6s", animationDelay: "2s" }} />

        {/* Grid */}
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Floating particles */}
        {Array.from({ length: 22 }).map((_, i) => {
          const colors = ["bg-fuchsia-400", "bg-cyan-400", "bg-amber-400", "bg-emerald-400", "bg-violet-400"];
          const c = colors[i % colors.length];
          return (
            <span
              key={i}
              className={`absolute w-1 h-1 rounded-full ${c} animate-pulse`}
              style={{
                top: `${(i * 53) % 100}%`,
                left: `${(i * 37) % 100}%`,
                opacity: 0.4 + (i % 4) * 0.1,
                boxShadow: "0 0 8px currentColor",
                animationDuration: `${3 + (i % 5)}s`,
                animationDelay: `${(i % 6) * 0.3}s`,
              }}
            />
          );
        })}
      </div>

      <div className="relative z-10 w-full max-w-md px-6 flex flex-col items-center">
        {/* Orbital ring system */}
        <div className="relative w-56 h-56 flex items-center justify-center">
          {/* Outer rotating conic ring */}
          <div
            className="absolute inset-0 rounded-full animate-spin"
            style={{
              animationDuration: "3s",
              background: "conic-gradient(from 0deg, transparent 0%, #ec4899 25%, transparent 50%, #06b6d4 75%, transparent 100%)",
              maskImage: "radial-gradient(circle, transparent 60%, black 62%, black 70%, transparent 72%)",
              WebkitMaskImage: "radial-gradient(circle, transparent 60%, black 62%, black 70%, transparent 72%)",
            }}
          />

          {/* Middle counter-rotating ring */}
          <div
            className="absolute inset-6 rounded-full animate-spin"
            style={{
              animationDuration: "4s",
              animationDirection: "reverse",
              background: "conic-gradient(from 90deg, transparent 0%, #f59e0b 30%, transparent 60%, #a78bfa 90%, transparent 100%)",
              maskImage: "radial-gradient(circle, transparent 65%, black 67%, black 73%, transparent 75%)",
              WebkitMaskImage: "radial-gradient(circle, transparent 65%, black 67%, black 73%, transparent 75%)",
            }}
          />

          {/* Pulsing core glow */}
          <div className="absolute inset-12 rounded-full bg-gradient-to-br from-fuchsia-500 via-violet-500 to-cyan-500 blur-2xl opacity-60 animate-pulse" />

          {/* Inner glass orb with active icon */}
          <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-[0_0_60px_-10px_rgba(236,72,153,0.6)]">
            <div
              className={`absolute inset-0 rounded-full bg-gradient-to-br ${PHASES[phase].color} opacity-30 transition-opacity duration-500`}
            />
            <Active
              key={phase}
              className="relative w-12 h-12 text-white drop-shadow-[0_0_12px_rgba(236,72,153,0.9)] animate-[scale-in_0.5s_ease-out]"
              strokeWidth={1.6}
            />
          </div>

          {/* Orbiting dots */}
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute inset-0 animate-spin"
              style={{
                animationDuration: `${5 + i * 1.5}s`,
                animationDirection: i % 2 === 0 ? "normal" : "reverse",
              }}
            >
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full"
                style={{
                  background: ["#ec4899", "#06b6d4", "#f59e0b"][i],
                  boxShadow: `0 0 12px ${["#ec4899", "#06b6d4", "#f59e0b"][i]}`,
                }}
              />
            </div>
          ))}
        </div>

        {/* Phase label */}
        <div className="mt-10 text-center space-y-2">
          <div className="text-[10px] uppercase tracking-[0.25em] text-white/40 font-semibold">
            Generating · {category}
          </div>
          <div
            key={phase}
            className="text-lg font-bold bg-gradient-to-r from-fuchsia-300 via-cyan-300 to-amber-300 bg-clip-text text-transparent animate-[fade-in_0.4s_ease-out]"
            style={{ backgroundSize: "200% 100%" }}
          >
            {PHASES[phase].label}
            <span className="inline-block ml-1 animate-pulse">…</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-8 w-full">
          <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden border border-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-pink-500 to-amber-400 transition-all duration-200 ease-out shadow-[0_0_12px_rgba(236,72,153,0.7)]"
              style={{ width: `${Math.min(progress, 99)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-white/40 tabular-nums uppercase tracking-wider">
            <span>AI · gemini-2.5</span>
            <span>{Math.min(Math.floor(progress), 99)}%</span>
          </div>
        </div>

        {/* Phase pills */}
        <div className="mt-6 flex gap-2">
          {PHASES.map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full transition-all duration-500"
              style={{
                width: phase === i ? 24 : 8,
                background:
                  phase === i
                    ? "linear-gradient(90deg, #ec4899, #06b6d4)"
                    : "rgba(255,255,255,0.15)",
                boxShadow: phase === i ? "0 0 8px rgba(236,72,153,0.6)" : "none",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default UltraLoader;
