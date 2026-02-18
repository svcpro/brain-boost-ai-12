
-- Auto-activate Pro Plan 15-day trial for every new user
CREATE OR REPLACE FUNCTION public.handle_new_user_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  pro_plan_id UUID;
BEGIN
  -- Get Pro plan ID
  SELECT id INTO pro_plan_id FROM subscription_plans WHERE plan_key = 'pro' LIMIT 1;

  -- Only insert if no subscription exists yet
  IF NOT EXISTS (SELECT 1 FROM user_subscriptions WHERE user_id = NEW.id) THEN
    INSERT INTO user_subscriptions (
      user_id, plan_id, status, is_trial,
      trial_start_date, trial_end_date,
      expires_at, billing_cycle, amount, currency
    ) VALUES (
      NEW.id,
      COALESCE(pro_plan_id::text, 'pro'),
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
$$;

-- Attach trigger to auth.users (fires AFTER handle_new_user so profile exists)
DROP TRIGGER IF EXISTS on_auth_user_created_trial ON auth.users;
CREATE TRIGGER on_auth_user_created_trial
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_trial();
