
-- Add yearly_price and trial_days to subscription_plans
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS yearly_price integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_days integer DEFAULT 0;

-- Add billing_cycle, trial tracking to user_subscriptions
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle text DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS trial_start_date timestamptz,
  ADD COLUMN IF NOT EXISTS trial_end_date timestamptz,
  ADD COLUMN IF NOT EXISTS is_trial boolean DEFAULT false;

-- Deactivate the free plan
UPDATE public.subscription_plans SET is_active = false WHERE plan_key = 'free';

-- Update Pro plan
UPDATE public.subscription_plans 
SET price = 99, yearly_price = 999, trial_days = 15, name = 'Pro Brain', 
    features = '["Unlimited subjects & topics", "AI exam simulator", "Advanced analytics", "Voice notifications", "Priority support", "Weekly AI reports", "Standard AI predictions", "Basic AI agent support", "Limited community access", "Limited WhatsApp notifications"]'::jsonb,
    is_popular = false
WHERE plan_key = 'pro';

-- Update Ultra plan
UPDATE public.subscription_plans 
SET price = 299, yearly_price = 2999, trial_days = 0, name = 'Ultra Brain',
    features = '["Everything in Pro", "AI study coach (1-on-1)", "Custom study plans", "Peer competition insights", "Full AI brain features", "Advanced AI predictions", "Full community access", "Full WhatsApp & Voice notifications", "Advanced analytics", "Data export & backup", "Early access to features"]'::jsonb,
    is_popular = true
WHERE plan_key = 'ultra';

-- Update plan_feature_gates: rename free_enabled to reflect trial concept (keep column but set all to false since no free plan)
UPDATE public.plan_feature_gates SET free_enabled = false;
