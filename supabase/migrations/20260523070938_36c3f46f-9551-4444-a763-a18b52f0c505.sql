-- Campus Ambassador Applications table
CREATE TABLE public.campus_ambassador_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  college TEXT NOT NULL,
  city TEXT NOT NULL,
  course TEXT,
  instagram TEXT,
  linkedin TEXT,
  why_join TEXT,
  leadership_experience TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT DEFAULT 'landing_page',
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campus_ambassador_applications ENABLE ROW LEVEL SECURITY;

-- Anyone can submit an application (public form)
CREATE POLICY "Anyone can submit ambassador application"
ON public.campus_ambassador_applications
FOR INSERT
WITH CHECK (true);

-- Only super admins can view/update (uses existing has_role function pattern - fallback: deny by default)
-- If has_role with 'admin' exists, allow admins to view
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_role') THEN
    EXECUTE 'CREATE POLICY "Admins can view ambassador applications" ON public.campus_ambassador_applications FOR SELECT USING (public.has_role(auth.uid(), ''admin''::app_role))';
    EXECUTE 'CREATE POLICY "Admins can update ambassador applications" ON public.campus_ambassador_applications FOR UPDATE USING (public.has_role(auth.uid(), ''admin''::app_role))';
  END IF;
END $$;

CREATE INDEX idx_campus_ambassador_applications_created_at ON public.campus_ambassador_applications(created_at DESC);
CREATE INDEX idx_campus_ambassador_applications_email ON public.campus_ambassador_applications(email);

CREATE TRIGGER update_campus_ambassador_applications_updated_at
BEFORE UPDATE ON public.campus_ambassador_applications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();