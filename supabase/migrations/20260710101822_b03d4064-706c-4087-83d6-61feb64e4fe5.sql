
CREATE TABLE IF NOT EXISTS public.mission_batch_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  email TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'lead',
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  amount INTEGER,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.mission_batch_leads TO service_role;
GRANT SELECT ON public.mission_batch_leads TO authenticated;

ALTER TABLE public.mission_batch_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read mission batch leads" ON public.mission_batch_leads;
CREATE POLICY "Admins read mission batch leads"
  ON public.mission_batch_leads FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_msb_leads_status ON public.mission_batch_leads(status);
CREATE INDEX IF NOT EXISTS idx_msb_leads_order ON public.mission_batch_leads(razorpay_order_id);
