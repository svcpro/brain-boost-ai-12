import { useMemo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, AlertCircle, Activity, TrendingUp, Trophy } from "lucide-react";

/**
 * Professional 5-Tier Circular Progress Ring
 *
 * Industry-standard color logic (data-viz best practices):
 *  ┌─────────┬────────────┬──────────────────────┬─────────────────────┐
 *  │ Range   │ Tier       │ Color (HSL)          │ Meaning             │
 *  ├─────────┼────────────┼──────────────────────┼─────────────────────┤
 *  │  0–19   │ Critical   │ hsl(0, 84%, 60%)     │ Urgent action       │
 *  │ 20–39   │ At Risk    │ hsl(20, 90%, 55%)    │ Behind schedule     │
 *  │ 40–59   │ Building   │ hsl(38, 95%, 55%)    │ Making progress     │
 *  │ 60–79   │ On Track   │ hsl(82, 70%, 48%)    │ Solid pace          │
 *  │ 80–100  │ Excellent  │ hsl(150, 75%, 42%)   │ Mastery zone        │
 *  └─────────┴────────────┴──────────────────────┴─────────────────────┘
 */

interface Tier {
  min: number;
  max: number;
  label: string;
  hsl: string;          // raw HSL for inline styles
  hslSoft: string;      // softer variant for backgrounds
  icon: typeof Activity;
  description: string;
}

const TIERS: Tier[] = [
  { min: 0,  max: 19,  label: "Critical",  hsl: "0 84% 60%",   hslSoft: "0 84% 60% / 0.15",   icon: AlertTriangle, description: "Urgent — start now" },
  { min: 20, max: 39,  label: "At Risk",   hsl: "20 90% 55%",  hslSoft: "20 90% 55% / 0.15",  icon: AlertCircle,   description: "Behind schedule" },
  { min: 40, max: 59,  label: "Building",  hsl: "38 95% 55%",  hslSoft: "38 95% 55% / 0.15",  icon: Activity,      description: "Making progress" },
  { min: 60, max: 79,  label: "On Track",  hsl: "82 70% 48%",  hslSoft: "82 70% 48% / 0.15",  icon: TrendingUp,    description: "Solid pace" },
  { min: 80, max: 100, label: "Excellent", hsl: "150 75% 42%", hslSoft: "150 75% 42% / 0.15", icon: Trophy,        description: "Mastery zone" },
];

const pickTier = (pct: number): Tier => {
  for (const t of TIERS) if (pct >= t.min && pct <= t.max) return t;
  return TIERS[0];
};

interface Props {
  /** 0–100 */
  value: number;
  label?: string;
  sublabel?: string;
  size?: number;
  showLegend?: boolean;
  className?: string;
}

export default function ProfessionalProgressRing({
  value,
  label = "Today's Plan Completion",
  sublabel,
  size = 180,
  showLegend = true,
  className = "",
}: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const tier = useMemo(() => pickTier(pct), [pct]);
  const Icon = tier.icon;
  const color = `hsl(${tier.hsl})`;
  const colorSoft = `hsl(${tier.hslSoft})`;

  const stroke = 12;
  const r = (size - stroke - 8) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  const dashOffset = C - (C * pct) / 100;

  return (
    <div
      className={`glass rounded-2xl p-5 neural-border ${className}`}
      style={{
        borderColor: colorSoft,
        background: `radial-gradient(ellipse at top, ${colorSoft}, transparent 60%), hsl(var(--card))`,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: colorSoft }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground truncate">{label}</h3>
          {sublabel && <p className="text-[10px] text-muted-foreground truncate">{sublabel}</p>}
        </div>
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={{ background: colorSoft, color }}
        >
          {tier.label}
        </span>
      </div>

      {/* Ring + center value */}
      <div className="flex items-center justify-center mb-4">
        <div className="relative" style={{ width: size, height: size }}>
          {/* Pulsing outer halo */}
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{ border: `2px solid ${color}`, opacity: 0.2 }}
            animate={{ scale: [1, 1.04, 1], opacity: [0.15, 0.3, 0.15] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />

          <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
            {/* Track */}
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth={stroke}
              strokeOpacity="0.25"
            />

            {/* Progress arc */}
            <motion.circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={C}
              initial={{ strokeDashoffset: C }}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
              style={{ filter: `drop-shadow(0 0 10px ${color})` }}
            />

            {/* Threshold tick marks at tier boundaries (20, 40, 60, 80) */}
            {[20, 40, 60, 80].map((mark) => {
              const angle = (mark / 100) * 2 * Math.PI - Math.PI / 2;
              const r1 = r - stroke / 2 - 2;
              const r2 = r + stroke / 2 + 2;
              const x1 = cx + r1 * Math.cos(angle + Math.PI / 2);
              const y1 = cy + r1 * Math.sin(angle + Math.PI / 2);
              const x2 = cx + r2 * Math.cos(angle + Math.PI / 2);
              const y2 = cy + r2 * Math.sin(angle + Math.PI / 2);
              return (
                <line
                  key={mark}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="hsl(var(--background))"
                  strokeWidth="2"
                />
              );
            })}
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              key={pct}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="text-4xl font-black tabular-nums leading-none"
              style={{ color }}
            >
              {pct}
              <span className="text-xl font-bold opacity-70">%</span>
            </motion.span>
            <span className="text-[10px] text-muted-foreground mt-1 font-medium">
              {tier.description}
            </span>
          </div>
        </div>
      </div>

      {/* 5-tier color logic legend */}
      {showLegend && (
        <div className="grid grid-cols-5 gap-1">
          {TIERS.map((t) => {
            const active = t.label === tier.label;
            return (
              <div
                key={t.label}
                className="flex flex-col items-center gap-1 py-1.5 rounded-lg transition-all"
                style={{
                  background: active ? `hsl(${t.hslSoft})` : "transparent",
                  opacity: active ? 1 : 0.55,
                }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    background: `hsl(${t.hsl})`,
                    boxShadow: active ? `0 0 8px hsl(${t.hsl})` : "none",
                  }}
                />
                <span
                  className="text-[8px] font-bold leading-none"
                  style={{ color: active ? `hsl(${t.hsl})` : undefined }}
                >
                  {t.label}
                </span>
                <span className="text-[7px] text-muted-foreground tabular-nums leading-none">
                  {t.min}–{t.max}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
