import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ExamPhase = "normal" | "acceleration" | "lockdown" | "no_exam";

export interface ExamCountdownState {
  phase: ExamPhase;
  daysRemaining: number | null;
  examDate: string | null;
  lockedModes: string[];
  lockMessage: string;
  recommendedMode: string;
  canBypass: boolean;
  loading: boolean;
  isEnabled: boolean;
  aiReasoning: string;
  confidence: number;
  isModeBlocked: (modeId: string) => boolean;
  refreshPrediction: () => Promise<void>;
}

interface Prediction {
  predicted_acceleration_days: number;
  predicted_lockdown_days: number;
  locked_modes_acceleration: string[];
  locked_modes_lockdown: string[];
  recommended_mode_acceleration: string;
  recommended_mode_lockdown: string;
  acceleration_message: string;
  lockdown_message: string;
  ai_reasoning: string;
  confidence_score: number;
  computed_at: string;
}

export const useExamCountdown = (): ExamCountdownState => {
  const { user, session } = useAuth();
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [examDate, setExamDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load cached prediction on mount
  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const loadCached = async () => {
      const [predRes, profileRes] = await Promise.all([
        (supabase as any).from("exam_countdown_predictions")
          .select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("exam_date").eq("id", user.id).maybeSingle(),
      ]);

      if (profileRes.data) setExamDate((profileRes.data as any).exam_date);
      if (predRes.data) setPrediction(predRes.data as Prediction);
      setLoading(false);
    };
    loadCached();
  }, [user]);

  // Auto-refresh prediction if stale (older than 24h) or missing
  useEffect(() => {
    if (!session || !examDate || loading) return;

    const isStale = !prediction || 
      (Date.now() - new Date(prediction.computed_at).getTime()) > 24 * 60 * 60 * 1000;

    if (isStale) {
      refreshPrediction();
    }
  }, [session, examDate, loading]);

  const refreshPrediction = useCallback(async () => {
    if (!session) return;
    try {
      const { data, error } = await supabase.functions.invoke("exam-countdown-predict");
      if (error) { console.error("Prediction error:", error); return; }
      if (data?.prediction) {
        setPrediction(data.prediction);
        if (data.examDate) setExamDate(data.examDate);
      }
    } catch (e) {
      console.error("Failed to refresh prediction:", e);
    }
  }, [session]);

  const daysRemaining = useMemo(() => {
    if (!examDate) return null;
    return Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000);
  }, [examDate]);

  const phase: ExamPhase = useMemo(() => {
    if (!prediction || daysRemaining === null || daysRemaining < 0) return "no_exam";
    if (daysRemaining <= prediction.predicted_lockdown_days) return "lockdown";
    if (daysRemaining <= prediction.predicted_acceleration_days) return "acceleration";
    return "normal";
  }, [daysRemaining, prediction]);

  const lockedModes = useMemo(() => {
    if (!prediction) return [];
    switch (phase) {
      case "acceleration": return prediction.locked_modes_acceleration || [];
      case "lockdown": return prediction.locked_modes_lockdown || [];
      default: return [];
    }
  }, [phase, prediction]);

  const lockMessage = useMemo(() => {
    if (!prediction) return "";
    switch (phase) {
      case "acceleration": return prediction.acceleration_message || "";
      case "lockdown": return prediction.lockdown_message || "";
      default: return "";
    }
  }, [phase, prediction]);

  const recommendedMode = useMemo(() => {
    if (!prediction) return "focus";
    switch (phase) {
      case "acceleration": return prediction.recommended_mode_acceleration || "mock";
      case "lockdown": return prediction.recommended_mode_lockdown || "emergency";
      default: return "focus";
    }
  }, [phase, prediction]);

  const isModeBlocked = useCallback((modeId: string) => {
    return lockedModes.includes(modeId);
  }, [lockedModes]);

  return {
    phase,
    daysRemaining,
    examDate,
    lockedModes,
    lockMessage,
    recommendedMode,
    canBypass: false, // AI controls everything now
    loading,
    isEnabled: true,
    aiReasoning: prediction?.ai_reasoning || "",
    confidence: prediction?.confidence_score || 0,
    isModeBlocked,
    refreshPrediction,
  };
};
