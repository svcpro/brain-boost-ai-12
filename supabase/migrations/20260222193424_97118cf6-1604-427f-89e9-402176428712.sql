
-- CA 4.0 Debate & Analytical Writing Engine

-- Table 1: Debate topics / multi-angle analyses
CREATE TABLE public.ca_debate_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.ca_events(id) ON DELETE SET NULL,
  topic_title TEXT NOT NULL,
  topic_context TEXT,
  pro_arguments JSONB DEFAULT '[]',
  counter_arguments JSONB DEFAULT '[]',
  ethical_dimension TEXT,
  economic_dimension TEXT,
  constitutional_link TEXT,
  international_perspective TEXT,
  frameworks_applied JSONB DEFAULT '[]',
  exam_relevance_score NUMERIC DEFAULT 0,
  exam_types TEXT[] DEFAULT '{"UPSC CSE"}',
  status TEXT DEFAULT 'generated',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ca_debate_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage debate analyses"
  ON public.ca_debate_analyses FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated users can read debate analyses"
  ON public.ca_debate_analyses FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_ca_debate_analyses_updated_at
  BEFORE UPDATE ON public.ca_debate_analyses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table 2: Framework applications (PESTLE, stakeholder, cost-benefit, etc.)
CREATE TABLE public.ca_framework_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  debate_analysis_id UUID REFERENCES public.ca_debate_analyses(id) ON DELETE CASCADE,
  framework_type TEXT NOT NULL, -- pestle, stakeholder, cost_benefit, long_short_term
  framework_data JSONB NOT NULL DEFAULT '{}',
  ai_summary TEXT,
  quality_score NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ca_framework_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage framework applications"
  ON public.ca_framework_applications FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated users can read framework applications"
  ON public.ca_framework_applications FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Table 3: Writing submissions & evaluations
CREATE TABLE public.ca_writing_evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  debate_analysis_id UUID REFERENCES public.ca_debate_analyses(id) ON DELETE SET NULL,
  topic_title TEXT NOT NULL,
  user_answer TEXT NOT NULL,
  word_count INT DEFAULT 0,
  time_taken_seconds INT,
  structure_score NUMERIC DEFAULT 0,
  depth_score NUMERIC DEFAULT 0,
  evidence_score NUMERIC DEFAULT 0,
  clarity_score NUMERIC DEFAULT 0,
  logical_flow_score NUMERIC DEFAULT 0,
  overall_score NUMERIC DEFAULT 0,
  ai_feedback TEXT,
  improvement_areas JSONB DEFAULT '[]',
  strengths JSONB DEFAULT '[]',
  model_answer TEXT,
  evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ca_writing_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own writing evaluations"
  ON public.ca_writing_evaluations FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all writing evaluations"
  ON public.ca_writing_evaluations FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_ca_writing_evaluations_updated_at
  BEFORE UPDATE ON public.ca_writing_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
