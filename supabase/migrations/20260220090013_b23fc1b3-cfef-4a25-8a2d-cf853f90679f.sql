
-- Step 1: Deactivate old plans
UPDATE subscription_plans SET is_active = false WHERE plan_key IN ('pro', 'ultra', 'free');

-- Step 2: Insert single ACRY Premium plan
INSERT INTO subscription_plans (plan_key, name, price, yearly_price, currency, billing_period, is_active, trial_days, features, is_popular, sort_order)
VALUES (
  'premium',
  'ACRY Premium',
  149,
  1499,
  'INR',
  'monthly',
  true,
  15,
  '["AI Second Brain", "Focus Study Mode", "AI Revision Mode", "Mock Practice Mode", "Emergency Rescue Mode", "Neural Memory Map", "Decay Forecast Engine", "AI Strategy Optimization", "Voice + Push Notifications", "Community Access", "Unlimited Usage", "Cognitive Twin", "ML Dashboard", "Knowledge Graph", "Data Export & Backup", "Advanced Analytics"]'::jsonb,
  true,
  1
)
ON CONFLICT (plan_key) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  yearly_price = EXCLUDED.yearly_price,
  trial_days = EXCLUDED.trial_days,
  features = EXCLUDED.features,
  is_active = true,
  is_popular = true,
  sort_order = 1;

-- Step 3: Update all plan_feature_gates - enable everything for premium (using pro_enabled column for premium)
UPDATE plan_feature_gates SET pro_enabled = true, ultra_enabled = true;

-- Step 4: Update the trial trigger to use 'premium' instead of 'pro'
CREATE OR REPLACE FUNCTION public.handle_new_user_trial()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  premium_plan_id UUID;
BEGIN
  -- Get Premium plan ID
  SELECT id INTO premium_plan_id FROM subscription_plans WHERE plan_key = 'premium' LIMIT 1;

  -- Only insert if no subscription exists yet
  IF NOT EXISTS (SELECT 1 FROM user_subscriptions WHERE user_id = NEW.id) THEN
    INSERT INTO user_subscriptions (
      user_id, plan_id, status, is_trial,
      trial_start_date, trial_end_date,
      expires_at, billing_cycle, amount, currency
    ) VALUES (
      NEW.id,
      COALESCE(premium_plan_id::text, 'premium'),
      'active',
      true,
      now(),
      now() + interval '15 days',
      now() + interval '15 days',
      'monthly',
      0,
      'INR'
    );
  END IF;

  RETURN NEW;
END;
$function$;
