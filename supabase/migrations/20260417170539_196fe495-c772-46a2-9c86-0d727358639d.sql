
ALTER TABLE public.sms_templates
  ADD COLUMN IF NOT EXISTS target_url text;

-- Seed default deep links per template
UPDATE public.sms_templates SET target_url = CASE name
  -- Critical / auth
  WHEN 'otp_verification'        THEN 'https://acry.ai/auth'
  WHEN 'password_reset'          THEN 'https://acry.ai/reset-password'
  WHEN 'login_alert'             THEN 'https://acry.ai/app?tab=you'
  WHEN 'security_alert'          THEN 'https://acry.ai/app?tab=you'
  WHEN 'account_locked'          THEN 'https://acry.ai/contact'

  -- Engagement
  WHEN 'daily_mission_reminder'  THEN 'https://acry.ai/app?tab=action'
  WHEN 'streak_risk_alert'       THEN 'https://acry.ai/app?tab=action'
  WHEN 'streak_save'             THEN 'https://acry.ai/app?tab=action'
  WHEN 'weak_topic_alert'        THEN 'https://acry.ai/app?tab=brain'
  WHEN 'rank_drop_alert'         THEN 'https://acry.ai/app?tab=progress'
  WHEN 'weekly_report'           THEN 'https://acry.ai/app?tab=progress'
  WHEN 'mock_test_reminder'      THEN 'https://acry.ai/app?tab=action'
  WHEN 'exam_countdown_alert'    THEN 'https://acry.ai/app?tab=progress'
  WHEN 'exam_d_day'              THEN 'https://acry.ai/app?tab=progress'
  WHEN 'emergency_mode'          THEN 'https://acry.ai/app?tab=action'
  WHEN 'milestone_achieved'      THEN 'https://acry.ai/app?tab=you'
  WHEN 'inactivity_nudge'        THEN 'https://acry.ai/app?tab=home'
  WHEN 'rank_war_invite'         THEN 'https://acry.ai/app?tab=progress'
  WHEN 'referral_reward'         THEN 'https://acry.ai/app?tab=you'
  WHEN 'current_affairs_alert'   THEN 'https://acry.ai/app?tab=brain'

  -- Transactional
  WHEN 'payment_success'         THEN 'https://acry.ai/app?tab=you'
  WHEN 'payment_failed'          THEN 'https://acry.ai/app?tab=you'
  WHEN 'subscription_renewed'    THEN 'https://acry.ai/app?tab=you'
  WHEN 'subscription_expiring'   THEN 'https://acry.ai/app?tab=you'
  WHEN 'trial_ending'            THEN 'https://acry.ai/app?tab=you'
  WHEN 'invoice_ready'           THEN 'https://acry.ai/app?tab=you'
  WHEN 'refund_processed'        THEN 'https://acry.ai/app?tab=you'
  ELSE target_url
END
WHERE target_url IS NULL;
