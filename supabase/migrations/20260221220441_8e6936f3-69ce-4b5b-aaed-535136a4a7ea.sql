
-- ============================
-- ACRY v7.0: AI Precision Intelligence Engine Schema
-- ============================

-- 1. Precision Stability Scores (Hybrid AI Model output)
CREATE TABLE public.precision_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  performance_trend_score NUMERIC(5,4) DEFAULT 0,
  topic_weight_importance NUMERIC(5,4) DEFAULT 0,
  forgetting_curve_factor NUMERIC(5,4) DEFAULT 0,
  retrieval_strength_index NUMERIC(5,4) DEFAULT 0,
  behavioral_timing_score NUMERIC(5,4) DEFAULT 0,
  error_clustering_score NUMERIC(5,4) DEFAULT 0,
  unified_precision_score NUMERIC(5,4) DEFAULT 0,
  confidence_interval_low NUMERIC(5,4) DEFAULT 0,
  confidence_interval_high NUMERIC(5,4) DEFAULT 0,
  ai_reasoning TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.precision_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own precision scores"
  ON public.precision_scores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can insert precision scores"
  ON public.precision_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update precision scores"
  ON public.precision_scores FOR UPDATE USING (true);

CREATE INDEX idx_precision_scores_user ON public.precision_scores(user_id, computed_at DESC);

-- 2. Enhanced Topic Decay (Forgetting Curve 2.0)
CREATE TABLE public.topic_decay_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  topic_id UUID REFERENCES public.topics(id),
  initial_mastery NUMERIC(5,4) DEFAULT 0,
  recall_strength NUMERIC(5,4) DEFAULT 0,
  avg_answer_latency_ms INTEGER DEFAULT 0,
  time_gap_hours NUMERIC(8,2) DEFAULT 0,
  error_severity_score NUMERIC(5,4) DEFAULT 0,
  computed_decay_rate NUMERIC(8,6) DEFAULT 0,
  predicted_retention NUMERIC(5,4) DEFAULT 0,
  next_optimal_review TIMESTAMPTZ,
  ai_reasoning TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.topic_decay_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own decay models"
  ON public.topic_decay_models FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can insert decay models"
  ON public.topic_decay_models FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update decay models"
  ON public.topic_decay_models FOR UPDATE USING (true);

CREATE INDEX idx_topic_decay_user_topic ON public.topic_decay_models(user_id, topic_id, computed_at DESC);

-- 3. Rank Model 2.0 (Enhanced rank predictions)
CREATE TABLE public.rank_predictions_v2 (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  consistency_coefficient NUMERIC(5,4) DEFAULT 0,
  volatility_index NUMERIC(5,4) DEFAULT 0,
  high_weight_topic_factor NUMERIC(5,4) DEFAULT 0,
  percentile_estimation NUMERIC(5,2) DEFAULT 0,
  confidence_interval_low NUMERIC(5,2) DEFAULT 0,
  confidence_interval_high NUMERIC(5,2) DEFAULT 0,
  predicted_rank INTEGER,
  rank_band_low INTEGER,
  rank_band_high INTEGER,
  model_version TEXT DEFAULT 'v2.0',
  factors_breakdown JSONB DEFAULT '{}',
  ai_reasoning TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rank_predictions_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rank predictions"
  ON public.rank_predictions_v2 FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can insert rank predictions"
  ON public.rank_predictions_v2 FOR INSERT WITH CHECK (true);

CREATE INDEX idx_rank_v2_user ON public.rank_predictions_v2(user_id, computed_at DESC);

-- 4. Behavioral Micro Events
CREATE TABLE public.behavioral_micro_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL, -- hesitation_spike, rapid_guessing, speed_drop, pattern_shift
  topic_id UUID REFERENCES public.topics(id),
  severity NUMERIC(3,2) DEFAULT 0, -- 0-1 scale
  context JSONB DEFAULT '{}', -- answer_time_ms, expected_time_ms, delta_pct etc.
  auto_adjustment_applied TEXT, -- what micro-adjustment was triggered
  adjustment_details JSONB DEFAULT '{}',
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.behavioral_micro_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own micro events"
  ON public.behavioral_micro_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can insert micro events"
  ON public.behavioral_micro_events FOR INSERT WITH CHECK (true);

CREATE INDEX idx_micro_events_user ON public.behavioral_micro_events(user_id, created_at DESC);
CREATE INDEX idx_micro_events_type ON public.behavioral_micro_events(event_type, created_at DESC);

-- 5. Model Recalibration Logs (AI Self-Learning Loop)
CREATE TABLE public.model_recalibration_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recalibration_type TEXT NOT NULL, -- weekly_auto, emergency, admin_triggered
  model_name TEXT NOT NULL, -- forgetting_curve, rank_prediction, precision_engine, behavioral
  previous_accuracy NUMERIC(5,4),
  new_accuracy NUMERIC(5,4),
  accuracy_delta NUMERIC(5,4),
  parameters_changed JSONB DEFAULT '{}',
  training_data_size INTEGER,
  user_count_affected INTEGER,
  ai_reasoning TEXT,
  status TEXT DEFAULT 'completed', -- pending, running, completed, failed
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.model_recalibration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view recalibration logs"
  ON public.model_recalibration_logs FOR SELECT USING (true);
CREATE POLICY "Service role can insert recalibration logs"
  ON public.model_recalibration_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update recalibration logs"
  ON public.model_recalibration_logs FOR UPDATE USING (true);

CREATE INDEX idx_recalibration_type ON public.model_recalibration_logs(recalibration_type, created_at DESC);
