import { AnimatePresence, motion } from "framer-motion";
import type { DayInfo } from "./types";

interface Props {
  activeDot: number | null;
  days: DayInfo[];
  dailyMinutes: number[];
  scheduleLabel: string;
}

const DayDetailPanel = ({ activeDot, days, dailyMinutes, scheduleLabel }: Props) => (
  <AnimatePresence>
    {activeDot !== null && (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      >
        <div className="mt-2 px-2 py-1.5 rounded-lg bg-secondary/40 text-[10px] flex items-center justify-between">
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{days[activeDot].label}</span>
            {" · "}
            {days[activeDot].dateStr}
          </span>
          <span className={
            days[activeDot].delivered && dailyMinutes[activeDot] === 0
              ? "text-warning"
              : days[activeDot].delivered
                ? "text-success"
                : days[activeDot].past
                  ? "text-destructive"
                  : "text-muted-foreground"
          }>
            {days[activeDot].delivered && dailyMinutes[activeDot] === 0
              ? `⚠ Ignored — 0 min studied`
              : days[activeDot].delivered
                ? `✓ Delivered · ${dailyMinutes[activeDot]} min studied`
                : days[activeDot].past
                  ? `✗ Missed (${scheduleLabel})`
                  : `Scheduled ${scheduleLabel}`}
          </span>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default DayDetailPanel;
