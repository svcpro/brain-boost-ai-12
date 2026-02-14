
-- Table to track streak freeze inventory and usage
CREATE TABLE public.streak_freezes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  used_date DATE NULL, -- NULL = available/unused, date = used on that day
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.streak_freezes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own streak_freezes"
  ON public.streak_freezes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_streak_freezes_user ON public.streak_freezes (user_id);
CREATE INDEX idx_streak_freezes_used ON public.streak_freezes (user_id, used_date);
