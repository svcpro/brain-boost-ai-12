
CREATE TABLE IF NOT EXISTS public.sms_broadcast_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID,
  status TEXT NOT NULL DEFAULT 'running',
  total_pairs INT NOT NULL DEFAULT 0,
  sent INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  skipped INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  last_error TEXT,
  results JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_broadcast_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view broadcast jobs"
  ON public.sms_broadcast_jobs FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert broadcast jobs"
  ON public.sms_broadcast_jobs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));
