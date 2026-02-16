import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle, X, Send, Mic, MicOff, Volume2, VolumeX,
  Loader2, Brain, Trash2, ChevronDown, Sparkles
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  voice_used?: boolean;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-support-chat`;

const AIAssistantButton = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [language, setLanguage] = useState<"en" | "hi">("en");

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
    if (data) setMessages(data as Message[]);
    setLoadingHistory(false);
  }, [user]);

  useEffect(() => {
    if (open && messages.length === 0) loadHistory();
  }, [open, loadHistory]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  // Save message to DB
  const saveMessage = async (role: "user" | "assistant", content: string, voiceUsed = false) => {
    if (!user) return;
    const { data } = await supabase.from("ai_chat_messages").insert({
      user_id: user.id,
      role,
      content,
      voice_used: voiceUsed,
      language,
    }).select("id, created_at").single();
    return data;
  };

  // Stream chat
  const sendMessage = async (text: string, isVoice = false) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
      created_at: new Date().toISOString(),
      voice_used: isVoice,
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    // Save user message
    saveMessage("user", text.trim(), isVoice);

    let assistantContent = "";
    const assistantId = crypto.randomUUID();

    // Add placeholder assistant message
    setMessages(prev => [...prev, {
      id: assistantId,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
    }]);

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          message: text.trim(),
          conversationHistory: messages.slice(-20).map(m => ({ role: m.role, content: m.content })),
          language,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `Error ${resp.status}`);
      }

      if (!resp.body) throw new Error("No response body");

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

      // Final buffer flush
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

      // Save assistant response
      if (assistantContent) {
        saveMessage("assistant", assistantContent);
      }

      // Voice output if enabled
      if (voiceEnabled && assistantContent) {
        playVoiceResponse(assistantContent);
      }
    } catch (e: any) {
      console.error("Chat error:", e);
      setMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, content: `⚠️ ${e.message || "Something went wrong. Please try again."}` } : m)
      );
      toast({ title: "AI Error", description: e.message, variant: "destructive" });
    } finally {
      setIsStreaming(false);
    }
  };

  // Voice output via ElevenLabs
  const playVoiceResponse = async (text: string) => {
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-notification`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            type: "test",
            language,
            tone: "calm",
            voiceId: "EXAVITQu4vr4xnSDxMaL", // Sarah - sweet female voice
            context: { customText: text.slice(0, 500) },
          }),
        }
      );

      if (!resp.ok) return;
      const data = await resp.json();
      if (data.audio) {
        const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
        audio.play();
      }
    } catch (e) {
      console.error("Voice playback error:", e);
    }
  };

  // Voice input via MediaRecorder + transcription
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });

        if (blob.size < 1000) {
          toast({ title: "Recording too short", variant: "destructive" });
          return;
        }

        // Transcribe
        const formData = new FormData();
        formData.append("audio", blob, "voice.webm");

        try {
          const resp = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-voice`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: formData,
            }
          );

          if (!resp.ok) throw new Error("Transcription failed");
          const data = await resp.json();
          if (data.transcription) {
            sendMessage(data.transcription, true);
          } else {
            toast({ title: "Couldn't understand audio", variant: "destructive" });
          }
        } catch (e) {
          console.error("Transcription error:", e);
          toast({ title: "Voice transcription failed", variant: "destructive" });
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (e) {
      toast({ title: "Microphone access denied", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const clearHistory = async () => {
    if (!user) return;
    await supabase.from("ai_chat_messages").delete().eq("user_id", user.id);
    setMessages([]);
    toast({ title: "Chat history cleared" });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-[5.5rem] right-4 z-[60] w-16 h-16 rounded-full bg-gradient-to-br from-primary via-primary/90 to-accent text-primary-foreground flex items-center justify-center transition-all duration-300 shadow-[0_0_25px_hsl(var(--primary)/0.4),0_0_50px_hsl(var(--primary)/0.15)]"
          >
            {/* Outer orbital ring */}
            <motion.div
              className="absolute inset-[-4px] rounded-full border-2 border-primary/40"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
            </motion.div>
            {/* Inner pulse ring */}
            <motion.div
              className="absolute inset-0 rounded-full border border-primary/30"
              animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
            />
            {/* Second pulse ring (offset) */}
            <motion.div
              className="absolute inset-0 rounded-full border border-accent/20"
              animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut", delay: 0.5 }}
            />
            {/* Brain icon with glow */}
            <div className="relative z-10">
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              >
                <Brain className="w-7 h-7 drop-shadow-[0_0_6px_hsl(var(--primary))]" />
              </motion.div>
              {/* Online dot */}
              <motion.div
                className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-background"
                animate={{ scale: [1, 1.3, 1], boxShadow: ["0 0 0px #4ade80", "0 0 8px #4ade80", "0 0 0px #4ade80"] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
            </div>
            {/* Sparkle particles */}
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-primary/60"
                style={{ top: "50%", left: "50%" }}
                animate={{
                  x: [0, Math.cos((i * 120 * Math.PI) / 180) * 28],
                  y: [0, Math.sin((i * 120 * Math.PI) / 180) * 28],
                  opacity: [0, 1, 0],
                  scale: [0.5, 1, 0.5],
                }}
                transition={{ repeat: Infinity, duration: 2.5, delay: i * 0.8, ease: "easeOut" }}
              />
            ))}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex flex-col bg-background"
          >
            {/* Header */}
            <header className="glass-strong border-b border-border px-4 py-3 flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 rounded-xl neural-gradient neural-border flex items-center justify-center relative">
                <Brain className="w-5 h-5 text-primary" />
                <motion.div
                  className="absolute inset-0 rounded-xl border border-primary/30"
                  animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ repeat: Infinity, duration: 2.5 }}
                />
              </div>
              <div className="flex-1">
                <h2 className="font-display font-bold text-sm text-foreground">ACRY Brain Assistant</h2>
                <p className="text-[10px] text-primary font-medium">24/7 AI Support • Always Learning</p>
              </div>

              {/* Language toggle */}
              <button
                onClick={() => setLanguage(l => l === "en" ? "hi" : "en")}
                className="px-2 py-1 rounded-lg bg-secondary text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                {language === "en" ? "EN" : "हि"}
              </button>

              {/* Voice output toggle */}
              <button
                onClick={() => setVoiceEnabled(v => !v)}
                className={`p-2 rounded-lg transition-colors ${voiceEnabled ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                title={voiceEnabled ? "Voice output on" : "Voice output off"}
              >
                {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              {/* Clear history */}
              <button
                onClick={clearHistory}
                className="p-2 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                title="Clear chat"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button onClick={() => setOpen(false)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </header>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {loadingHistory ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6 space-y-4">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-20 h-20 rounded-2xl neural-gradient neural-border flex items-center justify-center relative"
                  >
                    <Brain className="w-10 h-10 text-primary" />
                    <motion.div
                      className="absolute inset-0 rounded-2xl"
                      style={{ border: "1px solid hsl(175 80% 50% / 0.3)" }}
                      animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ repeat: Infinity, duration: 3 }}
                    />
                  </motion.div>
                  <h3 className="text-lg font-bold text-foreground">Hey! I'm ACRY 🧠</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Your personal AI brain assistant. I know your study data, memory patterns, and exam progress. Ask me anything!
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 mt-2">
                    {[
                      "What should I study now?",
                      "Why is my memory risk high?",
                      "How can I improve my rank?",
                      "Help me fix weak topics",
                    ].map((q) => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        className="px-3 py-1.5 rounded-full glass neural-border text-xs text-foreground hover:bg-primary/10 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "glass neural-border rounded-bl-md"
                    }`}>
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm prose-invert max-w-none text-sm text-foreground [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:mb-0.5 [&_strong]:text-primary [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_code]:text-primary/80 [&_code]:bg-secondary/50 [&_code]:px-1 [&_code]:rounded">
                          {msg.content ? (
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          ) : (
                            <motion.div className="flex items-center gap-1.5">
                              <Sparkles className="w-3 h-3 text-primary animate-pulse" />
                              <span className="text-xs text-muted-foreground">Thinking...</span>
                            </motion.div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm">{msg.content}</p>
                      )}
                      {msg.voice_used && (
                        <span className="text-[9px] opacity-60 mt-1 block">🎤 Voice</span>
                      )}
                    </div>
                  </motion.div>
                ))
              )}

              {/* Streaming indicator */}
              {isStreaming && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <motion.div
                      className="flex gap-1"
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    </motion.div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="glass-strong border-t border-border px-4 py-3 shrink-0 safe-area-bottom">
              <div className="flex items-end gap-2">
                {/* Voice input */}
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isStreaming}
                  className={`p-3 rounded-xl shrink-0 transition-all ${
                    isRecording
                      ? "bg-destructive text-destructive-foreground animate-pulse"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  } disabled:opacity-50`}
                >
                  {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                {/* Text input */}
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isRecording ? "🎤 Listening..." : "Ask ACRY anything..."}
                    disabled={isRecording || isStreaming}
                    rows={1}
                    className="w-full px-4 py-3 bg-secondary rounded-xl text-sm text-foreground placeholder:text-muted-foreground border border-border focus:border-primary outline-none resize-none max-h-32 disabled:opacity-50"
                    style={{ minHeight: "44px" }}
                  />
                </div>

                {/* Send */}
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isStreaming || isRecording}
                  className="p-3 rounded-xl bg-primary text-primary-foreground shrink-0 disabled:opacity-50 hover:bg-primary/90 transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>

              {isRecording && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center gap-2 mt-2"
                >
                  <motion.div
                    className="flex gap-[3px] items-end h-5"
                  >
                    {[0, 1, 2, 3, 4].map(i => (
                      <motion.div
                        key={i}
                        className="w-[3px] rounded-full bg-destructive"
                        animate={{ height: [4, 12 + Math.random() * 8, 6, 16, 4] }}
                        transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.08 }}
                      />
                    ))}
                  </motion.div>
                  <span className="text-[11px] text-destructive font-medium">Recording... tap mic to stop</span>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AIAssistantButton;
