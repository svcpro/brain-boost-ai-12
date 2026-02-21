
-- =============================================
-- ACRY 2.0: AI Cognitive Personalization Engine
-- =============================================

-- 1. Cognitive Profile Engine
CREATE TABLE public.cognitive_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  learning_style TEXT NOT NULL DEFAULT 'hybrid' CHECK (learning_style IN ('conceptual', 'memorizer', 'hybrid')),
  learning_style_confidence NUMERIC DEFAULT 0,
  avg_answer_speed_ms NUMERIC DEFAULT 0,
  speed_pattern TEXT DEFAULT 'moderate' CHECK (speed_pattern IN ('fast', 'moderate', 'slow', 'variable')),
  accuracy_rate NUMERIC DEFAULT 0,
  speed_accuracy_tradeoff TEXT DEFAULT 'balanced' CHECK (speed_accuracy_tradeoff IN ('speed_first', 'accuracy_first', 'balanced')),
  conceptual_score NUMERIC DEFAULT 0,
  memorizer_score NUMERIC DEFAULT 0,
  total_answers_analyzed INTEGER DEFAULT 0,
  last_recalibrated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.cognitive_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cognitive profile" ON public.cognitive_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cognitive profile" ON public.cognitive_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cognitive profile" ON public.cognitive_profiles FOR UPDATE USING (auth.uid() = user_id);

-- 2. Real-Time Fatigue Events
CREATE TABLE public.fatigue_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'fatigue_detected' CHECK (event_type IN ('fatigue_detected', 'break_suggested', 'break_taken', 'break_skipped')),
  trigger_reason TEXT,
  response_delay_avg_ms NUMERIC DEFAULT 0,
  mistake_cluster_count INTEGER DEFAULT 0,
  session_duration_minutes NUMERIC DEFAULT 0,
  fatigue_score NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fatigue_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fatigue events" ON public.fatigue_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own fatigue events" ON public.fatigue_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. Emotional Confidence Events
CREATE TABLE public.confidence_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'struggle_detected' CHECK (event_type IN ('struggle_detected', 'rescue_triggered', 'confidence_boost', 'recovery_achieved')),
  consecutive_wrong INTEGER DEFAULT 0,
  topic_id UUID,
  boost_message TEXT,
  rescue_mode_duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.confidence_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own confidence events" ON public.confidence_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own confidence events" ON public.confidence_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. Language Performance Analytics
CREATE TABLE public.language_performance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  language TEXT NOT NULL DEFAULT 'english' CHECK (language IN ('english', 'hindi')),
  total_questions INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  avg_response_time_ms NUMERIC DEFAULT 0,
  accuracy_rate NUMERIC DEFAULT 0,
  improvement_pct NUMERIC DEFAULT 0,
  period_start TIMESTAMPTZ DEFAULT now(),
  period_end TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.language_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own language performance" ON public.language_performance FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own language performance" ON public.language_performance FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own language performance" ON public.language_performance FOR UPDATE USING (auth.uid() = user_id);

-- 5. AI Recalibration Logs
CREATE TABLE public.ai_recalibration_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  recalibration_type TEXT NOT NULL DEFAULT 'session' CHECK (recalibration_type IN ('session', 'weekly', 'manual', 'admin_triggered')),
  old_profile JSONB DEFAULT '{}'::jsonb,
  new_profile JSONB DEFAULT '{}'::jsonb,
  changes_summary TEXT,
  triggered_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_recalibration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recalibration logs" ON public.ai_recalibration_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all recalibration logs" ON public.ai_recalibration_logs FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "System can insert recalibration logs" ON public.ai_recalibration_logs FOR INSERT WITH CHECK (true);

-- 6. Admin Fatigue Threshold Config
CREATE TABLE public.fatigue_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delay_threshold_ms NUMERIC DEFAULT 8000,
  mistake_cluster_threshold INTEGER DEFAULT 3,
  session_max_minutes NUMERIC DEFAULT 90,
  break_suggestion_cooldown_minutes NUMERIC DEFAULT 15,
  rescue_mode_wrong_threshold INTEGER DEFAULT 4,
  confidence_boost_enabled BOOLEAN DEFAULT true,
  auto_language_suggestion BOOLEAN DEFAULT true,
  weekly_recalibration_enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.fatigue_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read fatigue config" ON public.fatigue_config FOR SELECT USING (true);
CREATE POLICY "Admins can update fatigue config" ON public.fatigue_config FOR UPDATE USING (public.is_admin(auth.uid()));

-- Insert default config
INSERT INTO public.fatigue_config (id) VALUES (gen_random_uuid());

-- Triggers for updated_at
CREATE TRIGGER update_cognitive_profiles_updated_at BEFORE UPDATE ON public.cognitive_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_language_performance_updated_at BEFORE UPDATE ON public.language_performance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fatigue_config_updated_at BEFORE UPDATE ON public.fatigue_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
