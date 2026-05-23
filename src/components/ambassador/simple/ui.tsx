import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/** Simple, premium, mobile-first theme — Black + Deep Blue + Neon accents */
export const T = {
  bg: "#070a14",
  bg2: "#0c1226",
  surface: "rgba(255,255,255,0.04)",
  surfaceHi: "rgba(255,255,255,0.07)",
  border: "rgba(255,255,255,0.08)",
  borderHi: "rgba(124,77,255,0.35)",
  text: "#f5f7ff",
  mute: "#8a93b2",
  cyan: "#22d3ee",
  purple: "#7c4dff",
  green: "#22c55e",
  pink: "#ec4899",
  amber: "#f59e0b",
};

export function SimpleAtmosphere() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute inset-0" style={{ background: T.bg }} />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(700px 500px at 10% 0%, ${T.purple}22 0%, transparent 60%), radial-gradient(700px 500px at 95% 100%, ${T.cyan}1a 0%, transparent 60%)`,
        }}
      />
    </div>
  );
}

export function Card({
  className,
  children,
  glow,
  onClick,
}: {
  className?: string;
  children: React.ReactNode;
  glow?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative rounded-2xl border p-4 transition-all",
        onClick && "cursor-pointer active:scale-[0.99]",
        className
      )}
      style={{
        background: T.surface,
        borderColor: T.border,
        boxShadow: glow ? `0 8px 30px -12px ${glow}55` : undefined,
      }}
    >
      {children}
    </div>
  );
}

export function Btn({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "secondary";
  size?: "sm" | "md" | "lg";
}) {
  const sz =
    size === "sm" ? "px-3 py-2 text-xs" : size === "lg" ? "px-5 py-3.5 text-sm" : "px-4 py-2.5 text-sm";
  const variantStyle: React.CSSProperties =
    variant === "primary"
      ? {
          background: `linear-gradient(135deg, ${T.purple}, ${T.cyan})`,
          color: "#0a0a0a",
          boxShadow: `0 6px 20px -8px ${T.purple}`,
        }
      : variant === "secondary"
      ? {
          background: `${T.purple}22`,
          color: T.text,
          border: `1px solid ${T.purple}55`,
        }
      : {
          background: T.surface,
          color: T.text,
          border: `1px solid ${T.border}`,
        };
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all active:scale-[0.97] disabled:opacity-50",
        sz,
        className
      )}
      style={variantStyle}
    >
      {children}
    </button>
  );
}

export function Counter({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const [n, setN] = useState(0);
  const reduce = useReducedMotion();
  const start = useRef<number | null>(null);
  useEffect(() => {
    if (reduce) return setN(value);
    let raf = 0;
    const step = (ts: number) => {
      if (start.current === null) start.current = ts;
      const t = Math.min(1, (ts - start.current) / 900);
      setN(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      start.current = null;
    };
  }, [value, reduce]);
  return (
    <span>
      {prefix}
      {n.toLocaleString()}
      {suffix}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  color = T.cyan,
  icon,
}: {
  label: string;
  value: number | string;
  hint?: string;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-[11px]" style={{ color: T.mute }}>
        {icon && <span style={{ color }}>{icon}</span>}
        <span>{label}</span>
      </div>
      <div className="mt-1.5 text-2xl font-bold tracking-tight" style={{ color: T.text }}>
        {typeof value === "number" ? <Counter value={value} /> : value}
      </div>
      {hint && <div className="mt-0.5 text-[11px]" style={{ color: T.mute }}>{hint}</div>}
    </Card>
  );
}

export function ProgressBar({ value, max = 100, color = T.purple }: { value: number; max?: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: `linear-gradient(90deg, ${color}, ${T.cyan})` }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />
    </div>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <h2 className="text-base font-semibold" style={{ color: T.text }}>
        {title}
      </h2>
      {action}
    </div>
  );
}
