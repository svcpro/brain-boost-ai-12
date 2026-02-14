import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Shield, Download, Share2 } from "lucide-react";
import html2canvas from "html2canvas";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format, subDays, startOfDay } from "date-fns";

interface WeekBucket {
  label: string;
  high: number;
  medium: number;
  low: number;
  total: number;
}

const ConfidenceTrendChart = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [weeks, setWeeks] = useState<WeekBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const captureCard = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    const canvas = await html2canvas(cardRef.current, {
      backgroundColor: "#0f1419",
      scale: 2,
      useCORS: true,
    });
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
  };

  const handleDownload = async () => {
    setSharing(true);
    try {
      const blob = await captureCard();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `confidence-trend-${format(new Date(), "yyyy-MM-dd")}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "📥 Downloaded!", description: "Confidence trend saved as image." });
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    } finally {
      setSharing(false);
    }
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const blob = await captureCard();
      if (!blob) return;
      const file = new File([blob], "confidence-trend.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "My Confidence Trend", text: "Check out my confidence trend! 🛡️", files: [file] });
      } else {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        toast({ title: "📋 Copied!", description: "Image copied to clipboard." });
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        toast({ title: "Could not share", description: "Try downloading instead.", variant: "destructive" });
      }
    } finally {
      setSharing(false);
    }
  };

  const load = useCallback(async () => {
    if (!user) return;

    const today = startOfDay(new Date());
    const since = subDays(today, 27); // 4 weeks

    const { data: logs } = await supabase
      .from("study_logs")
      .select("confidence_level, created_at")
      .eq("user_id", user.id)
      .not("confidence_level", "is", null)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true });

    if (!logs || logs.length === 0) {
      setLoading(false);
      return;
    }

    // Build 4 weekly buckets
    const buckets: WeekBucket[] = [];
    for (let w = 0; w < 4; w++) {
      const weekStart = subDays(today, (3 - w) * 7 + 6);
      const weekEnd = subDays(today, (3 - w) * 7 - 1);
      const weekLogs = logs.filter((l) => {
        const d = new Date(l.created_at);
        return d >= weekStart && d < weekEnd;
      });
      buckets.push({
        label: format(weekStart, "MMM d"),
        high: weekLogs.filter((l) => l.confidence_level === "high").length,
        medium: weekLogs.filter((l) => l.confidence_level === "medium").length,
        low: weekLogs.filter((l) => l.confidence_level === "low").length,
        total: weekLogs.length,
      });
    }

    setWeeks(buckets);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return null;
  if (weeks.every((w) => w.total === 0)) return null;

  const maxTotal = Math.max(...weeks.map((w) => w.total), 1);

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-5 neural-border"
    >
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-foreground text-sm">Confidence Trend</h2>
        <span className="ml-auto text-[10px] text-muted-foreground">Last 4 weeks</span>
        {weeks.some((w) => w.total > 0) && (
          <div className="flex items-center gap-1">
            <button onClick={handleDownload} disabled={sharing} className="p-1.5 rounded-lg neural-border hover:glow-primary transition-all disabled:opacity-50" title="Download as image">
              <Download className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button onClick={handleShare} disabled={sharing} className="p-1.5 rounded-lg neural-border hover:glow-primary transition-all disabled:opacity-50" title="Share">
              <Share2 className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-4">
        {[
          { label: "High", color: "bg-success" },
          { label: "Medium", color: "bg-warning" },
          { label: "Low", color: "bg-destructive" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${item.color}`} />
            <span className="text-[10px] text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Stacked bar chart */}
      <div className="flex items-end gap-3 h-32">
        {weeks.map((week, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex flex-col-reverse rounded-md overflow-hidden" style={{ height: "100%" }}>
              {week.total > 0 ? (
                <>
                  <motion.div
                    className="bg-destructive/80 w-full"
                    initial={{ height: 0 }}
                    animate={{ height: `${(week.low / maxTotal) * 100}%` }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                  />
                  <motion.div
                    className="bg-warning/80 w-full"
                    initial={{ height: 0 }}
                    animate={{ height: `${(week.medium / maxTotal) * 100}%` }}
                    transition={{ duration: 0.5, delay: i * 0.1 + 0.05 }}
                  />
                  <motion.div
                    className="bg-success/80 w-full"
                    initial={{ height: 0 }}
                    animate={{ height: `${(week.high / maxTotal) * 100}%` }}
                    transition={{ duration: 0.5, delay: i * 0.1 + 0.1 }}
                  />
                </>
              ) : (
                <div className="w-full h-full bg-secondary/30 rounded-md" />
              )}
            </div>
            <span className="text-[9px] text-muted-foreground mt-1">{week.label}</span>
          </div>
        ))}
      </div>

      {/* Per-week breakdown */}
      <div className="grid grid-cols-4 gap-2 mt-4">
        {weeks.map((week, i) => {
          const highPct = week.total > 0 ? Math.round((week.high / week.total) * 100) : 0;
          return (
            <div key={i} className="text-center">
              <p className="text-sm font-bold text-foreground">{week.total}</p>
              <p className="text-[9px] text-muted-foreground">sessions</p>
              {week.total > 0 && (
                <p className="text-[9px] text-success font-medium mt-0.5">{highPct}% high</p>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default ConfidenceTrendChart;
