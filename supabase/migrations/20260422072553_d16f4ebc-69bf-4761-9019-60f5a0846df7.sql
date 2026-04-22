
-- 1. Wipe all existing templates
DELETE FROM public.sms_templates;

-- 2. Insert tab-wise DLT-approved templates (no emojis, plain ASCII)

-- ============= CRITICAL / SECURITY (bypass quota) =============
INSERT INTO public.sms_templates (name, display_name, body_template, category, variables, target_url, description, is_active) VALUES
('auth_otp', 'OTP Verification',
 'ACRY: {{otp}} is your verification code. Valid for 10 minutes. Do not share with anyone. -ACRYAI',
 'critical', '["otp"]'::jsonb,
 'https://acry.ai/auth',
 'Critical: OTP login code. Bypasses 60/month quota.', true),

('auth_password_reset', 'Password Reset Code',
 'ACRY: Your password reset code is {{code}}. Valid for 15 minutes. Set a new password here {{link}} -ACRYAI',
 'critical', '["code","link"]'::jsonb,
 'https://acry.ai/reset-password',
 'Critical: password reset code. Bypasses quota.', true),

('auth_login_alert', 'New Login Alert',
 'ACRY: New sign in detected from {{device}} at {{time}}. If this was not you, secure your account here {{link}} -ACRYAI',
 'critical', '["device","time","link"]'::jsonb,
 'https://acry.ai/app?tab=you',
 'Critical: new device login alert.', true),

('auth_security_alert', 'Security Alert',
 'ACRY: Security alert. Unusual activity detected on your account. Review and lock here {{link}} -ACRYAI',
 'critical', '["link"]'::jsonb,
 'https://acry.ai/app?tab=you',
 'Critical: security incident alert.', true),

('auth_account_locked', 'Account Locked',
 'ACRY: Your account has been temporarily locked due to suspicious activity. Recover access here {{link}} -ACRYAI',
 'critical', '["link"]'::jsonb,
 'https://acry.ai/contact',
 'Critical: account lockout.', true);

-- ============= HOME TAB =============
INSERT INTO public.sms_templates (name, display_name, body_template, category, variables, target_url, description, is_active) VALUES
('home_daily_briefing', 'Home: Daily Brain Briefing',
 'ACRY: {{name}}, your brain stability is {{stability}} percent today. Open your Home dashboard {{link}} -ACRYAI',
 'engagement', '["name","stability","link"]'::jsonb,
 'https://acry.ai/app?tab=home',
 'Home Tab: morning daily briefing with stability score.', true),

('home_inactivity_return', 'Home: Comeback Nudge',
 'ACRY: {{name}}, you have been away for {{days}} days. Your comeback bonus is waiting inside {{link}} -ACRYAI',
 'engagement', '["name","days","link"]'::jsonb,
 'https://acry.ai/app?tab=home',
 'Home Tab: re-engagement after inactivity.', true),

('home_streak_risk', 'Home: Streak Risk',
 'ACRY: {{name}}, your {{days}} day streak ends in {{hours}} hours. Save it now {{link}} -ACRYAI',
 'engagement', '["name","days","hours","link"]'::jsonb,
 'https://acry.ai/app?tab=home',
 'Home Tab: streak about to break.', true),

('home_streak_save_final', 'Home: Final Streak Save',
 'ACRY: {{name}}, your {{days}} day streak ends in 2 hours. One quick quiz keeps it alive {{link}} -ACRYAI',
 'engagement', '["name","days","link"]'::jsonb,
 'https://acry.ai/app?tab=home',
 'Home Tab: final 2-hour streak warning.', true);

-- ============= ACTION TAB =============
INSERT INTO public.sms_templates (name, display_name, body_template, category, variables, target_url, description, is_active) VALUES
('action_daily_mission', 'Action: Daily Mission Ready',
 'ACRY: {{name}}, your daily mission is ready. Finish it in 5 minutes {{link}} -ACRYAI',
 'engagement', '["name","link"]'::jsonb,
 'https://acry.ai/app?tab=action',
 'Action Tab: daily mission reminder.', true),

('action_emergency_rescue', 'Action: Emergency Rescue',
 'ACRY: {{name}}, Auto Pilot triggered an Emergency Rescue for {{topic}}. Open and rescue now {{link}} -ACRYAI',
 'engagement', '["name","topic","link"]'::jsonb,
 'https://acry.ai/app?tab=action',
 'Action Tab: emergency rescue mode triggered.', true),

('action_focus_session_due', 'Action: Focus Session Due',
 'ACRY: {{name}}, your focus session for {{topic}} is due now. Start the 4 phase quiz {{link}} -ACRYAI',
 'engagement', '["name","topic","link"]'::jsonb,
 'https://acry.ai/app?tab=action',
 'Action Tab: scheduled focus session due.', true),

('action_ai_revision_due', 'Action: AI Revision Due',
 'ACRY: {{name}}, your 10 minute AI revision on {{topic}} is ready. Begin now {{link}} -ACRYAI',
 'engagement', '["name","topic","link"]'::jsonb,
 'https://acry.ai/app?tab=action',
 'Action Tab: AI revision session due.', true);

-- ============= MYRANK TAB =============
INSERT INTO public.sms_templates (name, display_name, body_template, category, variables, target_url, description, is_active) VALUES
('myrank_rank_drop', 'MyRank: Rank Drop',
 'ACRY: {{name}}, your predicted rank dropped by {{points}} points. Get an instant recovery plan {{link}} -ACRYAI',
 'engagement', '["name","points","link"]'::jsonb,
 'https://acry.ai/app?tab=progress',
 'MyRank: rank drop alert.', true),

('myrank_rank_war_invite', 'MyRank: Rank War Invite',
 'ACRY: {{name}}, the {{exam}} Rank War starts at {{time}}. Top 10 win Premium days. Join here {{link}} -ACRYAI',
 'engagement', '["name","exam","time","link"]'::jsonb,
 'https://acry.ai/app?tab=progress',
 'MyRank: scheduled rank war invite.', true),

('myrank_friend_overtook', 'MyRank: Friend Overtook You',
 'ACRY: {{name}}, {{friend}} just overtook your {{exam}} rank. Reclaim your position {{link}} -ACRYAI',
 'engagement', '["name","friend","exam","link"]'::jsonb,
 'https://acry.ai/app?tab=progress',
 'MyRank: friend overtook user rank.', true),

('myrank_weekly_recap', 'MyRank: Weekly Recap',
 'ACRY: {{name}}, weekly recap. Solved {{questions}}, accuracy {{accuracy}} percent, rank {{rank}}. View report {{link}} -ACRYAI',
 'engagement', '["name","questions","accuracy","rank","link"]'::jsonb,
 'https://acry.ai/app?tab=progress',
 'MyRank: weekly performance recap.', true);

-- ============= EXAM PRACTICE TAB =============
INSERT INTO public.sms_templates (name, display_name, body_template, category, variables, target_url, description, is_active) VALUES
('practice_mock_test_due', 'Practice: Mock Test Due',
 'ACRY: {{name}}, your {{exam}} mock test starts at {{time}}. Be ready and tap to enter {{link}} -ACRYAI',
 'engagement', '["name","exam","time","link"]'::jsonb,
 'https://acry.ai/app?tab=action',
 'Exam Practice: scheduled mock test reminder.', true),

('practice_weak_topic', 'Practice: Weak Topic Alert',
 'ACRY: {{name}}, your memory on {{topic}} is at {{strength}} percent. Run a 3 minute revival {{link}} -ACRYAI',
 'engagement', '["name","topic","strength","link"]'::jsonb,
 'https://acry.ai/app?tab=brain',
 'Exam Practice: weak topic memory drop.', true),

('practice_sureshot_ready', 'Practice: SureShot Ready',
 'ACRY: {{name}}, your SureShot {{count}} predicted questions for {{exam}} are ready. Practice now {{link}} -ACRYAI',
 'engagement', '["name","count","exam","link"]'::jsonb,
 'https://acry.ai/app?tab=sureshot',
 'Exam Practice: SureShot predicted question set ready.', true),

('practice_current_affairs', 'Practice: Current Affairs Alert',
 'ACRY: {{count}} key Current Affairs events for {{exam}} today. {{prob}} percent question chance. Read here {{link}} -ACRYAI',
 'engagement', '["count","exam","prob","link"]'::jsonb,
 'https://acry.ai/app?tab=brain',
 'Exam Practice: high-probability current affairs.', true),

('practice_exam_countdown', 'Practice: Exam Countdown',
 'ACRY: {{name}}, only {{days}} days left for {{exam}}. Lock in your edge {{link}} -ACRYAI',
 'engagement', '["name","days","exam","link"]'::jsonb,
 'https://acry.ai/app?tab=progress',
 'Exam Practice: exam countdown reminder.', true),

('practice_exam_d_day', 'Practice: Exam D-Day',
 'ACRY: {{name}}, today is your {{exam}} day. Give your best. View final checklist {{link}} -ACRYAI',
 'engagement', '["name","exam","link"]'::jsonb,
 'https://acry.ai/app?tab=progress',
 'Exam Practice: D-Day morning reminder.', true);

-- ============= YOU TAB =============
INSERT INTO public.sms_templates (name, display_name, body_template, category, variables, target_url, description, is_active) VALUES
('you_milestone_unlocked', 'You: Milestone Unlocked',
 'ACRY: {{name}}, you unlocked {{milestone}}. View your achievement {{link}} -ACRYAI',
 'engagement', '["name","milestone","link"]'::jsonb,
 'https://acry.ai/app?tab=you',
 'You Tab: milestone achievement.', true),

('you_referral_reward', 'You: Referral Reward',
 'ACRY: {{name}}, {{friend}} joined ACRY using your code. You earned {{reward}}. Invite more {{link}} -ACRYAI',
 'engagement', '["name","friend","reward","link"]'::jsonb,
 'https://acry.ai/app?tab=you',
 'You Tab: referral reward earned.', true),

('you_payment_success', 'You: Payment Success',
 'ACRY: Payment of Rs {{amount}} received. Premium active till {{expiry}}. View receipt {{link}} -ACRYAI',
 'transactional', '["amount","expiry","link"]'::jsonb,
 'https://acry.ai/app?tab=you',
 'You Tab: payment confirmation.', true),

('you_payment_failed', 'You: Payment Failed',
 'ACRY: Payment of Rs {{amount}} failed. Retry in one tap to keep Premium active {{link}} -ACRYAI',
 'transactional', '["amount","link"]'::jsonb,
 'https://acry.ai/app?tab=you',
 'You Tab: payment failure (critical-priority).', true),

('you_subscription_expiring', 'You: Subscription Expiring',
 'ACRY: Your Premium plan expires in {{days}} days. Renew to keep your AI mentor active {{link}} -ACRYAI',
 'transactional', '["days","link"]'::jsonb,
 'https://acry.ai/app?tab=you',
 'You Tab: subscription expiry warning.', true),

('you_trial_ending', 'You: Trial Ending',
 'ACRY: Your free trial ends in {{days}} days. Upgrade to Premium at Rs 149 per month {{link}} -ACRYAI',
 'transactional', '["days","link"]'::jsonb,
 'https://acry.ai/app?tab=you',
 'You Tab: trial ending warning.', true),

('you_invoice_ready', 'You: Invoice Ready',
 'ACRY: Invoice of Rs {{amount}} is ready. Download here {{link}} -ACRYAI',
 'transactional', '["amount","link"]'::jsonb,
 'https://acry.ai/app?tab=you',
 'You Tab: invoice download.', true);
