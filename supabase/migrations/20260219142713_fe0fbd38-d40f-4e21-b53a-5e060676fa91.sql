
-- SureShot Admin Configuration table
CREATE TABLE public.sureshot_admin_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  -- Weight parameters (must sum to 1.0)
  weight_trend_momentum NUMERIC NOT NULL DEFAULT 0.25,
  weight_time_series NUMERIC NOT NULL DEFAULT 0.20,
  weight_historical_frequency NUMERIC NOT NULL DEFAULT 0.20,
  weight_difficulty_alignment NUMERIC NOT NULL DEFAULT 0.15,
  weight_semantic_similarity NUMERIC NOT NULL DEFAULT 0.10,
  weight_examiner_behavior NUMERIC NOT NULL DEFAULT 0.10,
  -- Display config
  prediction_min_score INTEGER NOT NULL DEFAULT 55,
  prediction_max_score INTEGER NOT NULL DEFAULT 85,
  display_threshold INTEGER NOT NULL DEFAULT 50,
  show_research_button BOOLEAN NOT NULL DEFAULT true,
  -- Mode config
  calm_mode_enabled BOOLEAN NOT NULL DEFAULT true,
  exam_mode_enabled BOOLEAN NOT NULL DEFAULT true,
  rapid_mode_enabled BOOLEAN NOT NULL DEFAULT true,
  -- Model info
  model_version TEXT NOT NULL DEFAULT 'v2.0',
  last_retrain_at TIMESTAMPTZ,
  retrain_interval_days INTEGER NOT NULL DEFAULT 30,
  dataset_size INTEGER NOT NULL DEFAULT 0,
  prediction_accuracy NUMERIC DEFAULT 0,
  -- Metadata
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default config
INSERT INTO public.sureshot_admin_config (id) VALUES ('default');

-- Prediction audit log
CREATE TABLE public.sureshot_prediction_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'approve', 'reject', 'boost', 'lock', 'retrain', 'weight_change'
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Question bank tags table for admin overrides
CREATE TABLE public.question_bank_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL,
  tag TEXT NOT NULL, -- 'high_priority', 'trend_sensitive', 'core_concept'
  tagged_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(question_id, tag)
);

-- Enable RLS
ALTER TABLE public.sureshot_admin_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sureshot_prediction_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_bank_tags ENABLE ROW LEVEL SECURITY;

-- RLS policies - admin only
CREATE POLICY "Admins can read sureshot config" ON public.sureshot_admin_config
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update sureshot config" ON public.sureshot_admin_config
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can read prediction logs" ON public.sureshot_prediction_logs
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert prediction logs" ON public.sureshot_prediction_logs
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage question tags" ON public.question_bank_tags
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_sureshot_admin_config_updated_at
  BEFORE UPDATE ON public.sureshot_admin_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
