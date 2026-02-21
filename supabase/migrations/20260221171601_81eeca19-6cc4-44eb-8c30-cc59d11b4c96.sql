
-- Autopilot admin configuration (singleton)
CREATE TABLE public.autopilot_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  intensity_level TEXT NOT NULL DEFAULT 'balanced' CHECK (intensity_level IN ('gentle','balanced','intense','beast')),
  auto_schedule_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_mode_switch_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_emergency_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_mock_optimization_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_weekly_report_enabled BOOLEAN NOT NULL DEFAULT true,
  emergency_drop_threshold INTEGER NOT NULL DEFAULT 15,
  emergency_min_memory_strength INTEGER NOT NULL DEFAULT 30,
  report_send_day INTEGER NOT NULL DEFAULT 0,
  report_send_hour INTEGER NOT NULL DEFAULT 9,
  report_channels TEXT[] NOT NULL DEFAULT ARRAY['email','in_app'],
  max_daily_auto_sessions INTEGER NOT NULL DEFAULT 6,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.autopilot_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage autopilot config" ON public.autopilot_config
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Anyone can read autopilot config" ON public.autopilot_config
  FOR SELECT USING (true);

-- Insert default config
INSERT INTO public.autopilot_config (id) VALUES (gen_random_uuid());

-- Per-user autopilot sessions (daily auto-generated plans)
CREATE TABLE public.autopilot_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  planned_schedule JSONB NOT NULL DEFAULT '[]',
  completed_sessions INTEGER NOT NULL DEFAULT 0,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  mode_switches JSONB DEFAULT '[]',
  emergency_triggered BOOLEAN NOT NULL DEFAULT false,
  emergency_topic_id UUID REFERENCES public.topics(id),
  performance_summary JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','skipped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, session_date)
);

ALTER TABLE public.autopilot_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own autopilot sessions" ON public.autopilot_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all autopilot sessions" ON public.autopilot_sessions
  FOR SELECT USING (public.is_admin(auth.uid()));

-- User autopilot preferences
CREATE TABLE public.user_autopilot_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  autopilot_enabled BOOLEAN NOT NULL DEFAULT true,
  preferred_intensity TEXT DEFAULT 'balanced',
  quiet_hours_start INTEGER DEFAULT 22,
  quiet_hours_end INTEGER DEFAULT 7,
  max_sessions_per_day INTEGER DEFAULT 6,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_autopilot_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences" ON public.user_autopilot_preferences
  FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER update_autopilot_sessions_updated_at
  BEFORE UPDATE ON public.autopilot_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_autopilot_prefs_updated_at
  BEFORE UPDATE ON public.user_autopilot_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
