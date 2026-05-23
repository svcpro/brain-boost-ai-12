import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Brand palette for the ambassador dashboard */
export const AMB = {
  bg: "#05060f",
  bg2: "#0a0f2a",
  card: "rgba(15,18,42,0.65)",
  border: "rgba(124,77,255,0.22)",
  cyan: "#00e5ff",
  purple: "#7c4dff",
  pink: "#ec4899",
  amber: "#fbbf24",
  emerald: "#10b981",
  text: "#e6e9ff",
  mute: "#9aa3c7",
};

/** Glassmorphic card */
export function AmbCard({
  className,
  glow,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { glow?: string }) {
  return (
    <div
      {...rest}
      className={cn(
        "relative overflow-hidden rounded-2xl border backdrop-blur-xl",
        "transition-all duration-300 hover:-translate-y-[2px]",
        className
      )}
      style={{
        background:
          "linear-gradient(140deg, rgba(124,77,255,0.08) 0%, rgba(0,229,255,0.04) 40%, rgba(255,255,255,0.02) 100%)",
        borderColor: AMB.border,
        boxShadow: glow
          ? `0 10px 40px -10px ${glow}40, inset 0 1px 0 rgba(255,255,255,0.04)`
          : "0 10px 40px -20px rgba(124,77,255,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {children}
    </div>
  );
}

/** Animated counter that eases from 0 → value */
export function AnimatedCounter({
  value,
  duration = 1200,
  className,
  prefix = "",
  suffix = "",
}: {
  value: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(0);
  const reduce = useReducedMotion();
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    const animate = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(raf);
      startRef.current = null;
    };
  }, [value, duration, reduce]);
  return (
    <span className={className}>
      {prefix}
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}

/** Neon circular progress ring */
export function ProgressRing({
  value,
  max = 100,
  size = 120,
  stroke = 10,
  label,
  sub,
  color = AMB.cyan,
  glow = AMB.purple,
}: {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  label?: React.ReactNode;
  sub?: React.ReactNode;
  color?: string;
  glow?: string;
}) {
  const pct = Math.max(0, Math.min(1, value / max));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * pct;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`amb-grad-${color}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={glow} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#amb-grad-${color})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${c}`}
          initial={{ strokeDasharray: `0 ${c}` }}
          animate={{ strokeDasharray: `${dash} ${c}` }}
          transition={{ duration: 1.1, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-xl font-bold" style={{ color: AMB.text }}>
          {label ?? `${Math.round(pct * 100)}%`}
        </div>
        {sub && <div className="mt-0.5 text-[10px] uppercase tracking-wider" style={{ color: AMB.mute }}>{sub}</div>}
      </div>
    </div>
  );
}

/** Neon button */
export function NeonButton({
  className,
  variant = "primary",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const styles =
    variant === "primary"
      ? { bg: `linear-gradient(135deg, ${AMB.purple}, ${AMB.cyan})`, color: "#fff", shadow: `0 8px 24px -8px ${AMB.purple}` }
      : variant === "danger"
      ? { bg: `linear-gradient(135deg, ${AMB.pink}, ${AMB.amber})`, color: "#fff", shadow: `0 8px 24px -8px ${AMB.pink}` }
      : { bg: "rgba(255,255,255,0.04)", color: AMB.text, shadow: "none" };
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold",
        "transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none",
        variant !== "ghost" && "hover:brightness-110",
        className
      )}
      style={{ background: styles.bg, color: styles.color, boxShadow: styles.shadow, border: `1px solid ${AMB.border}` }}
    >
      {children}
    </button>
  );
}

/** Floating background particles */
export function AmbParticles({ count = 18 }: { count?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  const particles = Array.from({ length: count });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((_, i) => {
        const left = (i * 37) % 100;
        const delay = (i % 7) * 0.6;
        const size = 2 + ((i * 13) % 4);
        const color = i % 3 === 0 ? AMB.cyan : i % 3 === 1 ? AMB.purple : AMB.pink;
        return (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${left}%`,
              bottom: -20,
              width: size,
              height: size,
              background: color,
              boxShadow: `0 0 ${size * 4}px ${color}`,
              willChange: "transform, opacity",
            }}
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: -800, opacity: [0, 0.9, 0] }}
            transition={{ duration: 10 + (i % 6), repeat: Infinity, delay, ease: "linear" }}
          />
        );
      })}
    </div>
  );
}

/** Background radial gradient layer */
export function AmbAtmosphere() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute inset-0" style={{ background: AMB.bg }} />
      <div
        className="absolute inset-0 opacity-80"
        style={{
          background: `radial-gradient(900px 600px at 15% -10%, ${AMB.purple}33 0%, transparent 60%), radial-gradient(800px 500px at 90% 110%, ${AMB.cyan}22 0%, transparent 60%), radial-gradient(600px 400px at 50% 50%, ${AMB.pink}14 0%, transparent 70%)`,
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(124,77,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.4) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
        }}
      />
    </div>
  );
}

/** AI Level meta */
export const AI_LEVELS = [
  { name: "AI Rookie", min: 0, color: "#94a3b8", icon: "🌱" },
  { name: "AI Explorer", min: 250, color: "#00e5ff", icon: "🚀" },
  { name: "AI Leader", min: 750, color: "#7c4dff", icon: "⚡" },
  { name: "AI Captain", min: 2000, color: "#ec4899", icon: "🛡️" },
  { name: "AI Champion", min: 5000, color: "#fbbf24", icon: "👑" },
];

export function getLevel(xp: number) {
  let current = AI_LEVELS[0];
  let next = AI_LEVELS[1];
  for (let i = 0; i < AI_LEVELS.length; i++) {
    if (xp >= AI_LEVELS[i].min) {
      current = AI_LEVELS[i];
      next = AI_LEVELS[i + 1] ?? AI_LEVELS[i];
    }
  }
  const span = next.min - current.min || 1;
  const into = Math.max(0, xp - current.min);
  const pct = next === current ? 100 : Math.min(100, Math.round((into / span) * 100));
  return { current, next, pct };
}
