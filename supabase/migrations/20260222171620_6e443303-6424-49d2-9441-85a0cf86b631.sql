
-- ============================================
-- ACRY v10.0: Autonomous Exam Intelligence Supermodel
-- ============================================

-- MODULE 1: Meta-Pattern Evolution Model
CREATE TABLE public.exam_evolution_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  year INTEGER NOT NULL,
  frequency_score NUMERIC DEFAULT 0,
  difficulty_index NUMERIC DEFAULT 0,
  structural_type TEXT DEFAULT 'standard',
  weight_trend TEXT DEFAULT 'stable',
  pattern_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.exam_evolution_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_type TEXT NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'trend',
  period_start INTEGER,
  period_end INTEGER,
  difficulty_inflation_rate NUMERIC DEFAULT 0,
  structural_drift_index NUMERIC DEFAULT 0,
  topic_rotation_score NUMERIC DEFAULT 0,
  rising_topics JSONB DEFAULT '[]',
  declining_topics JSONB DEFAULT '[]',
  shift_alerts JSONB DEFAULT '[]',
  full_report JSONB DEFAULT '{}',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- MODULE 2: Subtopic Granular Engine
CREATE TABLE public.micro_concepts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  micro_concept TEXT NOT NULL,
  probability_score NUMERIC DEFAULT 0,
  historical_frequency INTEGER DEFAULT 0,
  trend_direction TEXT DEFAULT 'stable',
  last_appeared_year INTEGER,
  importance_weight NUMERIC DEFAULT 0.5,
  injected_to_memory BOOLEAN DEFAULT false,
  injected_to_revision BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- MODULE 3: Question DNA Clustering
CREATE TABLE public.question_dna_clusters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_type TEXT NOT NULL,
  cluster_label TEXT NOT NULL,
  cognitive_features JSONB DEFAULT '{}',
  concept_layers JSONB DEFAULT '[]',
  archetype TEXT DEFAULT 'standard',
  is_rising BOOLEAN DEFAULT false,
  growth_rate NUMERIC DEFAULT 0,
  sample_question_ids JSONB DEFAULT '[]',
  cluster_size INTEGER DEFAULT 0,
  centroid_embedding JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- MODULE 4: Generative Question Engine
CREATE TABLE public.generated_exam_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  micro_concept_id UUID REFERENCES public.micro_concepts(id),
  question_text TEXT NOT NULL,
  options JSONB DEFAULT '[]',
  correct_answer INTEGER DEFAULT 0,
  explanation TEXT,
  difficulty_level TEXT DEFAULT 'medium',
  cognitive_type TEXT DEFAULT 'application',
  dna_cluster_id UUID REFERENCES public.question_dna_clusters(id),
  predicted_probability NUMERIC DEFAULT 0,
  quality_score NUMERIC DEFAULT 0,
  is_approved BOOLEAN DEFAULT false,
  approved_by UUID,
  generation_model TEXT DEFAULT 'gemini-3-flash',
  generation_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- MODULE 5: Predictive Curriculum Shift
CREATE TABLE public.curriculum_shift_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_type TEXT NOT NULL,
  shift_type TEXT NOT NULL DEFAULT 'topic_weight',
  affected_subject TEXT,
  affected_topic TEXT,
  old_weight NUMERIC DEFAULT 0,
  new_weight NUMERIC DEFAULT 0,
  confidence NUMERIC DEFAULT 0,
  detection_method TEXT DEFAULT 'ai_analysis',
  auto_recalibrated BOOLEAN DEFAULT false,
  recalibration_details JSONB DEFAULT '{}',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- MODULE 6: Confidence Interval Engine
CREATE TABLE public.prediction_confidence_bands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  prediction_type TEXT NOT NULL,
  exam_type TEXT NOT NULL,
  point_estimate NUMERIC DEFAULT 0,
  lower_bound NUMERIC DEFAULT 0,
  upper_bound NUMERIC DEFAULT 0,
  confidence_level NUMERIC DEFAULT 0.95,
  volatility_score NUMERIC DEFAULT 0,
  risk_adjustment NUMERIC DEFAULT 0,
  data_points_used INTEGER DEFAULT 0,
  model_version TEXT DEFAULT 'v10.0',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_evolution_patterns_exam ON public.exam_evolution_patterns(exam_type, subject);
CREATE INDEX idx_evolution_reports_exam ON public.exam_evolution_reports(exam_type);
CREATE INDEX idx_micro_concepts_exam ON public.micro_concepts(exam_type, subject, topic);
CREATE INDEX idx_question_dna_exam ON public.question_dna_clusters(exam_type);
CREATE INDEX idx_generated_questions_exam ON public.generated_exam_questions(exam_type, subject);
CREATE INDEX idx_curriculum_shifts_exam ON public.curriculum_shift_events(exam_type);
CREATE INDEX idx_confidence_bands_user ON public.prediction_confidence_bands(user_id, exam_type);

-- RLS
ALTER TABLE public.exam_evolution_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_evolution_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.micro_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_dna_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_shift_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_confidence_bands ENABLE ROW LEVEL SECURITY;

-- Public read for exam data (non-user-specific)
CREATE POLICY "Anyone can read evolution patterns" ON public.exam_evolution_patterns FOR SELECT USING (true);
CREATE POLICY "Anyone can read evolution reports" ON public.exam_evolution_reports FOR SELECT USING (true);
CREATE POLICY "Anyone can read micro concepts" ON public.micro_concepts FOR SELECT USING (true);
CREATE POLICY "Anyone can read question dna" ON public.question_dna_clusters FOR SELECT USING (true);
CREATE POLICY "Anyone can read generated questions" ON public.generated_exam_questions FOR SELECT USING (true);
CREATE POLICY "Anyone can read curriculum shifts" ON public.curriculum_shift_events FOR SELECT USING (true);

-- Admin write policies
CREATE POLICY "Admins can manage evolution patterns" ON public.exam_evolution_patterns FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can manage evolution reports" ON public.exam_evolution_reports FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can manage micro concepts" ON public.micro_concepts FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can manage question dna" ON public.question_dna_clusters FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can manage generated questions" ON public.generated_exam_questions FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can manage curriculum shifts" ON public.curriculum_shift_events FOR ALL USING (public.is_admin(auth.uid()));

-- Confidence bands: user sees own, admin sees all
CREATE POLICY "Users can read own confidence bands" ON public.prediction_confidence_bands FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage confidence bands" ON public.prediction_confidence_bands FOR ALL USING (public.is_admin(auth.uid()));

-- Triggers
CREATE TRIGGER update_evolution_patterns_updated_at BEFORE UPDATE ON public.exam_evolution_patterns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_micro_concepts_updated_at BEFORE UPDATE ON public.micro_concepts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_question_dna_updated_at BEFORE UPDATE ON public.question_dna_clusters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
