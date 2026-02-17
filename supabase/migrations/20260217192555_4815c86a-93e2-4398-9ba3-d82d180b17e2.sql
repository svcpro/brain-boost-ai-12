
-- Voice notification templates
CREATE TABLE public.voice_notification_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  voice_text TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  tone TEXT NOT NULL DEFAULT 'soft',
  voice_id TEXT DEFAULT 'EXAVITQu4vr4xnSDxMaL',
  variables TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage voice templates" ON public.voice_notification_templates
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_voice_notification_templates_updated_at
  BEFORE UPDATE ON public.voice_notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Voice notification triggers (pre-seeded automation rules)
CREATE TABLE public.voice_notification_triggers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trigger_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  use_ai_content BOOLEAN NOT NULL DEFAULT true,
  template_id UUID REFERENCES public.voice_notification_templates(id) ON DELETE SET NULL,
  cooldown_minutes INTEGER NOT NULL DEFAULT 60,
  priority TEXT NOT NULL DEFAULT 'normal',
  default_language TEXT NOT NULL DEFAULT 'en',
  default_tone TEXT NOT NULL DEFAULT 'soft',
  conditions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_notification_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage voice triggers" ON public.voice_notification_triggers
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_voice_notification_triggers_updated_at
  BEFORE UPDATE ON public.voice_notification_triggers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Voice notification logs
CREATE TABLE public.voice_notification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trigger_key TEXT,
  template_id UUID REFERENCES public.voice_notification_templates(id) ON DELETE SET NULL,
  voice_text TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  tone TEXT NOT NULL DEFAULT 'soft',
  voice_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  played_at TIMESTAMPTZ,
  error_message TEXT,
  context JSONB DEFAULT '{}',
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own voice logs" ON public.voice_notification_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all voice logs" ON public.voice_notification_logs
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE INDEX idx_voice_logs_user_created ON public.voice_notification_logs(user_id, created_at DESC);
CREATE INDEX idx_voice_logs_trigger ON public.voice_notification_logs(trigger_key, created_at DESC);
CREATE INDEX idx_voice_logs_status ON public.voice_notification_logs(status);

-- Voice notification queue
CREATE TABLE public.voice_notification_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trigger_key TEXT,
  template_id UUID REFERENCES public.voice_notification_templates(id) ON DELETE SET NULL,
  context JSONB DEFAULT '{}',
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage voice queue" ON public.voice_notification_queue
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE INDEX idx_voice_queue_status_scheduled ON public.voice_notification_queue(status, scheduled_at);

CREATE TRIGGER update_voice_notification_queue_updated_at
  BEFORE UPDATE ON public.voice_notification_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed 35+ automation triggers across all categories
INSERT INTO public.voice_notification_triggers (trigger_key, display_name, description, category, cooldown_minutes, priority, default_tone) VALUES
-- User Actions
('user_signup', 'User Signup', 'Welcome voice when user signs up', 'user_action', 0, 'high', 'soft'),
('user_login', 'User Login', 'Welcome back voice on login', 'user_action', 1440, 'low', 'soft'),
('profile_complete', 'Profile Completed', 'Voice when profile setup done', 'user_action', 0, 'normal', 'energetic'),
('exam_setup', 'Exam Setup Done', 'Voice confirming exam configuration', 'user_action', 0, 'normal', 'soft'),
('session_completed', 'Study Session Done', 'Voice celebrating session completion', 'user_action', 30, 'normal', 'energetic'),
-- AI Brain Predictions
('memory_forget_risk', 'Memory Forget Risk', 'Alert when topic memory at risk', 'ai_prediction', 120, 'high', 'calm'),
('weak_topic_detected', 'Weak Topic Detected', 'Alert when weak topic found', 'ai_prediction', 240, 'high', 'calm'),
('memory_improved', 'Memory Improved', 'Celebrate memory strength gain', 'ai_prediction', 60, 'normal', 'energetic'),
('memory_declined', 'Memory Declined', 'Alert on memory strength drop', 'ai_prediction', 120, 'high', 'calm'),
('brain_performance_up', 'Brain Performance Up', 'Celebrate brain score improvement', 'ai_prediction', 60, 'normal', 'energetic'),
('brain_performance_down', 'Brain Performance Down', 'Alert on brain score decline', 'ai_prediction', 240, 'high', 'calm'),
-- Study Reminders
('inactive_hours', 'Inactive Hours', 'Reminder after X hours inactive', 'study_reminder', 180, 'normal', 'soft'),
('inactive_days', 'Inactive Days', 'Urgent reminder after days inactive', 'study_reminder', 1440, 'high', 'calm'),
('revision_reminder', 'Revision Reminder', 'Scheduled revision reminder', 'study_reminder', 120, 'normal', 'soft'),
('study_schedule', 'Study Schedule', 'Daily study schedule voice', 'study_reminder', 1440, 'normal', 'soft'),
-- Fix Sessions
('fix_recommended', 'Fix Recommended', 'Voice suggesting fix session', 'fix_session', 120, 'high', 'calm'),
('fix_completed', 'Fix Completed', 'Celebrate fix session completion', 'fix_session', 0, 'normal', 'energetic'),
('improvement_detected', 'Improvement Detected', 'Voice celebrating improvement', 'fix_session', 60, 'normal', 'energetic'),
-- Rank & Exam
('rank_improved', 'Rank Improved', 'Celebrate rank improvement', 'rank_exam', 60, 'normal', 'energetic'),
('rank_declined', 'Rank Declined', 'Alert on rank decline', 'rank_exam', 240, 'high', 'calm'),
('exam_approaching', 'Exam Approaching', 'Exam countdown voice alert', 'rank_exam', 1440, 'high', 'soft'),
('exam_countdown_7d', 'Exam 7 Days Away', '7-day exam countdown', 'rank_exam', 1440, 'high', 'soft'),
('exam_countdown_1d', 'Exam Tomorrow', '1-day exam countdown', 'rank_exam', 720, 'critical', 'calm'),
-- Community
('community_reply', 'Reply Received', 'Voice when someone replies', 'community', 30, 'normal', 'soft'),
('community_answer', 'Answer Received', 'Voice when AI answers question', 'community', 30, 'normal', 'soft'),
('community_mention', 'User Mentioned', 'Voice when user is mentioned', 'community', 30, 'normal', 'soft'),
-- Subscription
('subscription_activated', 'Subscription Active', 'Welcome to premium voice', 'subscription', 0, 'high', 'energetic'),
('subscription_expiring', 'Subscription Expiring', 'Renewal reminder voice', 'subscription', 1440, 'high', 'calm'),
('payment_success', 'Payment Successful', 'Payment confirmation voice', 'subscription', 0, 'normal', 'soft'),
('payment_failed', 'Payment Failed', 'Payment failure alert voice', 'subscription', 1440, 'critical', 'calm'),
-- Security
('new_device_login', 'New Device Login', 'Security alert for new device', 'security', 0, 'critical', 'calm'),
('suspicious_activity', 'Suspicious Activity', 'Security threat alert', 'security', 0, 'critical', 'calm'),
('password_changed', 'Password Changed', 'Password change confirmation', 'security', 0, 'high', 'calm'),
-- Admin
('admin_announcement', 'Admin Announcement', 'Global admin voice broadcast', 'admin', 0, 'critical', 'soft'),
-- Streaks
('streak_milestone', 'Streak Milestone', 'Celebrate streak milestone', 'streak', 0, 'normal', 'energetic'),
('streak_at_risk', 'Streak At Risk', 'Alert when streak might break', 'streak', 720, 'high', 'calm');
