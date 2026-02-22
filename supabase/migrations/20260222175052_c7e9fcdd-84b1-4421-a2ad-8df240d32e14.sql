
-- Auto-pilot configuration for Current Affairs 2.0
CREATE TABLE public.ca_autopilot_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  fetch_interval_hours INT NOT NULL DEFAULT 6,
  exam_types TEXT[] NOT NULL DEFAULT ARRAY['UPSC CSE'],
  categories TEXT[] NOT NULL DEFAULT ARRAY['polity', 'economy', 'science', 'environment', 'international', 'social', 'defence'],
  auto_approve_questions BOOLEAN NOT NULL DEFAULT false,
  last_auto_run_at TIMESTAMPTZ,
  total_auto_runs INT NOT NULL DEFAULT 0,
  total_events_fetched INT NOT NULL DEFAULT 0,
  total_questions_generated INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.ca_autopilot_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage CA autopilot config"
  ON public.ca_autopilot_config FOR ALL
  USING (public.is_admin(auth.uid()));

-- Insert default config row
INSERT INTO public.ca_autopilot_config (id) VALUES (gen_random_uuid());

-- Add source column to track auto vs manual events
ALTER TABLE public.ca_events ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
