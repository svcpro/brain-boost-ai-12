
CREATE TABLE public.question_performance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  question_hash TEXT NOT NULL,
  question_text TEXT NOT NULL,
  options JSONB,
  correct_index INTEGER NOT NULL,
  explanation TEXT,
  times_seen INTEGER NOT NULL DEFAULT 1,
  times_wrong INTEGER NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_wrong_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, question_hash)
);

ALTER TABLE public.question_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own question_performance"
  ON public.question_performance FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_qp_user_wrong ON public.question_performance (user_id, times_wrong DESC);
