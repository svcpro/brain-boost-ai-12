
-- 1. Add sms_template_name column
ALTER TABLE public.omnichannel_rules 
  ADD COLUMN IF NOT EXISTS sms_template_name text;

-- 2. Add 'sms' to existing rules + map template names
UPDATE public.omnichannel_rules SET 
  channels = array_append(channels, 'sms'::notification_channel),
  sms_template_name = CASE event_type
    WHEN 'payment_failure' THEN 'you_payment_failed'
    WHEN 'payment_success' THEN 'you_payment_success'
    WHEN 'security_alert' THEN 'auth_security_alert'
    WHEN 'subscription_expiry' THEN 'you_subscription_expiring'
    WHEN 'subscription_activated' THEN 'you_payment_success'
    WHEN 'streak_at_risk' THEN 'home_streak_risk'
    WHEN 'inactivity_detected' THEN 'home_inactivity_return'
    WHEN 'weak_topic_detected' THEN 'practice_weak_topic'
    WHEN 'fix_session_recommended' THEN 'practice_weak_topic'
    WHEN 'rank_declined' THEN 'myrank_rank_drop'
    WHEN 'rank_improved' THEN 'myrank_leaderboard_climb'
    WHEN 'rank_war_daily' THEN 'myrank_rank_war_invite'
    WHEN 'badge_earned' THEN 'you_milestone_unlocked'
    WHEN 'memory_risk_detected' THEN 'practice_weak_topic'
    WHEN 'churn_risk_detected' THEN 'home_inactivity_return'
    WHEN 'signup' THEN 'auth_login_alert'
    WHEN 'daily_briefing' THEN 'home_daily_briefing'
    WHEN 'weekly_report' THEN 'myrank_weekly_recap'
    WHEN 'rank_prediction_update' THEN 'myrank_leaderboard_climb'
    WHEN 'exam_setup' THEN 'practice_exam_countdown'
    WHEN 'brain_update_reminder' THEN 'action_ai_revision_due'
    WHEN 'freeze_gift_received' THEN 'you_milestone_unlocked'
    ELSE NULL
  END
WHERE 
  NOT ('sms'::notification_channel = ANY(channels))
  AND priority IN ('critical', 'high', 'medium')
  AND event_type IN (
    'payment_failure','payment_success','security_alert','subscription_expiry','subscription_activated',
    'streak_at_risk','inactivity_detected','weak_topic_detected','fix_session_recommended',
    'rank_declined','rank_improved','rank_war_daily','badge_earned','memory_risk_detected',
    'churn_risk_detected','signup','daily_briefing','weekly_report','rank_prediction_update',
    'exam_setup','brain_update_reminder','freeze_gift_received'
  );

-- 3. Insert NEW event rules
INSERT INTO public.omnichannel_rules 
  (event_type, display_name, priority, channels, sms_template_name, is_enabled, cooldown_minutes, retry_count, fallback_channels) 
VALUES
  ('auth_otp_alt', 'Auth OTP (alt)', 'critical', ARRAY['sms','push']::notification_channel[], 'auth_otp', true, 0, 2, ARRAY['email']::notification_channel[]),
  ('account_locked', 'Account Locked', 'critical', ARRAY['sms','push','email']::notification_channel[], 'auth_account_locked', true, 0, 2, ARRAY['voice']::notification_channel[]),
  ('password_reset', 'Password Reset', 'critical', ARRAY['sms','email']::notification_channel[], 'auth_password_reset', true, 0, 2, ARRAY['push']::notification_channel[]),
  ('trial_ending', 'Trial Ending', 'critical', ARRAY['sms','push','email']::notification_channel[], 'you_trial_ending', true, 1440, 1, ARRAY['voice']::notification_channel[]),
  ('invoice_ready', 'Invoice Ready', 'medium', ARRAY['sms','email']::notification_channel[], 'you_invoice_ready', true, 0, 1, ARRAY['push']::notification_channel[]),
  ('streak_save_final', 'Streak Save Final Warning', 'critical', ARRAY['sms','push','whatsapp']::notification_channel[], 'home_streak_save_final', true, 1440, 2, ARRAY['email']::notification_channel[]),
  ('daily_mission', 'Daily Mission', 'medium', ARRAY['sms','push']::notification_channel[], 'action_daily_mission', true, 720, 1, ARRAY['email']::notification_channel[]),
  ('focus_session_due', 'Focus Session Due', 'medium', ARRAY['sms','push']::notification_channel[], 'action_focus_session_due', true, 240, 1, ARRAY['whatsapp']::notification_channel[]),
  ('emergency_rescue', 'Emergency Rescue Mode', 'critical', ARRAY['sms','push','whatsapp']::notification_channel[], 'action_emergency_rescue', true, 360, 2, ARRAY['email']::notification_channel[]),
  ('ai_revision_due', 'AI Revision Due', 'medium', ARRAY['sms','push']::notification_channel[], 'action_ai_revision_due', true, 480, 1, ARRAY['whatsapp']::notification_channel[]),
  ('mock_test_due', 'Mock Test Due', 'medium', ARRAY['sms','push']::notification_channel[], 'practice_mock_test_due', true, 1440, 1, ARRAY['whatsapp']::notification_channel[]),
  ('sureshot_ready', 'SureShot Questions Ready', 'high', ARRAY['sms','push','whatsapp']::notification_channel[], 'practice_sureshot_ready', true, 720, 1, ARRAY['email']::notification_channel[]),
  ('current_affairs', 'Current Affairs Update', 'low', ARRAY['sms','push']::notification_channel[], 'practice_current_affairs', true, 1440, 1, ARRAY['whatsapp']::notification_channel[]),
  ('exam_countdown', 'Exam Countdown', 'high', ARRAY['sms','push','email']::notification_channel[], 'practice_exam_countdown', true, 1440, 1, ARRAY['whatsapp']::notification_channel[]),
  ('exam_d_day', 'Exam D-Day', 'critical', ARRAY['sms','push','email','voice']::notification_channel[], 'practice_exam_d_day', true, 0, 2, ARRAY['whatsapp']::notification_channel[]),
  ('milestone_unlocked', 'Milestone Unlocked', 'high', ARRAY['sms','push','whatsapp']::notification_channel[], 'you_milestone_unlocked', true, 360, 1, ARRAY['email']::notification_channel[]),
  ('referral_reward', 'Referral Reward', 'high', ARRAY['sms','push','email']::notification_channel[], 'you_referral_reward', true, 0, 1, ARRAY['whatsapp']::notification_channel[]),
  ('referral_signup', 'Referral Signup', 'medium', ARRAY['sms','push']::notification_channel[], 'myrank_referral_signup', true, 0, 1, ARRAY['whatsapp']::notification_channel[]),
  ('referral_test_completed', 'Referral Test Completed', 'medium', ARRAY['sms','push']::notification_channel[], 'myrank_referral_test_completed', true, 0, 1, ARRAY['whatsapp']::notification_channel[]),
  ('top_rank_achieved', 'Top Rank Achieved', 'high', ARRAY['sms','push','whatsapp','email']::notification_channel[], 'myrank_top_rank_achieved', true, 0, 1, ARRAY['voice']::notification_channel[]),
  ('leaderboard_climb', 'Leaderboard Climb', 'high', ARRAY['sms','push','whatsapp']::notification_channel[], 'myrank_leaderboard_climb', true, 720, 1, ARRAY['email']::notification_channel[]),
  ('friend_overtook', 'Friend Overtook You', 'high', ARRAY['sms','push','whatsapp']::notification_channel[], 'myrank_friend_overtook', true, 720, 1, ARRAY['email']::notification_channel[]),
  ('rank_war_invite', 'Rank War Invite', 'high', ARRAY['sms','push','whatsapp']::notification_channel[], 'myrank_rank_war_invite', true, 360, 1, ARRAY['email']::notification_channel[]),
  ('weekly_recap', 'Weekly Recap', 'medium', ARRAY['sms','push','email']::notification_channel[], 'myrank_weekly_recap', true, 10080, 1, ARRAY['whatsapp']::notification_channel[]),
  ('test_completed', 'Test Completed', 'low', ARRAY['sms','push']::notification_channel[], 'myrank_test_completed', true, 0, 1, ARRAY['in_app']::notification_channel[]),
  ('home_briefing', 'Home Daily Briefing', 'medium', ARRAY['sms','push','email']::notification_channel[], 'home_daily_briefing', true, 1440, 1, ARRAY['whatsapp']::notification_channel[]),
  ('inactivity_return', 'Inactivity Return', 'high', ARRAY['sms','push','email']::notification_channel[], 'home_inactivity_return', true, 1440, 1, ARRAY['whatsapp']::notification_channel[])
ON CONFLICT (event_type) DO UPDATE SET
  sms_template_name = EXCLUDED.sms_template_name;
