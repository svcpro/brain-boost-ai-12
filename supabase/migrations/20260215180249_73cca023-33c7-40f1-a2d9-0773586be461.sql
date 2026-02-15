
-- Razorpay gateway configuration table
CREATE TABLE public.razorpay_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'test' CHECK (mode IN ('test', 'live')),
  test_key_id TEXT,
  test_key_secret TEXT,
  live_key_id TEXT,
  live_key_secret TEXT,
  webhook_secret TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.razorpay_config ENABLE ROW LEVEL SECURITY;

-- Only super_admin/admin/finance_admin can manage
CREATE POLICY "Admins can view razorpay config"
ON public.razorpay_config
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update razorpay config"
ON public.razorpay_config
FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert razorpay config"
ON public.razorpay_config
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

-- Seed a default row
INSERT INTO public.razorpay_config (mode) VALUES ('test');
