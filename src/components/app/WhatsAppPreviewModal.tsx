import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Send, X, CheckCircle2, Phone, Image, Loader2, Eye } from "lucide-react";
import { format } from "date-fns";

interface WhatsAppPreviewModalProps {
  open: boolean;
  message: string;
  eventType: string;
  onConfirm: () => void;
  onCancel: () => void;
  sending?: boolean;
  mediaUrl?: string;
  buttons?: { text: string; url?: string }[];
}

// Event type display config
const EVENT_CONFIG: Record<string, { emoji: string; label: string }> = {
  daily_goal_completed: { emoji: "🎯", label: "Daily Goal Completed" },
  streak_milestone: { emoji: "🔥", label: "Streak Milestone" },
  streak_broken: { emoji: "💔", label: "Streak Broken" },
  streak_freeze_used: { emoji: "🧊", label: "Streak Freeze Used" },
  memory_strength_drop: { emoji: "⚠️", label: "Memory Alert" },
  study_reminder: { emoji: "📖", label: "Study Reminder" },
  weak_topic_alert: { emoji: "🧠", label: "Weak Topic Alert" },
  risk_digest: { emoji: "🔴", label: "Daily Risk Digest" },
  brain_mission_assigned: { emoji: "🎯", label: "Brain Mission" },
  brain_mission_completed: { emoji: "✅", label: "Mission Complete" },
  weekly_report: { emoji: "📊", label: "Weekly Report" },
  ai_recommendation: { emoji: "💡", label: "AI Recommendation" },
  brain_update: { emoji: "🧠", label: "Brain Update" },
  comeback_nudge: { emoji: "👋", label: "Comeback Nudge" },
  badge_earned: { emoji: "🏅", label: "Badge Earned" },
  leaderboard_rank_change: { emoji: "📈", label: "Rank Update" },
  exam_result: { emoji: "📝", label: "Exam Result" },
  exam_countdown: { emoji: "⏰", label: "Exam Countdown" },
  focus_session_completed: { emoji: "✅", label: "Focus Session Done" },
  community_reply: { emoji: "💬", label: "New Reply" },
  subscription_expiry: { emoji: "⚡", label: "Subscription Alert" },
};

const WhatsAppPreviewModal = ({
  open,
  message,
  eventType,
  onConfirm,
  onCancel,
  sending = false,
  mediaUrl,
  buttons,
}: WhatsAppPreviewModalProps) => {
  const config = EVENT_CONFIG[eventType] || { emoji: "📱", label: eventType.replace(/_/g, " ") };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm"
          >
            {/* Header */}
            <div className="bg-card border border-border rounded-t-2xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center">
                  <Eye className="w-4 h-4 text-green-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">WhatsApp Preview</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <span>{config.emoji}</span> {config.label}
                  </p>
                </div>
              </div>
              <button
                onClick={onCancel}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Phone Preview */}
            <div className="bg-[#0b141a] border-x border-border">
              {/* WhatsApp header */}
              <div className="flex items-center gap-3 px-4 py-2.5 bg-[#1f2c34]">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                  <MessageSquare className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-white text-xs font-semibold">ACRY Brain</p>
                  <p className="text-green-400 text-[9px]">online</p>
                </div>
                <Phone className="w-3.5 h-3.5 text-white/50" />
              </div>

              {/* Message bubble */}
              <div className="p-4 min-h-[200px] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZykiLz48L3N2Zz4=')]">
                {message ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="flex justify-end"
                  >
                    <div className="bg-[#005c4b] rounded-2xl rounded-tr-sm p-3 max-w-[90%] shadow-lg">
                      <p className="text-white text-xs whitespace-pre-wrap leading-relaxed">
                        {message}
                      </p>
                      {mediaUrl && (
                        <div className="mt-2 rounded-lg bg-white/10 p-2 flex items-center gap-2">
                          <Image className="w-4 h-4 text-white/60" />
                          <span className="text-white/60 text-[10px] truncate">{mediaUrl}</span>
                        </div>
                      )}
                      {buttons && buttons.length > 0 && (
                        <div className="mt-2.5 space-y-1">
                          {buttons.map((btn, i) => (
                            <div key={i} className="w-full py-2 rounded-lg bg-white/10 text-center">
                              <span className="text-[10px] text-blue-300 font-medium">{btn.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-end gap-1 mt-1.5">
                        <p className="text-white/40 text-[9px]">{format(new Date(), "h:mm a")}</p>
                        <CheckCircle2 className="w-3 h-3 text-blue-400" />
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[180px] gap-2">
                    <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
                    <p className="text-white/20 text-xs">Loading preview...</p>
                  </div>
                )}
              </div>

              {/* Input bar */}
              <div className="px-4 py-2 bg-[#1f2c34] flex items-center gap-2">
                <div className="flex-1 bg-[#2a3942] rounded-full px-4 py-1.5">
                  <p className="text-white/30 text-[10px]">Type a message</p>
                </div>
                <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center">
                  <Send className="w-3 h-3 text-white" />
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="bg-card border border-t-0 border-border rounded-b-2xl p-3 flex gap-2">
              <button
                onClick={onCancel}
                disabled={sending}
                className="flex-1 py-2.5 rounded-xl bg-secondary text-muted-foreground text-xs font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={sending}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-xs font-semibold transition-all disabled:opacity-50 shadow-lg shadow-green-600/20"
              >
                {sending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                {sending ? "Sending..." : "Send WhatsApp"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WhatsAppPreviewModal;
