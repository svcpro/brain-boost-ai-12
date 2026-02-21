import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Monitor, Smartphone, Tablet, Laptop, Trash2, Wifi, WifiOff } from "lucide-react";
import { useDeviceSync } from "@/hooks/useDeviceSync";
import { formatDistanceToNow } from "date-fns";
import { createPortal } from "react-dom";

const DEVICE_ICONS: Record<string, any> = {
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
  web: Laptop,
};

export default function DeviceSyncIndicator() {
  const { devices, currentDeviceId, removeDevice, activeCount } = useDeviceSync();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const fiveMinAgo = Date.now() - 5 * 60 * 1000;

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const panelWidth = 288;
    let left = rect.left + rect.width / 2 - panelWidth / 2;
    if (left + panelWidth > window.innerWidth - 12) left = window.innerWidth - panelWidth - 12;
    if (left < 12) left = 12;
    setPos({ top: rect.bottom + 8, left });
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary/60 border border-border/50 hover:bg-secondary transition-colors"
        title="Synced devices"
      >
        <Monitor className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[10px] font-medium text-foreground">{activeCount}</span>
        <div className={`w-1.5 h-1.5 rounded-full ${activeCount > 1 ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
      </button>

      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)} />
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              style={{ position: "fixed", top: pos.top, left: pos.left, width: 288 }}
              className="z-[101] rounded-xl bg-card border border-border shadow-2xl shadow-background/80 p-3 space-y-2"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-foreground">Synced Devices</span>
                <span className="text-[10px] text-muted-foreground">{devices.length} device{devices.length !== 1 ? "s" : ""}</span>
              </div>

              {devices.map((d) => {
                const Icon = DEVICE_ICONS[d.device_type ?? "desktop"] || Monitor;
                const lastActive = d.last_active_at ? new Date(d.last_active_at).getTime() : 0;
                const isOnline = lastActive > fiveMinAgo;
                const isCurrent = d.device_id === currentDeviceId;
                return (
                  <div key={d.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/40">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isCurrent ? "bg-primary/15" : "bg-secondary"}`}>
                      <Icon className={`w-4 h-4 ${isCurrent ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-foreground truncate">{d.device_name || d.device_type || "Unknown"}</span>
                        {isCurrent && <span className="text-[9px] font-bold text-primary px-1.5 py-0.5 rounded-full bg-primary/10">This</span>}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {isOnline ? (
                          <Wifi className="w-2.5 h-2.5 text-success" />
                        ) : (
                          <WifiOff className="w-2.5 h-2.5 text-muted-foreground" />
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {isOnline ? "Online now" : d.last_active_at ? formatDistanceToNow(new Date(d.last_active_at), { addSuffix: true }) : "Unknown"}
                        </span>
                      </div>
                    </div>
                    {!isCurrent && (
                      <button
                        onClick={() => removeDevice(d.device_id)}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}

              {devices.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No devices synced yet</p>
              )}
            </motion.div>
          </AnimatePresence>
        </>,
        document.body
      )}
    </>
  );
}
