
-- META WhatsApp Business template approval management
CREATE TABLE public.meta_template_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'UTILITY',
  language TEXT NOT NULL DEFAULT 'en',
  header_type TEXT DEFAULT 'NONE',
  header_content TEXT,
  body_text TEXT NOT NULL,
  footer_text TEXT,
  button_type TEXT,
  buttons JSONB,
  sample_values JSONB,
  meta_template_id TEXT,
  meta_status TEXT NOT NULL DEFAULT 'draft',
  rejection_reason TEXT,
  quality_score TEXT,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  submitted_by TEXT DEFAULT 'admin',
  notes TEXT,
  tags TEXT[],
  message_sends_24h INTEGER DEFAULT 0,
  message_sends_total INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_template_submissions ENABLE ROW LEVEL SECURITY;

-- Only admins can manage META templates
CREATE POLICY "Admins can manage meta templates"
ON public.meta_template_submissions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Super admins can manage meta templates"
ON public.meta_template_submissions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Trigger for updated_at
CREATE TRIGGER update_meta_template_submissions_updated_at
BEFORE UPDATE ON public.meta_template_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
