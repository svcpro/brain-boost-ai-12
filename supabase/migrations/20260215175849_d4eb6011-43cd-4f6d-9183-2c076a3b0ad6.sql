
-- Webhook events log table
CREATE TABLE public.razorpay_webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  payment_id TEXT,
  order_id TEXT,
  subscription_id TEXT,
  status TEXT,
  amount INTEGER,
  currency TEXT,
  payload JSONB DEFAULT '{}',
  processed BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.razorpay_webhook_events ENABLE ROW LEVEL SECURITY;

-- Only admins can read webhook events
CREATE POLICY "Admins can view webhook events"
ON public.razorpay_webhook_events
FOR SELECT
USING (public.is_admin(auth.uid()));
