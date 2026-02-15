
-- Feature flags table for admin-controlled app sections
CREATE TABLE public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  label text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Everyone can read flags
CREATE POLICY "Anyone can read feature flags"
ON public.feature_flags FOR SELECT
USING (true);

-- Only admins can modify
CREATE POLICY "Admins can update feature flags"
ON public.feature_flags FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert feature flags"
ON public.feature_flags FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

-- Seed default flags
INSERT INTO public.feature_flags (flag_key, enabled, label) VALUES
  ('tab_home', true, 'Home Tab'),
  ('tab_action', true, 'Action Tab'),
  ('tab_brain', true, 'Brain Tab'),
  ('tab_progress', true, 'Progress Tab'),
  ('tab_you', true, 'You Tab');
