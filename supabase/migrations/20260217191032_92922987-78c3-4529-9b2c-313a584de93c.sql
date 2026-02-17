
-- Push Notification Templates
CREATE TABLE public.push_notification_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  variables TEXT[] DEFAULT '{}'::text[],
  icon TEXT DEFAULT 'default',
  priority TEXT NOT NULL DEFAULT 'normal',
  is_active BOOLEAN NOT NULL DEFAULT true,
  use_ai_personalization BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.push_notification_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage push templates" ON public.push_notification_templates FOR ALL USING (is_admin(auth.uid()));

-- Push Notification Triggers (automation rules)
CREATE TABLE public.push_notification_triggers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trigger_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  template_id UUID REFERENCES public.push_notification_templates(id) ON DELETE SET NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  cooldown_minutes INTEGER DEFAULT 60,
  target_audience JSONB NOT NULL DEFAULT '{"type":"all"}'::jsonb,
  schedule_type TEXT NOT NULL DEFAULT 'instant',
  schedule_config JSONB DEFAULT '{}'::jsonb,
  priority TEXT NOT NULL DEFAULT 'normal',
  use_ai_content BOOLEAN NOT NULL DEFAULT false,
  total_sent BIGINT DEFAULT 0,
  total_opened BIGINT DEFAULT 0,
  total_clicked BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.push_notification_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage push triggers" ON public.push_notification_triggers FOR ALL USING (is_admin(auth.uid()));

-- Push Notification Queue (for scheduled/recurring)
CREATE TABLE public.push_notification_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trigger_key TEXT,
  template_id UUID REFERENCES public.push_notification_templates(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.push_notification_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage push queue" ON public.push_notification_queue FOR ALL USING (is_admin(auth.uid()));

-- Push Notification Logs (detailed analytics)
CREATE TABLE public.push_notification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trigger_key TEXT,
  template_id UUID REFERENCES public.push_notification_templates(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'sent',
  device_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  error_message TEXT,
  ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.push_notification_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage push logs" ON public.push_notification_logs FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Users can view own push logs" ON public.push_notification_logs FOR SELECT USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_push_queue_status_scheduled ON public.push_notification_queue(status, scheduled_at);
CREATE INDEX idx_push_queue_user ON public.push_notification_queue(user_id);
CREATE INDEX idx_push_logs_user ON public.push_notification_logs(user_id);
CREATE INDEX idx_push_logs_created ON public.push_notification_logs(created_at DESC);
CREATE INDEX idx_push_logs_trigger ON public.push_notification_logs(trigger_key);
CREATE INDEX idx_push_triggers_key ON public.push_notification_triggers(trigger_key);
CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions(user_id);

-- Seed default triggers
INSERT INTO public.push_notification_triggers (trigger_key, display_name, description, category, is_enabled, cooldown_minutes, use_ai_content) VALUES
-- User Actions
('user_signup', 'User Signup', 'Welcome notification on signup', 'user_action', true, 0, true),
('user_login', 'User Login', 'Login detected notification', 'user_action', false, 1440, false),
('profile_setup', 'Profile Setup Complete', 'Profile completion celebration', 'user_action', true, 0, true),
('exam_setup', 'Exam Setup Complete', 'Exam configuration acknowledgment', 'user_action', true, 0, true),
('study_session_start', 'Study Session Started', 'Encouragement on starting study', 'user_action', false, 60, false),
('study_session_complete', 'Study Session Complete', 'Celebration on session completion', 'user_action', true, 30, true),
-- AI Brain Predictions
('memory_forget_risk', 'Memory Forget Risk', 'Alert when memory is about to decay', 'ai_prediction', true, 360, true),
('weak_topic_detected', 'Weak Topic Detected', 'New weak topic identified by AI', 'ai_prediction', true, 720, true),
('memory_strength_improved', 'Memory Improved', 'Memory strength increased', 'ai_prediction', true, 1440, true),
('memory_strength_decreased', 'Memory Declined', 'Memory strength decreased', 'ai_prediction', true, 360, true),
('brain_performance_improved', 'Brain Performance Up', 'Overall brain performance improved', 'ai_prediction', true, 1440, true),
('brain_performance_declined', 'Brain Performance Down', 'Overall brain performance declined', 'ai_prediction', true, 720, true),
-- Study Reminders
('inactive_hours', 'Inactive Hours', 'User inactive for configured hours', 'study_reminder', true, 240, true),
('inactive_days', 'Inactive Days', 'User inactive for multiple days', 'study_reminder', true, 1440, true),
('study_reminder', 'Study Reminder', 'Scheduled study reminder', 'study_reminder', true, 120, true),
('revision_reminder', 'Revision Reminder', 'Topics due for revision', 'study_reminder', true, 360, true),
-- Fix & Improvement
('fix_session_recommended', 'Fix Session Recommended', 'AI recommends a fix session', 'improvement', true, 720, true),
('fix_session_completed', 'Fix Session Completed', 'Fix session completed celebration', 'improvement', true, 0, true),
('improvement_detected', 'Improvement Detected', 'Significant improvement detected', 'improvement', true, 1440, true),
-- Rank & Exam
('rank_prediction_updated', 'Rank Prediction Updated', 'AI rank prediction changed', 'rank_exam', true, 1440, true),
('rank_improved', 'Rank Improved', 'User rank went up', 'rank_exam', true, 0, true),
('rank_declined', 'Rank Declined', 'User rank went down', 'rank_exam', true, 1440, true),
('exam_approaching', 'Exam Approaching', 'Exam date is near', 'rank_exam', true, 1440, false),
('exam_countdown', 'Exam Countdown', 'Daily countdown to exam', 'rank_exam', true, 1440, false),
-- Community
('community_reply', 'Reply Received', 'Someone replied to user post', 'community', true, 5, false),
('community_comment', 'Comment Received', 'New comment on user post', 'community', true, 5, false),
('community_mention', 'User Mentioned', 'User was mentioned in a post', 'community', true, 5, false),
('ai_answer_posted', 'AI Answer Posted', 'AI answered user question', 'community', true, 0, false),
-- Subscription & Billing
('subscription_activated', 'Subscription Activated', 'New subscription started', 'billing', true, 0, false),
('subscription_expiring', 'Subscription Expiring', 'Subscription about to expire', 'billing', true, 1440, false),
('payment_successful', 'Payment Successful', 'Payment processed successfully', 'billing', true, 0, false),
('payment_failed', 'Payment Failed', 'Payment processing failed', 'billing', true, 60, false),
-- Security
('new_device_login', 'New Device Login', 'Login from new device detected', 'security', true, 0, false),
('suspicious_activity', 'Suspicious Activity', 'Unusual account activity detected', 'security', true, 0, false),
('password_changed', 'Password Changed', 'Account password was changed', 'security', true, 0, false),
-- Streak
('streak_milestone', 'Streak Milestone', 'Streak milestone achieved', 'engagement', true, 0, true),
('streak_at_risk', 'Streak At Risk', 'Study streak about to break', 'engagement', true, 360, true),
('streak_broken', 'Streak Broken', 'Study streak was broken', 'engagement', true, 0, true),
-- Admin
('admin_announcement', 'Admin Announcement', 'Global admin announcement', 'admin', true, 0, false);

-- Update trigger for templates
CREATE TRIGGER update_push_templates_updated_at BEFORE UPDATE ON public.push_notification_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_push_triggers_updated_at BEFORE UPDATE ON public.push_notification_triggers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_push_queue_updated_at BEFORE UPDATE ON public.push_notification_queue FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
