import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getFeedbackVolume, isFeedbackEnabled } from "@/lib/feedback";

export type VoiceAlertType = "daily_reminder" | "forget_risk" | "exam_countdown" | "motivation" | "test";

export interface VoiceContext {
  subject?: string;
  topic?: string;
  memory_score?: number;
  exam_days?: number;
  rank_change?: number;
  daily_minutes?: number;
  daily_topic?: string;
}

export interface VoiceSettings {
  enabled: boolean;
  language: "en" | "hi" | "auto";
  tone: "soft" | "energetic" | "calm";
  schedule: "morning" | "afternoon" | "evening" | "custom";
  customHour?: number;
  nudgeThreshold?: number;
}

const VOICE_SETTINGS_KEY = "acry-voice-settings";

export function getVoiceSettings(): VoiceSettings {
  try {
    const stored = localStorage.getItem(VOICE_SETTINGS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { enabled: false, language: "en", tone: "soft", schedule: "morning" };
}

export function saveVoiceSettings(settings: VoiceSettings) {
  try {
    localStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

export function useVoiceNotification() {
  const [playing, setPlaying] = useState(false);
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { session } = useAuth();

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlaying(false);
    setSubtitle(null);
  }, []);

  const speak = useCallback(async (type: VoiceAlertType, context?: VoiceContext) => {
    const settings = getVoiceSettings();
    if (!settings.enabled && type !== "test") return;
    if (!isFeedbackEnabled() && type !== "test") return;

    setLoading(true);
    stop();

    try {
      const { data, error } = await supabase.functions.invoke("voice-notification", {
        body: {
          type,
          language: settings.language,
          tone: settings.tone,
          context: context || {},
        },
      });

      if (error) throw error;

      setSubtitle(data.text);

      if (data.audio) {
        const volume = getFeedbackVolume() / 100;
        const audioUrl = `data:audio/mpeg;base64,${data.audio}`;
        const audio = new Audio(audioUrl);
        audio.volume = Math.max(0.05, volume);
        audioRef.current = audio;

        setPlaying(true);
        audio.onended = () => {
          setPlaying(false);
          setTimeout(() => setSubtitle(null), 2000);
        };
        audio.onerror = () => {
          setPlaying(false);
          setSubtitle(null);
        };
        await audio.play();
      } else {
        // Text-only fallback — show subtitle for a few seconds
        setTimeout(() => setSubtitle(null), 4000);
      }
    } catch (e: any) {
      console.error("Voice notification error:", e);
      setSubtitle(null);
    } finally {
      setLoading(false);
    }
  }, [session, stop]);

  return { speak, stop, playing, subtitle, loading };
}
