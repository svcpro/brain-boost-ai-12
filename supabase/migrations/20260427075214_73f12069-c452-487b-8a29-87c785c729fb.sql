CREATE TABLE IF NOT EXISTS public.sms_scheduled_dispatches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_key TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'ai_orchestrator',
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_sched_disp_due
  ON public.sms_scheduled_dispatches (scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_sms_sched_disp_user_day
  ON public.sms_scheduled_dispatches (user_id, scheduled_for);

ALTER TABLE public.sms_scheduled_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view scheduled dispatches"
  ON public.sms_scheduled_dispatches
  FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_sms_sched_disp_updated_at
  BEFORE UPDATE ON public.sms_scheduled_dispatches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();