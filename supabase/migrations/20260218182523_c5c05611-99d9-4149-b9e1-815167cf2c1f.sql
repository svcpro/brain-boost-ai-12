
-- ═══ NOTIFICATION SEGMENTS ═══
CREATE TABLE IF NOT EXISTS public.notification_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  segment_key TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, segment_key)
);
ALTER TABLE public.notification_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages segments" ON public.notification_segments FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_segments_user ON public.notification_segments(user_id);
CREATE INDEX idx_segments_key ON public.notification_segments(segment_key);

-- ═══ GROWTH JOURNEYS (30-day activation etc.) ═══
CREATE TABLE IF NOT EXISTS public.growth_journeys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  journey_key TEXT NOT NULL DEFAULT 'onboarding_30d',
  current_step INT NOT NULL DEFAULT 0,
  total_steps INT NOT NULL DEFAULT 8,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_step_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  step_history JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.growth_journeys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages journeys" ON public.growth_journeys FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_journeys_user ON public.growth_journeys(user_id);
CREATE INDEX idx_journeys_status ON public.growth_journeys(status);

-- ═══ GROWTH TRIGGER LOG ═══
CREATE TABLE IF NOT EXISTS public.growth_trigger_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_data JSONB DEFAULT '{}',
  channel TEXT,
  outcome TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.growth_trigger_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages growth logs" ON public.growth_trigger_log FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_growth_log_user ON public.growth_trigger_log(user_id);
CREATE INDEX idx_growth_log_type ON public.growth_trigger_log(trigger_type);
CREATE INDEX idx_growth_log_created ON public.growth_trigger_log(created_at DESC);

-- ═══ GROWTH ANALYTICS (daily rollups) ═══
CREATE TABLE IF NOT EXISTS public.growth_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  segment_key TEXT,
  dau INT DEFAULT 0,
  retention_rate NUMERIC(5,2) DEFAULT 0,
  open_rate NUMERIC(5,2) DEFAULT 0,
  click_rate NUMERIC(5,2) DEFAULT 0,
  conversion_rate NUMERIC(5,2) DEFAULT 0,
  churn_reduction NUMERIC(5,2) DEFAULT 0,
  revenue_uplift NUMERIC(10,2) DEFAULT 0,
  referral_count INT DEFAULT 0,
  notifications_sent INT DEFAULT 0,
  notifications_opened INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(metric_date, segment_key)
);
ALTER TABLE public.growth_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages growth analytics" ON public.growth_analytics FOR ALL USING (true) WITH CHECK (true);

-- ═══ Add fatigue + segment fields to behavioral_profiles ═══
ALTER TABLE public.behavioral_profiles
  ADD COLUMN IF NOT EXISTS notification_fatigue_score NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rank_war_eligible BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS silence_mode_active BOOLEAN DEFAULT false;

-- ═══ Enable realtime for growth analytics ═══
ALTER PUBLICATION supabase_realtime ADD TABLE public.growth_analytics;
