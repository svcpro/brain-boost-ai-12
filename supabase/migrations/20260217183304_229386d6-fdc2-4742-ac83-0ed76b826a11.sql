
-- Email triggers: automation rules for when to send emails
CREATE TABLE public.email_triggers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trigger_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  cooldown_hours INTEGER DEFAULT 24,
  priority TEXT NOT NULL DEFAULT 'normal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email triggers"
  ON public.email_triggers FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Email queue: reliable delivery queue
CREATE TABLE public.email_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trigger_key TEXT NOT NULL,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'normal',
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email queue"
  ON public.email_queue FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE INDEX idx_email_queue_status ON public.email_queue(status, scheduled_at);
CREATE INDEX idx_email_queue_user ON public.email_queue(user_id);

-- Email logs: comprehensive tracking
CREATE TABLE public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trigger_key TEXT NOT NULL,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email logs"
  ON public.email_logs FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Users can view own email logs"
  ON public.email_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX idx_email_logs_user ON public.email_logs(user_id);
CREATE INDEX idx_email_logs_trigger ON public.email_logs(trigger_key);
CREATE INDEX idx_email_logs_created ON public.email_logs(created_at DESC);

-- Triggers for updated_at
CREATE TRIGGER update_email_triggers_updated_at
  BEFORE UPDATE ON public.email_triggers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_queue_updated_at
  BEFORE UPDATE ON public.email_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default email triggers for all event types
INSERT INTO public.email_triggers (trigger_key, display_name, description, category, is_enabled, priority) VALUES
  ('user_signup', 'Welcome Email', 'Sent when a new user signs up', 'user_lifecycle', true, 'high'),
  ('email_verification', 'Email Verification', 'Email verification reminder', 'user_lifecycle', true, 'high'),
  ('profile_completed', 'Profile Completed', 'User completed their profile', 'user_lifecycle', true, 'normal'),
  ('exam_setup_completed', 'Exam Setup Done', 'User completed exam setup', 'user_lifecycle', true, 'normal'),
  ('memory_forget_risk', 'Memory Forget Risk', 'AI detected memory forget risk', 'ai_brain', true, 'high'),
  ('weak_topic_detected', 'Weak Topic Alert', 'AI detected weak topics', 'ai_brain', true, 'high'),
  ('brain_performance_up', 'Brain Performance Up', 'Brain performance improved', 'ai_brain', true, 'normal'),
  ('brain_performance_down', 'Brain Performance Drop', 'Brain performance decreased', 'ai_brain', true, 'high'),
  ('user_inactive_hours', 'Inactive Hours', 'User inactive for X hours', 'study_reminder', true, 'normal'),
  ('user_inactive_days', 'Inactive Days', 'User inactive for X days', 'study_reminder', true, 'high'),
  ('study_reminder', 'Study Reminder', 'Daily study reminder', 'study_reminder', true, 'normal'),
  ('revision_reminder', 'Revision Reminder', 'Topic revision needed', 'study_reminder', true, 'normal'),
  ('fix_session_completed', 'Fix Session Done', 'Fix session completed', 'study_progress', true, 'normal'),
  ('improvement_detected', 'Improvement Detected', 'AI detected improvement', 'study_progress', true, 'normal'),
  ('weak_topics_improved', 'Weak Topics Improved', 'Previously weak topics improved', 'study_progress', true, 'normal'),
  ('rank_prediction_updated', 'Rank Updated', 'Rank prediction was updated', 'rank_performance', true, 'normal'),
  ('rank_improved', 'Rank Improved', 'User rank improved', 'rank_performance', true, 'normal'),
  ('rank_dropped', 'Rank Dropped', 'User rank dropped', 'rank_performance', true, 'high'),
  ('exam_readiness_updated', 'Exam Readiness', 'Exam readiness score updated', 'rank_performance', true, 'normal'),
  ('community_reply', 'Community Reply', 'Someone replied to user post', 'community', true, 'normal'),
  ('community_comment', 'Community Comment', 'Someone commented on user post', 'community', true, 'normal'),
  ('community_mention', 'Community Mention', 'User mentioned in discussion', 'community', true, 'normal'),
  ('ai_answered_question', 'AI Answer', 'AI answered user question', 'community', true, 'normal'),
  ('subscription_activated', 'Subscription Active', 'Subscription activated', 'billing', true, 'high'),
  ('subscription_expired', 'Subscription Expired', 'Subscription expired', 'billing', true, 'high'),
  ('payment_successful', 'Payment Success', 'Payment processed successfully', 'billing', true, 'high'),
  ('payment_failed', 'Payment Failed', 'Payment failed', 'billing', true, 'high'),
  ('new_device_login', 'New Device Login', 'Login from new device detected', 'security', true, 'high'),
  ('password_changed', 'Password Changed', 'User password was changed', 'security', true, 'high'),
  ('suspicious_activity', 'Suspicious Activity', 'Suspicious activity detected', 'security', true, 'high'),
  ('new_feature', 'New Feature', 'New feature announcement', 'system', true, 'normal'),
  ('system_announcement', 'System Announcement', 'System-wide announcement', 'system', true, 'normal'),
  ('maintenance_notice', 'Maintenance Notice', 'Scheduled maintenance', 'system', true, 'high'),
  ('streak_milestone', 'Streak Milestone', 'User achieved streak milestone', 'study_progress', true, 'normal'),
  ('daily_goal_completed', 'Daily Goal Done', 'User completed daily goal', 'study_progress', true, 'normal'),
  ('weekly_report', 'Weekly Report', 'Weekly performance report', 'study_reminder', true, 'normal');
