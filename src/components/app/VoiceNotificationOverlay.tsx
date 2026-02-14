import { motion, AnimatePresence } from "framer-motion";
import { Brain } from "lucide-react";

interface VoiceNotificationOverlayProps {
  playing: boolean;
  subtitle: string | null;
}

const VoiceNotificationOverlay = ({ playing, subtitle }: VoiceNotificationOverlayProps) => {
  if (!playing && !subtitle) return null;

  return (
    <AnimatePresence>
      {(playing || subtitle) && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed bottom-28 left-4 right-4 z-50 flex items-center gap-3 rounded-2xl p-4 glass-strong neural-border"
          style={{
            boxShadow: playing
              ? "0 0 30px hsl(175 80% 50% / 0.3), 0 0 60px hsl(175 80% 50% / 0.1), inset 0 0 20px hsl(175 80% 50% / 0.05)"
              : undefined,
          }}
        >
          {/* Animated brain glow */}
          <div className="relative flex-shrink-0">
            <motion.div
              animate={playing ? {
                boxShadow: [
                  "0 0 10px hsl(175 80% 50% / 0.3)",
                  "0 0 25px hsl(175 80% 50% / 0.5)",
                  "0 0 10px hsl(175 80% 50% / 0.3)",
                ],
                scale: [1, 1.1, 1],
              } : {}}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="w-10 h-10 rounded-full neural-gradient neural-border flex items-center justify-center"
            >
              <Brain className="w-5 h-5 text-primary" />
            </motion.div>
            {playing && (
              <motion.div
                className="absolute inset-0 rounded-full"
                animate={{ scale: [1, 1.8], opacity: [0.4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                style={{ border: "2px solid hsl(175 80% 50% / 0.3)" }}
              />
            )}
          </div>

          {/* Subtitle text */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-primary font-semibold uppercase tracking-wider mb-0.5">
              {playing ? "ACRY Speaking" : "ACRY"}
            </p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-foreground leading-snug line-clamp-3"
            >
              {subtitle}
            </motion.p>
          </div>

          {/* Sound wave bars */}
          {playing && (
            <div className="flex items-end gap-0.5 flex-shrink-0 h-6">
              {[0, 1, 2, 3, 4].map((i) => (
                <motion.div
                  key={i}
                  className="w-[3px] rounded-full bg-primary"
                  animate={{ height: ["6px", `${12 + Math.random() * 12}px`, "6px"] }}
                  transition={{
                    duration: 0.5 + Math.random() * 0.3,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.1,
                  }}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VoiceNotificationOverlay;
