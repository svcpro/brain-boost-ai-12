
-- ============================================================
-- ML DATA INFRASTRUCTURE
-- ============================================================

-- 1. ML Events: Raw event store for all user behavior signals
CREATE TABLE public.ml_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL, -- 'study_session', 'recall_attempt', 'app_open', 'fix_session', 'pdf_upload', 'voice_record', 'exam_attempt', 'topic_review'
  event_category TEXT NOT NULL, -- 'study', 'memory', 'passive', 'behavior', 'exam'
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ml_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ml_events" ON public.ml_events
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_ml_events_user_type ON public.ml_events (user_id, event_type);
CREATE INDEX idx_ml_events_user_created ON public.ml_events (user_id, created_at DESC);
CREATE INDEX idx_ml_events_category ON public.ml_events (event_category);

-- 2. User Features: Computed feature vectors per user (updated periodically)
CREATE TABLE public.user_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  -- Memory features
  avg_time_since_revision_hours NUMERIC DEFAULT 0,
  avg_revision_frequency NUMERIC DEFAULT 0,
  recall_success_rate NUMERIC DEFAULT 0,
  memory_decay_slope NUMERIC DEFAULT 0,
  -- Behavior features
  study_consistency_score NUMERIC DEFAULT 0,
  engagement_score NUMERIC DEFAULT 0,
  fatigue_indicator NUMERIC DEFAULT 0,
  response_latency_score NUMERIC DEFAULT 0,
  avg_session_duration_minutes NUMERIC DEFAULT 0,
  app_open_frequency NUMERIC DEFAULT 0,
  -- Exam features
  subject_strength_score NUMERIC DEFAULT 0,
  rank_trajectory_slope NUMERIC DEFAULT 0,
  -- Learning features
  learning_velocity NUMERIC DEFAULT 0,
  knowledge_stability NUMERIC DEFAULT 0,
  -- Burnout features
  burnout_risk_score NUMERIC DEFAULT 0,
  consecutive_long_sessions INTEGER DEFAULT 0,
  hours_studied_last_24h NUMERIC DEFAULT 0,
  hours_studied_last_7d NUMERIC DEFAULT 0,
  -- Meta
  computed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own features" ON public.user_features
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System manages features" ON public.user_features
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Model Predictions: Store all predictions for accuracy tracking
CREATE TABLE public.model_predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  model_name TEXT NOT NULL, -- 'forgetting_curve', 'memory_strength', 'rank_prediction', 'study_recommendation', 'adaptive_difficulty', 'burnout_detection'
  model_version TEXT NOT NULL DEFAULT 'v1',
  input_features JSONB DEFAULT '{}'::jsonb,
  prediction JSONB NOT NULL,
  actual_outcome JSONB, -- filled later for accuracy tracking
  confidence NUMERIC, -- 0-1 confidence score
  latency_ms INTEGER, -- inference time
  is_correct BOOLEAN, -- filled later
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  validated_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.model_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own predictions" ON public.model_predictions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own predictions" ON public.model_predictions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own predictions" ON public.model_predictions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_predictions_user_model ON public.model_predictions (user_id, model_name, created_at DESC);
CREATE INDEX idx_predictions_model_version ON public.model_predictions (model_name, model_version);

-- 4. Model Metrics: Aggregated model performance over time
CREATE TABLE public.model_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL DEFAULT 'v1',
  metric_type TEXT NOT NULL, -- 'accuracy', 'precision', 'recall', 'f1', 'mae', 'rmse', 'latency_p50', 'latency_p95'
  metric_value NUMERIC NOT NULL,
  sample_size INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.model_metrics ENABLE ROW LEVEL SECURITY;

-- Model metrics are readable by authenticated users (for admin dashboard)
CREATE POLICY "Authenticated users view model metrics" ON public.model_metrics
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "System inserts model metrics" ON public.model_metrics
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX idx_model_metrics_name ON public.model_metrics (model_name, created_at DESC);

-- 5. ML Training Logs
CREATE TABLE public.ml_training_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  training_type TEXT NOT NULL DEFAULT 'incremental', -- 'incremental', 'full'
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  training_data_size INTEGER,
  metrics JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  triggered_by TEXT DEFAULT 'system' -- 'system', 'admin', 'schedule'
);

ALTER TABLE public.ml_training_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users view training logs" ON public.ml_training_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "System manages training logs" ON public.ml_training_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "System updates training logs" ON public.ml_training_logs
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_training_logs_model ON public.ml_training_logs (model_name, started_at DESC);
