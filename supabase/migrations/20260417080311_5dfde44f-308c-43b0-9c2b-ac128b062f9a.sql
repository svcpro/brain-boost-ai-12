-- ─── Quota ───
CREATE TABLE IF NOT EXISTS public.whatsapp_quota (
  user_id uuid PRIMARY KEY,
  month_key text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  monthly_limit integer NOT NULL DEFAULT 40,
  last_sent_at timestamptz,
  reset_at timestamptz NOT NULL DEFAULT date_trunc('month', now()) + interval '1 month',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_quota_month ON public.whatsapp_quota(month_key);

-- ─── Config (single row) ───
CREATE TABLE IF NOT EXISTS public.whatsapp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled boolean NOT NULL DEFAULT true,
  monthly_limit_per_user integer NOT NULL DEFAULT 40,
  allowed_categories text[] NOT NULL DEFAULT ARRAY['critical','engagement']::text[],
  fallback_channels text[] NOT NULL DEFAULT ARRAY['push','email']::text[],
  integrated_number text NOT NULL DEFAULT '918796032562',
  default_namespace text NOT NULL DEFAULT '5a93dcbd_6802_42d5_af95_17d4fd2d7441',
  auto_fallback_on_quota_exceeded boolean NOT NULL DEFAULT true,
  provider text NOT NULL DEFAULT 'msg91',
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.whatsapp_config (is_enabled)
SELECT true WHERE NOT EXISTS (SELECT 1 FROM public.whatsapp_config);

-- ─── Scheduled sends ───
CREATE TABLE IF NOT EXISTS public.whatsapp_scheduled_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  category text NOT NULL DEFAULT 'engagement',
  audience_type text NOT NULL DEFAULT 'all',
  audience_user_ids uuid[],
  audience_filters jsonb DEFAULT '{}'::jsonb,
  variables jsonb DEFAULT '{}'::jsonb,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  total_recipients integer NOT NULL DEFAULT 0,
  delivered_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  blocked_quota_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sched_status ON public.whatsapp_scheduled_sends(status, scheduled_at);

-- ─── Profile opt-in ───
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_categories text[] NOT NULL DEFAULT ARRAY['critical','engagement']::text[];

-- ─── RLS ───
ALTER TABLE public.whatsapp_quota ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_scheduled_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wa_quota_user_read" ON public.whatsapp_quota;
CREATE POLICY "wa_quota_user_read"
  ON public.whatsapp_quota FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "wa_quota_admin_all" ON public.whatsapp_quota;
CREATE POLICY "wa_quota_admin_all"
  ON public.whatsapp_quota FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "wa_config_admin_all" ON public.whatsapp_config;
CREATE POLICY "wa_config_admin_all"
  ON public.whatsapp_config FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "wa_config_public_read" ON public.whatsapp_config;
CREATE POLICY "wa_config_public_read"
  ON public.whatsapp_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "wa_sched_admin_all" ON public.whatsapp_scheduled_sends;
CREATE POLICY "wa_sched_admin_all"
  ON public.whatsapp_scheduled_sends FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Triggers
DROP TRIGGER IF EXISTS update_whatsapp_quota_updated_at ON public.whatsapp_quota;
CREATE TRIGGER update_whatsapp_quota_updated_at
  BEFORE UPDATE ON public.whatsapp_quota
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_whatsapp_sched_updated_at ON public.whatsapp_scheduled_sends;
CREATE TRIGGER update_whatsapp_sched_updated_at
  BEFORE UPDATE ON public.whatsapp_scheduled_sends
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── Helper Functions ───
CREATE OR REPLACE FUNCTION public.whatsapp_quota_remaining(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_count integer;
  v_month text;
BEGIN
  SELECT monthly_limit_per_user INTO v_limit FROM whatsapp_config LIMIT 1;
  v_limit := COALESCE(v_limit, 40);
  v_month := to_char(now(), 'YYYY-MM');
  SELECT count INTO v_count FROM whatsapp_quota
    WHERE user_id = p_user_id AND month_key = v_month;
  RETURN GREATEST(0, v_limit - COALESCE(v_count, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_quota_increment(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month text;
  v_new_count integer;
  v_limit integer;
BEGIN
  v_month := to_char(now(), 'YYYY-MM');
  SELECT monthly_limit_per_user INTO v_limit FROM whatsapp_config LIMIT 1;
  INSERT INTO whatsapp_quota (user_id, month_key, count, monthly_limit, last_sent_at)
  VALUES (p_user_id, v_month, 1, COALESCE(v_limit, 40), now())
  ON CONFLICT (user_id) DO UPDATE
    SET count = CASE WHEN whatsapp_quota.month_key = v_month
                     THEN whatsapp_quota.count + 1 ELSE 1 END,
        month_key = v_month,
        monthly_limit = COALESCE(v_limit, 40),
        last_sent_at = now(),
        reset_at = date_trunc('month', now()) + interval '1 month',
        updated_at = now()
  RETURNING count INTO v_new_count;
  RETURN v_new_count;
END;
$$;