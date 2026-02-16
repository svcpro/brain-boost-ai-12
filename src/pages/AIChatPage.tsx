import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Send, Mic, MicOff, Volume2, VolumeX,
  Loader2, Brain, Trash2, Sparkles, TrendingUp,
  BookOpen, Target, Zap, AlertTriangle, BarChart3,
  Clock, Copy, Check, RefreshCw, ChevronDown, Search, X,
  Bookmark, BookmarkCheck, Filter, Download, Share2, Mail,
  Square, CornerDownLeft, Pencil, Heart, ThumbsUp, ThumbsDown,
  Smile, Reply, MoreHorizontal, CheckCheck, Eye
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  voice_used?: boolean;
  bookmarked?: boolean;
  reactions?: string[];
  status?: "sending" | "sent" | "delivered" | "seen";
  replyTo?: string;
  edited?: boolean;
}

interface QuickAction {
  icon: React.ReactNode;
  label: string;
  prompt: string;
  color: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-support-chat`;

const QUICK_ACTIONS: QuickAction[] = [
  { icon: <Brain className="w-4 h-4" />, label: "Brain Health", prompt: "Analyze my complete brain health status. What topics are at risk and what's my overall cognitive state?", color: "from-primary/20 to-primary/5 border-primary/30 text-primary" },
  { icon: <TrendingUp className="w-4 h-4" />, label: "Rank Trend", prompt: "What's my rank prediction trend? Am I improving or declining and what specific actions will improve my rank fastest?", color: "from-accent/20 to-accent/5 border-accent/30 text-accent" },
  { icon: <Target className="w-4 h-4" />, label: "Study Plan", prompt: "Create an optimal study plan for today based on my weakest topics, memory decay predictions, and exam deadline.", color: "from-green-500/20 to-green-500/5 border-green-500/30 text-green-500" },
  { icon: <AlertTriangle className="w-4 h-4" />, label: "Forget Risk", prompt: "Which topics am I about to forget? Show me the most urgent ones that need revision right now with exact memory percentages.", color: "from-orange-500/20 to-orange-500/5 border-orange-500/30 text-orange-500" },
  { icon: <Zap className="w-4 h-4" />, label: "Quick Boost", prompt: "Give me a 15-minute power study session targeting my weakest topic. Include specific focus areas and technique recommendations.", color: "from-yellow-500/20 to-yellow-500/5 border-yellow-500/30 text-yellow-500" },
  { icon: <BarChart3 className="w-4 h-4" />, label: "Performance", prompt: "Analyze my exam performance trends. Where am I improving and what patterns do you see in my mistakes?", color: "from-blue-500/20 to-blue-500/5 border-blue-500/30 text-blue-500" },
];

const EMOJI_REACTIONS = ["👍", "❤️", "😂", "😮", "🔥", "💯"];

const SMART_SUGGESTIONS_MAP: Record<string, string[]> = {
  "brain": ["What's my brain health?", "Brain evolution score?", "Cognitive twin analysis"],
  "study": ["Create a study plan", "Best study time today?", "Study consistency check"],
  "exam": ["Am I exam ready?", "Predict my exam score", "Weak topics for exam"],
  "rank": ["Rank prediction update", "How to improve rank?", "Rank vs last week"],
  "forget": ["Topics about to forget", "Memory decay report", "Revision priority list"],
  "weak": ["My weakest topics", "How to fix weak areas?", "Weak topic deep dive"],
  "help": ["How does ACRY work?", "What can you analyze?", "Show my data summary"],
  "plan": ["Today's optimal plan", "Weekly study plan", "Exam countdown plan"],
};

const AIChatPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [showReactionsFor, setShowReactionsFor] = useState<string | null>(null);
  const [activeContextMenu, setActiveContextMenu] = useState<string | null>(null);
  const [typingStatus, setTypingStatus] = useState<"idle" | "thinking" | "typing">("idle");
  const [streamStartTime, setStreamStartTime] = useState<number | null>(null);
  const [smartSuggestions, setSmartSuggestions] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Load chat history
  const loadHistory = useCallback(async () => {
    if (!user) return;
    setLoadingHistory(true);
    const { data } = await supabase
      .from("ai_chat_messages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(100);
    if (data) setMessages(data.map((m: any) => ({ ...m, status: "seen" as const })) as Message[]);
    setLoadingHistory(false);
  }, [user]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
      if (isNearBottom) el.scrollTop = el.scrollHeight;
    }
  }, [messages, isStreaming]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 200);
  };

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  };

  // Smart suggestions based on input
  useEffect(() => {
    if (!input.trim()) { setSmartSuggestions([]); return; }
    const lower = input.toLowerCase();
    const matched: string[] = [];
    for (const [key, suggestions] of Object.entries(SMART_SUGGESTIONS_MAP)) {
      if (lower.includes(key)) matched.push(...suggestions);
    }
    setSmartSuggestions(matched.slice(0, 4));
  }, [input]);

  const saveMessage = async (role: "user" | "assistant", content: string, voiceUsed = false) => {
    if (!user) return;
    await supabase.from("ai_chat_messages").insert({
      user_id: user.id, role, content, voice_used: voiceUsed, language,
    });
  };

  const copyMessage = async (id: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleBookmark = async (msgId: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;
    const newVal = !msg.bookmarked;
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, bookmarked: newVal } : m));
    await supabase.from("ai_chat_messages").update({ bookmarked: newVal } as any).eq("id", msgId);
    toast({ title: newVal ? "Bookmarked ⭐" : "Bookmark removed" });
  };

  const addReaction = (msgId: string, emoji: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const reactions = m.reactions || [];
      if (reactions.includes(emoji)) return { ...m, reactions: reactions.filter(r => r !== emoji) };
      return { ...m, reactions: [...reactions, emoji] };
    }));
    setShowReactionsFor(null);
  };

  // Stop streaming
  const stopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setTypingStatus("idle");
  };

  // Regenerate response
  const regenerateResponse = async (msgId: string) => {
    const msgIndex = messages.findIndex(m => m.id === msgId);
    if (msgIndex < 1) return;
    // Find the user message before this assistant message
    let userMsgIndex = msgIndex - 1;
    while (userMsgIndex >= 0 && messages[userMsgIndex].role !== "user") userMsgIndex--;
    if (userMsgIndex < 0) return;
    const userMsg = messages[userMsgIndex];
    // Remove the old assistant response
    setMessages(prev => prev.filter(m => m.id !== msgId));
    // Re-send
    await sendMessage(userMsg.content, false, true);
  };

  // Edit message
  const startEdit = (msg: Message) => {
    setEditingMsg(msg);
    setInput(msg.content);
    inputRef.current?.focus();
  };

  const cancelEdit = () => {
    setEditingMsg(null);
    setInput("");
  };

  const displayMessages = showBookmarksOnly ? messages.filter(m => m.bookmarked) : messages;
  const bookmarkCount = messages.filter(m => m.bookmarked).length;

  const exportBookmarks = (format: "txt" | "pdf") => {
    const bookmarked = messages.filter(m => m.bookmarked);
    if (bookmarked.length === 0) {
      toast({ title: "No bookmarks to export", variant: "destructive" });
      return;
    }
    const formatDate = (d: string) => new Date(d).toLocaleString();

    if (format === "txt") {
      const text = [
        "═══════════════════════════════════",
        "  ACRY Intelligence — Bookmarked Responses",
        `  Exported: ${new Date().toLocaleString()}`,
        "═══════════════════════════════════\n",
        ...bookmarked.map((m, i) => [
          `── ${i + 1}. ${m.role === "user" ? "You" : "ACRY"} (${formatDate(m.created_at)}) ──`,
          m.content, "",
        ].join("\n")),
      ].join("\n");
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `acry-bookmarks-${new Date().toISOString().slice(0, 10)}.txt`; a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Exported as TXT ✅" });
    } else {
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ACRY Bookmarks</title>
        <style>body{font-family:-apple-system,sans-serif;max-width:700px;margin:0 auto;padding:40px 20px;color:#1a1a2e}h1{font-size:20px;color:#6c47ff;border-bottom:2px solid #6c47ff;padding-bottom:8px}.msg{margin-bottom:24px;page-break-inside:avoid}.msg-header{font-size:11px;font-weight:600;color:#6c47ff;margin-bottom:4px}.msg-content{font-size:13px;line-height:1.7;white-space:pre-wrap;background:#f8f8fc;padding:12px 16px;border-radius:8px;border-left:3px solid #6c47ff}</style></head><body>
        <h1>⭐ ACRY Bookmarked Responses</h1>
        <p style="font-size:11px;color:#888">Exported on ${new Date().toLocaleString()}</p>
        ${bookmarked.map((m, i) => `<div class="msg"><div class="msg-header">${m.role === "user" ? "📝 You" : "🧠 ACRY"} — ${formatDate(m.created_at)}</div><div class="msg-content">${m.content.replace(/</g, "&lt;")}</div></div>`).join("")}
        </body></html>`;
      const printWindow = window.open("", "_blank");
      if (printWindow) { printWindow.document.write(html); printWindow.document.close(); setTimeout(() => printWindow.print(), 500); }
    }
  };

  // Stream chat
  const sendMessage = async (text: string, isVoice = false, isRegenerate = false) => {
    if (!text.trim() || isStreaming) return;

    // If editing, update the message
    if (editingMsg && !isRegenerate) {
      setMessages(prev => prev.map(m => m.id === editingMsg.id ? { ...m, content: text.trim(), edited: true } : m));
      // Remove all assistant messages after the edited message
      const editIndex = messages.findIndex(m => m.id === editingMsg.id);
      if (editIndex >= 0) {
        const toRemove = messages.slice(editIndex + 1).filter(m => m.role === "assistant").map(m => m.id);
        setMessages(prev => prev.filter(m => !toRemove.includes(m.id)));
      }
      setEditingMsg(null);
      // Re-send as new query
    }

    const userMsg: Message = {
      id: crypto.randomUUID(), role: "user", content: text.trim(),
      created_at: new Date().toISOString(), voice_used: isVoice,
      status: "sending", replyTo: replyTo?.id,
    };

    if (!isRegenerate) {
      setMessages(prev => [...prev, userMsg]);
      setInput("");
      setReplyTo(null);
      saveMessage("user", text.trim(), isVoice);
    }

    // Optimistic: mark as sent
    setTimeout(() => {
      setMessages(prev => prev.map(m => m.id === userMsg.id ? { ...m, status: "sent" } : m));
    }, 200);
    setTimeout(() => {
      setMessages(prev => prev.map(m => m.id === userMsg.id ? { ...m, status: "delivered" } : m));
    }, 600);

    setIsStreaming(true);
    setTypingStatus("thinking");
    setStreamStartTime(Date.now());

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let assistantContent = "";
    const assistantId = crypto.randomUUID();

    setMessages(prev => [...prev, {
      id: assistantId, role: "assistant", content: "",
      created_at: new Date().toISOString(),
    }]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Please log in to use the AI assistant");

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          message: text.trim(),
          conversationHistory: messages.slice(-20).map(m => ({ role: m.role, content: m.content })),
          language,
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        if (resp.status === 429) throw new Error("Rate limited — please wait a moment and try again.");
        if (resp.status === 402) throw new Error("AI credits exhausted. Please add credits to continue.");
        throw new Error(err.error || `Error ${resp.status}`);
      }

      if (!resp.body) throw new Error("No response body");

      setTypingStatus("typing");

      // Mark user msg as seen
      setMessages(prev => prev.map(m => m.id === userMsg.id ? { ...m, status: "seen" } : m));

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || !line.trim()) continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev =>
                prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m)
              );
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Final flush
      if (buffer.trim()) {
        for (let raw of buffer.split("\n")) {
          if (!raw || !raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev =>
                prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m)
              );
            }
          } catch { /* ignore */ }
        }
      }

      if (assistantContent) saveMessage("assistant", assistantContent);
      if (voiceEnabled && assistantContent) playVoiceResponse(assistantContent);
    } catch (e: any) {
      if (e.name === "AbortError") {
        // User stopped — keep partial content
        if (assistantContent) {
          setMessages(prev =>
            prev.map(m => m.id === assistantId ? { ...m, content: assistantContent + "\n\n⏹️ *Stopped by user*" } : m)
          );
          saveMessage("assistant", assistantContent);
        } else {
          setMessages(prev => prev.filter(m => m.id !== assistantId));
        }
      } else {
        console.error("Chat error:", e);
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, content: `⚠️ ${e.message || "Something went wrong."}` } : m)
        );
        toast({ title: "AI Error", description: e.message, variant: "destructive" });
      }
    } finally {
      setIsStreaming(false);
      setTypingStatus("idle");
      setStreamStartTime(null);
      abortControllerRef.current = null;
    }
  };

  const playVoiceResponse = async (text: string) => {
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-notification`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({ type: "test", language, tone: "calm", voiceId: "EXAVITQu4vr4xnSDxMaL", context: { customText: text.slice(0, 500) } }),
        }
      );
      if (!resp.ok) return;
      const data = await resp.json();
      if (data.audio) { const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`); audio.play(); }
    } catch (e) { console.error("Voice error:", e); }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size < 1000) { toast({ title: "Recording too short", variant: "destructive" }); return; }
        const formData = new FormData();
        formData.append("audio", blob, "voice.webm");
        try {
          const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-voice`, {
            method: "POST",
            headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
            body: formData,
          });
          if (!resp.ok) throw new Error("Transcription failed");
          const data = await resp.json();
          if (data.transcription) sendMessage(data.transcription, true);
          else toast({ title: "Couldn't understand audio", variant: "destructive" });
        } catch { toast({ title: "Voice transcription failed", variant: "destructive" }); }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch { toast({ title: "Microphone access denied", variant: "destructive" }); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const clearHistory = async () => {
    if (!user) return;
    await supabase.from("ai_chat_messages").delete().eq("user_id", user.id);
    setMessages([]);
    toast({ title: "Chat history cleared" });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
    if (e.key === "Escape" && editingMsg) cancelEdit();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const searchResults = searchQuery.trim()
    ? messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const jumpToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleSearchNav = (dir: 1 | -1) => {
    if (searchResults.length === 0) return;
    const next = (searchIndex + dir + searchResults.length) % searchResults.length;
    setSearchIndex(next);
    jumpToMessage(searchResults[next].id);
  };

  useEffect(() => {
    if (searchOpen && searchInputRef.current) searchInputRef.current.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (searchResults.length > 0) { setSearchIndex(0); jumpToMessage(searchResults[0].id); }
  }, [searchQuery]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Response time tracker
  const [responseTime, setResponseTime] = useState<number | null>(null);
  useEffect(() => {
    if (streamStartTime && isStreaming) {
      const interval = setInterval(() => setResponseTime(Math.round((Date.now() - streamStartTime) / 100) / 10), 100);
      return () => clearInterval(interval);
    } else {
      setResponseTime(null);
    }
  }, [streamStartTime, isStreaming]);

  // Context-aware follow-ups
  const getContextualFollowUps = useMemo(() => {
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "assistant" || !lastMsg.content) return [];
    const content = lastMsg.content.toLowerCase();
    const suggestions: string[] = [];

    if (content.includes("memory") || content.includes("forget")) suggestions.push("Show revision schedule", "Which topics first?");
    if (content.includes("rank") || content.includes("percentile")) suggestions.push("How to improve by 10 ranks?", "Compare with toppers");
    if (content.includes("study plan") || content.includes("schedule")) suggestions.push("Adjust for less time", "Add more breaks");
    if (content.includes("burnout") || content.includes("fatigue")) suggestions.push("Suggest recovery routine", "Shorter session plan");
    if (content.includes("exam") || content.includes("score")) suggestions.push("Mock test strategy", "Last-minute revision tips");

    if (suggestions.length < 3) suggestions.push("Give me more detail", "What should I do next?", "Create action items");
    return suggestions.slice(0, 4);
  }, [messages]);

  const getReplyPreview = (id: string) => {
    const msg = messages.find(m => m.id === id);
    if (!msg) return null;
    return msg.content.slice(0, 60) + (msg.content.length > 60 ? "..." : "");
  };

  // Status icon for messages
  const StatusIcon = ({ status }: { status?: string }) => {
    switch (status) {
      case "sending": return <Clock className="w-2.5 h-2.5 text-muted-foreground" />;
      case "sent": return <Check className="w-2.5 h-2.5 text-muted-foreground" />;
      case "delivered": return <CheckCheck className="w-2.5 h-2.5 text-muted-foreground" />;
      case "seen": return <CheckCheck className="w-2.5 h-2.5 text-primary" />;
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur-xl px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-secondary transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>

        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center relative">
          <Brain className="w-5 h-5 text-primary-foreground" />
          <motion.div
            className="absolute inset-0 rounded-xl border border-primary/40"
            animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ repeat: Infinity, duration: 2.5 }}
          />
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background" />
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-sm text-foreground truncate">ACRY Intelligence</h2>
          <div className="flex items-center gap-1.5">
            {typingStatus === "thinking" ? (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] text-primary font-medium">
                🧠 Analyzing your data...
              </motion.p>
            ) : typingStatus === "typing" ? (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] text-success font-medium">
                ✍️ Typing... {responseTime && `(${responseTime}s)`}
              </motion.p>
            ) : (
              <>
                <motion.div className="w-1.5 h-1.5 rounded-full bg-green-500" animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 2 }} />
                <p className="text-[10px] text-muted-foreground">Online • Ultra-Fast AI</p>
              </>
            )}
          </div>
        </div>

        {/* Controls */}
        <button onClick={() => setLanguage(l => l === "en" ? "hi" : "en")} className="px-2 py-1 rounded-lg bg-secondary text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors">
          {language === "en" ? "EN" : "हि"}
        </button>
        <button onClick={() => setVoiceEnabled(v => !v)} className={`p-2 rounded-lg transition-colors ${voiceEnabled ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
          {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
        <button onClick={clearHistory} className="p-2 rounded-lg text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
        <button onClick={() => setShowBookmarksOnly(b => !b)} className={`p-2 rounded-lg transition-colors relative ${showBookmarksOnly ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
          {showBookmarksOnly ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          {bookmarkCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-primary text-primary-foreground text-[8px] font-bold flex items-center justify-center">{bookmarkCount}</span>
          )}
        </button>
        <button onClick={() => { setSearchOpen(o => !o); setSearchQuery(""); }} className={`p-2 rounded-lg transition-colors ${searchOpen ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
          <Search className="w-4 h-4" />
        </button>
      </header>

      {/* Search Bar */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="border-b border-border bg-secondary/50 backdrop-blur-xl px-4 py-2 shrink-0 overflow-hidden">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input ref={searchInputRef} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search messages..." className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
              {searchQuery && (
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {searchResults.length > 0 ? `${searchIndex + 1}/${searchResults.length}` : "No results"}
                </span>
              )}
              {searchResults.length > 1 && (
                <div className="flex gap-0.5">
                  <button onClick={() => handleSearchNav(-1)} className="p-1 rounded hover:bg-secondary text-muted-foreground"><ChevronDown className="w-3.5 h-3.5 rotate-180" /></button>
                  <button onClick={() => handleSearchNav(1)} className="p-1 rounded hover:bg-secondary text-muted-foreground"><ChevronDown className="w-3.5 h-3.5" /></button>
                </div>
              )}
              <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="p-1 rounded hover:bg-secondary text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loadingHistory ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Loading your conversation...</p>
          </div>
        ) : showBookmarksOnly && displayMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Bookmark className="w-10 h-10 text-muted-foreground/40" />
            <h3 className="text-sm font-semibold text-foreground">No bookmarks yet</h3>
            <p className="text-xs text-muted-foreground max-w-xs">Tap the bookmark icon on any AI response to save it.</p>
            <button onClick={() => setShowBookmarksOnly(false)} className="text-xs text-primary font-medium mt-2">← Back to all messages</button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center pt-8 pb-4 px-2">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary via-accent to-primary flex items-center justify-center relative mb-5">
              <Brain className="w-12 h-12 text-primary-foreground" />
              <motion.div className="absolute inset-0 rounded-3xl border-2 border-primary/30" animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }} transition={{ repeat: Infinity, duration: 3 }} />
              <motion.div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-green-500 border-3 border-background flex items-center justify-center" animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                <Sparkles className="w-3 h-3 text-white" />
              </motion.div>
            </motion.div>

            <motion.h3 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-xl font-bold text-foreground mb-1">
              ACRY Intelligence 🧠
            </motion.h3>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
              className="text-[10px] text-success font-semibold mb-3">⚡ Ultra-Fast • Gemini 3 Flash • Real-Time Analysis</motion.p>
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="text-sm text-muted-foreground text-center max-w-xs mb-6">
              I analyze your real cognitive data, memory trends, and exam patterns to give you personalized AI-powered guidance.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="grid grid-cols-2 gap-2.5 w-full max-w-sm mb-4">
              {QUICK_ACTIONS.map((action, i) => (
                <motion.button key={action.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05 }}
                  onClick={() => sendMessage(action.prompt)}
                  className={`flex items-center gap-2.5 px-3 py-3 rounded-xl bg-gradient-to-br ${action.color} border text-left hover:scale-[1.02] active:scale-[0.98] transition-transform`}>
                  {action.icon}
                  <span className="text-xs font-semibold">{action.label}</span>
                </motion.button>
              ))}
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="w-full max-w-sm">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                <TrendingUp className="w-3 h-3 inline mr-1" />Trending Questions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["Am I on track for my exam?", "What's causing my rank drop?", "Burnout risk analysis", "Best study time for me", "Weekly progress summary"].map(q => (
                  <button key={q} onClick={() => sendMessage(q)} className="px-3 py-1.5 rounded-full bg-secondary/80 border border-border text-[11px] text-foreground hover:bg-secondary transition-colors">{q}</button>
                ))}
              </div>
            </motion.div>
          </div>
        ) : (
          <>
            {/* Bookmarks export banner */}
            {showBookmarksOnly && displayMessages.length > 0 && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 mb-2">
                <div className="flex items-center gap-2">
                  <BookmarkCheck className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-foreground">{displayMessages.length} bookmarked</span>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <button onClick={() => exportBookmarks("txt")} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary border border-border text-[10px] font-semibold text-foreground hover:bg-secondary/80 transition-colors">
                    <Download className="w-3 h-3" /> TXT
                  </button>
                  <button onClick={() => exportBookmarks("pdf")} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary border border-border text-[10px] font-semibold text-foreground hover:bg-secondary/80 transition-colors">
                    <Download className="w-3 h-3" /> PDF
                  </button>
                  <button onClick={() => {
                    const bookmarked = messages.filter(m => m.bookmarked);
                    const text = bookmarked.map((m, i) => `${i + 1}. [${m.role === "user" ? "You" : "ACRY"}] ${m.content}`).join("\n\n");
                    window.open(`https://wa.me/?text=${encodeURIComponent(`⭐ My ACRY Bookmarks:\n\n${text}`)}`, "_blank");
                  }} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent text-accent-foreground text-[10px] font-semibold hover:bg-accent/80 transition-colors">
                    <Share2 className="w-3 h-3" /> WhatsApp
                  </button>
                  <button onClick={() => {
                    const bookmarked = messages.filter(m => m.bookmarked);
                    const body = bookmarked.map((m, i) => `${i + 1}. [${m.role === "user" ? "You" : "ACRY"}] ${m.content}`).join("\n\n");
                    window.open(`mailto:?subject=${encodeURIComponent("My ACRY Bookmarked Responses")}&body=${encodeURIComponent(body)}`, "_self");
                  }} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-[10px] font-semibold hover:bg-primary/90 transition-colors">
                    <Mail className="w-3 h-3" /> Email
                  </button>
                </div>
              </motion.div>
            )}

            {displayMessages.map((msg) => (
              <motion.div
                id={`msg-${msg.id}`}
                key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} group relative ${searchQuery && searchResults.length > 0 && searchResults[searchIndex]?.id === msg.id ? "ring-2 ring-primary/50 rounded-2xl" : ""}`}
              >
                <div className={`max-w-[88%] ${msg.role === "assistant" ? "flex gap-2" : ""}`}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 mt-1">
                      <Brain className="w-3.5 h-3.5 text-primary-foreground" />
                    </div>
                  )}

                  <div>
                    {/* Reply preview */}
                    {msg.replyTo && (
                      <div className="ml-1 mb-1 px-3 py-1.5 rounded-lg bg-secondary/40 border-l-2 border-primary/40 cursor-pointer"
                        onClick={() => jumpToMessage(msg.replyTo!)}>
                        <p className="text-[9px] text-primary font-semibold">↩ Reply</p>
                        <p className="text-[10px] text-muted-foreground truncate">{getReplyPreview(msg.replyTo)}</p>
                      </div>
                    )}

                    <div className={`rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-secondary/60 border border-border rounded-bl-md"
                    }`}>
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none text-sm text-foreground [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:mb-0.5 [&_strong]:text-primary [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_code]:text-primary/80 [&_code]:bg-primary/10 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-secondary [&_pre]:p-3 [&_pre]:rounded-lg [&_blockquote]:border-primary/30 [&_blockquote]:text-muted-foreground">
                          {msg.content ? <ReactMarkdown>{msg.content}</ReactMarkdown> : (
                            <motion.div className="flex items-center gap-2">
                              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                                <Sparkles className="w-3.5 h-3.5 text-primary" />
                              </motion.div>
                              <span className="text-xs text-muted-foreground">Analyzing your data...</span>
                            </motion.div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>

                    {/* Reactions display */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="flex gap-1 mt-1 ml-1">
                        {msg.reactions.map(r => (
                          <span key={r} onClick={() => addReaction(msg.id, r)}
                            className="px-1.5 py-0.5 rounded-full bg-secondary/80 border border-border text-[11px] cursor-pointer hover:scale-110 transition-transform">{r}</span>
                        ))}
                      </div>
                    )}

                    {/* Message meta */}
                    <div className={`flex items-center gap-1.5 mt-1 px-1 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <span className="text-[9px] text-muted-foreground">{formatTime(msg.created_at)}</span>
                      {msg.edited && <span className="text-[9px] text-muted-foreground italic">edited</span>}
                      {msg.voice_used && <span className="text-[9px] text-muted-foreground">🎤</span>}
                      {msg.role === "user" && <StatusIcon status={msg.status} />}

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Reaction button */}
                        <button onClick={() => setShowReactionsFor(showReactionsFor === msg.id ? null : msg.id)}
                          className="p-0.5 rounded hover:bg-secondary/50"><Smile className="w-3 h-3 text-muted-foreground" /></button>

                        {/* Reply */}
                        <button onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }}
                          className="p-0.5 rounded hover:bg-secondary/50"><Reply className="w-3 h-3 text-muted-foreground" /></button>

                        {msg.role === "assistant" && msg.content && (
                          <>
                            <button onClick={() => toggleBookmark(msg.id)} className="p-0.5 rounded hover:bg-secondary/50">
                              {msg.bookmarked ? <BookmarkCheck className="w-3 h-3 text-primary" /> : <Bookmark className="w-3 h-3 text-muted-foreground" />}
                            </button>
                            <button onClick={() => copyMessage(msg.id, msg.content)} className="p-0.5 rounded hover:bg-secondary/50">
                              {copiedId === msg.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                            </button>
                            <button onClick={() => regenerateResponse(msg.id)} className="p-0.5 rounded hover:bg-secondary/50" title="Regenerate">
                              <RefreshCw className="w-3 h-3 text-muted-foreground" />
                            </button>
                          </>
                        )}

                        {msg.role === "user" && (
                          <button onClick={() => startEdit(msg)} className="p-0.5 rounded hover:bg-secondary/50" title="Edit message">
                            <Pencil className="w-3 h-3 text-muted-foreground" />
                          </button>
                        )}
                      </div>

                      {msg.bookmarked && <span className="text-[9px] text-primary">⭐</span>}
                    </div>

                    {/* Emoji reaction picker */}
                    <AnimatePresence>
                      {showReactionsFor === msg.id && (
                        <motion.div initial={{ opacity: 0, scale: 0.8, y: 5 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8 }}
                          className="flex gap-1 mt-1 ml-1 p-1.5 rounded-xl bg-secondary border border-border shadow-lg">
                          {EMOJI_REACTIONS.map(emoji => (
                            <button key={emoji} onClick={() => addReaction(msg.id, emoji)}
                              className="text-sm hover:scale-125 transition-transform p-1">{emoji}</button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Streaming with stop button */}
            {isStreaming && (
              <div className="flex justify-start pl-9">
                <div className="flex flex-col items-start gap-2">
                  <motion.div className="flex items-center gap-2 px-3 py-2" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-primary"
                          animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }} />
                      ))}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {typingStatus === "thinking" ? "ACRY is analyzing..." : "ACRY is typing..."}
                    </span>
                    {responseTime && <span className="text-[9px] text-muted-foreground/60">{responseTime}s</span>}
                  </motion.div>
                  <button onClick={stopStreaming}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-[11px] font-medium hover:bg-destructive/20 transition-colors">
                    <Square className="w-3 h-3" /> Stop generating
                  </button>
                </div>
              </div>
            )}

            {/* Context-aware follow-up suggestions */}
            {!isStreaming && messages.length > 0 && messages[messages.length - 1]?.role === "assistant" && messages[messages.length - 1]?.content && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="flex flex-wrap gap-1.5 pl-9">
                {getContextualFollowUps.map(s => (
                  <button key={s} onClick={() => sendMessage(s)}
                    className="px-3 py-1.5 rounded-full bg-secondary/60 border border-border text-[11px] text-foreground hover:bg-secondary hover:border-primary/30 transition-colors">{s}</button>
                ))}
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Scroll to bottom */}
      <AnimatePresence>
        {showScrollBtn && (
          <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToBottom}
            className="absolute bottom-32 left-1/2 -translate-x-1/2 z-10 w-8 h-8 rounded-full bg-secondary border border-border shadow-lg flex items-center justify-center">
            <ChevronDown className="w-4 h-4 text-foreground" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Smart suggestions overlay */}
      <AnimatePresence>
        {smartSuggestions.length > 0 && !isStreaming && input.trim() && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-[76px] left-4 right-4 z-10">
            <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-secondary/95 backdrop-blur-lg border border-border shadow-xl">
              <p className="w-full text-[9px] text-muted-foreground font-semibold uppercase tracking-wider px-1 mb-0.5">
                <Sparkles className="w-3 h-3 inline mr-1" />Smart Suggestions
              </p>
              {smartSuggestions.map(s => (
                <button key={s} onClick={() => { setInput(s); setSmartSuggestions([]); }}
                  className="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-[11px] text-foreground hover:bg-primary/20 transition-colors">{s}</button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reply/Edit banner */}
      <AnimatePresence>
        {(replyTo || editingMsg) && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="border-t border-border bg-secondary/50 px-4 py-2 shrink-0 overflow-hidden">
            <div className="flex items-center gap-2">
              <div className="w-1 h-8 rounded-full bg-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-primary font-semibold">
                  {editingMsg ? "✏️ Editing message" : `↩ Replying to ${replyTo?.role === "user" ? "yourself" : "ACRY"}`}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {(editingMsg || replyTo)?.content.slice(0, 80)}
                </p>
              </div>
              <button onClick={() => { setReplyTo(null); cancelEdit(); }} className="p-1 rounded hover:bg-secondary"><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="border-t border-border bg-background/95 backdrop-blur-xl px-4 py-3 shrink-0 safe-area-bottom">
        <div className="flex items-end gap-2">
          <button onClick={isRecording ? stopRecording : startRecording} disabled={isStreaming}
            className={`p-3 rounded-xl shrink-0 transition-all ${isRecording ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-secondary text-muted-foreground hover:text-foreground"} disabled:opacity-50`}>
            {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <div className="flex-1 relative">
            <textarea ref={inputRef} value={input} onChange={handleInputChange} onKeyDown={handleKeyDown}
              placeholder={isRecording ? "🎤 Listening..." : editingMsg ? "Edit your message..." : "Ask ACRY anything..."}
              disabled={isRecording || isStreaming} rows={1}
              className="w-full px-4 py-3 bg-secondary rounded-xl text-sm text-foreground placeholder:text-muted-foreground border border-border focus:border-primary outline-none resize-none max-h-[120px] disabled:opacity-50"
              style={{ minHeight: "44px" }} />
          </div>

          <button onClick={() => sendMessage(input)} disabled={!input.trim() || isStreaming || isRecording}
            className="p-3 rounded-xl bg-primary text-primary-foreground shrink-0 disabled:opacity-50 hover:bg-primary/90 transition-colors active:scale-95">
            {editingMsg ? <Check className="w-5 h-5" /> : <Send className="w-5 h-5" />}
          </button>
        </div>

        {isRecording && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-2 mt-2">
            <motion.div className="flex gap-[3px] items-end h-5">
              {[0, 1, 2, 3, 4].map(i => (
                <motion.div key={i} className="w-[3px] rounded-full bg-destructive"
                  animate={{ height: [4, 12 + Math.random() * 8, 6, 16, 4] }}
                  transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.08 }} />
              ))}
            </motion.div>
            <span className="text-[11px] text-destructive font-medium">Recording... tap mic to stop</span>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default AIChatPage;
