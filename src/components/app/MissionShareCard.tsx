import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Download, Share2, Trophy, Brain, Flame, Star, Zap, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MissionShareCardProps {
  missionTitle: string;
  accuracy: number;
  xpEarned: number;
  brainBoost: number;
  streakDays: number;
  score: number;
  badges: string[];
  onClose: () => void;
}

export default function MissionShareCard({
  missionTitle, accuracy, xpEarned, brainBoost, streakDays, score, badges, onClose,
}: MissionShareCardProps) {
  const { toast } = useToast();
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const gradeEmoji = accuracy >= 90 ? "🏆" : accuracy >= 75 ? "🎉" : accuracy >= 50 ? "💪" : "🌱";
  const gradeLabel = accuracy >= 90 ? "Outstanding" : accuracy >= 75 ? "Excellent" : accuracy >= 50 ? "Good Job" : "Keep Growing";

  const shareText = `${gradeEmoji} I just completed "${missionTitle}" on ACRY!\n\n📊 Score: ${score}\n🎯 Accuracy: ${accuracy}%\n🧠 Brain Boost: +${brainBoost}%\n⚡ XP: ${xpEarned}\n🔥 Streak: ${streakDays} days\n\n#ACRY #BrainTraining #StudySmart`;

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      toast({ title: "Copied!", description: "Share text copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch { toast({ title: "Copy failed", variant: "destructive" }); }
  };

  const handleDownloadImage = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, { backgroundColor: "#0a0a0a", scale: 2, useCORS: true });
      const link = document.createElement("a");
      link.download = `acry-mission-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast({ title: "Downloaded!", description: "Share card saved as image" });
    } catch { toast({ title: "Download failed", variant: "destructive" }); }
    finally { setDownloading(false); }
  };

  const handleNativeShare = async () => {
    if (navigator.share) { try { await navigator.share({ title: "ACRY Mission Complete!", text: shareText }); } catch {} }
    else handleCopyText();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-5 safe-area-top">
      
      <button onClick={onClose} className="absolute top-4 right-4 p-2.5 rounded-xl hover:bg-secondary transition-colors active:scale-95">
        <X className="w-5 h-5 text-muted-foreground" />
      </button>

      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">Share Your Achievement</p>

      {/* Share card */}
      <div ref={cardRef} className="w-full max-w-[320px] rounded-3xl overflow-hidden"
        style={{ background: "linear-gradient(145deg, hsl(175 80% 18%), hsl(220 50% 12%), hsl(260 40% 15%))" }}>
        <div className="p-6">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-5">
            <div className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center border border-white/10">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white text-xs font-bold">ACRY Mission Complete</p>
              <p className="text-white/50 text-[9px]">{missionTitle}</p>
            </div>
          </div>

          {/* Grade */}
          <div className="text-center mb-5">
            <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}
              className="text-5xl mb-2">{gradeEmoji}</motion.p>
            <h3 className="text-white text-xl font-bold">{gradeLabel}</h3>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            <ShareStat icon={<Trophy className="w-3 h-3" />} label="Score" value={score.toString()} />
            <ShareStat icon={<Star className="w-3 h-3" />} label="Accuracy" value={`${accuracy}%`} />
            <ShareStat icon={<Brain className="w-3 h-3" />} label="Brain Boost" value={`+${brainBoost}%`} />
            <ShareStat icon={<Flame className="w-3 h-3" />} label="Streak" value={`${streakDays}d`} />
          </div>

          {/* Badges */}
          {badges.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {badges.map(b => (
                <span key={b} className="px-2.5 py-1 rounded-lg bg-white/8 text-white/80 text-[9px] font-semibold capitalize border border-white/5">
                  {b.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}

          {/* XP */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-white/80 text-[11px] font-semibold">+{xpEarned} XP earned</span>
          </div>

          <p className="text-center text-white/20 text-[8px] mt-4 font-semibold tracking-wider uppercase">
            ACRY • AI-Powered Learning
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2.5 mt-5">
        <button onClick={handleDownloadImage} disabled={downloading}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-card border border-border/50 text-xs font-semibold text-foreground hover:bg-secondary transition-colors active:scale-95">
          <Download className="w-3.5 h-3.5" />
          {downloading ? "Saving..." : "Save"}
        </button>
        <button onClick={handleCopyText}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-card border border-border/50 text-xs font-semibold text-foreground hover:bg-secondary transition-colors active:scale-95">
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied!" : "Copy"}
        </button>
        <button onClick={handleNativeShare}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold active:opacity-90 transition-colors active:scale-95"
          style={{ boxShadow: "0 4px 16px hsl(var(--primary) / 0.3)" }}>
          <Share2 className="w-3.5 h-3.5" /> Share
        </button>
      </div>
    </motion.div>
  );
}

function ShareStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-white/5 text-center border border-white/5">
      <div className="flex items-center justify-center gap-1 text-white/50 mb-1">{icon}<span className="text-[8px] font-medium">{label}</span></div>
      <p className="text-white font-bold text-sm">{value}</p>
    </div>
  );
}
