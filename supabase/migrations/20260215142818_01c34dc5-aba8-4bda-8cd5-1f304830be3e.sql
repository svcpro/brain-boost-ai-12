
-- Anonymized global learning patterns table (no user_id references)
CREATE TABLE public.global_learning_patterns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern_date date NOT NULL DEFAULT CURRENT_DATE,
  pattern_type text NOT NULL, -- 'topic_difficulty', 'study_timing', 'decay_patterns', 'revision_effectiveness', 'exam_trends'
  pattern_key text NOT NULL, -- e.g. topic name, hour of day, etc.
  sample_size integer NOT NULL DEFAULT 0,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(pattern_date, pattern_type, pattern_key)
);

-- Enable RLS
ALTER TABLE public.global_learning_patterns ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read global patterns (they're anonymized)
CREATE POLICY "Authenticated users can view global patterns"
  ON public.global_learning_patterns
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only service role can insert/update (via edge function)
-- No INSERT/UPDATE/DELETE policies for regular users

-- Index for fast lookups
CREATE INDEX idx_global_patterns_type_date ON public.global_learning_patterns(pattern_type, pattern_date DESC);
CREATE INDEX idx_global_patterns_date ON public.global_learning_patterns(pattern_date DESC);

-- Trigger for updated_at
CREATE TRIGGER update_global_patterns_updated_at
  BEFORE UPDATE ON public.global_learning_patterns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
