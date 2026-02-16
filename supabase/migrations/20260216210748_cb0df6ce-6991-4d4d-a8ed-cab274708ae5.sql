
-- Add WhatsApp phone number and opt-in to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_opted_in BOOLEAN DEFAULT false;

-- WhatsApp message log
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),
  to_number TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text', -- text, template, media
  content TEXT,
  template_name TEXT,
  template_params JSONB,
  media_url TEXT,
  twilio_sid TEXT,
  status TEXT NOT NULL DEFAULT 'queued', -- queued, sent, delivered, read, failed, undelivered
  error_code TEXT,
  error_message TEXT,
  direction TEXT NOT NULL DEFAULT 'outbound', -- outbound, inbound
  category TEXT, -- risk_digest, study_reminder, streak, milestone, campaign, manual
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Admins can see all messages
CREATE POLICY "Admins can manage whatsapp messages"
ON public.whatsapp_messages
FOR ALL
USING (public.is_admin(auth.uid()));

-- Users can see their own messages
CREATE POLICY "Users can view own whatsapp messages"
ON public.whatsapp_messages
FOR SELECT
USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_whatsapp_messages_user ON public.whatsapp_messages(user_id);
CREATE INDEX idx_whatsapp_messages_status ON public.whatsapp_messages(status);
CREATE INDEX idx_whatsapp_messages_twilio_sid ON public.whatsapp_messages(twilio_sid);
CREATE INDEX idx_whatsapp_messages_created ON public.whatsapp_messages(created_at DESC);

-- WhatsApp templates registry
CREATE TABLE public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  body_template TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'utility', -- utility, marketing, authentication
  variables TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage whatsapp templates"
ON public.whatsapp_templates
FOR ALL
USING (public.is_admin(auth.uid()));

-- Insert default templates
INSERT INTO public.whatsapp_templates (name, description, body_template, category, variables) VALUES
('risk_digest', 'Daily risk digest notification', '⚠️ *Risk Digest*\n\n{{1}} topic(s) need attention today.\n\nTop priority: *{{2}}* ({{3}}% strength)\n\n📚 Tap to review your study plan.', 'utility', ARRAY['risk_count', 'top_topic', 'strength']),
('study_reminder', 'Study session reminder', '🧠 *Study Reminder*\n\nHey {{1}}! Time to study.\n\nYour goal: {{2}} minutes today.\nSuggested topic: *{{3}}*\n\nLet''s keep that streak going! 🔥', 'utility', ARRAY['name', 'goal_minutes', 'suggested_topic']),
('streak_milestone', 'Streak milestone celebration', '🎉 *Streak Milestone!*\n\nCongrats {{1}}! You hit a *{{2}}-day streak*!\n\nYou''re in the top {{3}}% of learners. Keep it up! 💪', 'utility', ARRAY['name', 'streak_days', 'percentile']),
('weekly_report', 'Weekly progress report', '📊 *Weekly Report*\n\nHi {{1}}, here''s your week:\n\n⏱️ {{2}} min studied\n📈 {{3}} topics improved\n🧠 Brain score: {{4}}%\n\nKeep pushing! 🚀', 'utility', ARRAY['name', 'minutes', 'topics_improved', 'brain_score']),
('exam_countdown', 'Exam countdown alert', '⏰ *Exam Countdown*\n\nHey {{1}}, only *{{2}} days* until your {{3}} exam!\n\n{{4}} topics still need review.\nStay focused! 📖', 'utility', ARRAY['name', 'days_left', 'exam_type', 'weak_topics_count']);

-- Trigger for updated_at
CREATE TRIGGER update_whatsapp_messages_updated_at
BEFORE UPDATE ON public.whatsapp_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_templates_updated_at
BEFORE UPDATE ON public.whatsapp_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
