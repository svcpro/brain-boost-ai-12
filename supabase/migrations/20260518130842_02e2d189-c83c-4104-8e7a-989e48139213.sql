CREATE TABLE IF NOT EXISTS public.whatsapp_msg91_templates (
  template_name text PRIMARY KEY,
  display_name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_msg91_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read msg91 templates"
  ON public.whatsapp_msg91_templates FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins update msg91 templates"
  ON public.whatsapp_msg91_templates FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Service role full access msg91 templates"
  ON public.whatsapp_msg91_templates FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_whatsapp_msg91_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_msg91_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.whatsapp_msg91_templates (template_name, display_name, description, is_active) VALUES
  ('re_engagement_message', 'Re-engagement (Never Signed In)', 'Sent to users who signed up but never logged in (24h+)', true),
  ('re_enguage_two', 'Re-engagement Two (24h Inactive)', 'Sent to users inactive for 24 hours', true),
  ('recovery_trust', 'Recovery Trust (3d & 7d Inactive)', 'Sent to users inactive for 3 or 7 days', true)
ON CONFLICT (template_name) DO NOTHING;