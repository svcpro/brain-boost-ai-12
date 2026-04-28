CREATE TABLE public.incident_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  description TEXT,
  metric_name TEXT,
  metric_value NUMERIC,
  threshold_value NUMERIC,
  current_tier TEXT,
  recommended_tier TEXT,
  snapshot JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_incident_history_created_at ON public.incident_history(created_at DESC);
CREATE INDEX idx_incident_history_event_type ON public.incident_history(event_type);
CREATE INDEX idx_incident_history_severity ON public.incident_history(severity);

ALTER TABLE public.incident_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all incidents"
ON public.incident_history FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert incidents"
ON public.incident_history FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Super admins can update incidents"
ON public.incident_history FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can delete incidents"
ON public.incident_history FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));