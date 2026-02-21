import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CognitiveProfile {
  learning_style: "conceptual" | "memorizer" | "hybrid";
  learning_style_confidence: number;
  avg_answer_speed_ms: number;
  speed_pattern: "fast" | "moderate" | "slow" | "variable";
  accuracy_rate: number;
  speed_accuracy_tradeoff: "speed_first" | "accuracy_first" | "balanced";
  conceptual_score: number;
  memorizer_score: number;
  total_answers_analyzed: number;
  last_recalibrated_at: string;
}

export interface FatigueEvent {
  id: string;
  event_type: string;
  trigger_reason: string;
  fatigue_score: number;
  created_at: string;
}

export interface ConfidenceEvent {
  id: string;
  event_type: string;
  consecutive_wrong: number;
  boost_message: string;
  created_at: string;
}

export interface LanguagePerf {
  language: string;
  total_questions: number;
  correct_answers: number;
  accuracy_rate: number;
  improvement_pct: number;
  avg_response_time_ms: number;
}

export interface SessionAnalysis {
  profile: CognitiveProfile;
  fatigue: { detected: boolean; score: number; event?: FatigueEvent };
  confidence: { triggered: boolean; event?: ConfidenceEvent };
  session_stats: { total: number; correct: number; accuracy: number; avg_speed_ms: number };
}

export function useCognitiveProfile() {
  const [profile, setProfile] = useState<CognitiveProfile | null>(null);
  const [fatigueHistory, setFatigueHistory] = useState<FatigueEvent[]>([]);
  const [confidenceHistory, setConfidenceHistory] = useState<ConfidenceEvent[]>([]);
  const [languagePerf, setLanguagePerf] = useState<LanguagePerf[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<SessionAnalysis | null>(null);
  const { session } = useAuth();

  const fetchProfile = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cognitive-profile-engine", {
        body: { action: "get_profile" },
      });
      if (error) throw error;
      setProfile(data.profile);
      setFatigueHistory(data.fatigue_history || []);
      setConfidenceHistory(data.confidence_history || []);
      setLanguagePerf(data.language_performance || []);
      return data;
    } catch (e) {
      console.error("Failed to fetch cognitive profile:", e);
    } finally {
      setLoading(false);
    }
  }, [session]);

  const analyzeSession = useCallback(async (
    answers: { is_correct: boolean; time_ms: number; question_id?: string }[],
    sessionDurationMs: number,
    language?: string
  ): Promise<SessionAnalysis | null> => {
    if (!session) return null;
    try {
      const { data, error } = await supabase.functions.invoke("cognitive-profile-engine", {
        body: { action: "analyze_session", answers, session_duration_ms: sessionDurationMs, language },
      });
      if (error) throw error;
      setLastAnalysis(data);
      setProfile(data.profile);
      return data;
    } catch (e) {
      console.error("Session analysis failed:", e);
      return null;
    }
  }, [session]);

  return {
    profile,
    fatigueHistory,
    confidenceHistory,
    languagePerf,
    loading,
    lastAnalysis,
    fetchProfile,
    analyzeSession,
  };
}
