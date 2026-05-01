
-- 1. Update auto-trial trigger to 7 days
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
      now() + interval '7 days',
      now() + interval '7 days',
      'monthly',
      0,
      'INR'
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Update Starter plan trial_days = 7
UPDATE public.subscription_plans SET trial_days = 7 WHERE plan_key = 'starter';

-- 3. Helper view for trial reminder engine (active trial OR ended in last 7 days)
CREATE OR REPLACE VIEW public.trial_reminder_targets AS
SELECT
  us.user_id,
  us.trial_start_date,
  us.trial_end_date,
  GREATEST(0, CEIL(EXTRACT(EPOCH FROM (us.trial_end_date - now())) / 86400.0))::int AS days_left,
  CASE
    WHEN us.trial_end_date < now() THEN 'expired'
    WHEN us.trial_end_date <= now() + interval '2 days' THEN 'urgent'
    ELSE 'active'
  END AS phase,
  p.email,
  p.display_name,
  p.phone
FROM public.user_subscriptions us
JOIN public.profiles p ON p.id = us.user_id
WHERE us.is_trial = true
  AND us.status = 'active'
  AND us.trial_end_date > now() - interval '7 days';
