import { useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";

/**
 * Color-coded Progress Chart
 * Color changes based on percentage thresholds.
 *
 * Threshold systems:
 *  - "tier3":  Red <40, Yellow 40–70, Green >70
 *  - "tier4":  Red <30, Orange 30–60, Yellow 60–80, Green >80
 *  - "tier5":  Red <25, Orange 25–50, Yellow 50–75, Green 75–90, Emerald >90
 *
 * Styles: "bar" | "ring" | "thermometer" | "gauge"
 */

export type ThresholdSystem = "tier3" | "tier4" | "tier5";
export type ChartStyle = "bar" | "ring" | "thermometer" | "gauge";

interface ColorProgressChartProps {
  /** 0–100 */
  value: number;
  label?: string;
  sublabel?: string;
  thresholds?: ThresholdSystem;
  style?: ChartStyle;
  /** Show a small legend of color tiers below the chart */
  showLegend?: boolean;
  size?: number; // for ring / gauge / thermometer (px)
  className?: string;
}

interface Tier {
  min: number;
  label: string;
  /** HSL token without `hsl()` wrapper, e.g. "var(--destructive)" or "0 84% 60%" */
  color: string;
  twText: string; // tailwind text class for label
  twBg: string;   // tailwind bg class for legend dot
}

const TIER_SYSTEMS: Record<ThresholdSystem, Tier[]> = {
  tier3: [
    { min: 0,  label: "Low",    color: "var(--destructive)", twText: "text-destructive", twBg: "bg-destructive" },
    { min: 40, label: "Medium", color: "var(--warning)",     twText: "text-warning",     twBg: "bg-warning" },
    { min: 70, label: "High",   color: "var(--success)",     twText: "text-success",     twBg: "bg-success" },
  ],
  tier4: [
    { min: 0,  label: "Critical", color: "var(--destructive)", twText: "text-destructive", twBg: "bg-destructive" },
    { min: 30, label: "Weak",     color: "25 95% 55%",         twText: "text-[hsl(25,95%,55%)]", twBg: "bg-[hsl(25,95%,55%)]" },
    { min: 60, label: "Fair",     color: "var(--warning)",     twText: "text-warning",     twBg: "bg-warning" },
    { min: 80, label: "Strong",   color: "var(--success)",     twText: "text-success",     twBg: "bg-success" },
  ],
  tier5: [
    { min: 0,  label: "Critical",  color: "var(--destructive)", twText: "text-destructive", twBg: "bg-destructive" },
    { min: 25, label: "Weak",      color: "25 95% 55%",         twText: "text-[hsl(25,95%,55%)]", twBg: "bg-[hsl(25,95%,55%)]" },
    { min: 50, label: "Fair",      color: "var(--warning)",     twText: "text-warning",     twBg: "bg-warning" },
    { min: 75, label: "Strong",    color: "var(--success)",     twText: "text-success",     twBg: "bg-success" },
    { min: 90, label: "Excellent", color: "160 84% 39%",        twText: "text-[hsl(160,84%,39%)]", twBg: "bg-[hsl(160,84%,39%)]" },
  ],
};

const pickTier = (tiers: Tier[], pct: number): Tier => {
  let current = tiers[0];
  for (const t of tiers) if (pct >= t.min) current = t;
  return current;
};

const cssColor = (token: string) => `hsl(${token})`;

export default function ColorProgressChart({
  value,
  label,
  sublabel,
  thresholds = "tier4",
  style = "bar",
  showLegend = true,
  size = 140,
  className = "",
}: ColorProgressChartProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const tiers = TIER_SYSTEMS[thresholds];
  const tier = useMemo(() => pickTier(tiers, pct), [tiers, pct]);
  const color = cssColor(tier.color);

  const Header = label || sublabel ? (
    <div className="flex items-center gap-2 mb-3">
      <TrendingUp className="w-4 h-4" style={{ color }} />
      <div className="flex-1 min-w-0">
        {label && <h3 className="text-sm font-bold text-foreground truncate">{label}</h3>}
        {sublabel && <p className="text-[10px] text-muted-foreground truncate">{sublabel}</p>}
      </div>
      <span className="text-base font-extrabold" style={{ color }}>{pct}%</span>
    </div>
  ) : null;

  const Legend = showLegend ? (
    <div className="flex items-center gap-2 mt-3 flex-wrap">
      {tiers.map((t, i) => {
        const next = tiers[i + 1];
        const range = next ? `${t.min}–${next.min - 1}` : `${t.min}+`;
        const active = t.min === tier.min;
        return (
          <div
            key={t.label}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-all ${active ? "ring-1" : "opacity-50"}`}
            style={active ? { boxShadow: `inset 0 0 0 1px ${cssColor(t.color)}` } : undefined}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: cssColor(t.color) }} />
            <span className="text-[9px] font-medium" style={{ color: active ? cssColor(t.color) : undefined }}>
              {t.label} <span className="text-muted-foreground">({range})</span>
            </span>
          </div>
        );
      })}
    </div>
  ) : null;

  // Build chart by style
  let Chart: JSX.Element;

  if (style === "bar") {
    Chart = (
      <div className="w-full">
        <div className="relative w-full h-3 rounded-full bg-secondary overflow-hidden">
          {/* Threshold tick marks */}
          {tiers.slice(1).map((t) => (
            <div
              key={t.min}
              className="absolute top-0 bottom-0 w-px bg-border/60"
              style={{ left: `${t.min}%` }}
            />
          ))}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${color}, ${color})`,
              boxShadow: `0 0 12px ${color}`,
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-muted-foreground">0%</span>
          <span className="text-[9px] text-muted-foreground">100%</span>
        </div>
      </div>
    );
  } else if (style === "ring") {
    const r = (size - 16) / 2;
    const c = 2 * Math.PI * r;
    Chart = (
      <div className="relative mx-auto" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="8" strokeOpacity="0.3" />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: c - (c * pct) / 100 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            style={{ filter: `drop-shadow(0 0 8px ${color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black" style={{ color }}>{pct}%</span>
          <span className={`text-[10px] font-semibold ${tier.twText}`}>{tier.label}</span>
        </div>
      </div>
    );
  } else if (style === "thermometer") {
    const h = size;
    Chart = (
      <div className="flex items-end gap-3 mx-auto" style={{ height: h }}>
        <div className="relative w-8 h-full rounded-full bg-secondary overflow-hidden border border-border">
          {/* tier markers */}
          {tiers.slice(1).map((t) => (
            <div key={t.min} className="absolute left-0 right-0 h-px bg-border/60" style={{ bottom: `${t.min}%` }} />
          ))}
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${pct}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute bottom-0 left-0 right-0 rounded-t-full"
            style={{
              background: `linear-gradient(0deg, ${color}, ${color})`,
              boxShadow: `0 0 16px ${color}`,
            }}
          />
        </div>
        <div className="h-full flex flex-col justify-between text-right">
          <span className="text-[9px] text-muted-foreground">100%</span>
          <span className="text-2xl font-black" style={{ color }}>{pct}%</span>
          <span className="text-[9px] text-muted-foreground">0%</span>
        </div>
      </div>
    );
  } else {
    // gauge (semi-circle)
    const w = size * 1.6;
    const h = size;
    const r = w / 2 - 12;
    const cx = w / 2;
    const cy = h - 8;
    const c = Math.PI * r; // half circle
    Chart = (
      <div className="relative mx-auto" style={{ width: w, height: h + 24 }}>
        <svg viewBox={`0 0 ${w} ${h + 24}`} className="w-full h-full">
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth="10"
            strokeOpacity="0.3"
            strokeLinecap="round"
          />
          <motion.path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: c - (c * pct) / 100 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            style={{ filter: `drop-shadow(0 0 8px ${color})` }}
          />
          <text x={cx} y={cy - 8} textAnchor="middle" className="font-black" fontSize="28" fill={color}>
            {pct}%
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="hsl(var(--muted-foreground))">
            {tier.label}
          </text>
        </svg>
      </div>
    );
  }

  return (
    <div
      className={`glass rounded-2xl p-4 neural-border ${className}`}
      style={{ borderColor: `${color}33` }}
    >
      {Header}
      {Chart}
      {Legend}
    </div>
  );
}
