
-- Focus Shield: Distraction Intelligence Engine

-- 1. Admin configuration for Focus Shield
CREATE TABLE public.focus_shield_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_freeze_enabled BOOLEAN NOT NULL DEFAULT true,
  distraction_threshold INTEGER NOT NULL DEFAULT 60,
  warning_cooldown_seconds INTEGER NOT NULL DEFAULT 30,
  micro_recall_required BOOLEAN NOT NULL DEFAULT true,
  max_warnings_before_freeze INTEGER NOT NULL DEFAULT 3,
  freeze_duration_seconds INTEGER NOT NULL DEFAULT 300,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.focus_shield_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage focus shield config"
  ON public.focus_shield_config FOR ALL
  USING (public.is_admin(auth.uid()));

-- Insert default config
INSERT INTO public.focus_shield_config (id) VALUES (gen_random_uuid());

-- 2. User distraction events log
CREATE TABLE public.distraction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  event_type TEXT NOT NULL, -- 'tab_switch', 'app_blur', 'idle_detected', 'rapid_switch'
  during_focus_session BOOLEAN NOT NULL DEFAULT false,
  focus_session_id UUID,
  duration_seconds INTEGER DEFAULT 0,
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.distraction_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own distraction events"
  ON public.distraction_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own distraction events"
  ON public.distraction_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all distraction events"
  ON public.distraction_events FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE INDEX idx_distraction_events_user ON public.distraction_events(user_id, created_at DESC);

-- 3. Daily distraction scores
CREATE TABLE public.distraction_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  score_date DATE NOT NULL DEFAULT CURRENT_DATE,
  distraction_score INTEGER NOT NULL DEFAULT 0, -- 0-100 (higher = more distracted)
  focus_score INTEGER NOT NULL DEFAULT 100, -- inverse
  tab_switches INTEGER NOT NULL DEFAULT 0,
  blur_events INTEGER NOT NULL DEFAULT 0,
  total_distraction_seconds INTEGER NOT NULL DEFAULT 0,
  study_overlap_seconds INTEGER NOT NULL DEFAULT 0,
  late_night_minutes INTEGER NOT NULL DEFAULT 0,
  rapid_switches INTEGER NOT NULL DEFAULT 0,
  stability_correlation NUMERIC(4,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, score_date)
);

ALTER TABLE public.distraction_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own distraction scores"
  ON public.distraction_scores FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all distraction scores"
  ON public.distraction_scores FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE INDEX idx_distraction_scores_user ON public.distraction_scores(user_id, score_date DESC);

-- 4. Focus shield warnings log
CREATE TABLE public.focus_shield_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  warning_type TEXT NOT NULL DEFAULT 'distraction', -- 'distraction', 'freeze', 'recall_challenge'
  was_dismissed BOOLEAN NOT NULL DEFAULT false,
  recall_passed BOOLEAN,
  freeze_duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.focus_shield_warnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own warnings"
  ON public.focus_shield_warnings FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all warnings"
  ON public.focus_shield_warnings FOR SELECT
  USING (public.is_admin(auth.uid()));
