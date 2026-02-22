
-- ============================================
-- CURRENT AFFAIRS 3.0: Policy Impact Predictor
-- ============================================

-- MODULE 1: Policy Similarity Engine
CREATE TABLE public.ca_policy_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.ca_events(id) ON DELETE CASCADE,
  policy_title TEXT NOT NULL,
  policy_summary TEXT,
  policy_category TEXT,
  exam_types TEXT[] DEFAULT '{}',
  similarity_scan_status TEXT DEFAULT 'pending',
  top_similarity_score NUMERIC(4,3) DEFAULT 0,
  impact_scan_status TEXT DEFAULT 'pending',
  overall_impact_score NUMERIC(4,3) DEFAULT 0,
  controversy_likelihood NUMERIC(4,3) DEFAULT 0,
  predicted_exam_framing TEXT,
  question_probability_increase NUMERIC(5,2) DEFAULT 0,
  ai_reasoning TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Historical policy similarity matches
CREATE TABLE public.ca_policy_similarities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_analysis_id UUID REFERENCES public.ca_policy_analyses(id) ON DELETE CASCADE,
  historical_policy_name TEXT NOT NULL,
  historical_policy_year INTEGER,
  similarity_score NUMERIC(4,3) NOT NULL DEFAULT 0,
  match_dimensions JSONB DEFAULT '{}',
  pattern_type TEXT,
  exam_appearance_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- MODULE 2: Impact Forecast Model
CREATE TABLE public.ca_impact_forecasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_analysis_id UUID REFERENCES public.ca_policy_analyses(id) ON DELETE CASCADE,
  impact_type TEXT NOT NULL, -- 'direct', 'indirect_ripple', 'controversy'
  topic_name TEXT NOT NULL,
  subject TEXT,
  current_tpi NUMERIC(5,3) DEFAULT 0,
  predicted_tpi_shift NUMERIC(5,3) DEFAULT 0,
  confidence NUMERIC(4,3) DEFAULT 0,
  time_horizon TEXT, -- 'immediate', '3_months', '6_months', '1_year'
  reasoning TEXT,
  micro_topics JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- MODULE 3: Probability Adjustments (TPI dynamic updates)
CREATE TABLE public.ca_probability_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_analysis_id UUID REFERENCES public.ca_policy_analyses(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  exam_type TEXT NOT NULL,
  subject TEXT,
  topic_name TEXT NOT NULL,
  old_probability NUMERIC(5,3) DEFAULT 0,
  new_probability NUMERIC(5,3) DEFAULT 0,
  adjustment_reason TEXT,
  adjustment_source TEXT DEFAULT 'ca_3.0_predictor',
  applied_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending', -- 'pending', 'applied', 'reverted'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_ca_policy_analyses_event ON public.ca_policy_analyses(event_id);
CREATE INDEX idx_ca_policy_similarities_analysis ON public.ca_policy_similarities(policy_analysis_id);
CREATE INDEX idx_ca_impact_forecasts_analysis ON public.ca_impact_forecasts(policy_analysis_id);
CREATE INDEX idx_ca_probability_adjustments_analysis ON public.ca_probability_adjustments(policy_analysis_id);
CREATE INDEX idx_ca_probability_adjustments_status ON public.ca_probability_adjustments(status);

-- RLS
ALTER TABLE public.ca_policy_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ca_policy_similarities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ca_impact_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ca_probability_adjustments ENABLE ROW LEVEL SECURITY;

-- Admin-only write, authenticated read
CREATE POLICY "Admins manage policy analyses" ON public.ca_policy_analyses FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Authenticated read policy analyses" ON public.ca_policy_analyses FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage policy similarities" ON public.ca_policy_similarities FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Authenticated read policy similarities" ON public.ca_policy_similarities FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage impact forecasts" ON public.ca_impact_forecasts FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Authenticated read impact forecasts" ON public.ca_impact_forecasts FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage probability adjustments" ON public.ca_probability_adjustments FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Authenticated read probability adjustments" ON public.ca_probability_adjustments FOR SELECT USING (auth.uid() IS NOT NULL);

-- Triggers
CREATE TRIGGER update_ca_policy_analyses_updated_at BEFORE UPDATE ON public.ca_policy_analyses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
