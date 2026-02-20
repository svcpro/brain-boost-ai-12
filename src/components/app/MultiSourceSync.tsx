import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { FileText, Camera, Mic, X, Upload, CheckCircle2 } from "lucide-react";
import AIProgressBar from "./AIProgressBar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface MultiSourceSyncProps {
  onClose: () => void;
  onSynced?: () => void;
}

const MultiSourceSync = ({ onClose, onSynced }: MultiSourceSyncProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ subjects: string[]; topics: string[] } | null>(null);
  const [activeSource, setActiveSource] = useState<"pdf" | "image" | "voice" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  const handlePDF = async (file: File) => {
    if (!user) return;
    setLoading(true);
    setActiveSource("pdf");
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      // Chunk encode to base64
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) {
        const chunk = bytes.subarray(i, Math.min(i + 8192, bytes.length));
        for (let j = 0; j < chunk.length; j++) binary += String.fromCharCode(chunk[j]);
      }
      const base64 = btoa(binary);

      const { data, error } = await supabase.functions.invoke("extract-pdf-topics", {
        body: { pdfBase64: base64 },
      });
      if (error) throw error;
      setResult({ subjects: data?.subjects || [], topics: data?.topics || [] });
      toast({ title: "PDF Synced ✅", description: `Found ${data?.topics?.length || 0} topics` });
      onSynced?.();
    } catch (e: any) {
      toast({ title: "PDF sync failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleImage = async (file: File) => {
    if (!user) return;
    setLoading(true);
    setActiveSource("image");
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) {
        const chunk = bytes.subarray(i, Math.min(i + 8192, bytes.length));
        for (let j = 0; j < chunk.length; j++) binary += String.fromCharCode(chunk[j]);
      }
      const base64 = btoa(binary);

      const { data, error } = await supabase.functions.invoke("extract-image-topics", {
        body: { imageBase64: base64, mimeType: file.type },
      });
      if (error) throw error;
      setResult({ subjects: data?.subjects || [], topics: data?.topics || [] });
      toast({ title: "Image Synced ✅", description: `Found ${data?.topics?.length || 0} topics` });
      onSynced?.();
    } catch (e: any) {
      toast({ title: "Image sync failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVoice = async () => {
    if (!user) return;
    setLoading(true);
    setActiveSource("voice");
    try {
      // Use Web Speech API for transcription
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        toast({ title: "Not supported", description: "Speech recognition is not supported in this browser.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        try {
          const { data, error } = await supabase.functions.invoke("extract-voice-topics", {
            body: { transcript, mode: "transcript" },
          });
          if (error) throw error;
          setResult({ subjects: data?.subjects || [], topics: data?.topics || [] });
          toast({ title: "Voice Synced ✅", description: `Found ${data?.topics?.length || 0} topics` });
          onSynced?.();
        } catch (e: any) {
          toast({ title: "Voice sync failed", description: e.message, variant: "destructive" });
        }
        setLoading(false);
      };

      recognition.onerror = () => {
        toast({ title: "Voice capture failed", variant: "destructive" });
        setLoading(false);
      };

      recognition.start();
      toast({ title: "🎙️ Listening...", description: "Speak about your study topics" });
    } catch {
      toast({ title: "Voice sync failed", variant: "destructive" });
      setLoading(false);
    }
  };

  const sources = [
    { id: "pdf" as const, icon: FileText, label: "PDF Upload", desc: "Extract topics from PDF documents", action: () => fileRef.current?.click() },
    { id: "image" as const, icon: Camera, label: "Image/Photo", desc: "Snap notes, textbooks, or diagrams", action: () => imageRef.current?.click() },
    { id: "voice" as const, icon: Mic, label: "Voice Input", desc: "Speak your topics and notes", action: handleVoice },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg glass rounded-2xl neural-border p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Multi-Source Sync</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground">Import topics from multiple sources into your brain.</p>

        {loading && (
          <AIProgressBar
            label={activeSource === "pdf" ? "Extracting from PDF" : activeSource === "image" ? "Analyzing image" : "Processing voice"}
            sublabel="AI is identifying topics and subjects"
            estimatedSeconds={10}
          />
        )}

        <div className="space-y-3">
          {sources.map(s => (
            <button
              key={s.id}
              onClick={s.action}
              disabled={loading}
              className="w-full flex items-center gap-3 p-4 rounded-xl glass neural-border hover:glow-primary transition-all text-left disabled:opacity-50"
            >
              {loading && activeSource === s.id ? (
                <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              ) : (
                <s.icon className="w-5 h-5 text-primary" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{s.label}</p>
                <p className="text-[10px] text-muted-foreground">{s.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Hidden file inputs */}
        <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => e.target.files?.[0] && handlePDF(e.target.files[0])} />
        <input ref={imageRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && handleImage(e.target.files[0])} />

        {/* Results */}
        {result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-4 neural-border space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span className="text-sm font-medium text-foreground">Synced Successfully</span>
            </div>
            {result.subjects.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Subjects:</p>
                <div className="flex flex-wrap gap-1">
                  {result.subjects.map((s, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {result.topics.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Topics:</p>
                <div className="flex flex-wrap gap-1">
                  {result.topics.map((t, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-success/10 text-success text-[10px] font-medium">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default MultiSourceSync;
