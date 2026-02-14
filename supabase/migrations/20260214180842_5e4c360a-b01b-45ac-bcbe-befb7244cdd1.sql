
-- Create user_subscriptions table
CREATE TABLE public.user_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL DEFAULT 'free',
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  amount INTEGER,
  currency TEXT DEFAULT 'INR',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscriptions
CREATE POLICY "Users can view own subscriptions"
ON public.user_subscriptions FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own subscriptions
CREATE POLICY "Users can insert own subscriptions"
ON public.user_subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own subscriptions
CREATE POLICY "Users can update own subscriptions"
ON public.user_subscriptions FOR UPDATE
USING (auth.uid() = user_id);

-- Service role can manage all (for edge function)
CREATE POLICY "Service role full access"
ON public.user_subscriptions
USING (true)
WITH CHECK (true);

-- Timestamp trigger
CREATE TRIGGER update_user_subscriptions_updated_at
BEFORE UPDATE ON public.user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
