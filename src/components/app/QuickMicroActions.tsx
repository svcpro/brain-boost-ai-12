import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Shield, Trophy, Zap, Loader2, ShieldAlert, Eye, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { triggerHaptic } from "@/lib/feedback";
import { useToast } from "@/hooks/use-toast";
import type { TopicPrediction } from "@/hooks/useMemoryEngine";
import SmartRecallOverlay from "./SmartRecallOverlay";
import RiskShieldOverlay from "./RiskShieldOverlay";
import RankBoostOverlay from "./RankBoostOverlay";
import FocusShieldDashboard from "./FocusShieldDashboard";

interface QuickMicroActionsProps {
  atRisk: TopicPrediction[];
  overallHealth: number;
  streakDays: number;
  onStartRecall: (subject?: string, topic?: string, minutes?: number) => void;
}

interface MicroAction {
  id: string;
  icon: typeof Brain;
  label: string;
  reward: string;
  color: string;
  bg: string;
  priority: number;
  gradient: string;
  glowColor: string;
  emoji: string;
  accentHsl: string;
}

// ─── Orbiting particle for cards ───
function CardOrbit({ color, size = 3, radius = 18, duration = 6, delay = 0 }: { color: string; size?: number; radius?: number; duration?: number; delay?: number }) {
  return (
    <motion.div className="absolute top-1/2 left-1/2" style={{ width: size, height: size }}
      animate={{ rotate: 360 }} transition={{ duration, repeat: Infinity, ease: "linear", delay }}>
      <div className="absolute rounded-full" style={{
        width: size, height: size, background: color,
        boxShadow: `0 0 6px ${color}`, transform: `translateX(${radius}px)`,
      }} />
    </motion.div>
  );
}

// ─── Animated ring for icon background ───
function IconRing({ color, active }: { color: string; active: boolean }) {
  return (
    <motion.div className="absolute inset-0 rounded-2xl pointer-events-none"
      animate={active ? { opacity: [0.3, 0.6, 0.3] } : { opacity: 0.15 }}
      transition={{ duration: 2, repeat: Infinity }}
      style={{ background: `conic-gradient(from 0deg, ${color}40, transparent 40%, transparent 60%, ${color}40)` }} />
  );
}

export default function QuickMicroActions({ atRisk, overallHealth, streakDays, onStartRecall }: QuickMicroActionsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [showRecall, setShowRecall] = useState(false);
  const [recallTopic, setRecallTopic] = useState<{ topic?: string; subject?: string }>({});
  const [showShield, setShowShield] = useState(false);
  const [showRankBoost, setShowRankBoost] = useState(false);
  const [focusScore, setFocusScore] = useState<number | null>(null);
  const [showFocusDash, setShowFocusDash] = useState(false);
  const [pressedId, setPressedId] = useState<string | null>(null);

  // Load today's focus score
  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    supabase.from("distraction_scores")
      .select("focus_score")
      .eq("user_id", user.id)
      .eq("score_date", today)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setFocusScore((data as any).focus_score);
      });
  }, [user]);

  // Dynamic reordering based on user state
  const actions = useMemo<MicroAction[]>(() => {
    const items: MicroAction[] = [
      {
        id: "smart-recall",
        icon: Brain,
        label: "Smart Recall",
        reward: "+3% memory",
        color: "text-primary",
        bg: "bg-primary/10",
        gradient: "from-[hsl(var(--primary))] to-[hsl(var(--accent))]",
        glowColor: "hsl(var(--primary))",
        accentHsl: "hsl(var(--primary) / 0.15)",
        emoji: "🧠",
        priority: overallHealth < 60 ? 100 : overallHealth < 80 ? 60 : 30,
      },
      {
        id: "risk-shield",
        icon: Shield,
        label: "Risk Shield",
        reward: atRisk.length > 0 ? `${atRisk.length} at risk` : "All safe",
        color: "text-warning",
        bg: "bg-warning/10",
        gradient: "from-[hsl(var(--warning))] to-[hsl(var(--destructive))]",
        glowColor: "hsl(var(--warning))",
        accentHsl: "hsl(var(--warning) / 0.15)",
        emoji: "🛡️",
        priority: atRisk.length >= 3 ? 90 : atRisk.length > 0 ? 50 : 10,
      },
      {
        id: "rank-boost",
        icon: Trophy,
        label: "Rank Boost",
        reward: "+1 rank",
        color: "text-accent",
        bg: "bg-accent/10",
        gradient: "from-[hsl(var(--accent))] to-[hsl(var(--primary))]",
        glowColor: "hsl(var(--accent))",
        accentHsl: "hsl(var(--accent) / 0.15)",
        emoji: "🏆",
        priority: streakDays >= 3 ? 70 : 40,
      },
      {
        id: "focus-shield",
        icon: ShieldAlert,
        label: "Focus Shield",
        reward: focusScore !== null ? `${focusScore}% focus` : "Track focus",
        color: "text-success",
        bg: "bg-success/10",
        gradient: "from-[hsl(var(--success))] to-[hsl(var(--primary))]",
        glowColor: "hsl(var(--success))",
        accentHsl: "hsl(var(--success) / 0.15)",
        emoji: "⚡",
        priority: 55,
      },
    ];
    // Only show Focus Shield; keep others hidden for now
    return items.filter((it) => it.id === "focus-shield");
  }, [atRisk.length, overallHealth, streakDays, focusScore]);

  const handleAction = async (id: string) => {
    triggerHaptic(20);
    setLoadingId(id);

    try {
      if (id === "smart-recall") {
        const target = atRisk[0];
        setRecallTopic({ topic: target?.name, subject: target?.subject_name ?? undefined });
        setShowRecall(true);
        setLoadingId(null);
        return;
      }
      if (id === "risk-shield") {
        if (atRisk.length === 0) {
          toast({ title: "🎉 All clear!", description: "No at-risk topics right now." });
          setLoadingId(null);
          return;
        }
        setShowShield(true);
        setLoadingId(null);
        return;
      }
      if (id === "rank-boost") {
        setShowRankBoost(true);
        setLoadingId(null);
        return;
      }
      if (id === "focus-shield") {
        setShowFocusDash(true);
        setLoadingId(null);
        return;
      }
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <motion.div animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
          <Sparkles className="w-3.5 h-3.5 text-primary" />
        </motion.div>
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em]">
          Quick Actions
        </p>
        <div className="flex-1 h-px bg-gradient-to-r from-border/40 to-transparent" />
        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity }}
          className="w-1.5 h-1.5 rounded-full bg-primary" />
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 gap-2.5">
        {actions.map((item, i) => {
          const isLoading = loadingId === item.id;
          const isPressed = pressedId === item.id;
          const isHero = item.id === "focus-shield" && actions.length === 1;

          // ─── ULTRA ADVANCED HERO CARD (Focus Shield solo) ───
          if (isHero) {
            return (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 220, damping: 22 }}
                whileTap={{ scale: 0.98 }}
                onTapStart={() => setPressedId(item.id)}
                onTap={() => setPressedId(null)}
                onTapCancel={() => setPressedId(null)}
                onClick={() => handleAction(item.id)}
                disabled={isLoading}
                className="relative w-full rounded-3xl overflow-hidden text-left disabled:opacity-70 group"
                style={{
                  background: `linear-gradient(135deg, hsl(var(--success) / 0.18), hsl(var(--primary) / 0.12) 50%, hsl(var(--accent) / 0.18))`,
                  border: `1px solid hsl(var(--success) / 0.35)`,
                  boxShadow: `0 8px 32px -8px hsl(var(--success) / 0.35), inset 0 1px 0 hsl(0 0% 100% / 0.08)`,
                  minHeight: 124,
                }}
              >
                {/* ─── Animated mesh gradient background ─── */}
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  animate={{
                    background: [
                      `radial-gradient(circle at 20% 30%, hsl(var(--success) / 0.35), transparent 50%), radial-gradient(circle at 80% 70%, hsl(var(--primary) / 0.25), transparent 50%)`,
                      `radial-gradient(circle at 80% 30%, hsl(var(--accent) / 0.30), transparent 50%), radial-gradient(circle at 20% 70%, hsl(var(--success) / 0.30), transparent 50%)`,
                      `radial-gradient(circle at 20% 30%, hsl(var(--success) / 0.35), transparent 50%), radial-gradient(circle at 80% 70%, hsl(var(--primary) / 0.25), transparent 50%)`,
                    ],
                  }}
                  transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                />

                {/* ─── Animated grid pattern ─── */}
                <div
                  className="absolute inset-0 opacity-[0.07] pointer-events-none"
                  style={{
                    backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
                    backgroundSize: "22px 22px",
                  }}
                />

                {/* ─── Scanning beam ─── */}
                <motion.div
                  className="absolute top-0 bottom-0 w-[2px] pointer-events-none"
                  style={{
                    background: `linear-gradient(180deg, transparent, hsl(var(--success)), transparent)`,
                    boxShadow: `0 0 16px hsl(var(--success)), 0 0 32px hsl(var(--success) / 0.6)`,
                  }}
                  animate={{ left: ["0%", "100%"] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />

                {/* ─── Floating orbs ─── */}
                <motion.div
                  className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl pointer-events-none"
                  style={{ background: `hsl(var(--success))`, opacity: 0.25 }}
                  animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.35, 0.2] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.div
                  className="absolute -bottom-10 -left-6 w-28 h-28 rounded-full blur-3xl pointer-events-none"
                  style={{ background: `hsl(var(--primary))`, opacity: 0.18 }}
                  animate={{ scale: [1.2, 1, 1.2], opacity: [0.15, 0.28, 0.15] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                />

                {/* ─── Orbiting particles ─── */}
                <CardOrbit color="hsl(var(--success))" size={3} radius={48} duration={10} />
                <CardOrbit color="hsl(var(--primary))" size={2} radius={62} duration={14} delay={2} />
                <CardOrbit color="hsl(var(--accent))" size={2} radius={38} duration={8} delay={1} />

                {/* ─── Pressed pulse border ─── */}
                <motion.div
                  className="absolute inset-0 rounded-3xl pointer-events-none"
                  animate={{ opacity: isPressed ? [0.4, 0.8, 0.4] : 0 }}
                  transition={{ duration: 0.6, repeat: isPressed ? Infinity : 0 }}
                  style={{ border: `2px solid hsl(var(--success))`, boxShadow: `0 0 24px hsl(var(--success) / 0.6)` }}
                />

                {/* ─── Content ─── */}
                <div className="relative z-10 p-4 flex items-center gap-4">
                  {/* Hexagonal icon shield */}
                  <div className="relative shrink-0">
                    {/* Outer rotating ring */}
                    <motion.div
                      className="absolute -inset-1.5 rounded-2xl"
                      style={{
                        background: `conic-gradient(from 0deg, hsl(var(--success)), hsl(var(--primary)), hsl(var(--accent)), hsl(var(--success)))`,
                        opacity: 0.6,
                      }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                    />
                    {/* Inner mask */}
                    <div
                      className="absolute -inset-1.5 rounded-2xl"
                      style={{ background: `hsl(var(--background) / 0.6)`, margin: 2 }}
                    />
                    {/* Icon container */}
                    <motion.div
                      className="relative w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden"
                      style={{
                        background: `linear-gradient(135deg, hsl(var(--success) / 0.35), hsl(var(--primary) / 0.20))`,
                        border: `1px solid hsl(var(--success) / 0.5)`,
                        boxShadow: `inset 0 0 16px hsl(var(--success) / 0.3)`,
                      }}
                      animate={{ y: [0, -2, 0] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    >
                      {/* Inner radial glow */}
                      <motion.div
                        className="absolute inset-0"
                        animate={{ opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        style={{ background: `radial-gradient(circle at center, hsl(var(--success) / 0.5), transparent 70%)` }}
                      />
                      {isLoading ? (
                        <Loader2 className="w-6 h-6 text-success animate-spin relative z-10" />
                      ) : (
                        <motion.div
                          animate={{ rotate: [0, -8, 8, 0] }}
                          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        >
                          <ShieldAlert className="w-6 h-6 text-success relative z-10" strokeWidth={2.2} />
                        </motion.div>
                      )}
                      {/* Shimmer */}
                      <motion.div
                        className="absolute inset-0"
                        animate={{ x: ["-150%", "250%"] }}
                        transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 3 }}
                        style={{ background: `linear-gradient(90deg, transparent, hsla(0,0%,100%,0.25), transparent)`, width: "60%" }}
                      />
                    </motion.div>
                  </div>

                  {/* Text block */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <motion.div
                        className="px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest"
                        style={{
                          background: `hsl(var(--success) / 0.2)`,
                          color: `hsl(var(--success))`,
                          border: `1px solid hsl(var(--success) / 0.4)`,
                        }}
                        animate={{ opacity: [0.7, 1, 0.7] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        ⚡ ACTIVE
                      </motion.div>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                        AI Guardian
                      </span>
                    </div>
                    <h3 className="text-base font-black text-foreground leading-tight tracking-tight flex items-center gap-1.5">
                      Focus Shield
                      <motion.span
                        animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.15, 1] }}
                        transition={{ duration: 3, repeat: Infinity }}
                        className="text-sm"
                      >
                        🛡️
                      </motion.span>
                    </h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                      Predictive cognitive control system
                    </p>
                    {/* Focus score bar */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-foreground/10 overflow-hidden relative">
                        <motion.div
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{
                            background: `linear-gradient(90deg, hsl(var(--success)), hsl(var(--primary)))`,
                            boxShadow: `0 0 8px hsl(var(--success) / 0.6)`,
                          }}
                          initial={{ width: "0%" }}
                          animate={{ width: `${focusScore ?? 72}%` }}
                          transition={{ duration: 1.2, ease: "easeOut", delay: 0.4 }}
                        />
                        {/* Shimmer on bar */}
                        <motion.div
                          className="absolute inset-y-0 w-1/3"
                          style={{ background: `linear-gradient(90deg, transparent, hsla(0,0%,100%,0.5), transparent)` }}
                          animate={{ x: ["-100%", "300%"] }}
                          transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                        />
                      </div>
                      <span className="text-[10px] font-black text-success tabular-nums">
                        {focusScore !== null ? `${focusScore}%` : "—"}
                      </span>
                    </div>
                  </div>

                  {/* CTA arrow */}
                  <motion.div
                    className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                      background: `hsl(var(--success) / 0.2)`,
                      border: `1px solid hsl(var(--success) / 0.4)`,
                    }}
                    animate={{ x: [0, 3, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Eye className="w-3.5 h-3.5 text-success" />
                  </motion.div>
                </div>

                {/* Bottom animated bar */}
                <motion.div
                  className="absolute bottom-0 left-0 right-0 h-[2px]"
                  style={{
                    background: `linear-gradient(90deg, transparent, hsl(var(--success)), hsl(var(--primary)), hsl(var(--accent)), transparent)`,
                  }}
                  animate={{ opacity: [0.4, 1, 0.4], backgroundPosition: ["0% 0%", "200% 0%"] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />
              </motion.button>
            );
          }

          // ─── Default compact card (used when multiple actions present) ───
          return (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, y: 15, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.3 + i * 0.07, type: "spring", stiffness: 300, damping: 22 }}
              whileTap={{ scale: 0.94 }}
              onTapStart={() => setPressedId(item.id)}
              onTap={() => setPressedId(null)}
              onTapCancel={() => setPressedId(null)}
              onClick={() => handleAction(item.id)}
              disabled={isLoading}
              className="relative rounded-2xl border border-border/50 backdrop-blur-sm p-3.5 flex flex-col items-start gap-2 text-left transition-colors disabled:opacity-60 overflow-hidden group"
              style={{ background: item.accentHsl }}
            >
              {/* ─── Background Effects ─── */}
              <motion.div
                className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl pointer-events-none"
                style={{ background: item.glowColor, opacity: 0.08 }}
                animate={{ scale: [1, 1.4, 1], opacity: [0.06, 0.12, 0.06] }}
                transition={{ duration: 4 + i, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full blur-2xl pointer-events-none"
                style={{ background: item.glowColor, opacity: 0.04 }}
                animate={{ scale: [1.2, 1, 1.2] }}
                transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              />
              <motion.div
                className="absolute inset-0 pointer-events-none"
                animate={{ x: ["-150%", "250%"] }}
                transition={{ duration: 3, repeat: Infinity, repeatDelay: 5 + i * 2, delay: i * 1.5 }}
                style={{ background: "linear-gradient(90deg, transparent, hsla(0,0%,100%,0.04), transparent)", width: "40%" }}
              />
              <CardOrbit color={item.glowColor} size={2} radius={28} duration={8 + i * 2} delay={i * 0.5} />
              <motion.div className="absolute inset-0 rounded-2xl pointer-events-none"
                animate={{ opacity: isPressed ? [0.3, 0.6, 0.3] : 0 }}
                transition={{ duration: 0.5, repeat: isPressed ? Infinity : 0 }}
                style={{ border: `1.5px solid ${item.glowColor}` }}
              />
              <div className="flex items-center justify-between w-full relative z-10">
                <div className="relative">
                  <IconRing color={item.glowColor} active={i === 0} />
                  <motion.div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center relative overflow-hidden`}
                    style={{
                      background: `linear-gradient(135deg, ${item.glowColor}20, ${item.glowColor}08)`,
                      border: `1px solid ${item.glowColor}25`,
                    }}
                  >
                    <motion.div className="absolute inset-0 rounded-2xl"
                      animate={{ opacity: [0.1, 0.25, 0.1] }}
                      transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.4 }}
                      style={{ background: `radial-gradient(circle at center, ${item.glowColor}30, transparent 70%)` }}
                    />
                    {isLoading ? (
                      <Loader2 className={`w-4.5 h-4.5 ${item.color} animate-spin relative z-10`} />
                    ) : (
                      <motion.div animate={i === 0 ? { rotate: [0, 8, -8, 0] } : {}} transition={{ duration: 3, repeat: Infinity }}>
                        <item.icon className={`w-[18px] h-[18px] ${item.color} relative z-10`} />
                      </motion.div>
                    )}
                  </motion.div>
                </div>
                <motion.span
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.6 + i * 0.1, type: "spring", stiffness: 400, damping: 12 }}
                  className="text-base"
                >
                  {item.emoji}
                </motion.span>
              </div>
              <div className="relative z-10 w-full">
                <p className="text-[11px] font-bold text-foreground leading-tight tracking-tight">{item.label}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <motion.div
                    className="w-1 h-1 rounded-full"
                    style={{ background: item.glowColor }}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                  />
                  <span className={`text-[9px] font-semibold ${item.color}`}>
                    {item.reward}
                  </span>
                </div>
              </div>
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-[2px] rounded-b-2xl"
                style={{ background: `linear-gradient(90deg, transparent, ${item.glowColor}, transparent)` }}
                animate={{ opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 3, repeat: Infinity, delay: i * 0.5 }}
              />
            </motion.button>
          );
        })}
      </div>

      {/* Smart Recall Overlay */}
      <AnimatePresence>
        {showRecall && (
          <SmartRecallOverlay
            topicName={recallTopic.topic}
            subjectName={recallTopic.subject}
            onClose={() => setShowRecall(false)}
          />
        )}
      </AnimatePresence>

      {/* Risk Shield Overlay */}
      <AnimatePresence>
        {showShield && (
          <RiskShieldOverlay
            atRisk={atRisk}
            onClose={() => setShowShield(false)}
          />
        )}
      </AnimatePresence>

      {/* Rank Boost Overlay */}
      <AnimatePresence>
        {showRankBoost && (
          <RankBoostOverlay onClose={() => setShowRankBoost(false)} />
        )}
      </AnimatePresence>

      {/* Focus Shield Dashboard */}
      <AnimatePresence>
        {showFocusDash && (
          <FocusShieldDashboard onClose={() => setShowFocusDash(false)} />
        )}
      </AnimatePresence>
    </motion.section>
  );
}
