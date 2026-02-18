
-- Section 15: User Behavioral Profile (consolidated view)
CREATE TABLE public.behavioral_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  engagement_score NUMERIC DEFAULT 0,
  channel_preference JSONB DEFAULT '{"push":50,"whatsapp":50,"email":50,"voice":50}'::jsonb,
  churn_risk_score NUMERIC DEFAULT 0,
  motivation_type TEXT DEFAULT 'achievement',
  stress_level TEXT DEFAULT 'normal',
  best_send_hour INTEGER DEFAULT 9,
  best_send_day INTEGER DEFAULT 1,
  notification_fatigue_score NUMERIC DEFAULT 0,
  silence_mode_active BOOLEAN DEFAULT false,
  dopamine_strategy TEXT DEFAULT 'curiosity',
  habit_loop_stage TEXT DEFAULT 'cue',
  rank_war_eligible BOOLEAN DEFAULT false,
  last_computed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.behavioral_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all behavioral profiles"
ON public.behavioral_profiles FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "System can manage behavioral profiles"
ON public.behavioral_profiles FOR ALL
USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view own behavioral profile"
ON public.behavioral_profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE TRIGGER update_behavioral_profiles_updated_at
BEFORE UPDATE ON public.behavioral_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Analytics aggregation table for notification intelligence
CREATE TABLE public.notification_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_sent INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  total_suppressed INTEGER DEFAULT 0,
  total_bundled INTEGER DEFAULT 0,
  total_escalated INTEGER DEFAULT 0,
  churn_prevented INTEGER DEFAULT 0,
  engagement_lift_pct NUMERIC DEFAULT 0,
  retention_lift_pct NUMERIC DEFAULT 0,
  channel_breakdown JSONB DEFAULT '{}'::jsonb,
  dopamine_strategy_breakdown JSONB DEFAULT '{}'::jsonb,
  avg_decision_ms NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(date)
);

ALTER TABLE public.notification_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view notification analytics"
ON public.notification_analytics FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "System can manage notification analytics"
ON public.notification_analytics FOR ALL
USING (public.is_admin(auth.uid()));
