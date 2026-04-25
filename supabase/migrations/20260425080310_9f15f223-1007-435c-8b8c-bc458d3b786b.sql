
-- 1. SMS Event Registry: master list of all auto-trigger events
CREATE TABLE IF NOT EXISTS public.sms_event_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'engagement',
  priority text NOT NULL DEFAULT 'medium',
  template_name text,
  variable_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  daily_cap_per_user int NOT NULL DEFAULT 1,
  bypass_quota boolean NOT NULL DEFAULT false,
  is_enabled boolean NOT NULL DEFAULT true,
  fallback_channels text[] NOT NULL DEFAULT ARRAY['push','email']::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_event_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage sms_event_registry"
  ON public.sms_event_registry FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_sms_event_registry_updated
  BEFORE UPDATE ON public.sms_event_registry
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Dedupe table (1-minute window per user/event)
CREATE TABLE IF NOT EXISTS public.sms_event_dedupe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_key text NOT NULL,
  last_fired_at timestamptz NOT NULL DEFAULT now(),
  daily_count int NOT NULL DEFAULT 1,
  day_key text NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD'),
  UNIQUE (user_id, event_key)
);

CREATE INDEX IF NOT EXISTS idx_sms_event_dedupe_user ON public.sms_event_dedupe(user_id, event_key);

ALTER TABLE public.sms_event_dedupe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read sms_event_dedupe"
  ON public.sms_event_dedupe FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- 3. Audit log
CREATE TABLE IF NOT EXISTS public.sms_event_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  event_key text NOT NULL,
  outcome text NOT NULL,
  reason text,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_event_audit_user ON public.sms_event_audit(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_event_audit_event ON public.sms_event_audit(event_key, created_at DESC);

ALTER TABLE public.sms_event_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read sms_event_audit"
  ON public.sms_event_audit FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "users read own sms_event_audit"
  ON public.sms_event_audit FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 4. Seed all 35 events with smart-default policy
INSERT INTO public.sms_event_registry (event_key, display_name, description, category, priority, daily_cap_per_user, bypass_quota, variable_map) VALUES
  -- USER (5)
  ('user_signup', 'Welcome SMS', 'Sent on user signup', 'transactional', 'high', 1, true, '{"var1":"name","var2":"app","var3":"link"}'),
  ('login_detected', 'Login Alert', 'New device or fresh login', 'security', 'high', 3, true, '{"var1":"name","var2":"device","var3":"time"}'),
  ('suspicious_activity', 'Security Alert', 'Suspicious account activity', 'security', 'critical', 5, true, '{"var1":"name","var2":"activity","var3":"time"}'),
  ('account_locked', 'Account Locked', 'Account lock notice', 'security', 'critical', 3, true, '{"var1":"name","var2":"reason","var3":"link"}'),
  ('otp_login', 'OTP Login', 'OTP for login', 'otp', 'critical', 10, true, '{"var1":"otp","var2":"time","var3":"app"}'),
  -- LEARNING (4)
  ('leaderboard_climb', 'Leaderboard Climb', 'User climbed leaderboard', 'engagement', 'medium', 1, false, '{"var1":"name","var2":"rank","var3":"link"}'),
  ('weak_topic_detected', 'Weak Topic Alert', 'Detected weak topic', 'engagement', 'medium', 1, false, '{"var1":"name","var2":"topic","var3":"link"}'),
  ('daily_brief_generated', 'Daily Brain Briefing', 'Daily AI briefing ready', 'engagement', 'medium', 1, false, '{"var1":"name","var2":"summary","var3":"link"}'),
  ('weekly_summary_ready', 'Weekly Recap', 'Weekly summary ready', 'engagement', 'medium', 1, false, '{"var1":"name","var2":"score","var3":"link"}'),
  -- EXAM (4)
  ('exam_today', 'Exam Today', 'Exam day reminder', 'transactional', 'high', 1, true, '{"var1":"name","var2":"exam","var3":"time"}'),
  ('exam_countdown', 'Exam Countdown', 'Days left to exam', 'engagement', 'medium', 1, false, '{"var1":"name","var2":"days","var3":"exam"}'),
  ('mock_test_due', 'Mock Test Due', 'Scheduled mock test', 'engagement', 'medium', 1, false, '{"var1":"name","var2":"test","var3":"link"}'),
  ('rank_drop', 'Rank Drop Alert', 'Performance drop detected', 'engagement', 'high', 1, false, '{"var1":"name","var2":"rank","var3":"link"}'),
  -- PAYMENT (5)
  ('payment_success', 'Payment Confirmation', 'Payment confirmed', 'payment', 'critical', 5, true, '{"var1":"name","var2":"amount","var3":"link"}'),
  ('payment_failed', 'Payment Failed', 'Retry payment', 'payment', 'critical', 3, true, '{"var1":"name","var2":"amount","var3":"link"}'),
  ('invoice_generated', 'Invoice Ready', 'Invoice generated', 'transactional', 'medium', 2, true, '{"var1":"name","var2":"invoice","var3":"link"}'),
  ('subscription_expiring', 'Subscription Expiring', 'Subscription expiry warning', 'transactional', 'high', 1, true, '{"var1":"name","var2":"days","var3":"link"}'),
  ('trial_ending', 'Trial Ending', 'Trial ends soon', 'transactional', 'high', 1, true, '{"var1":"name","var2":"days","var3":"link"}'),
  -- ENGAGEMENT (3)
  ('referral_reward', 'Referral Reward', 'Referral reward unlocked', 'engagement', 'medium', 1, false, '{"var1":"name","var2":"reward","var3":"link"}'),
  ('milestone_unlocked', 'Milestone Unlocked', 'Achievement milestone', 'engagement', 'medium', 1, false, '{"var1":"name","var2":"milestone","var3":"link"}'),
  ('comeback_user', 'Come Back', 'Inactive user nudge', 'engagement', 'medium', 1, false, '{"var1":"name","var2":"days","var3":"link"}'),
  -- RETENTION (3)
  ('streak_risk', 'Streak Risk', 'Streak about to break', 'engagement', 'high', 1, false, '{"var1":"name","var2":"streak","var3":"link"}'),
  ('final_streak_save', 'Final Streak Save', 'Last reminder', 'engagement', 'high', 1, false, '{"var1":"name","var2":"streak","var3":"link"}'),
  ('emergency_revision', 'Emergency Revision', 'Urgent revision push', 'engagement', 'high', 1, false, '{"var1":"name","var2":"topic","var3":"link"}'),
  -- Additional 11 to reach 35
  ('study_reminder', 'Daily Study Reminder', 'Daily study nudge', 'engagement', 'medium', 1, false, '{"var1":"name","var2":"topic","var3":"link"}'),
  ('test_completed', 'Test Completed', 'Test result ready', 'transactional', 'medium', 2, true, '{"var1":"name","var2":"score","var3":"link"}'),
  ('badge_earned', 'Badge Earned', 'New badge earned', 'engagement', 'medium', 1, false, '{"var1":"name","var2":"badge","var3":"link"}'),
  ('friend_joined', 'Friend Joined', 'A friend joined ACRY', 'engagement', 'low', 1, false, '{"var1":"name","var2":"friend","var3":"link"}'),
  ('plan_upgraded', 'Plan Upgraded', 'Subscription upgraded', 'transactional', 'high', 2, true, '{"var1":"name","var2":"plan","var3":"link"}'),
  ('plan_downgraded', 'Plan Downgraded', 'Subscription downgraded', 'transactional', 'medium', 2, true, '{"var1":"name","var2":"plan","var3":"link"}'),
  ('refund_processed', 'Refund Processed', 'Refund issued', 'payment', 'high', 3, true, '{"var1":"name","var2":"amount","var3":"link"}'),
  ('password_changed', 'Password Changed', 'Password updated', 'security', 'critical', 3, true, '{"var1":"name","var2":"time","var3":"link"}'),
  ('email_verified', 'Email Verified', 'Email verification complete', 'transactional', 'medium', 2, true, '{"var1":"name","var2":"email","var3":"link"}'),
  ('mobile_verified', 'Mobile Verified', 'Mobile verification complete', 'transactional', 'medium', 2, true, '{"var1":"name","var2":"mobile","var3":"link"}'),
  ('feature_announcement', 'Feature Launch', 'New feature announcement', 'engagement', 'low', 1, false, '{"var1":"name","var2":"feature","var3":"link"}')
ON CONFLICT (event_key) DO NOTHING;

-- 5. Schedule monthly quota reset (uses existing pg_cron / pg_net if enabled)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.unschedule('sms-monthly-quota-reset') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='sms-monthly-quota-reset');
    PERFORM cron.schedule(
      'sms-monthly-quota-reset',
      '0 0 1 * *',
      $cron$ DELETE FROM public.sms_quota WHERE month_key <> to_char(now(),'YYYY-MM'); $cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END$$;
