-- Run log
CREATE TABLE IF NOT EXISTS public.sms_orchestration_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by TEXT NOT NULL DEFAULT 'cron',
  triggered_by_user UUID,
  status TEXT NOT NULL DEFAULT 'running',
  dry_run BOOLEAN NOT NULL DEFAULT false,
  model TEXT,
  users_scanned INTEGER NOT NULL DEFAULT 0,
  decisions_made INTEGER NOT NULL DEFAULT 0,
  sms_sent INTEGER NOT NULL DEFAULT 0,
  sms_skipped INTEGER NOT NULL DEFAULT 0,
  sms_failed INTEGER NOT NULL DEFAULT 0,
  ai_calls INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  decisions JSONB NOT NULL DEFAULT '[]'::jsonb,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sms_orch_log_started ON public.sms_orchestration_log (started_at DESC);

ALTER TABLE public.sms_orchestration_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read orch log"
  ON public.sms_orchestration_log FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "admins manage orch log"
  ON public.sms_orchestration_log FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Config (single-row)
CREATE TABLE IF NOT EXISTS public.sms_orchestration_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN NOT NULL DEFAULT true,
  dry_run BOOLEAN NOT NULL DEFAULT false,
  max_per_user_per_day INTEGER NOT NULL DEFAULT 3,
  max_users_per_run INTEGER NOT NULL DEFAULT 200,
  lookback_hours INTEGER NOT NULL DEFAULT 72,
  quiet_hours_start INTEGER NOT NULL DEFAULT 22,
  quiet_hours_end INTEGER NOT NULL DEFAULT 8,
  ai_model TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.sms_orchestration_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage orch config"
  ON public.sms_orchestration_config FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_sms_orch_config_updated
  BEFORE UPDATE ON public.sms_orchestration_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.sms_orchestration_config (enabled, dry_run, max_per_user_per_day, max_users_per_run, ai_model)
SELECT true, false, 3, 200, 'google/gemini-3-flash-preview'
WHERE NOT EXISTS (SELECT 1 FROM public.sms_orchestration_config);