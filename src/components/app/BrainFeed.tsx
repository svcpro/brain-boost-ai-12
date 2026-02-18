import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { Sparkles, Brain, ChevronUp, CheckCircle, XCircle, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { triggerHaptic } from "@/lib/feedback";

interface MicroConcept {
  topic_name: string;
  subject_name: string;
  concept: string;
  recall_question: string;
  options: string[];
  correct_index: number;
  memory_boost: number;
  memory_strength: number;
}

interface BrainFeedProps {
  hasTopics: boolean;
}

const BrainFeed = ({ hasTopics }: BrainFeedProps) => {
  const { user } = useAuth();
  const [cards, setCards] = useState<MicroConcept[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [answered, setAnswered] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [boosted, setBoosted] = useState(false);
  const hasFetched = useRef(false);

  const fetchFeed = useCallback(async () => {
    if (!user || hasFetched.current) return;
    hasFetched.current = true;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-brain-agent", {
        body: { action: "brain_feed", count: 5 },
      });
      if (!error && data?.cards?.length) {
        setCards(data.cards);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (hasTopics) fetchFeed();
  }, [hasTopics, fetchFeed]);

  const currentCard = cards[currentIndex];

  const handleSwipeUp = (_: any, info: PanInfo) => {
    if (info.offset.y < -50 && !revealed) {
      setRevealed(true);
      triggerHaptic([10]);
    }
  };

  const handleAnswer = async (idx: number) => {
    if (answered !== null || !currentCard) return;
    setAnswered(idx);
    triggerHaptic(idx === currentCard.correct_index ? [15, 30, 15] : [40]);

    if (idx === currentCard.correct_index) {
      setBoosted(true);
      // Update memory strength
      try {
        await supabase
          .from("topics")
          .update({
            memory_strength: Math.min(100, currentCard.memory_strength + currentCard.memory_boost),
          })
          .eq("user_id", user!.id)
          .eq("name", currentCard.topic_name);
      } catch {}
    }

    // Auto-advance after feedback
    setTimeout(() => {
      setRevealed(false);
      setAnswered(null);
      setBoosted(false);
      if (currentIndex < cards.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else {
        // Loop back
        setCurrentIndex(0);
      }
    }, 1800);
  };

  const advanceCard = () => {
    if (revealed || answered !== null) return;
    setCurrentIndex((i) => (i + 1) % cards.length);
    triggerHaptic([8]);
  };

  if (!hasTopics || cards.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="space-y-2"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground">Brain Feed</span>
        <span className="text-[9px] text-muted-foreground ml-auto">
          {currentIndex + 1}/{cards.length}
        </span>
      </div>

      {/* Card Stack */}
      <div className="relative h-44 overflow-hidden">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -60, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            drag={!revealed ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.3}
            onDragEnd={handleSwipeUp}
            onClick={!revealed ? () => setRevealed(true) : undefined}
            className="absolute inset-0 rounded-2xl border border-border bg-card p-4 cursor-pointer select-none overflow-hidden"
            style={{
              background: "linear-gradient(145deg, hsl(var(--card)) 0%, hsl(var(--secondary) / 0.5) 100%)",
            }}
          >
            {/* Glow accent */}
            <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-10 blur-2xl pointer-events-none bg-primary" />

            {/* Topic badge */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {currentCard.subject_name}
              </span>
              <span className="text-[9px] text-muted-foreground">{currentCard.topic_name}</span>
              <div className="ml-auto flex items-center gap-1">
                <Zap className="w-3 h-3 text-warning" />
                <span className="text-[9px] font-bold text-warning">+{currentCard.memory_boost}%</span>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {!revealed ? (
                /* Concept view */
                <motion.div
                  key="concept"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col justify-between h-[calc(100%-28px)]"
                >
                  <p className="text-sm font-medium text-foreground leading-relaxed line-clamp-3">
                    {currentCard.concept}
                  </p>
                  <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground mt-2">
                    <ChevronUp className="w-3 h-3 animate-bounce" />
                    <span>Tap to test recall</span>
                  </div>
                </motion.div>
              ) : (
                /* Question view */
                <motion.div
                  key="question"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col h-[calc(100%-28px)]"
                >
                  <p className="text-xs font-medium text-foreground mb-2 line-clamp-2">
                    {currentCard.recall_question}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 flex-1">
                    {currentCard.options.map((opt, i) => {
                      const isCorrect = i === currentCard.correct_index;
                      const isSelected = answered === i;
                      const showResult = answered !== null;

                      return (
                        <motion.button
                          key={i}
                          whileTap={!showResult ? { scale: 0.95 } : {}}
                          onClick={(e) => { e.stopPropagation(); handleAnswer(i); }}
                          disabled={showResult}
                          className={`rounded-xl px-2 py-1.5 text-[10px] font-medium text-left border transition-all leading-tight ${
                            showResult
                              ? isCorrect
                                ? "border-success/50 bg-success/10 text-success"
                                : isSelected
                                  ? "border-destructive/50 bg-destructive/10 text-destructive"
                                  : "border-border/30 bg-secondary/20 text-muted-foreground"
                              : "border-border/50 bg-secondary/30 text-foreground hover:border-primary/30 hover:bg-primary/5 active:bg-primary/10"
                          }`}
                        >
                          <span className="flex items-center gap-1">
                            {showResult && isCorrect && <CheckCircle className="w-3 h-3 shrink-0" />}
                            {showResult && isSelected && !isCorrect && <XCircle className="w-3 h-3 shrink-0" />}
                            {opt}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Boost overlay */}
            <AnimatePresence>
              {boosted && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-2xl z-10"
                >
                  <div className="text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 400 }}
                    >
                      <Brain className="w-8 h-8 text-primary mx-auto mb-1" />
                    </motion.div>
                    <p className="text-lg font-bold text-primary">+{currentCard.memory_boost}%</p>
                    <p className="text-[10px] text-muted-foreground">Memory boosted</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>

        {/* Background stack hint */}
        {cards.length > 1 && (
          <div
            className="absolute bottom-0 left-3 right-3 h-40 rounded-2xl border border-border/30 bg-card/50 -z-10"
            style={{ transform: "translateY(6px) scale(0.96)" }}
          />
        )}
      </div>

      {/* Dot indicators */}
      {cards.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {cards.map((_, i) => (
            <button
              key={i}
              onClick={() => { if (answered === null && !revealed) { setCurrentIndex(i); triggerHaptic([5]); } }}
              className={`rounded-full transition-all duration-300 ${
                i === currentIndex
                  ? "w-4 h-1.5 bg-primary"
                  : i < currentIndex
                    ? "w-1.5 h-1.5 bg-primary/40"
                    : "w-1.5 h-1.5 bg-border"
              }`}
            />
          ))}
        </div>
      )}
    </motion.section>
  );
};

export default BrainFeed;
