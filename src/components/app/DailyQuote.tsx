import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Quote, Share2, RefreshCw, Heart, ChevronDown, ChevronUp, Flame, TrendingUp, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type QuoteMood = "struggling" | "steady" | "thriving";

interface CategorizedQuote {
  text: string;
  author: string;
  mood: QuoteMood;
}

const QUOTES: CategorizedQuote[] = [
  // Struggling — low streak or low completion
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain", mood: "struggling" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius", mood: "struggling" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar", mood: "struggling" },
  { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe", mood: "struggling" },
  { text: "The expert in anything was once a beginner.", author: "Helen Hayes", mood: "struggling" },
  { text: "Push yourself, because no one else is going to do it for you.", author: "Unknown", mood: "struggling" },
  { text: "Great things never come from comfort zones.", author: "Unknown", mood: "struggling" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill", mood: "struggling" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt", mood: "struggling" },
  { text: "The roots of education are bitter, but the fruit is sweet.", author: "Aristotle", mood: "struggling" },
  { text: "Strive for progress, not perfection.", author: "Unknown", mood: "struggling" },
  { text: "Your limitation—it's only your imagination.", author: "Unknown", mood: "struggling" },

  // Steady — moderate streak or average completion
  { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier", mood: "steady" },
  { text: "A little progress each day adds up to big results.", author: "Satya Nani", mood: "steady" },
  { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn", mood: "steady" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson", mood: "steady" },
  { text: "Perseverance is not a long race; it is many short races one after the other.", author: "Walter Elliot", mood: "steady" },
  { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke", mood: "steady" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin", mood: "steady" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs", mood: "steady" },
  { text: "Education is the passport to the future.", author: "Malcolm X", mood: "steady" },
  { text: "Dream it. Wish it. Do it.", author: "Unknown", mood: "steady" },
  { text: "The capacity to learn is a gift; the ability to learn is a skill; the willingness to learn is a choice.", author: "Brian Herbert", mood: "steady" },

  // Thriving — high streak or great completion
  { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King", mood: "thriving" },
  { text: "The mind is not a vessel to be filled, but a fire to be kindled.", author: "Plutarch", mood: "thriving" },
  { text: "Study hard what interests you the most in the most undisciplined way.", author: "Richard Feynman", mood: "thriving" },
  { text: "What we learn with pleasure we never forget.", author: "Alfred Mercier", mood: "thriving" },
  { text: "Learning never exhausts the mind.", author: "Leonardo da Vinci", mood: "thriving" },
  { text: "Live as if you were to die tomorrow. Learn as if you were to live forever.", author: "Mahatma Gandhi", mood: "thriving" },
  { text: "Knowledge is power.", author: "Francis Bacon", mood: "thriving" },
  { text: "The more that you read, the more things you will know.", author: "Dr. Seuss", mood: "thriving" },
];

const FAVORITES_KEY = "daily-quote-favorites";

const loadFavorites = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
  } catch {
    return [];
  }
};

const saveFavorites = (favs: string[]) => {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
};

function getMood(streak: number, completionRate: number): QuoteMood {
  if (streak >= 5 || completionRate >= 75) return "thriving";
  if (streak >= 2 || completionRate >= 40) return "steady";
  return "struggling";
}

function getMoodMeta(mood: QuoteMood) {
  switch (mood) {
    case "thriving":
      return { label: "You're on fire!", icon: Flame, color: "text-success" };
    case "steady":
      return { label: "Keep it up!", icon: TrendingUp, color: "text-primary" };
    case "struggling":
      return { label: "Every step counts", icon: TrendingDown, color: "text-warning" };
  }
}

export interface DailyQuoteProps {
  currentStreak?: number;
  completionRate?: number;
}

const DailyQuote = ({ currentStreak = 0, completionRate = 50 }: DailyQuoteProps) => {
  const { toast } = useToast();

  const mood = getMood(currentStreak, completionRate);
  const moodMeta = getMoodMeta(mood);
  const MoodIcon = moodMeta.icon;

  const moodQuotes = useMemo(() => QUOTES.filter((q) => q.mood === mood), [mood]);

  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  const [index, setIndex] = useState(dayOfYear % moodQuotes.length);
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);
  const [showFavorites, setShowFavorites] = useState(false);

  const quote = moodQuotes[index % moodQuotes.length];
  const quoteKey = `${quote.text}|${quote.author}`;
  const isFav = favorites.includes(quoteKey);
  const shareText = `"${quote.text}" — ${quote.author} 📚`;

  const handleRefresh = () => {
    setIndex((prev) => (prev + 1) % moodQuotes.length);
  };

  const handleToggleFav = useCallback(() => {
    setFavorites((prev) => {
      const next = isFav ? prev.filter((k) => k !== quoteKey) : [...prev, quoteKey];
      saveFavorites(next);
      return next;
    });
    if (!isFav) toast({ title: "💛 Quote saved to favorites!" });
  }, [isFav, quoteKey, toast]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
        return;
      } catch { /* cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(shareText);
      toast({ title: "Quote copied to clipboard!" });
    } catch {
      toast({ title: "Couldn't copy quote", variant: "destructive" });
    }
  };

  const allQuotes = QUOTES;
  const favQuotes = allQuotes.filter((q) => favorites.includes(`${q.text}|${q.author}`));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-4 neural-border"
    >
      {/* Mood badge */}
      <div className="flex items-center gap-1.5 mb-2">
        <motion.div
          animate={mood === "thriving" ? { scale: [1, 1.15, 1] } : {}}
          transition={mood === "thriving" ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : {}}
        >
          <MoodIcon className={`w-3.5 h-3.5 ${moodMeta.color}`} />
        </motion.div>
        <span className={`text-[10px] font-semibold ${moodMeta.color}`}>{moodMeta.label}</span>
        {currentStreak > 0 && (
          <span className="text-[9px] text-muted-foreground ml-auto">
            🔥 {currentStreak}-day streak
          </span>
        )}
      </div>

      <div className="flex gap-3">
        <Quote className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${mood}-${index}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <p className="text-sm text-foreground italic leading-relaxed">"{quote.text}"</p>
              <p className="text-[10px] text-muted-foreground mt-1.5">— {quote.author}</p>
            </motion.div>
          </AnimatePresence>
          <div className="flex items-center justify-end gap-3 mt-2">
            <button
              onClick={handleToggleFav}
              className={`flex items-center gap-1 text-[10px] transition-colors active:scale-95 ${
                isFav ? "text-warning" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Heart className={`w-3 h-3 ${isFav ? "fill-warning" : ""}`} />
              {isFav ? "Saved" : "Save"}
            </button>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors active:scale-95"
            >
              <RefreshCw className="w-3 h-3" />
              New
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors active:scale-95"
            >
              <Share2 className="w-3 h-3" />
              Share
            </button>
          </div>
        </div>
      </div>

      {/* Favorites section */}
      {favQuotes.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <button
            onClick={() => setShowFavorites((v) => !v)}
            className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <Heart className="w-3 h-3 fill-warning text-warning" />
            {favQuotes.length} favorite{favQuotes.length !== 1 ? "s" : ""}
            {showFavorites ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
          </button>
          <AnimatePresence>
            {showFavorites && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-2 mt-2 max-h-40 overflow-y-auto">
                  {favQuotes.map((q, i) => (
                    <div key={i} className="flex items-start gap-2 group">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-foreground italic leading-relaxed">"{q.text}"</p>
                        <p className="text-[9px] text-muted-foreground">— {q.author}</p>
                      </div>
                      <button
                        onClick={() => {
                          const key = `${q.text}|${q.author}`;
                          setFavorites((prev) => {
                            const next = prev.filter((k) => k !== key);
                            saveFavorites(next);
                            return next;
                          });
                        }}
                        className="text-[9px] text-muted-foreground hover:text-destructive transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
};

export default DailyQuote;
