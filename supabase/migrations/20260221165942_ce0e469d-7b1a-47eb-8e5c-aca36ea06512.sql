
-- 1. Rank Heatmap: store computed percentile snapshots
CREATE TABLE public.rank_heatmap_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  exam_type TEXT NOT NULL DEFAULT 'general',
  percentile NUMERIC(5,2) NOT NULL DEFAULT 50,
  internal_rank_score NUMERIC(6,2),
  simulated_national_score NUMERIC(6,2),
  blended_percentile NUMERIC(5,2),
  total_internal_users INTEGER DEFAULT 0,
  subject_breakdown JSONB DEFAULT '{}',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rank_heatmap_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own rank snapshots" ON public.rank_heatmap_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System inserts rank snapshots" ON public.rank_heatmap_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_rank_heatmap_user ON public.rank_heatmap_snapshots(user_id, computed_at DESC);

-- 2. Weakness Predictions
CREATE TABLE public.weakness_predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  topic_id UUID REFERENCES public.topics(id),
  topic_name TEXT NOT NULL,
  failure_probability NUMERIC(5,2) NOT NULL DEFAULT 0,
  risk_factors JSONB DEFAULT '{}',
  reinforcement_scheduled BOOLEAN DEFAULT false,
  reinforcement_date DATE,
  ai_reasoning TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.weakness_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own weakness predictions" ON public.weakness_predictions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System inserts weakness predictions" ON public.weakness_predictions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own weakness predictions" ON public.weakness_predictions FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_weakness_pred_user ON public.weakness_predictions(user_id, computed_at DESC);

-- 3. Exam Trend Patterns (admin-managed + AI-generated)
CREATE TABLE public.exam_trend_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  year INTEGER,
  frequency_count INTEGER DEFAULT 0,
  predicted_probability NUMERIC(5,2) DEFAULT 0,
  difficulty_distribution JSONB DEFAULT '{}',
  source TEXT DEFAULT 'manual',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_trend_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read exam trends" ON public.exam_trend_patterns FOR SELECT USING (true);
CREATE POLICY "Admins insert exam trends" ON public.exam_trend_patterns FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update exam trends" ON public.exam_trend_patterns FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete exam trends" ON public.exam_trend_patterns FOR DELETE USING (public.is_admin(auth.uid()));

CREATE INDEX idx_exam_trends_type ON public.exam_trend_patterns(exam_type, subject);

-- 4. Exam Datasets (admin uploads)
CREATE TABLE public.exam_datasets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_type TEXT NOT NULL,
  year INTEGER NOT NULL,
  subject TEXT,
  file_url TEXT,
  file_type TEXT DEFAULT 'csv',
  status TEXT DEFAULT 'pending',
  total_questions INTEGER DEFAULT 0,
  processed_patterns INTEGER DEFAULT 0,
  error_message TEXT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

ALTER TABLE public.exam_datasets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage exam datasets" ON public.exam_datasets FOR ALL USING (public.is_admin(auth.uid()));

-- 5. Accelerator Mode enrollment
CREATE TABLE public.accelerator_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL DEFAULT (CURRENT_DATE + 30),
  target_exam_type TEXT,
  intensity_level TEXT DEFAULT 'high',
  daily_schedule JSONB DEFAULT '{}',
  weak_topics JSONB DEFAULT '[]',
  high_probability_topics JSONB DEFAULT '[]',
  progress_percentage NUMERIC(5,2) DEFAULT 0,
  days_completed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  ai_strategy TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.accelerator_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own accelerator" ON public.accelerator_enrollments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own accelerator" ON public.accelerator_enrollments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own accelerator" ON public.accelerator_enrollments FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_accelerator_user ON public.accelerator_enrollments(user_id, status);

-- 6. Opponent simulation config (admin-managed)
CREATE TABLE public.opponent_simulation_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_type TEXT NOT NULL DEFAULT 'general',
  pressure_level TEXT DEFAULT 'medium',
  time_pressure_multiplier NUMERIC(3,2) DEFAULT 0.80,
  difficulty_escalation_rate NUMERIC(3,2) DEFAULT 1.10,
  competitor_accuracy_range JSONB DEFAULT '{"min": 0.55, "max": 0.85}',
  is_enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.opponent_simulation_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads opponent config" ON public.opponent_simulation_config FOR SELECT USING (true);
CREATE POLICY "Admins manage opponent config" ON public.opponent_simulation_config FOR ALL USING (public.is_admin(auth.uid()));

-- 7. Competitive intelligence admin config
CREATE TABLE public.competitive_intel_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trend_engine_enabled BOOLEAN DEFAULT true,
  weakness_engine_enabled BOOLEAN DEFAULT true,
  accelerator_enabled BOOLEAN DEFAULT true,
  opponent_sim_enabled BOOLEAN DEFAULT true,
  rank_heatmap_enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.competitive_intel_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads intel config" ON public.competitive_intel_config FOR SELECT USING (true);
CREATE POLICY "Admins manage intel config" ON public.competitive_intel_config FOR ALL USING (public.is_admin(auth.uid()));

-- Seed default config
INSERT INTO public.competitive_intel_config (id) VALUES (gen_random_uuid());
INSERT INTO public.opponent_simulation_config (exam_type) VALUES ('general');

-- Triggers for updated_at
CREATE TRIGGER update_exam_trends_updated_at BEFORE UPDATE ON public.exam_trend_patterns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_accelerator_updated_at BEFORE UPDATE ON public.accelerator_enrollments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_opponent_config_updated_at BEFORE UPDATE ON public.opponent_simulation_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_intel_config_updated_at BEFORE UPDATE ON public.competitive_intel_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
