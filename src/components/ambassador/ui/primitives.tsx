import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Solar Plasma — futuristic ambassador command-center palette.
 * Dark plum base with plasma orange + gold accents.
 * Variable names are kept for compatibility; semantics updated below.
 */
export const AMB = {
  bg: "#0d0512",            // void plum
  bg2: "#1a0726",           // deep plum
  plum: "#3b0a4a",          // plum surface
  card: "rgba(28,8,42,0.6)",
  border: "rgba(255,107,53,0.22)",
  cyan: "#ff6b35",          // PRIMARY accent — plasma orange
  purple: "#b53dff",        // SECONDARY — plasma violet
  pink: "#ff37a6",          // plasma magenta
  amber: "#fbbf24",         // championship gold
  emerald: "#10b981",
  text: "#fff4ea",          // warm ivory
  mute: "#b59ec7",          // dusty violet
};

/** Glassmorphic HUD card with corner brackets */
export function AmbCard({
  className,
  glow,
  hud = false,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { glow?: string; hud?: boolean }) {
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
          "linear-gradient(140deg, rgba(255,107,53,0.07) 0%, rgba(251,191,36,0.04) 40%, rgba(181,61,255,0.05) 100%)",
        borderColor: AMB.border,
        boxShadow: glow
          ? `0 10px 40px -10px ${glow}55, inset 0 1px 0 rgba(255,244,234,0.06)`
          : "0 10px 40px -20px rgba(255,107,53,0.4), inset 0 1px 0 rgba(255,244,234,0.05)",
      }}
    >
      {hud && <HudCorners color={glow ?? AMB.cyan} />}
      {children}
    </div>
  );
}

/** Decorative HUD corner brackets */
export function HudCorners({ color = AMB.cyan, size = 14 }: { color?: string; size?: number }) {
  const s = `${size}px`;
  const common: React.CSSProperties = {
    position: "absolute",
    width: s,
    height: s,
    pointerEvents: "none",
  };
  return (
    <>
      <span style={{ ...common, top: 8, left: 8, borderTop: `1.5px solid ${color}`, borderLeft: `1.5px solid ${color}`, borderTopLeftRadius: 6 }} />
      <span style={{ ...common, top: 8, right: 8, borderTop: `1.5px solid ${color}`, borderRight: `1.5px solid ${color}`, borderTopRightRadius: 6 }} />
      <span style={{ ...common, bottom: 8, left: 8, borderBottom: `1.5px solid ${color}`, borderLeft: `1.5px solid ${color}`, borderBottomLeftRadius: 6 }} />
      <span style={{ ...common, bottom: 8, right: 8, borderBottom: `1.5px solid ${color}`, borderRight: `1.5px solid ${color}`, borderBottomRightRadius: 6 }} />
    </>
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

/** Neon circular progress ring with dual-stop gradient */
export function ProgressRing({
  value,
  max = 100,
  size = 120,
  stroke = 10,
  label,
  sub,
  color = AMB.cyan,
  glow = AMB.amber,
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
  const gradId = `amb-grad-${color.replace("#", "")}-${glow.replace("#", "")}`;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={glow} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,244,234,0.08)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${c}`}
          initial={{ strokeDasharray: `0 ${c}` }}
          animate={{ strokeDasharray: `${dash} ${c}` }}
          transition={{ duration: 1.1, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 8px ${color}90)` }}
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
      ? { bg: `linear-gradient(135deg, ${AMB.cyan}, ${AMB.amber})`, color: "#1a0726", shadow: `0 8px 24px -8px ${AMB.cyan}` }
      : variant === "danger"
      ? { bg: `linear-gradient(135deg, ${AMB.pink}, ${AMB.purple})`, color: "#fff", shadow: `0 8px 24px -8px ${AMB.pink}` }
      : { bg: "rgba(255,244,234,0.04)", color: AMB.text, shadow: "none" };
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

/** Floating background particles (plasma embers) */
export function AmbParticles({ count = 22 }: { count?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  const particles = Array.from({ length: count });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((_, i) => {
        const left = (i * 37) % 100;
        const delay = (i % 7) * 0.6;
        const size = 2 + ((i * 13) % 4);
        const color = i % 3 === 0 ? AMB.cyan : i % 3 === 1 ? AMB.amber : AMB.purple;
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
              boxShadow: `0 0 ${size * 5}px ${color}`,
              willChange: "transform, opacity",
            }}
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: -900, opacity: [0, 0.9, 0] }}
            transition={{ duration: 11 + (i % 6), repeat: Infinity, delay, ease: "linear" }}
          />
        );
      })}
    </div>
  );
}

/** Background radial gradient layer — plasma sunrise */
export function AmbAtmosphere() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute inset-0" style={{ background: AMB.bg }} />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(1100px 700px at 18% -10%, ${AMB.purple}3a 0%, transparent 60%), radial-gradient(900px 600px at 92% 110%, ${AMB.cyan}33 0%, transparent 60%), radial-gradient(700px 500px at 50% 50%, ${AMB.amber}14 0%, transparent 70%)`,
        }}
      />
      {/* HUD grid */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,107,53,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(251,191,36,0.45) 1px, transparent 1px)",
          backgroundSize: "70px 70px",
          maskImage: "radial-gradient(ellipse at center, black 25%, transparent 80%)",
        }}
      />
      {/* Slow plasma sweep */}
      <motion.div
        className="absolute -inset-x-32 top-1/3 h-40 opacity-30"
        style={{
          background: `linear-gradient(90deg, transparent, ${AMB.cyan}30, ${AMB.amber}40, ${AMB.purple}30, transparent)`,
          filter: "blur(40px)",
        }}
        animate={{ x: ["-20%", "20%", "-20%"] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

/** AI Level meta — Solar Plasma tier colors */
export const AI_LEVELS = [
  { name: "AI Rookie", min: 0, color: "#b59ec7", icon: "🌱" },
  { name: "AI Explorer", min: 250, color: "#ff6b35", icon: "🚀" },
  { name: "AI Leader", min: 750, color: "#fbbf24", icon: "⚡" },
  { name: "AI Captain", min: 2000, color: "#ff37a6", icon: "🛡️" },
  { name: "AI Champion", min: 5000, color: "#b53dff", icon: "👑" },
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

/** Live status pill — pulsing plasma dot */
export function LiveDot({ color = AMB.cyan, label }: { color?: string; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color }}>
      <motion.span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
        animate={{ opacity: [0.4, 1, 0.4], scale: [0.9, 1.15, 0.9] }}
        transition={{ duration: 1.6, repeat: Infinity }}
      />
      {label}
    </span>
  );
}
