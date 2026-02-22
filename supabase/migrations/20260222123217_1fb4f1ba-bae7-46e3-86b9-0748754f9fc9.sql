
-- =============================================
-- STQ ENGINE v9.0 - Database Schema
-- =============================================

-- 1. Syllabus Taxonomies (parsed syllabus hierarchy)
CREATE TABLE public.syllabus_taxonomies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_type TEXT NOT NULL DEFAULT 'JEE',
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  subtopic TEXT,
  normalized_name TEXT NOT NULL,
  hierarchy_level INT NOT NULL DEFAULT 1,
  parent_id UUID REFERENCES public.syllabus_taxonomies(id),
  weightage_pct NUMERIC(5,2),
  source TEXT DEFAULT 'manual',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.syllabus_taxonomies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage syllabus" ON public.syllabus_taxonomies FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Users can read syllabus" ON public.syllabus_taxonomies FOR SELECT USING (true);

CREATE INDEX idx_syllabus_exam ON public.syllabus_taxonomies(exam_type);
CREATE INDEX idx_syllabus_parent ON public.syllabus_taxonomies(parent_id);

-- 2. Question Mining Results (mined questions mapped to topics)
CREATE TABLE public.question_mining_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_type TEXT NOT NULL,
  year INT NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  subtopic TEXT,
  taxonomy_id UUID REFERENCES public.syllabus_taxonomies(id),
  question_text TEXT,
  question_type TEXT DEFAULT 'mcq',
  difficulty_level TEXT DEFAULT 'medium',
  marks NUMERIC(4,1) DEFAULT 4,
  semantic_cluster TEXT,
  similarity_score NUMERIC(5,4),
  pattern_tags TEXT[] DEFAULT '{}',
  source_paper TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.question_mining_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage mining" ON public.question_mining_results FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Users can read mining" ON public.question_mining_results FOR SELECT USING (true);

CREATE INDEX idx_mining_exam_topic ON public.question_mining_results(exam_type, topic);
CREATE INDEX idx_mining_year ON public.question_mining_results(year);

-- 3. Topic Probability Index (TPI scores per topic)
CREATE TABLE public.topic_probability_index (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  subtopic TEXT,
  taxonomy_id UUID REFERENCES public.syllabus_taxonomies(id),
  frequency_score NUMERIC(5,2) DEFAULT 0,
  recency_score NUMERIC(5,2) DEFAULT 0,
  trend_momentum_score NUMERIC(5,2) DEFAULT 0,
  volatility_score NUMERIC(5,2) DEFAULT 0,
  difficulty_score NUMERIC(5,2) DEFAULT 0,
  tpi_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  confidence NUMERIC(5,2) DEFAULT 50,
  prediction_year INT NOT NULL DEFAULT 2025,
  data_points_used INT DEFAULT 0,
  last_appeared_year INT,
  appearance_years INT[] DEFAULT '{}',
  model_version TEXT DEFAULT 'v1.0',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.topic_probability_index ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage TPI" ON public.topic_probability_index FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Users can read TPI" ON public.topic_probability_index FOR SELECT USING (true);

CREATE INDEX idx_tpi_exam ON public.topic_probability_index(exam_type);
CREATE INDEX idx_tpi_score ON public.topic_probability_index(tpi_score DESC);
CREATE UNIQUE INDEX idx_tpi_unique ON public.topic_probability_index(exam_type, subject, topic, COALESCE(subtopic, ''), prediction_year);

-- 4. Pattern Evolution Logs (tracks shifts over time)
CREATE TABLE public.pattern_evolution_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_type TEXT NOT NULL,
  subject TEXT,
  detection_type TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT DEFAULT 'moderate',
  old_value JSONB,
  new_value JSONB,
  affected_topics TEXT[] DEFAULT '{}',
  recommendation TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pattern_evolution_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage evolution" ON public.pattern_evolution_logs FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Users can read evolution" ON public.pattern_evolution_logs FOR SELECT USING (true);

CREATE INDEX idx_evolution_exam ON public.pattern_evolution_logs(exam_type);

-- 5. STQ Engine Config
CREATE TABLE public.stq_engine_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  engine_enabled BOOLEAN DEFAULT true,
  syllabus_parser_enabled BOOLEAN DEFAULT true,
  question_mining_enabled BOOLEAN DEFAULT true,
  tpi_engine_enabled BOOLEAN DEFAULT true,
  pattern_detection_enabled BOOLEAN DEFAULT true,
  memory_injection_enabled BOOLEAN DEFAULT true,
  mock_integration_enabled BOOLEAN DEFAULT true,
  sureshot_integration_enabled BOOLEAN DEFAULT true,
  auto_retrain_enabled BOOLEAN DEFAULT false,
  retrain_interval_days INT DEFAULT 7,
  tpi_high_threshold NUMERIC(5,2) DEFAULT 85,
  tpi_low_threshold NUMERIC(5,2) DEFAULT 40,
  model_version TEXT DEFAULT 'v1.0',
  last_retrained_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.stq_engine_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage stq config" ON public.stq_engine_config FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Users can read stq config" ON public.stq_engine_config FOR SELECT USING (true);

-- Insert default config
INSERT INTO public.stq_engine_config (engine_enabled) VALUES (true);

-- 6. STQ Model Training Logs
CREATE TABLE public.stq_training_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_version TEXT NOT NULL,
  training_type TEXT DEFAULT 'full',
  exam_types_trained TEXT[] DEFAULT '{}',
  data_points_processed INT DEFAULT 0,
  accuracy_before NUMERIC(5,2),
  accuracy_after NUMERIC(5,2),
  duration_ms INT,
  status TEXT DEFAULT 'completed',
  error_message TEXT,
  triggered_by TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stq_training_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage training logs" ON public.stq_training_logs FOR ALL USING (public.is_admin(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_syllabus_taxonomies_updated_at BEFORE UPDATE ON public.syllabus_taxonomies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tpi_updated_at BEFORE UPDATE ON public.topic_probability_index FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_stq_config_updated_at BEFORE UPDATE ON public.stq_engine_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
