import { motion } from "framer-motion";
import { Quote, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
  { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
  { text: "Education is the passport to the future.", author: "Malcolm X" },
  { text: "The mind is not a vessel to be filled, but a fire to be kindled.", author: "Plutarch" },
  { text: "Study hard what interests you the most in the most undisciplined way.", author: "Richard Feynman" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Perseverance is not a long race; it is many short races one after the other.", author: "Walter Elliot" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "What we learn with pleasure we never forget.", author: "Alfred Mercier" },
  { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
  { text: "A little progress each day adds up to big results.", author: "Satya Nani" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn" },
  { text: "The roots of education are bitter, but the fruit is sweet.", author: "Aristotle" },
  { text: "Learning never exhausts the mind.", author: "Leonardo da Vinci" },
  { text: "Strive for progress, not perfection.", author: "Unknown" },
  { text: "Your limitation—it's only your imagination.", author: "Unknown" },
  { text: "Push yourself, because no one else is going to do it for you.", author: "Unknown" },
  { text: "Great things never come from comfort zones.", author: "Unknown" },
  { text: "Dream it. Wish it. Do it.", author: "Unknown" },
  { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke" },
  { text: "The capacity to learn is a gift; the ability to learn is a skill; the willingness to learn is a choice.", author: "Brian Herbert" },
  { text: "Live as if you were to die tomorrow. Learn as if you were to live forever.", author: "Mahatma Gandhi" },
  { text: "Knowledge is power.", author: "Francis Bacon" },
  { text: "The more that you read, the more things you will know.", author: "Dr. Seuss" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
];

const DailyQuote = () => {
  const { toast } = useToast();
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  const quote = QUOTES[dayOfYear % QUOTES.length];
  const shareText = `"${quote.text}" — ${quote.author} 📚`;

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-4 neural-border"
    >
      <div className="flex gap-3">
        <Quote className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground italic leading-relaxed">"{quote.text}"</p>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-[10px] text-muted-foreground">— {quote.author}</p>
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
    </motion.div>
  );
};

export default DailyQuote;
