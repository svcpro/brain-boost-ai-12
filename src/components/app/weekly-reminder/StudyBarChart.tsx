import { motion } from "framer-motion";
import type { DayInfo } from "./types";

interface Props {
  days: DayInfo[];
  dailyMinutes: number[];
}

const StudyBarChart = ({ days, dailyMinutes }: Props) => {
  const maxMinutes = Math.max(...dailyMinutes, 1);

  return (
    <>
      <div className="mt-3 flex items-end gap-1 h-12">
        {days.map((day, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <div className="w-full relative flex items-end justify-center h-8">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(dailyMinutes[i] / maxMinutes) * 100}%` }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className={`w-full rounded-t-sm min-h-[2px] ${
                  day.delivered && dailyMinutes[i] === 0
                    ? "bg-warning/40"
                    : day.delivered
                      ? "bg-success/60"
                      : day.past
                        ? "bg-muted-foreground/20"
                        : "bg-muted/40"
                }`}
              />
              {day.delivered && dailyMinutes[i] === 0 ? (
                <div className="absolute -top-0.5 w-1.5 h-1.5 rounded-full bg-warning animate-pulse shadow-[0_0_3px_hsl(var(--warning)/0.6)]" />
              ) : day.delivered ? (
                <div className="absolute -top-0.5 w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_3px_hsl(var(--success)/0.6)]" />
              ) : null}
            </div>
            <span className={`text-[8px] leading-none ${day.delivered && dailyMinutes[i] === 0 ? "text-warning font-bold" : "text-muted-foreground"}`}>
              {day.label.charAt(0)}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-2 text-[8px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-sm bg-success/60" /> Study mins
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-success" /> Reminder sent
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-warning" /> Ignored
          </span>
        </div>
        <span className="text-[8px] text-muted-foreground">
          {dailyMinutes.reduce((a, b) => a + b, 0)} min total
        </span>
      </div>
    </>
  );
};

export default StudyBarChart;
