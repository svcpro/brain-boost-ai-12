
-- ─── SMS Config ───
CREATE TABLE IF NOT EXISTS public.sms_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled boolean NOT NULL DEFAULT true,
  monthly_limit_per_user int NOT NULL DEFAULT 60,
  allowed_categories text[] NOT NULL DEFAULT ARRAY['critical','transactional','engagement'],
  critical_categories text[] NOT NULL DEFAULT ARRAY['critical','otp','security','payment'],
  fallback_channels text[] NOT NULL DEFAULT ARRAY['push','email'],
  auto_fallback_on_quota_exceeded boolean NOT NULL DEFAULT true,
  sender_id text NOT NULL DEFAULT 'ACRYAI',
  default_dlt_template_id text,
  default_route text NOT NULL DEFAULT '4',
  default_country text NOT NULL DEFAULT '91',
  provider text NOT NULL DEFAULT 'msg91',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO public.sms_config (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- ─── SMS Templates ───
CREATE TABLE IF NOT EXISTS public.sms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  body_template text NOT NULL,
  category text NOT NULL DEFAULT 'engagement',
  variables jsonb DEFAULT '[]'::jsonb,
  dlt_template_id text,
  sender_id text,
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ─── SMS Messages Log ───
CREATE TABLE IF NOT EXISTS public.sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  to_number text NOT NULL,
  message_body text NOT NULL,
  template_name text,
  template_params jsonb DEFAULT '{}'::jsonb,
  category text,
  priority text DEFAULT 'medium',
  status text NOT NULL DEFAULT 'sent',
  msg91_request_id text,
  error_code text,
  error_message text,
  source text DEFAULT 'manual',
  fallback_sent boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_sms_messages_user ON public.sms_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_messages_status ON public.sms_messages(status, created_at DESC);

-- ─── SMS Quota ───
CREATE TABLE IF NOT EXISTS public.sms_quota (
  user_id uuid PRIMARY KEY,
  month_key text NOT NULL,
  count int NOT NULL DEFAULT 0,
  monthly_limit int NOT NULL DEFAULT 60,
  last_sent_at timestamptz,
  reset_at timestamptz NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Scheduled Sends ───
CREATE TABLE IF NOT EXISTS public.sms_scheduled_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  category text NOT NULL DEFAULT 'engagement',
  variables jsonb DEFAULT '{}'::jsonb,
  audience_type text NOT NULL DEFAULT 'all',
  audience_user_ids uuid[],
  audience_filters jsonb,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  total_recipients int DEFAULT 0,
  delivered_count int DEFAULT 0,
  failed_count int DEFAULT 0,
  blocked_quota_count int DEFAULT 0,
  executed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Quota RPCs ───
CREATE OR REPLACE FUNCTION public.sms_quota_remaining(p_user_id uuid)
RETURNS int
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_limit int;
  v_count int;
  v_month text;
BEGIN
  SELECT monthly_limit_per_user INTO v_limit FROM sms_config LIMIT 1;
  v_limit := COALESCE(v_limit, 60);
  v_month := to_char(now(), 'YYYY-MM');
  SELECT count INTO v_count FROM sms_quota
    WHERE user_id = p_user_id AND month_key = v_month;
  RETURN GREATEST(0, v_limit - COALESCE(v_count, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.sms_quota_increment(p_user_id uuid)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_month text;
  v_new_count int;
  v_limit int;
BEGIN
  v_month := to_char(now(), 'YYYY-MM');
  SELECT monthly_limit_per_user INTO v_limit FROM sms_config LIMIT 1;
  INSERT INTO sms_quota (user_id, month_key, count, monthly_limit, last_sent_at)
  VALUES (p_user_id, v_month, 1, COALESCE(v_limit, 60), now())
  ON CONFLICT (user_id) DO UPDATE
    SET count = CASE WHEN sms_quota.month_key = v_month
                     THEN sms_quota.count + 1 ELSE 1 END,
        month_key = v_month,
        monthly_limit = COALESCE(v_limit, 60),
        last_sent_at = now(),
        reset_at = date_trunc('month', now()) + interval '1 month',
        updated_at = now()
  RETURNING count INTO v_new_count;
  RETURN v_new_count;
END;
$$;

-- ─── RLS ───
ALTER TABLE public.sms_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_quota ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_scheduled_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage sms_config" ON public.sms_config
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admins manage sms_templates" ON public.sms_templates
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admins read sms_messages" ON public.sms_messages
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR auth.uid() = user_id);

CREATE POLICY "admins manage sms_messages" ON public.sms_messages
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "users see own sms_quota" ON public.sms_quota
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "admins manage sms_quota" ON public.sms_quota
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admins manage sms_scheduled" ON public.sms_scheduled_sends
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ─── Seed common templates ───
INSERT INTO public.sms_templates (name, display_name, body_template, category, variables, description) VALUES
  ('daily_mission_reminder', 'Daily Mission Reminder', 'Hi {{name}}, your ACRY mission is ready. Complete it now to keep your streak: acry.ai', 'engagement', '["name"]'::jsonb, 'Sent each morning to active users'),
  ('streak_risk_alert', 'Streak Risk Alert', '⚠️ {{name}}, your {{days}}-day streak ends in {{hours}}h. Open ACRY to save it: acry.ai', 'engagement', '["name","days","hours"]'::jsonb, 'Triggered when streak about to break'),
  ('exam_countdown_alert', 'Exam Countdown Alert', '{{name}}, only {{days}} days left for {{exam}}. Stay focused: acry.ai', 'engagement', '["name","days","exam"]'::jsonb, 'Pre-exam motivation'),
  ('payment_success', 'Payment Confirmation', 'Payment of Rs.{{amount}} received. Your ACRY Premium is active till {{expiry}}.', 'transactional', '["amount","expiry"]'::jsonb, 'Sent on successful subscription payment'),
  ('security_alert', 'Security Alert', 'Security alert: New login to your ACRY account from {{device}}. Not you? Reset password at acry.ai', 'critical', '["device"]'::jsonb, 'Suspicious login detection')
ON CONFLICT (name) DO NOTHING;
