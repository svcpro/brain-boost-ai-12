
-- Coming Soon configuration (single row config)
CREATE TABLE public.coming_soon_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  launch_date TIMESTAMP WITH TIME ZONE,
  countdown_enabled BOOLEAN NOT NULL DEFAULT true,
  email_capture_enabled BOOLEAN NOT NULL DEFAULT true,
  hero_text TEXT DEFAULT 'ACRY – AI Second Brain',
  sub_text TEXT DEFAULT 'Launching Soon.',
  auto_redirect_on_launch BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.coming_soon_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read coming soon config"
  ON public.coming_soon_config FOR SELECT USING (true);

CREATE POLICY "Admins can update coming soon config"
  ON public.coming_soon_config FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert coming soon config"
  ON public.coming_soon_config FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Seed default row
INSERT INTO public.coming_soon_config (is_enabled, countdown_enabled, email_capture_enabled)
VALUES (false, true, true);

-- Coming Soon email signups
CREATE TABLE public.coming_soon_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.coming_soon_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert email"
  ON public.coming_soon_emails FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view emails"
  ON public.coming_soon_emails FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete emails"
  ON public.coming_soon_emails FOR DELETE
  USING (public.is_admin(auth.uid()));
