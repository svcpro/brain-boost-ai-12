-- ───────────────────────────────────────────────────────────
-- Forgetting Curve 2.0 — autonomous interventions + AI cache
-- ───────────────────────────────────────────────────────────

-- 1. Interventions log (autonomous rescue actions)
CREATE TABLE IF NOT EXISTS public.fc2_interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  topic_id UUID,
  topic_name TEXT NOT NULL,
  subject_name TEXT,
  intervention_type TEXT NOT NULL, -- 'micro_quiz' | 'schedule_inject' | 'push_alert' | 'rescue_card'
  trigger_reason TEXT NOT NULL,    -- 'retention_below_threshold' | 'rapid_decay' | 'critical_drop'
  predicted_retention NUMERIC(5,2),
  risk_score NUMERIC(5,2),
  status TEXT NOT NULL DEFAULT 'queued', -- queued | dispatched | acknowledged | dismissed
  payload JSONB DEFAULT '{}'::jsonb,
  dispatched_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fc2_interventions_user_created
  ON public.fc2_interventions (user_id, created_at DESC);

ALTER TABLE public.fc2_interventions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own fc2 interventions"
  ON public.fc2_interventions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own fc2 interventions"
  ON public.fc2_interventions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all fc2 interventions"
  ON public.fc2_interventions FOR SELECT
  USING (public.is_admin(auth.uid()));

-- 2. AI insights cache (narrative + what-if simulator results)
CREATE TABLE IF NOT EXISTS public.fc2_ai_insights (
  user_id UUID NOT NULL,
  insight_key TEXT NOT NULL, -- 'overall_narrative' | 'whatif:<topic_id>:<scenario>' | 'topic_explain:<topic_id>'
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  model_used TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '6 hours'),
  PRIMARY KEY (user_id, insight_key)
);

ALTER TABLE public.fc2_ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own fc2 insights"
  ON public.fc2_ai_insights FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all fc2 insights"
  ON public.fc2_ai_insights FOR SELECT
  USING (public.is_admin(auth.uid()));

-- 3. Risk events (audit log for threshold crossings)
CREATE TABLE IF NOT EXISTS public.fc2_risk_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  topic_id UUID,
  topic_name TEXT NOT NULL,
  previous_risk TEXT,
  new_risk TEXT NOT NULL,
  predicted_retention NUMERIC(5,2),
  decay_velocity NUMERIC(8,4), -- retention drop per 24h
  factors JSONB DEFAULT '{}'::jsonb,
  model_version TEXT NOT NULL DEFAULT '2.0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fc2_risk_events_user_created
  ON public.fc2_risk_events (user_id, created_at DESC);

ALTER TABLE public.fc2_risk_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own fc2 risk events"
  ON public.fc2_risk_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all fc2 risk events"
  ON public.fc2_risk_events FOR SELECT
  USING (public.is_admin(auth.uid()));