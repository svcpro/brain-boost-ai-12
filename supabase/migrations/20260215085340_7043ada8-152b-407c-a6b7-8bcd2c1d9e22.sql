
-- Store RL signals and completion metrics for each generated plan
CREATE TABLE public.plan_quality_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_id UUID REFERENCES public.study_plans(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rl_signals JSONB NOT NULL DEFAULT '{}',
  overall_completion_rate NUMERIC,
  sessions_total INTEGER,
  sessions_completed INTEGER
);

ALTER TABLE public.plan_quality_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plan quality logs"
  ON public.plan_quality_logs FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plan quality logs"
  ON public.plan_quality_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plan quality logs"
  ON public.plan_quality_logs FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_plan_quality_user ON public.plan_quality_logs(user_id, created_at DESC);
