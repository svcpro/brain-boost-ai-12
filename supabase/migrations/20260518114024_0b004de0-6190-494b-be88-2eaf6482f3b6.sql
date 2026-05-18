
CREATE TABLE IF NOT EXISTS public.whatsapp_reengagement_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tier text NOT NULL,
  template_name text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  ai_message text,
  status text NOT NULL DEFAULT 'sent',
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_wa_reeng_user_tier_sent
  ON public.whatsapp_reengagement_log (user_id, tier, sent_at DESC);

ALTER TABLE public.whatsapp_reengagement_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read reengagement log"
  ON public.whatsapp_reengagement_log FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Service role writes reengagement log"
  ON public.whatsapp_reengagement_log FOR INSERT
  WITH CHECK (true);
