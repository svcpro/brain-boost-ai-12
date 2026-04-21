-- 1. Add tier_level column
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS tier_level integer NOT NULL DEFAULT 1;

-- 2. Deactivate legacy plans
UPDATE public.subscription_plans
SET is_active = false, is_popular = false
WHERE plan_key IN ('free', 'pro', 'ultra');

-- 3. Update existing 'premium' row to become Starter (₹149) — preserves its UUID so existing
--    user_subscriptions rows referencing this plan_id remain valid and now mean "Starter".
UPDATE public.subscription_plans
SET
  plan_key = 'starter',
  name = 'ACRY Starter',
  description = 'Full ACRY access with AI-powered learning. Excludes Exam Practice.',
  price = 149,
  yearly_price = 1490,
  trial_days = 14,
  tier_level = 1,
  is_active = true,
  is_popular = false,
  sort_order = 1,
  features = '["AI Second Brain","Focus Study Mode","Neural Memory Map","AI Strategy","Voice Notifications","Unlimited Usage","14-day free trial"]'::jsonb,
  updated_at = now()
WHERE plan_key = 'premium';

-- 4. Insert the new Premium (₹499) tier
INSERT INTO public.subscription_plans (
  plan_key, name, description, price, yearly_price, currency, billing_period,
  trial_days, tier_level, is_active, is_popular, sort_order, features
)
VALUES (
  'premium',
  'ACRY Premium',
  'Everything in Starter PLUS unlimited Exam Practice & SureShot.',
  499,
  4990,
  'INR',
  'monthly',
  0,
  2,
  true,
  true,
  2,
  '["Everything in Starter","Exam Practice (SureShot + Confidence Practice)","Priority AI processing","Advanced analytics","Early access to new features"]'::jsonb
)
ON CONFLICT (plan_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  yearly_price = EXCLUDED.yearly_price,
  trial_days = EXCLUDED.trial_days,
  tier_level = EXCLUDED.tier_level,
  is_active = true,
  is_popular = true,
  sort_order = EXCLUDED.sort_order,
  features = EXCLUDED.features,
  updated_at = now();

-- 5. Add exam_practice feature gate (Starter blocked, Premium allowed) if not present
INSERT INTO public.plan_feature_gates (feature_key, feature_label, feature_category, free_enabled, pro_enabled, ultra_enabled, sort_order)
VALUES ('exam_practice', 'Exam Practice', 'progress', false, false, true, 100)
ON CONFLICT (feature_key) DO NOTHING;

-- 6. Update the new-user trial trigger to use the (renamed) starter plan + 14 days
CREATE OR REPLACE FUNCTION public.handle_new_user_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  starter_plan_id UUID;
BEGIN
  SELECT id INTO starter_plan_id FROM subscription_plans WHERE plan_key = 'starter' LIMIT 1;

  IF NOT EXISTS (SELECT 1 FROM user_subscriptions WHERE user_id = NEW.id) THEN
    INSERT INTO user_subscriptions (
      user_id, plan_id, status, is_trial,
      trial_start_date, trial_end_date,
      expires_at, billing_cycle, amount, currency
    ) VALUES (
      NEW.id,
      COALESCE(starter_plan_id::text, 'starter'),
      'active',
      true,
      now(),
      now() + interval '14 days',
      now() + interval '14 days',
      'monthly',
      0,
      'INR'
    );
  END IF;

  RETURN NEW;
END;
$function$;