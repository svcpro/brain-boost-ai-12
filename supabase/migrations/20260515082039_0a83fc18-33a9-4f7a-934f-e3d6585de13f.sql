
-- Meta (Facebook) Conversion API configuration
CREATE TABLE IF NOT EXISTS public.meta_capi_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pixel_id text,
  test_event_code text,
  enabled boolean NOT NULL DEFAULT false,
  send_from_client boolean NOT NULL DEFAULT false,
  default_currency text NOT NULL DEFAULT 'INR',
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_capi_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view meta_capi_config"
  ON public.meta_capi_config FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert meta_capi_config"
  ON public.meta_capi_config FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update meta_capi_config"
  ON public.meta_capi_config FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_meta_capi_config_updated
  BEFORE UPDATE ON public.meta_capi_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Event log
CREATE TABLE IF NOT EXISTS public.meta_capi_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  event_id text,
  user_id uuid,
  event_source_url text,
  status text NOT NULL DEFAULT 'pending',
  http_status int,
  fb_trace_id text,
  request_payload jsonb,
  response_payload jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_capi_events_created ON public.meta_capi_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meta_capi_events_user ON public.meta_capi_events (user_id);

ALTER TABLE public.meta_capi_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view meta_capi_events"
  ON public.meta_capi_events FOR SELECT
  USING (public.is_admin(auth.uid()));
