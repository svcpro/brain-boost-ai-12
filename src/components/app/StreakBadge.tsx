import { useState, useRef } from "react";
import { Download, Share2 } from "lucide-react";
import html2canvas from "html2canvas";
import { useToast } from "@/hooks/use-toast";

interface StreakBadgeProps {
  milestone: number;
  onClose: () => void;
}

const BADGE_THEMES: Record<number, { bg: string; accent: string; glow: string; emoji: string; title: string; subtitle: string }> = {
  7: {
    bg: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)",
    accent: "#818cf8",
    glow: "0 0 60px rgba(99,102,241,0.4)",
    emoji: "⭐",
    title: "1 WEEK WARRIOR",
    subtitle: "7 consecutive days of studying",
  },
  30: {
    bg: "linear-gradient(135deg, #451a03 0%, #78350f 50%, #b45309 100%)",
    accent: "#fbbf24",
    glow: "0 0 60px rgba(245,158,11,0.4)",
    emoji: "🏆",
    title: "30-DAY LEGEND",
    subtitle: "A full month of dedication",
  },
  100: {
    bg: "linear-gradient(135deg, #450a0a 0%, #7f1d1d 50%, #b91c1c 100%)",
    accent: "#f87171",
    glow: "0 0 60px rgba(239,68,68,0.4)",
    emoji: "🔥",
    title: "100-DAY MASTER",
    subtitle: "Unstoppable. Legendary. Elite.",
  },
};

const StreakBadge = ({ milestone, onClose }: StreakBadgeProps) => {
  const badgeRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();
  const theme = BADGE_THEMES[milestone];

  if (!theme) return null;

  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const captureBadge = async (): Promise<HTMLCanvasElement | null> => {
    if (!badgeRef.current) return null;
    setGenerating(true);
    try {
      const canvas = await html2canvas(badgeRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false,
      });
      return canvas;
    } catch {
      toast({ title: "Failed to generate badge image", variant: "destructive" });
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    const canvas = await captureBadge();
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `streak-${milestone}-day-badge.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast({ title: "Badge downloaded!" });
  };

  const handleShare = async () => {
    const canvas = await captureBadge();
    if (!canvas) return;

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;

    if (navigator.share && navigator.canShare?.({ files: [new File([blob], "badge.png", { type: "image/png" })] })) {
      try {
        await navigator.share({
          text: `🔥 I just hit a ${milestone}-day study streak! #StudyStreak`,
          files: [new File([blob], `streak-${milestone}-badge.png`, { type: "image/png" })],
        });
        return;
      } catch {
        // cancelled
      }
    }

    // Fallback: copy text
    try {
      await navigator.clipboard.writeText(`🔥 I just hit a ${milestone}-day study streak! Consistency is key! #StudyStreak`);
      toast({ title: "Streak message copied to clipboard!" });
    } catch {
      toast({ title: "Couldn't share", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3">
      {/* The badge card — captured by html2canvas */}
      <div
        ref={badgeRef}
        style={{
          background: theme.bg,
          boxShadow: theme.glow,
          padding: "28px 24px",
          borderRadius: "16px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative circles */}
        <div
          style={{
            position: "absolute",
            top: -30,
            right: -30,
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: `${theme.accent}15`,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -20,
            left: -20,
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: `${theme.accent}10`,
          }}
        />

        <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 8 }}>{theme.emoji}</div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: 4,
              color: theme.accent,
              fontWeight: 600,
              marginBottom: 4,
              textTransform: "uppercase",
            }}
          >
            Achievement Unlocked
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: 1,
              marginBottom: 6,
            }}
          >
            {theme.title}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.7)",
              marginBottom: 16,
            }}
          >
            {theme.subtitle}
          </div>
          <div
            style={{
              display: "inline-block",
              padding: "6px 20px",
              borderRadius: 999,
              background: `${theme.accent}25`,
              border: `1px solid ${theme.accent}40`,
            }}
          >
            <span
              style={{
                fontSize: 28,
                fontWeight: 900,
                color: theme.accent,
              }}
            >
              {milestone}
            </span>
            <span
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.6)",
                marginLeft: 4,
                fontWeight: 500,
              }}
            >
              DAYS
            </span>
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 10,
              color: "rgba(255,255,255,0.4)",
              letterSpacing: 1,
            }}
          >
            {today}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleDownload}
          disabled={generating}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          {generating ? "Generating…" : "Download"}
        </button>
        <button
          onClick={handleShare}
          disabled={generating}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          <Share2 className="w-3.5 h-3.5" />
          Share
        </button>
      </div>
    </div>
  );
};

export default StreakBadge;
