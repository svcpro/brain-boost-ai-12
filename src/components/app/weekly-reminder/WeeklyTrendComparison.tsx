import { TrendingDown, TrendingUp, Minus } from "lucide-react";

interface Props {
  ignoredCount: number;
  lastWeekIgnored: number;
}

const WeeklyTrendComparison = ({ ignoredCount, lastWeekIgnored }: Props) => {
  const diff = ignoredCount - lastWeekIgnored;
  const TrendIcon = diff < 0 ? TrendingDown : diff > 0 ? TrendingUp : Minus;
  const trendColor = diff < 0 ? "text-success" : diff > 0 ? "text-warning" : "text-muted-foreground";
  const trendLabel = diff < 0
    ? `${Math.abs(diff)} fewer ignored vs last week`
    : diff > 0
      ? `${diff} more ignored vs last week`
      : "Same as last week";

  return (
    <div className="mt-2 flex items-center justify-between px-1">
      <div className={`flex items-center gap-1 text-[10px] ${trendColor}`}>
        <TrendIcon className="w-3 h-3" />
        <span>{trendLabel}</span>
      </div>
      <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
        <span>This: <span className={ignoredCount > 0 ? "text-warning font-semibold" : "text-success font-semibold"}>{ignoredCount}</span></span>
        <span>Last: <span className="font-semibold">{lastWeekIgnored}</span></span>
      </div>
    </div>
  );
};

export default WeeklyTrendComparison;
