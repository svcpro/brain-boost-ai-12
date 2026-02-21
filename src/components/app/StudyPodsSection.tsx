import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStudyPods, StudyPod, PodMessage } from "@/hooks/useStudyPods";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, Brain, Sparkles, Send, ArrowLeft, Loader2, Plus,
  LogOut, MessageCircle, Zap, Clock, BookOpen, Crown
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const StudyPodsSection = () => {
  const { user } = useAuth();
  const {
    myPods, suggestedPods, messages, loading, matchLoading,
    fetchMyPods, findMatch, joinPod, leavePod, loadMessages, sendMessage, setMessages,
  } = useStudyPods();
  const [activePod, setActivePod] = useState<StudyPod | null>(null);
  const [msgInput, setMsgInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchMyPods(); }, [fetchMyPods]);

  // Realtime for active pod
  useEffect(() => {
    if (!activePod) return;
    const channel = supabase
      .channel(`pod-${activePod.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "study_pod_messages",
        filter: `pod_id=eq.${activePod.id}`,
      }, (payload) => {
        setMessages((prev: PodMessage[]) => [...prev, payload.new as PodMessage]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activePod]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const openPod = async (pod: StudyPod) => {
    setActivePod(pod);
    await loadMessages(pod.id);
  };

  const handleSend = async () => {
    if (!msgInput.trim() || !activePod) return;
    const text = msgInput.trim();
    setMsgInput("");
    // Optimistic add
    setMessages((prev: PodMessage[]) => [...prev, {
      id: crypto.randomUUID(),
      pod_id: activePod.id,
      user_id: user!.id,
      content: text,
      is_ai_message: false,
      created_at: new Date().toISOString(),
    }]);
    await sendMessage(activePod.id, text);
  };

  // Pod Chat View
  if (activePod) {
    return (
      <div className="flex flex-col h-[60vh]">
        {/* Chat Header */}
        <div className="flex items-center gap-3 p-4 border-b border-border/50">
          <button onClick={() => setActivePod(null)} className="p-1.5 hover:bg-secondary rounded-lg">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-foreground truncate">{activePod.name}</h3>
            <p className="text-[10px] text-muted-foreground">{activePod.member_count} members</p>
          </div>
          <button onClick={() => { leavePod(activePod.id); setActivePod(null); }}
            className="p-1.5 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <MessageCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Start the conversation!</p>
            </div>
          )}
          {messages.map((msg) => {
            const isMe = msg.user_id === user?.id;
            return (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs ${
                  msg.is_ai_message
                    ? "bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 text-foreground"
                    : isMe
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground"
                }`}>
                  {!isMe && !msg.is_ai_message && (
                    <span className="text-[9px] text-muted-foreground font-medium block mb-0.5">
                      {msg.user_id.slice(0, 6)}
                    </span>
                  )}
                  {msg.is_ai_message && (
                    <span className="text-[9px] text-primary font-bold flex items-center gap-1 mb-0.5">
                      <Brain className="w-2.5 h-2.5" /> AI Brain
                    </span>
                  )}
                  <p className="leading-relaxed">{msg.content}</p>
                  <span className="text-[8px] opacity-60 mt-0.5 block">
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                  </span>
                </div>
              </motion.div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-border/50">
          <div className="flex gap-2">
            <input value={msgInput} onChange={e => setMsgInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSend()}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2.5 rounded-xl bg-secondary/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" />
            <button onClick={handleSend} disabled={!msgInput.trim()}
              className="p-2.5 bg-primary text-primary-foreground rounded-xl disabled:opacity-50">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pods List View
  return (
    <div className="space-y-4">
      {/* AI Match CTA */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl p-4 border border-primary/20"
        style={{ background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--primary) / 0.05) 100%)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
            <Brain className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              AI Pod Matching
              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">v4.0</span>
            </h3>
            <p className="text-[10px] text-muted-foreground">Find study partners with similar weak areas</p>
          </div>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={findMatch} disabled={matchLoading}
            className="px-4 py-2 bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-primary/20 disabled:opacity-50">
            {matchLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {matchLoading ? "Matching..." : "Find Pod"}
          </motion.button>
        </div>
      </motion.div>

      {/* Suggested Pods */}
      {suggestedPods.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-primary" /> Recommended for You
          </h3>
          {suggestedPods.map((pod, i) => (
            <motion.div key={pod.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className="glass rounded-xl p-3 neural-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-foreground truncate">{pod.name}</h4>
                  <p className="text-[10px] text-muted-foreground line-clamp-1">{pod.description}</p>
                  <div className="flex items-center gap-2 mt-1 text-[9px] text-muted-foreground">
                    <span className="flex items-center gap-0.5"><Users className="w-2.5 h-2.5" />{pod.member_count}/{pod.max_members}</span>
                    {pod.subject && <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{pod.subject}</span>}
                    {pod.match_score && <span className="text-primary font-bold">{pod.match_score}% match</span>}
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => joinPod(pod.id)}
                  className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-[10px] font-bold">
                  Join
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* My Pods */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Crown className="w-3.5 h-3.5 text-warning" /> My Study Pods
        </h3>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : myPods.length === 0 ? (
          <div className="text-center py-8 rounded-2xl bg-card/50 border border-border/50">
            <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No pods yet. Use AI Match to find your study group!</p>
          </div>
        ) : (
          myPods.map((pod, i) => (
            <motion.div key={pod.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => openPod(pod)}
              className="glass rounded-xl p-3 neural-border cursor-pointer hover:border-primary/30 transition-all">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-accent/10 flex items-center justify-center">
                    <Users className="w-4.5 h-4.5 text-primary" />
                  </div>
                  {pod.is_ai_created && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                      <Brain className="w-2.5 h-2.5 text-primary-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-foreground truncate">{pod.name}</h4>
                  <div className="flex items-center gap-2 text-[9px] text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-0.5"><Users className="w-2.5 h-2.5" />{pod.member_count}</span>
                    {pod.subject && <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{pod.subject}</span>}
                  </div>
                  {pod.last_message && (
                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">
                      {pod.last_message.content}
                    </p>
                  )}
                </div>
                <MessageCircle className="w-4 h-4 text-muted-foreground/50" />
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default StudyPodsSection;
