
-- ═══════════════════════════════════════════════════════════════
-- INTELLIGENT BEHAVIORAL NOTIFICATION SYSTEM - Tables
-- ═══════════════════════════════════════════════════════════════

-- 1. User Engagement Patterns (Send-Time Optimization)
CREATE TABLE public.user_engagement_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  hour_of_day INT NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
  day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  engagement_type TEXT NOT NULL DEFAULT 'app_open',
  engagement_count INT NOT NULL DEFAULT 1,
  open_rate NUMERIC(5,4) DEFAULT 0,
  click_rate NUMERIC(5,4) DEFAULT 0,
  avg_response_time_seconds INT DEFAULT NULL,
  last_engaged_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_uep_user_id ON public.user_engagement_patterns(user_id);
CREATE UNIQUE INDEX idx_uep_unique ON public.user_engagement_patterns(user_id, hour_of_day, day_of_week, engagement_type);
ALTER TABLE public.user_engagement_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own engagement" ON public.user_engagement_patterns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service manages engagement" ON public.user_engagement_patterns FOR ALL USING (true) WITH CHECK (true);

-- 2. Channel Effectiveness
CREATE TABLE public.channel_effectiveness (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  channel TEXT NOT NULL,
  total_sent INT NOT NULL DEFAULT 0,
  total_opened INT NOT NULL DEFAULT 0,
  total_clicked INT NOT NULL DEFAULT 0,
  total_ignored INT NOT NULL DEFAULT 0,
  effectiveness_score NUMERIC(5,4) DEFAULT 0.5,
  last_successful_at TIMESTAMPTZ DEFAULT NULL,
  last_failed_at TIMESTAMPTZ DEFAULT NULL,
  is_disabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_ce_user_channel ON public.channel_effectiveness(user_id, channel);
ALTER TABLE public.channel_effectiveness ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own channel stats" ON public.channel_effectiveness FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service manages channel stats" ON public.channel_effectiveness FOR ALL USING (true) WITH CHECK (true);

-- 3. Churn Predictions
CREATE TABLE public.churn_predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  churn_probability NUMERIC(5,4) NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low',
  days_until_predicted_churn INT DEFAULT NULL,
  risk_factors JSONB DEFAULT '[]'::jsonb,
  interventions_sent INT NOT NULL DEFAULT 0,
  intervention_channels TEXT[] DEFAULT '{}',
  last_intervention_at TIMESTAMPTZ DEFAULT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ DEFAULT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cp_user_id ON public.churn_predictions(user_id);
CREATE INDEX idx_cp_risk ON public.churn_predictions(risk_level, resolved);
ALTER TABLE public.churn_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service manages churn" ON public.churn_predictions FOR ALL USING (true) WITH CHECK (true);

-- 4. Notification Bundles
CREATE TABLE public.notification_bundles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bundle_type TEXT NOT NULL DEFAULT 'daily_summary',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  item_count INT NOT NULL DEFAULT 0,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  channel TEXT NOT NULL DEFAULT 'push',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_nb_user_status ON public.notification_bundles(user_id, status);
ALTER TABLE public.notification_bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own bundles" ON public.notification_bundles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service manages bundles" ON public.notification_bundles FOR ALL USING (true) WITH CHECK (true);

-- 5. Escalation Tracking
CREATE TABLE public.notification_escalations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  ignore_count INT NOT NULL DEFAULT 0,
  current_escalation_level INT NOT NULL DEFAULT 0,
  escalation_channels TEXT[] DEFAULT ARRAY['push'],
  last_escalated_at TIMESTAMPTZ DEFAULT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ne_user_id ON public.notification_escalations(user_id);
ALTER TABLE public.notification_escalations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service manages escalations" ON public.notification_escalations FOR ALL USING (true) WITH CHECK (true);

-- 6. A/B Test Results
CREATE TABLE public.notification_ab_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  variant_a_template TEXT NOT NULL,
  variant_b_template TEXT NOT NULL,
  variant_a_sent INT NOT NULL DEFAULT 0,
  variant_a_opened INT NOT NULL DEFAULT 0,
  variant_a_clicked INT NOT NULL DEFAULT 0,
  variant_b_sent INT NOT NULL DEFAULT 0,
  variant_b_opened INT NOT NULL DEFAULT 0,
  variant_b_clicked INT NOT NULL DEFAULT 0,
  winner TEXT DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_ab_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service manages AB tests" ON public.notification_ab_tests FOR ALL USING (true) WITH CHECK (true);

-- 7. Behavioral columns on omnichannel_rules
ALTER TABLE public.omnichannel_rules
  ADD COLUMN IF NOT EXISTS use_smart_timing BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS use_dopamine_copy BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bundleable BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalation_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_escalation_level INT NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS smart_silence_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ab_test_id UUID DEFAULT NULL;

-- Realtime for escalations
ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_escalations;
