import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, Play, Globe, Sparkles, Clock, Mic } from "lucide-react";
import { useVoiceNotification, getVoiceSettings, saveVoiceSettings, type VoiceSettings } from "@/hooks/useVoiceNotification";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getFeedbackVolume } from "@/lib/feedback";

const VoiceSettingsPanel = () => {
  const [settings, setSettings] = useState<VoiceSettings>(getVoiceSettings);
  const { speak, loading, playing } = useVoiceNotification();
  const { toast } = useToast();
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const previewVoice = useCallback(async (voiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewingVoiceId) return;

    setPreviewingVoiceId(voiceId);
    try {
      const { data, error } = await supabase.functions.invoke("voice-notification", {
        body: {
          type: "test",
          language: settings.language,
          tone: settings.tone,
          voiceId,
          context: {},
        },
      });
      if (error) throw error;
      if (data.audio) {
        const volume = getFeedbackVolume() / 100;
        const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
        audio.volume = Math.max(0.05, volume);
        previewAudioRef.current = audio;
        audio.onended = () => setPreviewingVoiceId(null);
        audio.onerror = () => setPreviewingVoiceId(null);
        await audio.play();
      } else {
        setPreviewingVoiceId(null);
      }
    } catch {
      toast({ title: "Preview failed", variant: "destructive" });
      setPreviewingVoiceId(null);
    }
  }, [previewingVoiceId, settings.language, settings.tone, toast]);
  const update = (partial: Partial<VoiceSettings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    saveVoiceSettings(next);
  };

  const languages: { value: VoiceSettings["language"]; label: string; desc: string }[] = [
    { value: "en", label: "English", desc: "English only" },
    { value: "hi", label: "Hindi", desc: "Hindi / Hinglish" },
    { value: "auto", label: "Auto", desc: "Match app language" },
  ];

  const tones: { value: VoiceSettings["tone"]; label: string; emoji: string }[] = [
    { value: "soft", label: "Soft", emoji: "🌸" },
    { value: "calm", label: "Calm", emoji: "🧘" },
    { value: "energetic", label: "Energetic", emoji: "⚡" },
  ];

  const voices: { id: string; name: string; desc: string; gender: string }[] = [
    { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", desc: "Natural, expressive", gender: "♀" },
    { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", desc: "Warm, friendly", gender: "♀" },
    { id: "nPczCjzI2devNBz1zQrb", name: "Brian", desc: "Calm, professional", gender: "♂" },
    { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", desc: "Clear, articulate", gender: "♂" },
  ];

  const schedules: { value: VoiceSettings["schedule"]; label: string; hour: number }[] = [
    { value: "morning", label: "Morning (8 AM)", hour: 8 },
    { value: "afternoon", label: "Afternoon (2 PM)", hour: 14 },
    { value: "evening", label: "Evening (7 PM)", hour: 19 },
    { value: "custom", label: "Custom Time", hour: settings.customHour ?? 18 },
  ];

  return (
    <div className="glass rounded-xl p-4 neural-border space-y-4 mt-1">
      {/* Master Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {settings.enabled ? (
            <Volume2 className="w-4 h-4 text-primary" />
          ) : (
            <VolumeX className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="text-sm text-foreground font-medium">Enable Voice Notifications</span>
        </div>
        <button
          onClick={() => update({ enabled: !settings.enabled })}
          className={`w-10 h-6 rounded-full transition-all relative ${settings.enabled ? "bg-primary" : "bg-secondary"}`}
        >
          <motion.div
            className="w-4 h-4 rounded-full bg-white absolute top-1"
            animate={{ left: settings.enabled ? 22 : 4 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </button>
      </div>

      <AnimatePresence>
        {settings.enabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden space-y-4"
          >
            {/* Language Selection */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Language</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {languages.map((lang) => (
                  <button
                    key={lang.value}
                    onClick={() => update({ language: lang.value })}
                    className={`py-2 px-2 rounded-lg text-xs font-medium transition-all border ${
                      settings.language === lang.value
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-secondary/30 text-foreground hover:border-primary/50"
                    }`}
                  >
                    <div>{lang.label}</div>
                    <div className="text-[9px] text-muted-foreground mt-0.5">{lang.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Voice Tone */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Voice Tone</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {tones.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => update({ tone: t.value })}
                    className={`py-2.5 rounded-lg text-xs font-medium transition-all border ${
                      settings.tone === t.value
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-secondary/30 text-foreground hover:border-primary/50"
                    }`}
                  >
                    <div className="text-base mb-0.5">{t.emoji}</div>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Voice Selection */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Voice</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {voices.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => update({ voiceId: v.id })}
                    className={`py-2 px-3 rounded-lg text-xs font-medium transition-all border text-left ${
                      (settings.voiceId || "EXAVITQu4vr4xnSDxMaL") === v.id
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-secondary/30 text-foreground hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{v.gender}</span>
                        <span>{v.name}</span>
                      </div>
                      <button
                        onClick={(e) => previewVoice(v.id, e)}
                        disabled={previewingVoiceId !== null}
                        className="p-1 rounded-full hover:bg-primary/20 transition-colors disabled:opacity-40"
                        title={`Preview ${v.name}`}
                      >
                        {previewingVoiceId === v.id ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full"
                          />
                        ) : (
                          <Play className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <div className="text-[9px] text-muted-foreground mt-0.5">{v.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Schedule */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Reminder Schedule</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {schedules.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => update({ schedule: s.value })}
                    className={`py-2 px-3 rounded-lg text-xs font-medium transition-all border text-left ${
                      settings.schedule === s.value
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-secondary/30 text-foreground hover:border-primary/50"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {settings.schedule === "custom" && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">Time:</span>
                  <select
                    value={settings.customHour ?? 18}
                    onChange={(e) => update({ customHour: Number(e.target.value) })}
                    className="rounded-lg bg-secondary border border-border px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  >
                    {Array.from({ length: 16 }, (_, i) => i + 6).map((h) => (
                      <option key={h} value={h}>
                        {h > 12 ? `${h - 12}:00 PM` : h === 12 ? "12:00 PM" : `${h}:00 AM`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Nudge Threshold */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Motivational Nudge</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Show nudge after</span>
                <select
                  value={settings.nudgeThreshold ?? 2}
                  onChange={(e) => update({ nudgeThreshold: Number(e.target.value) })}
                  className="rounded-lg bg-secondary border border-border px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <span className="text-[11px] text-muted-foreground">ignored reminder{(settings.nudgeThreshold ?? 2) !== 1 ? "s" : ""}</span>
              </div>
            </div>

            {/* Test Voice Button */}
            <button
              onClick={async () => {
                try {
                  await speak("test");
                } catch {
                  toast({ title: "Voice test failed", variant: "destructive" });
                }
              }}
              disabled={loading || playing}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl neural-gradient neural-border hover:glow-primary transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full"
                />
              ) : (
                <Play className="w-4 h-4 text-primary" />
              )}
              <span className="text-sm font-medium text-foreground">
                {loading ? "Generating..." : playing ? "Playing..." : "Test Voice"}
              </span>
            </button>

            <p className="text-[10px] text-muted-foreground text-center">
              Voice notifications use premium AI speech by ElevenLabs. Each notification is uniquely generated.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VoiceSettingsPanel;
