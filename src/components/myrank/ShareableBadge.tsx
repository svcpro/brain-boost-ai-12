import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Share2, Loader2 } from "lucide-react";

interface Props {
  rank: number;
  percentile: number;
  category: string;
  aiTag: string;
  userName?: string;
}

/**
 * Generates a 1080x1080 share-ready badge image using <canvas>.
 * Triggers native share if available, else download.
 */
const ShareableBadge = ({ rank, percentile, category, aiTag, userName = "Champion" }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 1080, H = 1080;
    canvas.width = W;
    canvas.height = H;

    // Tier-based gradient
    const tier = percentile >= 99 ? "legendary" : percentile >= 90 ? "elite" : percentile >= 70 ? "great" : "good";
    const gradients: Record<string, [string, string, string]> = {
      legendary: ["#fbbf24", "#f97316", "#ef4444"],
      elite: ["#a855f7", "#ec4899", "#ef4444"],
      great: ["#3b82f6", "#06b6d4", "#0ea5e9"],
      good: ["#22c55e", "#10b981", "#059669"],
    };
    const [c1, c2, c3] = gradients[tier];

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, c1);
    bg.addColorStop(0.5, c2);
    bg.addColorStop(1, c3);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Decorative rings
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 4;
    [200, 320, 440].forEach(r => {
      ctx.beginPath();
      ctx.arc(W / 2, 480, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    // ACRY brand
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 36px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ACRY MyRank", W / 2, 100);

    ctx.font = "24px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(category + " · AI Rank Test", W / 2, 145);

    // Trophy emoji
    ctx.font = "120px sans-serif";
    ctx.fillText(percentile >= 95 ? "👑" : "🏆", W / 2, 320);

    // Big rank number
    ctx.fillStyle = "#fff";
    ctx.font = "bold 56px system-ui";
    ctx.fillText("RANK", W / 2, 410);

    ctx.font = "bold 200px system-ui";
    ctx.fillText(`#${rank.toLocaleString("en-IN")}`, W / 2, 580);

    // Name
    ctx.font = "bold 48px system-ui";
    ctx.fillText(userName, W / 2, 670);

    // AI tag pill
    const pillText = aiTag;
    ctx.font = "bold 36px system-ui";
    const pillW = ctx.measureText(pillText).width + 80;
    const pillH = 70;
    const pillX = (W - pillW) / 2;
    const pillY = 720;
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    roundRect(ctx, pillX, pillY, pillW, pillH, 35);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(pillText, W / 2, pillY + 48);

    // Percentile
    ctx.font = "bold 64px system-ui";
    ctx.fillText(`Top ${(100 - percentile).toFixed(1)}%`, W / 2, 880);
    ctx.font = "32px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText("of all test-takers in India", W / 2, 925);

    // CTA
    ctx.font = "bold 32px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillText("Beat me → acry.ai/myrank", W / 2, 1020);

    setReady(true);
  }, [rank, percentile, category, aiTag, userName]);

  const getBlob = (): Promise<Blob> =>
    new Promise((resolve, reject) => {
      canvasRef.current?.toBlob(b => b ? resolve(b) : reject(new Error("blob failed")), "image/png", 0.95);
    });

  const handleShare = async () => {
    setBusy(true);
    try {
      const blob = await getBlob();
      const file = new File([blob], `myrank-${rank}.png`, { type: "image/png" });
      const shareUrl = `${window.location.origin}/myrank`;

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "My ACRY Rank",
          text: `🔥 Rank #${rank.toLocaleString("en-IN")} in ${category} — beat me!`,
          url: shareUrl,
        });
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `myrank-${rank}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error("share failed", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl overflow-hidden border-2 border-border shadow-lg">
        <canvas ref={canvasRef} className="w-full h-auto block" />
      </div>
      <Button onClick={handleShare} disabled={!ready || busy} className="w-full">
        {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Share2 className="w-4 h-4 mr-2" />}
        Share my badge
        <Download className="w-4 h-4 ml-2 opacity-60" />
      </Button>
    </div>
  );
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export default ShareableBadge;
