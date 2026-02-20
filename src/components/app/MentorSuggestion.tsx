import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Sparkles, Target, TrendingUp, Shield, AlertTriangle, Flame, ChevronDown, ChevronUp } from "lucide-react";

interface MentorSuggestionProps {
  score: number; // percentage 0-100
  totalQuestions: number;
  correctCount: number;
  difficulty?: string;
  context?: string; // e.g. "exam", "practice", "focus", "mock"
  topics?: string[]; // weak topics if available
  timeUsed?: number | null; // seconds
}

interface MentorMessage {
  headline: string;
  body: string;
  actionTip: string;
  tone: "celebrate" | "encourage" | "urgent";
  icon: typeof Brain;
}

const generateMentorMessage = ({
  score,
  totalQuestions,
  correctCount,
  difficulty,
  context,
  topics,
  timeUsed,
}: MentorSuggestionProps): MentorMessage => {
  const wrong = totalQuestions - correctCount;
  const avgTime = timeUsed && totalQuestions > 0 ? Math.round(timeUsed / totalQuestions) : null;
  const isFast = avgTime !== null && avgTime < 20;
  const isSlow = avgTime !== null && avgTime > 60;
  const topicStr = topics && topics.length > 0 ? topics.slice(0, 2).join(" & ") : null;
  const contextLabel = context === "mock" ? "mock exam" : context === "exam" ? "exam simulation" : context === "focus" ? "focus session" : "practice session";

  // ═══ HIGH SCORE (80%+) ═══
  if (score >= 80) {
    const headlines = [
      "You're in the top zone — don't slow down now.",
      "This is what preparation looks like.",
      "Your brain is firing on all cylinders.",
    ];
    const bodies = [
      `Scoring ${score}% on a ${contextLabel} means your fundamentals are locked in. ${wrong > 0 ? `But those ${wrong} mistake${wrong > 1 ? "s" : ""} — that's where the real growth hides. Champions fix the last 10%.` : "Perfect execution. Now push your limits with harder content."}`,
      `${correctCount} out of ${totalQuestions} correct. ${difficulty === "hard" ? "On hard difficulty — that's elite-level consistency." : "Now challenge yourself at a higher difficulty to stress-test your understanding."}`,
    ];
    return {
      headline: headlines[Math.floor(Math.random() * headlines.length)],
      body: bodies[Math.floor(Math.random() * bodies.length)],
      actionTip: wrong > 0
        ? `🎯 Review your ${wrong} incorrect answer${wrong > 1 ? "s" : ""} right now. Understanding WHY you got them wrong is worth more than 10 correct answers.`
        : isFast
        ? "⚡ You're fast AND accurate. Try timed hard-mode questions to build exam-day composure."
        : "🚀 Increase difficulty or add timer pressure. Comfort zones don't build champions.",
      tone: "celebrate",
      icon: TrendingUp,
    };
  }

  // ═══ MID SCORE (50-79%) ═══
  if (score >= 50) {
    const headlines = [
      "You're closer than you think.",
      "Good foundation — now sharpen the edges.",
      "This is the phase where winners separate from the crowd.",
    ];
    const bodies = [
      `${score}% shows you understand the core concepts, but ${wrong} question${wrong > 1 ? "s" : ""} slipped through. ${topicStr ? `Focus specifically on ${topicStr} — these are your highest-impact improvement areas.` : "Identify your weak patterns and attack them systematically."}`,
      `You got ${correctCount} right, which means your brain already knows most of this material. The gap between where you are and 80%+ is smaller than you think — it's about precision, not starting over.`,
    ];
    return {
      headline: headlines[Math.floor(Math.random() * headlines.length)],
      body: bodies[Math.floor(Math.random() * bodies.length)],
      actionTip: isSlow
        ? `⏱️ Speed matters. You averaged ${avgTime}s per question. Practice with timer enabled to build faster recall pathways.`
        : topicStr
        ? `📌 Spend 15 minutes revising ${topicStr}. Then retry just the questions you got wrong — watch your accuracy spike.`
        : "📌 Retry your mistakes immediately while they're fresh. Spaced repetition works best when you act within the hour.",
      tone: "encourage",
      icon: Target,
    };
  }

  // ═══ LOW SCORE (<50%) ═══
  const headlines = [
    "This is your starting line, not your finish line.",
    "Every expert was once a beginner.",
    "This score isn't a verdict — it's a roadmap.",
  ];
  const bodies = [
    `${score}% means there are clear gaps to fill, and that's actually a good thing — you now know exactly where to focus. ${topicStr ? `Start with ${topicStr}. Even 20 minutes of targeted revision can shift your next score dramatically.` : "Don't try to fix everything at once. Pick your weakest area and own it."}`,
    `Getting ${correctCount} out of ${totalQuestions} right shows you're not at zero — your brain already has hooks to build on. ${difficulty === "hard" ? "Also, you attempted hard mode — drop to medium, build confidence, then level up." : "Focus on understanding concepts, not memorizing answers."}`,
  ];
  return {
    headline: headlines[Math.floor(Math.random() * headlines.length)],
    body: bodies[Math.floor(Math.random() * bodies.length)],
    actionTip: difficulty === "hard"
      ? "💡 Switch to medium difficulty first. Master the fundamentals before tackling advanced questions — this isn't retreating, it's strategy."
      : "💡 Start a 10-minute focus session on your weakest topic. Small wins compound into massive confidence over time.",
    tone: "urgent",
    icon: Shield,
  };
};

const TONE_STYLES = {
  celebrate: {
    border: "border-success/30",
    bg: "bg-success/5",
    iconBg: "bg-success/15",
    iconColor: "text-success",
    accent: "text-success",
    glow: "0 0 30px hsl(var(--success) / 0.12)",
  },
  encourage: {
    border: "border-primary/30",
    bg: "bg-primary/5",
    iconBg: "bg-primary/15",
    iconColor: "text-primary",
    accent: "text-primary",
    glow: "0 0 30px hsl(var(--primary) / 0.12)",
  },
  urgent: {
    border: "border-warning/30",
    bg: "bg-warning/5",
    iconBg: "bg-warning/15",
    iconColor: "text-warning",
    accent: "text-warning",
    glow: "0 0 30px hsl(var(--warning) / 0.12)",
  },
};

const MentorSuggestion = (props: MentorSuggestionProps) => {
  const [mentor, setMentor] = useState<MentorMessage | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const msg = generateMentorMessage(props);
    setMentor(msg);
    // Staggered entrance
    const t = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(t);
  }, [props.score, props.totalQuestions]);

  if (!mentor || !visible) return null;

  const style = TONE_STYLES[mentor.tone];
  const MIcon = mentor.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ type: "spring", damping: 20, stiffness: 200 }}
        className={`rounded-2xl border ${style.border} ${style.bg} p-4 space-y-3 overflow-hidden`}
        style={{ boxShadow: style.glow }}
      >
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3"
        >
          <motion.div
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", damping: 12, delay: 0.2 }}
            className={`p-2 rounded-xl ${style.iconBg} shrink-0`}
          >
            <MIcon className={`w-5 h-5 ${style.iconColor}`} />
          </motion.div>
          <div className="flex-1 text-left">
            <div className="flex items-center gap-1.5">
              <Sparkles className={`w-3 h-3 ${style.accent}`} />
              <span className={`text-[10px] font-bold uppercase tracking-wider ${style.accent}`}>
                AI Mentor
              </span>
            </div>
            <motion.h3
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="text-sm font-bold text-foreground leading-snug"
            >
              {mentor.headline}
            </motion.h3>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
        </button>

        {/* Body */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-3"
            >
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-xs text-foreground/80 leading-relaxed"
              >
                {mentor.body}
              </motion.p>

              {/* Action tip card */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
                className="rounded-xl bg-background/60 border border-border/50 p-3"
              >
                <p className="text-[11px] font-semibold text-foreground leading-relaxed">
                  {mentor.actionTip}
                </p>
              </motion.div>

              {/* Motivational pulse */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="flex items-center gap-2"
              >
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className={`w-2 h-2 rounded-full ${
                    mentor.tone === "celebrate" ? "bg-success" :
                    mentor.tone === "encourage" ? "bg-primary" : "bg-warning"
                  }`}
                />
                <span className="text-[10px] text-muted-foreground italic">
                  {mentor.tone === "celebrate"
                    ? "Your consistency is building real mastery."
                    : mentor.tone === "encourage"
                    ? "Every session compounds. You're on the right track."
                    : "The fact that you're practicing puts you ahead of most."}
                </span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

export default MentorSuggestion;
