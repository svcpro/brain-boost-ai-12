
-- =========================================
-- ONESIGNAL PUSH COMMAND CENTER
-- =========================================

-- 1. Players (device subscriptions)
CREATE TABLE IF NOT EXISTS public.onesignal_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  player_id TEXT NOT NULL,
  external_id TEXT,
  device_type TEXT,
  device_os TEXT,
  browser TEXT,
  language TEXT,
  timezone TEXT,
  is_subscribed BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_os_players_user ON public.onesignal_players(user_id);
CREATE INDEX IF NOT EXISTS idx_os_players_player ON public.onesignal_players(player_id);

-- 2. Event catalog
CREATE TABLE IF NOT EXISTS public.push_event_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL, -- study | exam | growth | social | system
  display_name TEXT NOT NULL,
  description TEXT,
  default_enabled BOOLEAN NOT NULL DEFAULT true,
  user_visible BOOLEAN NOT NULL DEFAULT true,
  priority TEXT NOT NULL DEFAULT 'normal', -- low | normal | high | critical
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_cat ON public.push_event_catalog(category);

-- 3. Templates
CREATE TABLE IF NOT EXISTS public.push_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL,
  variant TEXT NOT NULL DEFAULT 'A',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  icon_url TEXT,
  image_url TEXT,
  deep_link TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  weight INT NOT NULL DEFAULT 50,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tmpl_event ON public.push_templates(event_key);

-- 4. Segments
CREATE TABLE IF NOT EXISTS public.push_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimated_size INT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Campaigns
CREATE TABLE IF NOT EXISTS public.push_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  icon_url TEXT,
  image_url TEXT,
  deep_link TEXT,
  segment_id UUID REFERENCES public.push_segments(id) ON DELETE SET NULL,
  audience_filter JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | scheduled | sending | sent | failed | cancelled
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  ab_config JSONB,
  stats JSONB DEFAULT '{}'::jsonb,
  onesignal_notification_id TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_camp_status ON public.push_campaigns(status);

-- 6. Automation rules
CREATE TABLE IF NOT EXISTS public.push_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  respect_quiet_hours BOOLEAN NOT NULL DEFAULT true,
  throttle_per_user_per_day INT NOT NULL DEFAULT 5,
  cooldown_minutes INT NOT NULL DEFAULT 30,
  escalate_to_email BOOLEAN NOT NULL DEFAULT false,
  ab_test_enabled BOOLEAN NOT NULL DEFAULT false,
  conditions JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Deliveries
CREATE TABLE IF NOT EXISTS public.push_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  event_key TEXT,
  campaign_id UUID,
  template_id UUID,
  variant TEXT,
  title TEXT,
  body TEXT,
  onesignal_notification_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued', -- queued | sent | delivered | clicked | failed | suppressed
  suppression_reason TEXT,
  error TEXT,
  payload JSONB,
  sent_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deliv_user ON public.push_deliveries(user_id);
CREATE INDEX IF NOT EXISTS idx_deliv_event ON public.push_deliveries(event_key);
CREATE INDEX IF NOT EXISTS idx_deliv_status ON public.push_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliv_created ON public.push_deliveries(created_at DESC);

-- 8. Per-user prefs (categories)
CREATE TABLE IF NOT EXISTS public.push_user_prefs (
  user_id UUID PRIMARY KEY,
  master_enabled BOOLEAN NOT NULL DEFAULT true,
  category_study BOOLEAN NOT NULL DEFAULT true,
  category_exam BOOLEAN NOT NULL DEFAULT true,
  category_growth BOOLEAN NOT NULL DEFAULT true,
  category_social BOOLEAN NOT NULL DEFAULT true,
  category_system BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_start TIME DEFAULT '22:00',
  quiet_end TIME DEFAULT '07:00',
  timezone TEXT DEFAULT 'Asia/Kolkata',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================
-- RLS
-- =========================================
ALTER TABLE public.onesignal_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_event_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_user_prefs ENABLE ROW LEVEL SECURITY;

-- Players
CREATE POLICY "users own players select" ON public.onesignal_players FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users own players upsert" ON public.onesignal_players FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users own players update" ON public.onesignal_players FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users own players delete" ON public.onesignal_players FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins all players" ON public.onesignal_players FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "service role players" ON public.onesignal_players FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Event catalog
CREATE POLICY "auth read catalog" ON public.push_event_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage catalog" ON public.push_event_catalog FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "service role catalog" ON public.push_event_catalog FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Templates
CREATE POLICY "auth read tmpl" ON public.push_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins tmpl" ON public.push_templates FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "service role tmpl" ON public.push_templates FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Segments
CREATE POLICY "admins seg" ON public.push_segments FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "service role seg" ON public.push_segments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Campaigns
CREATE POLICY "admins camp" ON public.push_campaigns FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "service role camp" ON public.push_campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Automation rules
CREATE POLICY "auth read rules" ON public.push_automation_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins rules" ON public.push_automation_rules FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "service role rules" ON public.push_automation_rules FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Deliveries
CREATE POLICY "users own deliv" ON public.push_deliveries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins deliv" ON public.push_deliveries FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "service role deliv" ON public.push_deliveries FOR ALL TO service_role USING (true) WITH CHECK (true);

-- User prefs
CREATE POLICY "users own prefs select" ON public.push_user_prefs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users own prefs upsert" ON public.push_user_prefs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users own prefs update" ON public.push_user_prefs FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins prefs" ON public.push_user_prefs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "service role prefs" ON public.push_user_prefs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- updated_at triggers
CREATE TRIGGER trg_os_players_upd BEFORE UPDATE ON public.onesignal_players FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tmpl_upd BEFORE UPDATE ON public.push_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_seg_upd BEFORE UPDATE ON public.push_segments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_camp_upd BEFORE UPDATE ON public.push_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_rules_upd BEFORE UPDATE ON public.push_automation_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_prefs_upd BEFORE UPDATE ON public.push_user_prefs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- SEED EVENT CATALOG (every notification moment)
-- =========================================
INSERT INTO public.push_event_catalog (event_key, category, display_name, description, priority) VALUES
-- STUDY LIFECYCLE
('study_session_start', 'study', 'Study Session Started', 'User opens a study session', 'low'),
('study_session_end', 'study', 'Session Complete', 'Reward after a productive session', 'normal'),
('daily_review_due', 'study', 'Daily Review Due', 'Spaced-repetition review topics ready', 'high'),
('weak_topic_alert', 'study', 'Weak Topic Detected', 'Mastery dropped below threshold', 'high'),
('decay_shield_warning', 'study', 'Decay Shield Warning', 'Topic at risk of being forgotten', 'high'),
('quick_fix_quiz_ready', 'study', 'Quick Fix Quiz Ready', '3-min targeted MCQ session ready', 'normal'),
('mission_assigned', 'study', 'New Mission Assigned', 'Brain mission generated', 'normal'),
('mission_completed', 'study', 'Mission Completed', 'Celebrate completion + XP', 'normal'),
('study_plan_today', 'study', 'Today''s Study Plan', 'Morning plan ready', 'normal'),
('inactive_study_24h', 'study', 'No Study in 24h', 'Re-engage idle learner', 'normal'),
('streak_at_risk', 'study', 'Streak At Risk', 'Save streak before midnight', 'critical'),
('streak_milestone', 'study', 'Streak Milestone', '7/14/30/60/100 day celebration', 'normal'),
('freeze_gift_received', 'study', 'Freeze Gift Received', 'Friend sent a streak freeze', 'high'),
('focus_shield_distraction', 'study', 'Distraction Detected', 'Refocus nudge during session', 'normal'),
('burnout_detected', 'study', 'Burnout Detected', 'Suggest break / recovery mode', 'high'),

-- EXAM & PERFORMANCE
('exam_countdown_lockdown', 'exam', 'Exam Lockdown Phase', '<7 days to exam — full focus', 'critical'),
('exam_countdown_acceleration', 'exam', 'Acceleration Phase', '<30 days — push hard', 'high'),
('mock_test_result', 'exam', 'Mock Test Result', 'New score available', 'normal'),
('mock_test_reminder', 'exam', 'Take a Mock Test', 'Weekly mock reminder', 'normal'),
('rank_changed_up', 'exam', 'Rank Improved', 'Predicted rank moved up', 'high'),
('rank_changed_down', 'exam', 'Rank Dropped', 'Predicted rank slipped', 'high'),
('sureshot_zone_topper', 'exam', 'Topper Zone', 'You entered Topper zone', 'high'),
('sureshot_zone_at_risk', 'exam', 'At-Risk Zone', 'Action required to stay safe', 'critical'),
('sureshot_questions_ready', 'exam', 'SureShot Questions Ready', 'High-probability question set', 'high'),
('precision_score_milestone', 'exam', 'Precision Milestone', 'Crossed precision threshold', 'normal'),
('current_affairs_digest', 'exam', 'Current Affairs Digest', 'Daily briefing ready', 'normal'),
('exam_today_motivation', 'exam', 'Exam Day Motivation', 'D-day cheer + checklist', 'critical'),
('benchmark_deviation', 'exam', 'Benchmark Deviation', 'Performance off-track', 'high'),
('rank_war_daily', 'exam', 'Rank War', 'Daily peer competition', 'normal'),

-- ENGAGEMENT & GROWTH
('churn_risk_detected', 'growth', 'Churn Risk', 'High disengagement signal', 'critical'),
('reengagement_1d', 'growth', 'Re-engage 1d', 'Inactive 24h', 'normal'),
('reengagement_3d', 'growth', 'Re-engage 3d', 'Inactive 3 days', 'high'),
('reengagement_7d', 'growth', 'Re-engage 7d', 'Inactive 7 days — last call', 'high'),
('trial_started', 'growth', 'Trial Started', 'Welcome to 14-day trial', 'normal'),
('trial_expiring_3d', 'growth', 'Trial Expiring 3d', 'Upgrade reminder', 'high'),
('trial_expiring_1d', 'growth', 'Trial Expiring 1d', 'Last day of trial', 'critical'),
('trial_expired', 'growth', 'Trial Expired', 'Subscribe now', 'critical'),
('subscription_activated', 'growth', 'Subscription Activated', 'Premium unlocked', 'normal'),
('subscription_renewed', 'growth', 'Subscription Renewed', 'Thanks for renewing', 'low'),
('subscription_failed', 'growth', 'Payment Failed', 'Update payment method', 'critical'),
('referral_milestone', 'growth', 'Referral Milestone', 'Earned a reward via referral', 'high'),
('brain_level_up', 'growth', 'Brain Level Up', '10-tier progression', 'high'),
('xp_earned', 'growth', 'XP Earned', 'Major XP gain', 'low'),
('motivation_boost', 'growth', 'Motivation Boost', 'Confidence dip detected', 'normal'),
('dynamic_reward', 'growth', 'Dynamic Reward', 'Surprise reward', 'normal'),

-- SOCIAL
('community_reply', 'social', 'Reply to Your Post', 'Someone replied to your discussion', 'normal'),
('community_mention', 'social', 'You Were Mentioned', '@you in community', 'normal'),
('study_pod_invite', 'social', 'Study Pod Invite', 'Joined a study pod', 'normal'),
('leaderboard_overtaken', 'social', 'You''ve Been Overtaken', 'Friend passed you on leaderboard', 'normal'),
('friend_joined', 'social', 'Friend Joined ACRY', 'A referred friend signed up', 'low'),

-- SYSTEM
('app_update_available', 'system', 'App Update Available', 'New version ready', 'low'),
('maintenance_window', 'system', 'Scheduled Maintenance', 'Heads up on downtime', 'normal'),
('admin_broadcast', 'system', 'Admin Announcement', 'Manual broadcast from team', 'normal'),
('security_alert', 'system', 'Security Alert', 'Unusual activity', 'critical'),
('test_notification', 'system', 'Test Notification', 'Admin test trigger', 'low')
ON CONFLICT (event_key) DO NOTHING;

-- Seed default automation rules
INSERT INTO public.push_automation_rules (event_key, enabled)
SELECT event_key, default_enabled FROM public.push_event_catalog
ON CONFLICT (event_key) DO NOTHING;
