import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, Sparkles, Zap, Clock, AlertTriangle, Heart, Brain, ChevronDown, Loader2, X } from "lucide-react";
import { useAIAgent, BrainBriefing } from "@/hooks/useAIAgent";

const urgencyConfig = {
  immediate: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", label: "Now" },
  today: { icon: Clock, color: "text-warning", bg: "bg-warning/10", label: "Today" },
  this_week: { icon: Zap, color: "text-primary", bg: "bg-primary/10", label: "This Week" },
};

const BriefingCard = ({ briefing }: { briefing: BrainBriefing }) => (
  <div className="space-y-4">
    {/* Cognitive Summary */}
    <div className="glass rounded-xl neural-border p-4">
      <div className="flex items-center gap-2 mb-2">
        <Brain className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-foreground">Cognitive Summary</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{briefing.cognitive_summary}</p>
    </div>

    {/* Focus Now */}
    <div className="rounded-xl bg-primary/10 border border-primary/20 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-primary">Focus Right Now</span>
      </div>
      <p className="text-xs text-foreground leading-relaxed">{briefing.focus_recommendation}</p>
    </div>

    {/* Strategic Advice */}
    {briefing.strategic_advice?.length > 0 && (
      <div className="space-y-2">
        <span className="text-xs font-semibold text-foreground">Strategic Advice</span>
        {briefing.strategic_advice.map((advice, i) => {
          const config = urgencyConfig[advice.urgency] || urgencyConfig.this_week;
          const Icon = config.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`${config.bg} rounded-lg p-3 border border-border/30`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-3 h-3 ${config.color}`} />
                <span className="text-[10px] font-semibold text-foreground">{advice.title}</span>
                <span className={`text-[9px] ${config.color} ml-auto`}>{config.label}</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">{advice.advice}</p>
            </motion.div>
          );
        })}
      </div>
    )}

    {/* Memory Analysis */}
    <div className="glass rounded-xl neural-border p-4">
      <span className="text-xs font-semibold text-foreground block mb-2">Memory Analysis</span>
      <p className="text-[10px] text-muted-foreground leading-relaxed">{briefing.memory_analysis}</p>
    </div>

    {/* Predicted Outcome */}
    <div className="glass rounded-xl neural-border p-4">
      <span className="text-xs font-semibold text-foreground block mb-2">Predicted Trajectory</span>
      <p className="text-[10px] text-muted-foreground leading-relaxed">{briefing.predicted_outcome}</p>
    </div>

    {/* Wellness */}
    {briefing.wellness_note && (
      <div className="rounded-xl bg-success/10 border border-success/20 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Heart className="w-3.5 h-3.5 text-success" />
          <span className="text-xs font-semibold text-success">Wellness</span>
        </div>
        <p className="text-[10px] text-foreground leading-relaxed">{briefing.wellness_note}</p>
      </div>
    )}
  </div>
);

export default function AIBrainAgent() {
  const { briefing, chatMessages, loading, analyze, chat, clearChat } = useAIAgent();
  const [showChat, setShowChat] = useState(false);
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.length]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput("");
    await chat(msg);
  };

  return (
    <div className="space-y-4">
      {/* AI Briefing */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">ACRY AI Agent</h3>
              <p className="text-[10px] text-muted-foreground">Your autonomous study brain</p>
            </div>
          </div>
          <button
            onClick={() => analyze()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[10px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {briefing ? "Refresh" : "Analyze My Brain"}
          </button>
        </div>

        {loading && !briefing && (
          <div className="glass rounded-xl neural-border p-8 flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground">AI is analyzing your cognitive data…</p>
          </div>
        )}

        {briefing && <BriefingCard briefing={briefing} />}
      </motion.div>

      {/* Chat Toggle */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        onClick={() => setShowChat(!showChat)}
        className="w-full flex items-center justify-between p-3 rounded-xl glass neural-border hover:bg-secondary/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Ask ACRY anything</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showChat ? "rotate-180" : ""}`} />
      </motion.button>

      {/* Chat Interface */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass rounded-xl neural-border overflow-hidden">
              {/* Messages */}
              <div className="max-h-64 overflow-y-auto p-3 space-y-2">
                {chatMessages.length === 0 && (
                  <div className="text-center py-6">
                    <Bot className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-[10px] text-muted-foreground">Ask me about your study strategy, predictions, or anything about your learning.</p>
                    <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                      {["Why is my rank dropping?", "What should I study today?", "Am I at risk of burnout?"].map(q => (
                        <button
                          key={q}
                          onClick={() => { setInput(q); }}
                          className="text-[9px] px-2 py-1 rounded-full bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-xl px-3 py-2 text-[11px] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary/50 text-foreground"
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {loading && chatMessages[chatMessages.length - 1]?.role === "user" && (
                  <div className="flex justify-start">
                    <div className="bg-secondary/50 rounded-xl px-3 py-2">
                      <Loader2 className="w-3 h-3 text-muted-foreground animate-spin" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-border/50 p-2 flex gap-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSend()}
                  placeholder="Ask ACRY..."
                  className="flex-1 text-xs bg-transparent outline-none placeholder:text-muted-foreground px-2"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className="p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-30 transition-opacity"
                >
                  <Send className="w-3 h-3" />
                </button>
                {chatMessages.length > 0 && (
                  <button onClick={clearChat} className="p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                    <X className="w-3 h-3 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
