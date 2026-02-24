
-- MODULE 1: Attention Drift Predictions
CREATE TABLE public.attention_predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  predicted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  distraction_probability NUMERIC NOT NULL DEFAULT 0,
  cognitive_state TEXT NOT NULL DEFAULT 'surface_focus',
  fatigue_level NUMERIC NOT NULL DEFAULT 0,
  impulse_score NUMERIC NOT NULL DEFAULT 0,
  time_of_day_risk NUMERIC NOT NULL DEFAULT 0,
  error_cluster_score NUMERIC NOT NULL DEFAULT 0,
  latency_spike_score NUMERIC NOT NULL DEFAULT 0,
  mock_frustration_score NUMERIC NOT NULL DEFAULT 0,
  app_switch_velocity NUMERIC NOT NULL DEFAULT 0,
  intervention_triggered TEXT,
  intervention_stage INT DEFAULT 0,
  model_version TEXT DEFAULT 'v1',
  context JSONB DEFAULT '{}'
);
ALTER TABLE public.attention_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own predictions" ON public.attention_predictions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System inserts predictions" ON public.attention_predictions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- MODULE 2: Cognitive State History
CREATE TABLE public.cognitive_state_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  state TEXT NOT NULL DEFAULT 'surface_focus',
  confidence NUMERIC NOT NULL DEFAULT 0,
  duration_seconds INT DEFAULT 0,
  transition_from TEXT,
  signals JSONB DEFAULT '{}',
  session_id UUID
);
ALTER TABLE public.cognitive_state_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own state history" ON public.cognitive_state_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System inserts state history" ON public.cognitive_state_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- MODULE 3: Intervention Logs
CREATE TABLE public.focus_interventions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  intervention_stage INT NOT NULL DEFAULT 1,
  intervention_type TEXT NOT NULL DEFAULT 'soft_nudge',
  trigger_reason TEXT,
  distraction_probability NUMERIC,
  cognitive_state TEXT,
  was_effective BOOLEAN,
  user_response TEXT,
  recall_passed BOOLEAN,
  lock_duration_seconds INT DEFAULT 0,
  context JSONB DEFAULT '{}'
);
ALTER TABLE public.focus_interventions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own interventions" ON public.focus_interventions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System inserts interventions" ON public.focus_interventions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- MODULE 4: Neural Discipline Score
CREATE TABLE public.neural_discipline_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  score_date DATE NOT NULL DEFAULT CURRENT_DATE,
  discipline_score NUMERIC NOT NULL DEFAULT 0,
  distractions_resisted INT NOT NULL DEFAULT 0,
  distractions_yielded INT NOT NULL DEFAULT 0,
  impulse_challenges_passed INT NOT NULL DEFAULT 0,
  impulse_challenges_failed INT NOT NULL DEFAULT 0,
  focus_streaks_completed INT NOT NULL DEFAULT 0,
  longest_focus_minutes INT NOT NULL DEFAULT 0,
  dopamine_rewards_earned INT NOT NULL DEFAULT 0,
  stability_boosts_earned INT NOT NULL DEFAULT 0,
  streak_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  brain_level_xp_earned INT NOT NULL DEFAULT 0,
  UNIQUE(user_id, score_date)
);
ALTER TABLE public.neural_discipline_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own discipline" ON public.neural_discipline_scores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System inserts discipline" ON public.neural_discipline_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "System updates discipline" ON public.neural_discipline_scores FOR UPDATE USING (auth.uid() = user_id);

-- MODULE 7: Adaptive Lock Config (Admin)
CREATE TABLE public.adaptive_lock_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  base_lock_seconds INT NOT NULL DEFAULT 300,
  exam_proximity_multiplier NUMERIC NOT NULL DEFAULT 2.0,
  high_risk_multiplier NUMERIC NOT NULL DEFAULT 1.5,
  burnout_reduction_factor NUMERIC NOT NULL DEFAULT 0.5,
  max_lock_seconds INT NOT NULL DEFAULT 1800,
  min_lock_seconds INT NOT NULL DEFAULT 60,
  impulse_delay_enabled BOOLEAN NOT NULL DEFAULT true,
  impulse_delay_type TEXT NOT NULL DEFAULT 'recall',
  breathing_exercise_seconds INT NOT NULL DEFAULT 30,
  intervention_ab_enabled BOOLEAN NOT NULL DEFAULT false,
  ab_variant_a TEXT DEFAULT 'soft_nudge_first',
  ab_variant_b TEXT DEFAULT 'hard_lock_first',
  ab_traffic_split NUMERIC DEFAULT 50,
  prediction_threshold NUMERIC NOT NULL DEFAULT 0.65,
  cognitive_state_enabled BOOLEAN NOT NULL DEFAULT true,
  dopamine_replacement_enabled BOOLEAN NOT NULL DEFAULT true,
  neural_discipline_enabled BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.adaptive_lock_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read lock config" ON public.adaptive_lock_config FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins update lock config" ON public.adaptive_lock_config FOR UPDATE USING (public.is_admin(auth.uid()));

-- Insert default adaptive lock config
INSERT INTO public.adaptive_lock_config (id) VALUES (gen_random_uuid());

-- Add prediction_enabled and neural_discipline columns to focus_shield_config
ALTER TABLE public.focus_shield_config
  ADD COLUMN IF NOT EXISTS prediction_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cognitive_classifier_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS adaptive_lock_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS dopamine_replacement_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS neural_discipline_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS impulse_delay_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS prediction_threshold NUMERIC NOT NULL DEFAULT 0.65;
