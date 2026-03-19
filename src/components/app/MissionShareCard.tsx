import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Download, Share2, Trophy, Brain, Flame, Star, Award, Zap, Copy, Check } from "lucide-react";
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
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleDownloadImage = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#0a0a0a",
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = `acry-mission-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast({ title: "Downloaded!", description: "Share card saved as image" });
    } catch (e) {
      toast({ title: "Download failed", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "ACRY Mission Complete!", text: shareText });
      } catch {}
    } else {
      handleCopyText();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-5"
    >
      <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-lg hover:bg-secondary">
        <X className="w-5 h-5 text-muted-foreground" />
      </button>

      {/* Share card preview */}
      <div
        ref={cardRef}
        className="w-full max-w-[320px] rounded-2xl overflow-hidden"
        style={{ background: "linear-gradient(135deg, hsl(175 80% 20%), hsl(220 60% 15%))" }}
      >
        <div className="p-5">
          {/* Header */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white text-xs font-bold">ACRY Mission Complete</p>
              <p className="text-white/60 text-[9px]">{missionTitle}</p>
            </div>
          </div>

          {/* Grade */}
          <div className="text-center mb-4">
            <p className="text-4xl mb-1">{gradeEmoji}</p>
            <h3 className="text-white text-lg font-bold">{gradeLabel}</h3>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <StatBox icon={<Trophy className="w-3 h-3" />} label="Score" value={score.toString()} />
            <StatBox icon={<Star className="w-3 h-3" />} label="Accuracy" value={`${accuracy}%`} />
            <StatBox icon={<Brain className="w-3 h-3" />} label="Brain Boost" value={`+${brainBoost}%`} />
            <StatBox icon={<Flame className="w-3 h-3" />} label="Streak" value={`${streakDays}d`} />
          </div>

          {/* Badges */}
          {badges.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {badges.map(b => (
                <span key={b} className="px-2 py-0.5 rounded-full bg-white/10 text-white/80 text-[8px] font-medium capitalize">
                  {b.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}

          {/* XP bar */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
            <Zap className="w-3 h-3 text-yellow-400" />
            <span className="text-white/80 text-[10px] font-medium">+{xpEarned} XP earned</span>
          </div>

          {/* Footer */}
          <p className="text-center text-white/30 text-[8px] mt-3 font-medium tracking-wider">
            ACRY • AI-Powered Learning
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 mt-5">
        <button
          onClick={handleDownloadImage}
          disabled={downloading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border text-xs font-medium text-foreground hover:bg-secondary transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          {downloading ? "Saving..." : "Save Image"}
        </button>
        <button
          onClick={handleCopyText}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border text-xs font-medium text-foreground hover:bg-secondary transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied!" : "Copy Text"}
        </button>
        <button
          onClick={handleNativeShare}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-colors"
        >
          <Share2 className="w-3.5 h-3.5" />
          Share
        </button>
      </div>
    </motion.div>
  );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-white/5 text-center">
      <div className="flex items-center justify-center gap-1 text-white/60 mb-1">{icon}<span className="text-[8px]">{label}</span></div>
      <p className="text-white font-bold text-sm">{value}</p>
    </div>
  );
}
