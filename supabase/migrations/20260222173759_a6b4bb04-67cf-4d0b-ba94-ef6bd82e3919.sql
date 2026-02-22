
-- Current Affairs Events
CREATE TABLE public.ca_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  source_url TEXT,
  source_name TEXT,
  event_date DATE DEFAULT CURRENT_DATE,
  category TEXT DEFAULT 'general',
  importance_score NUMERIC DEFAULT 0,
  processing_status TEXT DEFAULT 'pending',
  raw_content TEXT,
  ai_analysis JSONB,
  entity_count INT DEFAULT 0,
  syllabus_link_count INT DEFAULT 0,
  question_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Entity types: policy, scheme, govt_body, constitutional_article, act, location, economic_indicator, person, organization
CREATE TABLE public.ca_entities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  occurrence_count INT DEFAULT 1,
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(name, entity_type)
);

-- Junction: event <-> entity
CREATE TABLE public.ca_event_entities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.ca_events(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES public.ca_entities(id) ON DELETE CASCADE,
  relevance_score NUMERIC DEFAULT 0.5,
  context_snippet TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, entity_id)
);

-- Knowledge graph connections (event -> syllabus/history/PYQ/policy/impact)
CREATE TABLE public.ca_graph_edges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.ca_events(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL, -- 'syllabus', 'historical', 'pyq', 'policy', 'impact'
  target_label TEXT NOT NULL,
  target_ref_id TEXT, -- optional: topic_id, question_id, etc.
  weight NUMERIC DEFAULT 0.5,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Syllabus linking
CREATE TABLE public.ca_syllabus_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.ca_events(id) ON DELETE CASCADE,
  exam_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  micro_topic TEXT NOT NULL,
  topic_id UUID,
  relevance_score NUMERIC DEFAULT 0.5,
  tpi_impact NUMERIC DEFAULT 0,
  pattern_detected BOOLEAN DEFAULT false,
  pattern_details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-generated questions from CA
CREATE TABLE public.ca_generated_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.ca_events(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL, -- 'prelims_mcq', 'mains_10', 'mains_15', 'interview'
  exam_type TEXT DEFAULT 'UPSC',
  question_text TEXT NOT NULL,
  options JSONB, -- for MCQ
  correct_answer TEXT,
  explanation TEXT,
  difficulty TEXT DEFAULT 'moderate',
  cognitive_level TEXT DEFAULT 'application',
  marks INT,
  status TEXT DEFAULT 'draft', -- draft, approved, rejected
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ca_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ca_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ca_event_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ca_graph_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ca_syllabus_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ca_generated_questions ENABLE ROW LEVEL SECURITY;

-- Admin-only policies (read/write for admins)
CREATE POLICY "Admins can manage ca_events" ON public.ca_events FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can manage ca_entities" ON public.ca_entities FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can manage ca_event_entities" ON public.ca_event_entities FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can manage ca_graph_edges" ON public.ca_graph_edges FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can manage ca_syllabus_links" ON public.ca_syllabus_links FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can manage ca_generated_questions" ON public.ca_generated_questions FOR ALL USING (public.is_admin(auth.uid()));

-- Read access for authenticated users (students can view events and questions)
CREATE POLICY "Users can read ca_events" ON public.ca_events FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can read ca_entities" ON public.ca_entities FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can read ca_graph_edges" ON public.ca_graph_edges FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can read ca_syllabus_links" ON public.ca_syllabus_links FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can read approved ca_questions" ON public.ca_generated_questions FOR SELECT USING (auth.uid() IS NOT NULL AND status = 'approved');

-- Indexes
CREATE INDEX idx_ca_events_status ON public.ca_events(processing_status);
CREATE INDEX idx_ca_events_date ON public.ca_events(event_date DESC);
CREATE INDEX idx_ca_entities_type ON public.ca_entities(entity_type);
CREATE INDEX idx_ca_graph_edges_event ON public.ca_graph_edges(event_id);
CREATE INDEX idx_ca_graph_edges_type ON public.ca_graph_edges(edge_type);
CREATE INDEX idx_ca_syllabus_exam ON public.ca_syllabus_links(exam_type);
CREATE INDEX idx_ca_questions_event ON public.ca_generated_questions(event_id);
CREATE INDEX idx_ca_questions_type ON public.ca_generated_questions(question_type);

-- Triggers for updated_at
CREATE TRIGGER update_ca_events_updated_at BEFORE UPDATE ON public.ca_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
