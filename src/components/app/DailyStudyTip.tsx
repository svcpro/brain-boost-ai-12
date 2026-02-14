import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Lightbulb } from "lucide-react";

const tips = [
  { tip: "Teach what you learned today to an imaginary student — it reveals gaps instantly.", category: "technique" },
  { tip: "Study your weakest topic first when your energy is highest.", category: "strategy" },
  { tip: "A 5-minute review today saves 30 minutes of re-learning next week.", category: "spaced repetition" },
  { tip: "Close all tabs. One subject, one focus. Multitasking is a myth.", category: "focus" },
  { tip: "Write questions while reading — not highlights. Active recall beats passive review.", category: "technique" },
  { tip: "Your brain consolidates memory during sleep. Don't sacrifice rest for extra hours.", category: "health" },
  { tip: "Break a 2-hour session into 4×25 min blocks with 5-min breaks for peak retention.", category: "pomodoro" },
  { tip: "Test yourself before you feel ready. Struggling to recall strengthens the memory.", category: "recall" },
  { tip: "Interleave subjects instead of marathon sessions on one topic.", category: "strategy" },
  { tip: "Handwriting notes activates deeper encoding than typing.", category: "technique" },
  { tip: "Consistency beats intensity — 45 focused minutes daily outperforms weekend cramming.", category: "habit" },
  { tip: "Explain concepts out loud. If you stumble, that's exactly where to review.", category: "technique" },
  { tip: "Use the forgetting curve to your advantage — review just before you forget.", category: "spaced repetition" },
  { tip: "Start each session by recalling yesterday's material for 2 minutes.", category: "recall" },
  { tip: "Mistakes on practice tests are gifts — they show exactly where to focus.", category: "mindset" },
  { tip: "Hydrate. Even mild dehydration reduces concentration by up to 25%.", category: "health" },
  { tip: "Visualize concepts as stories or images — your brain remembers narratives better.", category: "technique" },
  { tip: "Set a tiny goal: 'Just 10 minutes.' Starting is the hardest part.", category: "motivation" },
  { tip: "Review your weakest 3 topics before bed — sleep will do the rest.", category: "strategy" },
  { tip: "Progress isn't always visible. Trust the process and keep showing up.", category: "mindset" },
  { tip: "Use the Feynman Technique: simplify until a child could understand it.", category: "technique" },
  { tip: "Switch locations occasionally — new environments create stronger memory cues.", category: "strategy" },
  { tip: "Celebrate small wins. Completing today's review is an achievement.", category: "motivation" },
  { tip: "Practice under exam conditions at least once a week to reduce test anxiety.", category: "exam prep" },
  { tip: "Don't compare your Chapter 1 to someone else's Chapter 10.", category: "mindset" },
  { tip: "Group similar concepts together, then compare differences — contrast strengthens memory.", category: "technique" },
  { tip: "Your future self will thank you for the 30 minutes you invest right now.", category: "motivation" },
  { tip: "After learning something new, close the book and write everything you remember.", category: "recall" },
  { tip: "Movement boosts cognition. A 10-minute walk before studying primes your brain.", category: "health" },
  { tip: "You don't need motivation to start — action creates motivation.", category: "mindset" },
];

const DailyStudyTip = () => {
  const [tip, setTip] = useState<typeof tips[0] | null>(null);

  useEffect(() => {
    // Use day-of-year to rotate tips deterministically
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    setTip(tips[dayOfYear % tips.length]);
  }, []);

  if (!tip) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-primary/20 bg-primary/5 p-4"
    >
      <div className="flex gap-3">
        <div className="p-1.5 rounded-lg bg-primary/10 h-fit">
          <Lightbulb className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-medium text-primary/70 uppercase tracking-wider mb-1">
            Daily Tip · {tip.category}
          </p>
          <p className="text-sm text-foreground leading-relaxed">{tip.tip}</p>
        </div>
      </div>
    </motion.div>
  );
};

export default DailyStudyTip;
