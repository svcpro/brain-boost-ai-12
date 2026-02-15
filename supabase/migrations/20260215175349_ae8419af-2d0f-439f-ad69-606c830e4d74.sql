
-- Create subscription_plans table for admin-managed plans
CREATE TABLE public.subscription_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  billing_period text NOT NULL DEFAULT 'monthly',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  is_popular boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  razorpay_plan_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Everyone can read active plans
CREATE POLICY "Anyone can read active plans"
ON public.subscription_plans
FOR SELECT
USING (true);

-- Only admins can manage plans
CREATE POLICY "Admins can insert plans"
ON public.subscription_plans
FOR INSERT
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update plans"
ON public.subscription_plans
FOR UPDATE
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete plans"
ON public.subscription_plans
FOR DELETE
USING (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default plans
INSERT INTO public.subscription_plans (plan_key, name, description, price, billing_period, features, is_active, is_popular, sort_order) VALUES
('free', 'Free Brain', 'Basic plan for getting started', 0, 'forever', '["5 subjects & 20 topics", "Basic memory tracking", "Daily study reminders", "Community leaderboard"]', true, false, 0),
('pro', 'Pro Brain', 'Most popular plan for serious learners', 199, 'monthly', '["Unlimited subjects & topics", "AI exam simulator", "Advanced analytics", "Voice notifications", "Priority support", "Weekly AI reports"]', true, true, 1),
('ultra', 'Ultra Brain', 'Maximum brain power for elite students', 499, 'monthly', '["Everything in Pro", "AI study coach (1-on-1)", "Custom study plans", "Peer competition insights", "Offline mode", "Data export & backup", "Early access to features"]', true, false, 2);
