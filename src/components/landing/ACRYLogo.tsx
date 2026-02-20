import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

// ─── Particle System ────────────────────────────────────────
const useAssemblyParticles = (count: number) =>
  useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        startX: (Math.random() - 0.5) * 300,
        startY: (Math.random() - 0.5) * 300,
        endX: (Math.random() - 0.5) * 60,
        endY: (Math.random() - 0.5) * 40,
        size: Math.random() * 2.5 + 0.8,
        delay: Math.random() * 0.8,
        duration: 1.2 + Math.random() * 0.6,
      })),
    [count]
  );

// ─── Neural Connection Lines ────────────────────────────────
const NeuralLines = ({ revealed }: { revealed: boolean }) => {
  const lines = useMemo(
    () => [
      { x1: 10, y1: 20, x2: 45, y2: 10 },
      { x1: 45, y1: 10, x2: 80, y2: 25 },
      { x1: 20, y1: 50, x2: 50, y2: 35 },
      { x1: 50, y1: 35, x2: 75, y2: 55 },
      { x1: 30, y1: 70, x2: 55, y2: 60 },
      { x1: 55, y1: 60, x2: 85, y2: 70 },
      { x1: 15, y1: 40, x2: 40, y2: 80 },
      { x1: 60, y1: 15, x2: 90, y2: 45 },
    ],
    []
  );

  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 80">
      {lines.map((l, i) => (
        <motion.line
          key={i}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke="hsl(187, 100%, 50%)"
          strokeWidth="0.3"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={revealed ? { pathLength: 1, opacity: [0, 0.5, 0.2] } : {}}
          transition={{ duration: 0.8, delay: 0.3 + i * 0.08, ease: "easeOut" }}
        />
      ))}
      {/* Neural nodes */}
      {lines.flatMap((l, i) => [
        <motion.circle
          key={`s${i}`}
          cx={l.x1}
          cy={l.y1}
          r="1"
          fill="hsl(187, 100%, 50%)"
          initial={{ scale: 0, opacity: 0 }}
          animate={revealed ? { scale: 1, opacity: [0, 0.8, 0.3] } : {}}
          transition={{ duration: 0.5, delay: 0.2 + i * 0.06 }}
        />,
        <motion.circle
          key={`e${i}`}
          cx={l.x2}
          cy={l.y2}
          r="0.8"
          fill="hsl(262, 100%, 65%)"
          initial={{ scale: 0, opacity: 0 }}
          animate={revealed ? { scale: 1, opacity: [0, 0.6, 0.25] } : {}}
          transition={{ duration: 0.5, delay: 0.4 + i * 0.06 }}
        />,
      ])}
    </svg>
  );
};

// ─── Electric Pulse ─────────────────────────────────────────
const ElectricPulse = ({ active }: { active: boolean }) => (
  <motion.div
    className="absolute inset-0 rounded-2xl pointer-events-none"
    initial={{ opacity: 0 }}
    animate={
      active
        ? {
            opacity: [0, 0.6, 0],
            boxShadow: [
              "0 0 0px hsl(187 100% 50% / 0)",
              "0 0 30px hsl(187 100% 50% / 0.4), 0 0 60px hsl(262 100% 65% / 0.2)",
              "0 0 0px hsl(187 100% 50% / 0)",
            ],
          }
        : {}
    }
    transition={{ duration: 1.5, delay: 1.8, ease: "easeInOut" }}
  />
);

// ─── Cinematic Light Sweep ──────────────────────────────────
const LightSweep = ({ active }: { active: boolean }) => (
  <motion.div
    className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none"
    initial={{ opacity: 0 }}
    animate={active ? { opacity: 1 } : {}}
    transition={{ delay: 2.2 }}
  >
    <motion.div
      className="absolute top-0 -left-full w-1/3 h-full"
      style={{
        background:
          "linear-gradient(90deg, transparent, hsl(187 100% 50% / 0.15), hsl(0 0% 100% / 0.08), transparent)",
      }}
      animate={active ? { left: ["−120%", "220%"] } : {}}
      transition={{ duration: 1.2, delay: 2.2, ease: "easeInOut" }}
    />
  </motion.div>
);

// ─── Signature "A" Icon ─────────────────────────────────────
const SignatureA = ({ size = 32, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    className={className}
  >
    <defs>
      <linearGradient id="aGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="hsl(187, 100%, 50%)" />
        <stop offset="60%" stopColor="hsl(262, 100%, 65%)" />
        <stop offset="100%" stopColor="hsl(187, 100%, 50%)" />
      </linearGradient>
      <filter id="aGlow">
        <feGaussianBlur stdDeviation="1.5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* Outer ring */}
    <circle cx="24" cy="24" r="22" stroke="url(#aGrad)" strokeWidth="1.2" fill="none" opacity="0.4" />
    {/* Inner neural triangle forming "A" */}
    <path
      d="M24 8L38 38H10L24 8Z"
      stroke="url(#aGrad)"
      strokeWidth="1.8"
      fill="none"
      strokeLinejoin="round"
      filter="url(#aGlow)"
    />
    {/* Crossbar */}
    <line x1="15" y1="30" x2="33" y2="30" stroke="url(#aGrad)" strokeWidth="1.5" opacity="0.8" />
    {/* Neural dots */}
    <circle cx="24" cy="8" r="2" fill="hsl(187, 100%, 50%)" />
    <circle cx="10" cy="38" r="1.5" fill="hsl(262, 100%, 65%)" />
    <circle cx="38" cy="38" r="1.5" fill="hsl(262, 100%, 65%)" />
    <circle cx="24" cy="30" r="1.2" fill="hsl(155, 100%, 50%)" />
  </svg>
);

// ─── Main Logo Component ────────────────────────────────────
interface ACRYLogoProps {
  /** "full" = icon + animated text, "icon" = icon only, "navbar" = compact icon + text */
  variant?: "full" | "icon" | "navbar";
  className?: string;
  animate?: boolean;
}

const ACRYLogo = ({ variant = "full", className = "", animate: shouldAnimate = true }: ACRYLogoProps) => {
  const [revealed, setRevealed] = useState(!shouldAnimate);
  const particles = useAssemblyParticles(shouldAnimate ? 35 : 0);

  useEffect(() => {
    if (shouldAnimate) {
      const t = setTimeout(() => setRevealed(true), 200);
      return () => clearTimeout(t);
    }
  }, [shouldAnimate]);

  // ── Navbar variant ──
  if (variant === "navbar") {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        <motion.div
          className="relative"
          initial={shouldAnimate ? { scale: 0, rotate: -90 } : {}}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.8, type: "spring", bounce: 0.3 }}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, hsl(228 50% 10%), hsl(228 40% 14%))",
              border: "1px solid hsl(187 100% 50% / 0.3)",
            }}
          >
            <SignatureA size={26} />
            {/* Ambient glow */}
            <motion.div
              className="absolute inset-0 rounded-xl pointer-events-none"
              animate={{
                boxShadow: [
                  "0 0 8px hsl(187 100% 50% / 0.1)",
                  "0 0 16px hsl(187 100% 50% / 0.2)",
                  "0 0 8px hsl(187 100% 50% / 0.1)",
                ],
              }}
              transition={{ duration: 3, repeat: Infinity }}
            />
          </div>
        </motion.div>
        <motion.span
          className="font-display font-bold text-xl tracking-[0.08em] text-foreground"
          initial={shouldAnimate ? { opacity: 0, x: -10 } : {}}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          ACRY
        </motion.span>
      </div>
    );
  }

  // ── Icon variant ──
  if (variant === "icon") {
    return (
      <motion.div
        className={`relative ${className}`}
        initial={shouldAnimate ? { scale: 0, rotate: -180 } : {}}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ duration: 1, type: "spring", bounce: 0.25 }}
      >
        <div
          className="w-24 h-24 md:w-28 md:h-28 rounded-3xl flex items-center justify-center relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, hsl(228 50% 8%), hsl(228 40% 12%))",
            border: "1px solid hsl(187 100% 50% / 0.25)",
          }}
        >
          <NeuralLines revealed={revealed} />
          <SignatureA size={56} className="relative z-10" />
          <ElectricPulse active={revealed} />
          <LightSweep active={revealed} />
        </div>
        {/* Orbiting energy ring */}
        <motion.div
          className="absolute inset-[-6px] rounded-[1.75rem] pointer-events-none"
          style={{ border: "1px solid hsl(187 100% 50% / 0.15)" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
      </motion.div>
    );
  }

  // ── Full variant (hero) ──
  return (
    <div className={`flex flex-col items-center gap-8 ${className}`}>
      {/* Particle assembly field */}
      <div className="relative">
        {shouldAnimate && (
          <div className="absolute inset-0 pointer-events-none" style={{ width: 300, height: 200, left: -100, top: -60 }}>
            {particles.map((p) => (
              <motion.div
                key={p.id}
                className="absolute rounded-full"
                style={{
                  width: p.size,
                  height: p.size,
                  background: p.id % 3 === 0
                    ? "hsl(187, 100%, 50%)"
                    : p.id % 3 === 1
                    ? "hsl(262, 100%, 65%)"
                    : "hsl(155, 100%, 50%)",
                  left: "50%",
                  top: "50%",
                }}
                initial={{ x: p.startX, y: p.startY, opacity: 0, scale: 0 }}
                animate={
                  revealed
                    ? {
                        x: [p.startX, p.endX],
                        y: [p.startY, p.endY],
                        opacity: [0, 0.8, 0],
                        scale: [0, 1.5, 0],
                      }
                    : {}
                }
                transition={{
                  duration: p.duration,
                  delay: p.delay,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        )}

        {/* Main icon container */}
        <motion.div
          className="relative"
          initial={shouldAnimate ? { scale: 0, rotate: -180 } : {}}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 1.2, type: "spring", bounce: 0.3, delay: 0.4 }}
        >
          {/* Pulsing outer rings */}
          <motion.div
            className="absolute inset-[-8px] rounded-[2rem]"
            animate={{
              boxShadow: [
                "0 0 0 0 hsl(187 100% 50% / 0.2)",
                "0 0 0 16px hsl(187 100% 50% / 0)",
              ],
            }}
            transition={{ duration: 2.5, repeat: Infinity, delay: 1 }}
          />
          <motion.div
            className="absolute inset-[-8px] rounded-[2rem]"
            animate={{
              boxShadow: [
                "0 0 0 0 hsl(262 100% 65% / 0.15)",
                "0 0 0 28px hsl(262 100% 65% / 0)",
              ],
            }}
            transition={{ duration: 3, repeat: Infinity, delay: 1.5 }}
          />

          <motion.div
            animate={revealed ? { y: [0, -6, 0] } : {}}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            <div
              className="w-24 h-24 md:w-28 md:h-28 rounded-3xl flex items-center justify-center relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, hsl(228 50% 8%), hsl(228 40% 12%))",
                border: "1px solid hsl(187 100% 50% / 0.3)",
                boxShadow:
                  "0 0 40px hsl(187 100% 50% / 0.1), 0 0 80px hsl(262 100% 65% / 0.05), inset 0 1px 0 hsl(187 100% 50% / 0.1)",
              }}
            >
              <NeuralLines revealed={revealed} />
              <SignatureA size={56} className="relative z-10" />
              <ElectricPulse active={revealed} />
              <LightSweep active={revealed} />
            </div>
          </motion.div>

          {/* Orbiting dots */}
          {[0, 120, 240].map((deg, i) => (
            <motion.div
              key={i}
              className="absolute top-1/2 left-1/2"
              style={{ marginTop: -3, marginLeft: -3 }}
              animate={{ rotate: [deg, deg + 360] }}
              transition={{ duration: 10 + i * 3, repeat: Infinity, ease: "linear" }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  transform: `translateX(${72 + i * 8}px)`,
                  background:
                    i === 0 ? "hsl(187, 100%, 50%)" : i === 1 ? "hsl(262, 100%, 65%)" : "hsl(155, 100%, 50%)",
                  boxShadow: `0 0 8px ${
                    i === 0 ? "hsl(187, 100%, 50%)" : i === 1 ? "hsl(262, 100%, 65%)" : "hsl(155, 100%, 50%)"
                  }`,
                }}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default ACRYLogo;
