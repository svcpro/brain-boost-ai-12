
-- Voice Broadcast (OBD) tables
CREATE TABLE IF NOT EXISTS public.voice_broadcast_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled boolean NOT NULL DEFAULT true,
  signup_trigger_enabled boolean NOT NULL DEFAULT false,
  inactive_trigger_enabled boolean NOT NULL DEFAULT false,
  inactive_tiers text[] NOT NULL DEFAULT ARRAY['inactive_3d','inactive_7d']::text[],
  default_welcome_prompt_id text,
  default_tts_text text DEFAULT 'Hi {{name}}, this is ACRY AI. Your study plan is ready. Open the app and continue your journey.',
  schedule_lead_minutes integer NOT NULL DEFAULT 11,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.voice_broadcast_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vbc_admin_all" ON public.voice_broadcast_config FOR ALL TO authenticated
USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.voice_broadcast_config (is_enabled) VALUES (true) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.voice_broadcast_voice_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id text NOT NULL UNIQUE,
  file_name text NOT NULL,
  prompt_category text,
  prompt_status integer,
  is_active boolean NOT NULL DEFAULT true,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.voice_broadcast_voice_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vbvf_admin_all" ON public.voice_broadcast_voice_files FOR ALL TO authenticated
USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.voice_broadcast_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id_external text,
  base_id text,
  campaign_name text NOT NULL,
  campaign_type text NOT NULL DEFAULT 'basic',
  template_id integer NOT NULL DEFAULT 0,
  prompt_id text,
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.voice_broadcast_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vbcamp_admin_all" ON public.voice_broadcast_campaigns FOR ALL TO authenticated
USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_vbcamp_created ON public.voice_broadcast_campaigns(created_at DESC);

CREATE TABLE IF NOT EXISTS public.voice_broadcast_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  phone text,
  trigger_key text NOT NULL DEFAULT 'manual',
  campaign_id_external text,
  prompt_id text,
  status text NOT NULL DEFAULT 'queued',
  response jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.voice_broadcast_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vblogs_admin_read" ON public.voice_broadcast_logs FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_vblogs_user ON public.voice_broadcast_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vblogs_trigger ON public.voice_broadcast_logs(trigger_key, created_at DESC);

CREATE TABLE IF NOT EXISTS public.voice_broadcast_token_cache (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  token text NOT NULL,
  user_id_obd text,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.voice_broadcast_token_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vbt_admin_read" ON public.voice_broadcast_token_cache FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_vbconfig_updated BEFORE UPDATE ON public.voice_broadcast_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_vbcamp_updated BEFORE UPDATE ON public.voice_broadcast_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
