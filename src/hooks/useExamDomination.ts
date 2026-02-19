import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { setCache, getCache } from "@/lib/offlineCache";

export interface ExamDominationData {
  exam_intelligence: {
    overall_score: number;
    high_probability_topics: Array<{
      name: string;
      probability: number;
      trend: "rising" | "stable" | "declining";
      impact: "critical" | "high" | "medium" | "low";
    }>;
    emerging_topics: string[];
    declining_topics: string[];
  };
  predicted_questions: Array<{
    question: string;
    probability: number;
    difficulty: "easy" | "medium" | "hard";
    relevance_score: number;
    topic: string;
  }>;
  competition_simulation: {
    expected_rank_min: number;
    expected_rank_max: number;
    percentile: number;
    crack_probability: number;
    competition_intensity: "low" | "moderate" | "high" | "extreme";
    cutoff_risk: "safe" | "borderline" | "at_risk" | "below";
    virtual_students_simulated: number;
  };
  adaptive_strategy: {
    daily_plan: Array<{ topic: string; minutes: number; priority: "critical" | "high" | "medium" | "low" }>;
    weak_areas: string[];
    time_allocation_advice: string;
    difficulty_recommendation: "increase" | "maintain" | "decrease";
    strategy_summary: string;
  };
  syllabus_domination: {
    coverage_percentage: number;
    high_roi_topics: string[];
    uncovered_topics: string[];
    revision_priority: Array<{ topic: string; urgency: "immediate" | "soon" | "can_wait" }>;
  };
  ultra_metrics: {
    exam_intelligence_score: number;
    performance_acceleration: number;
    ml_confidence: number;
    weakness_exposure: number;
    mastery_heatmap: Array<{ topic: string; mastery: number }>;
    rank_probability_data: Array<{ rank_range: string; probability: number }>;
  };
  overall_verdict: string;
  domination_level: "dominating" | "strong" | "building" | "needs_work" | "critical";
  generated_at: string;
  days_to_exam: number | null;
  exam_type: string;
  total_topics: number;
  total_study_hours: number;
}

const CACHE_KEY = "exam-domination-data";

export function useExamDomination() {
  const [data, setData] = useState<ExamDominationData | null>(() => getCache<ExamDominationData>(CACHE_KEY));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const analyze = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke("exam-domination-engine", {
        body: { action: "full_analysis" },
      });
      if (fnError) throw fnError;
      if (result?.error) throw new Error(result.error);
      setData(result);
      setCache(CACHE_KEY, result);
      return result;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  return { data, loading, error, analyze };
}
