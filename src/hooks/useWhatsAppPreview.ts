import { useState, useCallback, useRef } from "react";
import { notifyWhatsApp } from "@/lib/whatsappNotify";

// Default messages matching whatsapp-notify edge function EVENT_TEMPLATES
const EVENT_MESSAGES: Record<string, (data: Record<string, any>) => string> = {
  daily_goal_completed: (d) => `🎯 You crushed your daily goal! ${d.minutes || 0} minutes studied today. Keep the momentum going! 🔥`,
  streak_milestone: (d) => `🔥 ${d.days}-day streak! You're on fire! Every day counts — don't break the chain! 💪`,
  streak_broken: (d) => `💔 Your ${d.previous_days || 0}-day streak ended. No worries — start fresh today and bounce back stronger! 🚀`,
  memory_strength_drop: (d) => `⚠️ "${d.topic_name}" dropped to ${d.strength}% memory strength. A quick 10-min review can save it! 📚`,
  exam_result: (d) => `📝 You scored ${d.score}/${d.total} (${d.percentage || Math.round((d.score / d.total) * 100)}%) on your ${d.difficulty || ""} exam. ${(d.score / d.total) >= 0.8 ? "Excellent work! 🌟" : "Review weak areas to improve! 📖"}`,
  focus_session_completed: (d) => `✅ Great focus session! ${d.minutes || 25} minutes on "${d.topic_name || "your topics"}". Keep it up! 🎯`,
  badge_earned: (d) => `🏅 You earned the "${d.badge_name}" badge! ${d.description || "Keep up the amazing work!"} 🎉`,
  leaderboard_rank_change: (d) => `📈 Your rank ${d.direction === "up" ? "improved" : "changed"} to #${d.new_rank}!`,
};

interface PreviewState {
  open: boolean;
  eventType: string;
  message: string;
  data: Record<string, any>;
  sending: boolean;
}

export function useWhatsAppPreview() {
  const [preview, setPreview] = useState<PreviewState>({
    open: false,
    eventType: "",
    message: "",
    data: {},
    sending: false,
  });

  const resolveRef = useRef<(() => void) | null>(null);

  const showPreview = useCallback(
    (eventType: string, data: Record<string, any> = {}): Promise<void> => {
      const buildMessage = EVENT_MESSAGES[eventType];
      const eventData = data.data || data;
      const message = buildMessage
        ? buildMessage(eventData)
        : `📱 ${eventType.replace(/_/g, " ")} notification will be sent.`;

      return new Promise<void>((resolve) => {
        resolveRef.current = resolve;
        setPreview({
          open: true,
          eventType,
          message,
          data,
          sending: false,
        });
      });
    },
    []
  );

  const confirmSend = useCallback(async () => {
    setPreview((p) => ({ ...p, sending: true }));
    await notifyWhatsApp(preview.eventType, preview.data);
    setPreview({ open: false, eventType: "", message: "", data: {}, sending: false });
    resolveRef.current?.();
    resolveRef.current = null;
  }, [preview.eventType, preview.data]);

  const cancelSend = useCallback(() => {
    setPreview({ open: false, eventType: "", message: "", data: {}, sending: false });
    resolveRef.current?.();
    resolveRef.current = null;
  }, []);

  return {
    previewState: preview,
    showPreview,
    confirmSend,
    cancelSend,
  };
}
