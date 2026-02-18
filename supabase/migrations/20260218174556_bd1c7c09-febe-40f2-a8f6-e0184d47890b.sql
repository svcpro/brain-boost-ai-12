
-- =============================================
-- OMNICHANNEL NOTIFICATION ENGINE SCHEMA
-- =============================================

-- Priority enum
CREATE TYPE public.notification_priority AS ENUM ('critical', 'high', 'medium', 'low');

-- Channel enum
CREATE TYPE public.notification_channel AS ENUM ('push', 'whatsapp', 'email', 'voice', 'in_app');

-- Delivery status enum
CREATE TYPE public.delivery_status AS ENUM ('pending', 'processing', 'delivered', 'failed', 'skipped', 'opted_out');

-- ─── Event Log Table ───
CREATE TABLE public.event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID NOT NULL,
  source TEXT NOT NULL DEFAULT 'web',
  priority notification_priority NOT NULL DEFAULT 'medium',
  payload JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_log_user ON public.event_log(user_id);
CREATE INDEX idx_event_log_type ON public.event_log(event_type);
CREATE INDEX idx_event_log_status ON public.event_log(status);
CREATE INDEX idx_event_log_created ON public.event_log(created_at DESC);

ALTER TABLE public.event_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own events"
  ON public.event_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on event_log"
  ON public.event_log FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated users can insert own events"
  ON public.event_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ─── Notification Delivery Log Table ───
CREATE TABLE public.notification_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.event_log(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  channel notification_channel NOT NULL,
  status delivery_status NOT NULL DEFAULT 'pending',
  priority notification_priority NOT NULL DEFAULT 'medium',
  title TEXT,
  body TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  fallback_channel notification_channel,
  error_message TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_log_event ON public.notification_delivery_log(event_id);
CREATE INDEX idx_delivery_log_user ON public.notification_delivery_log(user_id);
CREATE INDEX idx_delivery_log_status ON public.notification_delivery_log(status);
CREATE INDEX idx_delivery_log_channel ON public.notification_delivery_log(channel);
CREATE INDEX idx_delivery_log_created ON public.notification_delivery_log(created_at DESC);

ALTER TABLE public.notification_delivery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own delivery logs"
  ON public.notification_delivery_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admin full access on delivery_log"
  ON public.notification_delivery_log FOR ALL
  USING (public.is_admin(auth.uid()));

-- ─── Omnichannel Trigger Rules Table ───
CREATE TABLE public.omnichannel_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  priority notification_priority NOT NULL DEFAULT 'medium',
  channels notification_channel[] NOT NULL DEFAULT '{push}',
  fallback_channels notification_channel[] DEFAULT '{}',
  condition_expression JSONB DEFAULT '{}',
  delay_seconds INT NOT NULL DEFAULT 0,
  retry_count INT NOT NULL DEFAULT 3,
  cooldown_minutes INT NOT NULL DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  total_triggered INT NOT NULL DEFAULT 0,
  total_delivered INT NOT NULL DEFAULT 0,
  total_failed INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_type)
);

ALTER TABLE public.omnichannel_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage omnichannel_rules"
  ON public.omnichannel_rules FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated can read omnichannel_rules"
  ON public.omnichannel_rules FOR SELECT
  TO authenticated
  USING (true);

-- ─── Trigger for updated_at ───
CREATE TRIGGER update_delivery_log_updated_at
  BEFORE UPDATE ON public.notification_delivery_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_omnichannel_rules_updated_at
  BEFORE UPDATE ON public.omnichannel_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── Seed default omnichannel rules for all events ───
INSERT INTO public.omnichannel_rules (event_type, display_name, category, priority, channels, fallback_channels) VALUES
  ('signup', 'User Signup', 'auth', 'high', '{push,whatsapp,email,voice}', '{email}'),
  ('email_verified', 'Email Verified', 'auth', 'medium', '{push,email}', '{}'),
  ('login', 'User Login', 'auth', 'low', '{in_app}', '{}'),
  ('profile_completed', 'Profile Completed', 'user', 'medium', '{push,email}', '{}'),
  ('exam_setup', 'Exam Setup', 'study', 'medium', '{push,whatsapp}', '{email}'),
  ('study_session_start', 'Study Session Start', 'study', 'low', '{in_app}', '{}'),
  ('study_session_end', 'Study Session End', 'study', 'medium', '{push}', '{}'),
  ('inactivity_detected', 'Inactivity Detected', 'engagement', 'high', '{push,whatsapp}', '{email,voice}'),
  ('memory_risk_detected', 'Memory Risk Detected', 'ai', 'critical', '{push,whatsapp,email,voice}', '{}'),
  ('weak_topic_detected', 'Weak Topic Detected', 'ai', 'high', '{push,whatsapp}', '{email}'),
  ('fix_session_recommended', 'Fix Session Recommended', 'ai', 'high', '{push,whatsapp}', '{email}'),
  ('fix_session_completed', 'Fix Session Completed', 'study', 'medium', '{push}', '{}'),
  ('rank_prediction_update', 'Rank Prediction Update', 'ai', 'medium', '{push,whatsapp}', '{}'),
  ('rank_improved', 'Rank Improved', 'achievement', 'high', '{push,whatsapp,email}', '{}'),
  ('rank_declined', 'Rank Declined', 'ai', 'high', '{push,whatsapp}', '{email}'),
  ('community_reply', 'Community Reply', 'community', 'medium', '{push}', '{email}'),
  ('community_mention', 'Community Mention', 'community', 'high', '{push,email}', '{}'),
  ('subscription_activated', 'Subscription Activated', 'billing', 'high', '{push,whatsapp,email}', '{}'),
  ('subscription_expiry', 'Subscription Expiry Warning', 'billing', 'critical', '{push,whatsapp,email,voice}', '{}'),
  ('payment_success', 'Payment Success', 'billing', 'high', '{push,email}', '{}'),
  ('payment_failure', 'Payment Failure', 'billing', 'critical', '{push,whatsapp,email,voice}', '{}'),
  ('security_alert', 'Security Alert', 'security', 'critical', '{push,whatsapp,email,voice}', '{}'),
  ('admin_announcement', 'Admin Announcement', 'admin', 'high', '{push,whatsapp,email}', '{}'),
  ('streak_milestone', 'Streak Milestone', 'achievement', 'high', '{push,whatsapp}', '{email}'),
  ('streak_at_risk', 'Streak At Risk', 'engagement', 'high', '{push,whatsapp}', '{voice}'),
  ('brain_update_reminder', 'Brain Update Reminder', 'ai', 'medium', '{push,whatsapp}', '{}'),
  ('daily_briefing', 'Daily Briefing', 'engagement', 'medium', '{push,email}', '{}'),
  ('weekly_report', 'Weekly Report', 'engagement', 'medium', '{email,push}', '{}'),
  ('freeze_gift_received', 'Freeze Gift Received', 'social', 'high', '{push,whatsapp}', '{email}'),
  ('exam_completed', 'Exam Completed', 'study', 'medium', '{push}', '{}'),
  ('badge_earned', 'Badge Earned', 'achievement', 'high', '{push,whatsapp}', '{}');
