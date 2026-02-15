
-- ===========================
-- COGNITIVE DIGITAL TWIN MODEL
-- ===========================
CREATE TABLE public.cognitive_twins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  -- Per-topic cognitive model
  topic_models JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Aggregate cognitive profile
  avg_learning_speed NUMERIC DEFAULT 0,
  avg_decay_rate NUMERIC DEFAULT 0,
  optimal_study_hour INTEGER DEFAULT 9,
  optimal_session_duration INTEGER DEFAULT 25,
  cognitive_capacity_score NUMERIC DEFAULT 50,
  recall_pattern_type TEXT DEFAULT 'standard',
  fatigue_threshold_minutes INTEGER DEFAULT 120,
  -- Evolution tracking
  brain_evolution_score NUMERIC DEFAULT 0,
  learning_efficiency_score NUMERIC DEFAULT 0,
  memory_growth_rate NUMERIC DEFAULT 0,
  twin_version INTEGER DEFAULT 1,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.cognitive_twins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own twin" ON public.cognitive_twins FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own twin" ON public.cognitive_twins FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own twin" ON public.cognitive_twins FOR UPDATE USING (auth.uid() = user_id);

-- ===========================
-- LEARNING SIMULATIONS
-- ===========================
CREATE TABLE public.learning_simulations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  scenario_type TEXT NOT NULL DEFAULT 'study_now',
  input_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  simulation_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  predicted_retention NUMERIC,
  predicted_rank_change NUMERIC,
  confidence NUMERIC DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.learning_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own simulations" ON public.learning_simulations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own simulations" ON public.learning_simulations FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ===========================
-- META-LEARNING STRATEGIES
-- ===========================
CREATE TABLE public.meta_learning_strategies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  strategy_type TEXT NOT NULL,
  strategy_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  performance_score NUMERIC DEFAULT 0,
  iteration INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_learning_strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own strategies" ON public.meta_learning_strategies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own strategies" ON public.meta_learning_strategies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own strategies" ON public.meta_learning_strategies FOR UPDATE USING (auth.uid() = user_id);

-- ===========================
-- MODEL SELECTION REGISTRY
-- ===========================
CREATE TABLE public.model_selections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  model_domain TEXT NOT NULL,
  active_model TEXT NOT NULL,
  candidate_models JSONB NOT NULL DEFAULT '[]'::jsonb,
  performance_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_evaluated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, model_domain)
);

ALTER TABLE public.model_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own model selections" ON public.model_selections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own model selections" ON public.model_selections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own model selections" ON public.model_selections FOR UPDATE USING (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_meta_learning_strategies_updated_at
  BEFORE UPDATE ON public.meta_learning_strategies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
