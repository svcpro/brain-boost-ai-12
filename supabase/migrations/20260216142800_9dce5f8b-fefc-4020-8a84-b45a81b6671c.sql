
-- Content flags table for tracking flagged posts/comments
CREATE TABLE public.content_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'comment')),
  content_id UUID NOT NULL,
  user_id UUID NOT NULL,
  abuse_score INTEGER NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  categories TEXT[] DEFAULT '{}',
  ai_reasoning TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  auto_hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Moderation actions log
CREATE TABLE public.moderation_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('warning', 'post_restriction', 'temporary_ban', 'community_ban', 'account_suspension')),
  reason TEXT,
  related_flag_id UUID REFERENCES public.content_flags(id),
  is_automatic BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User moderation profile (aggregated stats)
CREATE TABLE public.user_moderation_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  total_warnings INTEGER NOT NULL DEFAULT 0,
  total_flags INTEGER NOT NULL DEFAULT 0,
  total_violations INTEGER NOT NULL DEFAULT 0,
  current_penalty TEXT DEFAULT NULL,
  is_restricted BOOLEAN NOT NULL DEFAULT false,
  is_banned BOOLEAN NOT NULL DEFAULT false,
  last_violation_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Moderation rules configuration
CREATE TABLE public.moderation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('blocked_words', 'warning_threshold', 'penalty_threshold', 'auto_hide_threshold', 'allowed_words')),
  rule_key TEXT NOT NULL UNIQUE,
  rule_value JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.content_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_moderation_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_rules ENABLE ROW LEVEL SECURITY;

-- Admin-only policies using existing is_admin function
CREATE POLICY "Admins can manage content flags" ON public.content_flags FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can manage moderation actions" ON public.moderation_actions FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can manage moderation profiles" ON public.user_moderation_profiles FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can manage moderation rules" ON public.moderation_rules FOR ALL USING (public.is_admin(auth.uid()));

-- Users can read their own moderation profile
CREATE POLICY "Users can view own moderation profile" ON public.user_moderation_profiles FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert flags (for edge function)
CREATE POLICY "Service can insert flags" ON public.content_flags FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can insert actions" ON public.moderation_actions FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can upsert profiles" ON public.user_moderation_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update profiles" ON public.user_moderation_profiles FOR UPDATE USING (true);

-- Insert default moderation rules
INSERT INTO public.moderation_rules (rule_type, rule_key, rule_value) VALUES
  ('warning_threshold', 'abuse_score_warning', '{"threshold": 40}'),
  ('penalty_threshold', 'abuse_score_restrict', '{"threshold": 60}'),
  ('auto_hide_threshold', 'abuse_score_auto_hide', '{"threshold": 80}'),
  ('penalty_threshold', 'warnings_before_restrict', '{"count": 3}'),
  ('penalty_threshold', 'restrictions_before_ban', '{"count": 2}'),
  ('blocked_words', 'blocked_word_list', '{"words": []}'),
  ('allowed_words', 'allowed_word_list', '{"words": []}');

-- Indexes
CREATE INDEX idx_content_flags_content ON public.content_flags(content_type, content_id);
CREATE INDEX idx_content_flags_user ON public.content_flags(user_id);
CREATE INDEX idx_content_flags_status ON public.content_flags(status);
CREATE INDEX idx_moderation_actions_user ON public.moderation_actions(user_id);
CREATE INDEX idx_moderation_actions_active ON public.moderation_actions(is_active);
CREATE INDEX idx_user_mod_profiles_user ON public.user_moderation_profiles(user_id);
