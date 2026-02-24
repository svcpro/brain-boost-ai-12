import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PredictionResult {
  prediction: {
    distraction_probability: number;
    cognitive_state: string;
    state_confidence: number;
    signals: {
      time_of_day: number;
      fatigue: number;
      switch_velocity: number;
      error_cluster: number;
      latency_spike: number;
      mock_frustration: number;
    };
  };
  intervention: {
    stage: number;
    type: string;
    lock_duration: number;
    impulse_delay: boolean;
    impulse_type: string;
    breathing_seconds: number;
  } | null;
  discipline: {
    score: number;
    resisted: number;
    yielded: number;
    streak_multiplier: number;
    xp_earned: number;
    stability_boost: boolean;
  };
  dopamine: {
    focus_streak_multiplier: number;
    stability_boost_animation: boolean;
    motivational_trigger: boolean;
  };
}

export interface DisciplineHistory {
  score_date: string;
  discipline_score: number;
  distractions_resisted: number;
  distractions_yielded: number;
  streak_multiplier: number;
  brain_level_xp_earned: number;
  dopamine_rewards_earned: number;
  stability_boosts_earned: number;
  longest_focus_minutes: number;
}

export interface CognitiveStateEntry {
  state: string;
  confidence: number;
  recorded_at: string;
  signals: Record<string, number>;
}

export function useCognitivePrediction() {
  const { user } = useAuth();
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [disciplineHistory, setDisciplineHistory] = useState<DisciplineHistory[]>([]);
  const [stateHistory, setStateHistory] = useState<CognitiveStateEntry[]>([]);
  const [showImpulseChallenge, setShowImpulseChallenge] = useState(false);
  const [showDopamineReward, setShowDopamineReward] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const predict = useCallback(async () => {
    if (!user) return null;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cognitive-predict");
      if (error) throw error;
      setPrediction(data as PredictionResult);

      // Show dopamine reward animation if earned
      if ((data as PredictionResult)?.dopamine?.stability_boost_animation) {
        setShowDopamineReward(true);
        setTimeout(() => setShowDopamineReward(false), 3000);
      }

      return data as PredictionResult;
    } catch (e) {
      console.warn("Cognitive prediction failed:", e);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    const [discRes, stateRes] = await Promise.all([
      supabase.from("neural_discipline_scores")
        .select("*").eq("user_id", user.id)
        .order("score_date", { ascending: false }).limit(14),
      supabase.from("cognitive_state_history")
        .select("state, confidence, recorded_at, signals")
        .eq("user_id", user.id)
        .order("recorded_at", { ascending: false }).limit(50),
    ]);
    if (discRes.data) setDisciplineHistory(discRes.data as any);
    if (stateRes.data) setStateHistory(stateRes.data as any);
  }, [user]);

  // Auto-predict every 5 minutes
  useEffect(() => {
    if (!user) return;
    predict();
    loadHistory();
    intervalRef.current = setInterval(predict, 5 * 60 * 1000);
    return () => clearInterval(intervalRef.current);
  }, [user, predict, loadHistory]);

  const triggerImpulseChallenge = useCallback(() => {
    setShowImpulseChallenge(true);
  }, []);

  const resolveImpulseChallenge = useCallback((passed: boolean) => {
    setShowImpulseChallenge(false);
    if (passed && user) {
      supabase.from("focus_interventions").insert({
        user_id: user.id,
        intervention_stage: 2,
        intervention_type: "impulse_delay",
        was_effective: true,
        recall_passed: passed,
        user_response: "challenge_completed",
      }).then(() => {});
    }
  }, [user]);

  return {
    prediction,
    loading,
    predict,
    disciplineHistory,
    stateHistory,
    showImpulseChallenge,
    showDopamineReward,
    triggerImpulseChallenge,
    resolveImpulseChallenge,
    loadHistory,
  };
}
