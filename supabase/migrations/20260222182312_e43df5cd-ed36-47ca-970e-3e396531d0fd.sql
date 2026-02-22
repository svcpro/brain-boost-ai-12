
-- ====================================
-- EXAM INTEL v10.0 — Full Autonomous Pipeline
-- ====================================

-- 1. Topic Probability Index (TPI) — per-exam per-topic prediction scores
CREATE TABLE IF NOT EXISTS public.exam_intel_topic_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  topic_id UUID REFERENCES public.topics(id),
  probability_score NUMERIC NOT NULL DEFAULT 0.5,
  trend_direction TEXT NOT NULL DEFAULT 'stable',
  historical_frequency NUMERIC DEFAULT 0,
  ai_confidence NUMERIC DEFAULT 0.7,
  last_appeared_year INTEGER,
  consecutive_appearances INTEGER DEFAULT 0,
  predicted_marks_weight NUMERIC DEFAULT 0,
  ca_boost_score NUMERIC DEFAULT 0,
  composite_score NUMERIC GENERATED ALWAYS AS (
    probability_score * 0.4 + historical_frequency * 0.25 + COALESCE(ca_boost_score, 0) * 0.15 + ai_confidence * 0.2
  ) STORED,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_intel_topic_scores_exam ON public.exam_intel_topic_scores(exam_type, composite_score DESC);

ALTER TABLE public.exam_intel_topic_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read intel topic scores" ON public.exam_intel_topic_scores FOR SELECT USING (true);
CREATE POLICY "Service can manage intel topic scores" ON public.exam_intel_topic_scores FOR ALL USING (true);

-- 2. Per-Student Intel Briefs — personalized predictions
CREATE TABLE IF NOT EXISTS public.exam_intel_student_briefs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  exam_type TEXT NOT NULL,
  predicted_hot_topics JSONB DEFAULT '[]',
  weakness_overlap JSONB DEFAULT '[]',
  risk_topics JSONB DEFAULT '[]',
  opportunity_topics JSONB DEFAULT '[]',
  overall_readiness_score NUMERIC DEFAULT 0,
  recommended_actions JSONB DEFAULT '[]',
  ai_strategy_summary TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_intel_student_briefs_user ON public.exam_intel_student_briefs(user_id, exam_type);

ALTER TABLE public.exam_intel_student_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own intel briefs" ON public.exam_intel_student_briefs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service manages intel briefs" ON public.exam_intel_student_briefs FOR ALL USING (true);

-- 3. Intel Alerts — push when probability spikes
CREATE TABLE IF NOT EXISTS public.exam_intel_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  alert_type TEXT NOT NULL DEFAULT 'probability_spike',
  topic TEXT NOT NULL,
  subject TEXT,
  exam_type TEXT NOT NULL,
  old_score NUMERIC,
  new_score NUMERIC,
  severity TEXT NOT NULL DEFAULT 'medium',
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  is_pushed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_intel_alerts_user ON public.exam_intel_alerts(user_id, is_read, created_at DESC);

ALTER TABLE public.exam_intel_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own intel alerts" ON public.exam_intel_alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own intel alerts" ON public.exam_intel_alerts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service manages intel alerts" ON public.exam_intel_alerts FOR INSERT WITH CHECK (true);

-- 4. Intel Pipeline Runs — track autonomous execution
CREATE TABLE IF NOT EXISTS public.exam_intel_pipeline_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_type TEXT NOT NULL,
  pipeline_stage TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  topics_analyzed INTEGER DEFAULT 0,
  predictions_generated INTEGER DEFAULT 0,
  alerts_created INTEGER DEFAULT 0,
  student_briefs_updated INTEGER DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_intel_pipeline_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read pipeline runs" ON public.exam_intel_pipeline_runs FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Service manages pipeline runs" ON public.exam_intel_pipeline_runs FOR ALL USING (true);

-- 5. Intel Practice Questions — curated high-probability questions for students
CREATE TABLE IF NOT EXISTS public.exam_intel_practice_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  correct_answer INTEGER NOT NULL DEFAULT 0,
  explanation TEXT,
  difficulty_level TEXT DEFAULT 'medium',
  cognitive_type TEXT DEFAULT 'application',
  probability_score NUMERIC DEFAULT 0.5,
  source TEXT DEFAULT 'ai_generated',
  is_active BOOLEAN DEFAULT true,
  times_served INTEGER DEFAULT 0,
  correct_rate NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_intel_practice_exam ON public.exam_intel_practice_questions(exam_type, probability_score DESC);

ALTER TABLE public.exam_intel_practice_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active intel questions" ON public.exam_intel_practice_questions FOR SELECT USING (is_active = true);
CREATE POLICY "Service manages intel questions" ON public.exam_intel_practice_questions FOR ALL USING (true);

-- Enable realtime for alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.exam_intel_alerts;
