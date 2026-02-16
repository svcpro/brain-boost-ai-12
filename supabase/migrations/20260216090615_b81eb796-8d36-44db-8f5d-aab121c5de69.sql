
-- Plan feature gates: which features are available on which plans
CREATE TABLE public.plan_feature_gates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feature_key TEXT NOT NULL,
  feature_label TEXT NOT NULL,
  feature_category TEXT NOT NULL DEFAULT 'general',
  free_enabled BOOLEAN NOT NULL DEFAULT false,
  pro_enabled BOOLEAN NOT NULL DEFAULT true,
  ultra_enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint on feature_key
ALTER TABLE public.plan_feature_gates ADD CONSTRAINT plan_feature_gates_feature_key_unique UNIQUE (feature_key);

-- Enable RLS
ALTER TABLE public.plan_feature_gates ENABLE ROW LEVEL SECURITY;

-- Everyone can read (needed for client-side gating)
CREATE POLICY "Anyone can read plan feature gates"
ON public.plan_feature_gates FOR SELECT
USING (true);

-- Only admins can modify
CREATE POLICY "Admins can manage plan feature gates"
ON public.plan_feature_gates FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Seed default feature gates
INSERT INTO public.plan_feature_gates (feature_key, feature_label, feature_category, free_enabled, pro_enabled, ultra_enabled, sort_order) VALUES
  ('brain_missions', 'Brain Missions', 'home', true, true, true, 1),
  ('cognitive_embedding', 'Cognitive DNA', 'home', false, true, true, 2),
  ('risk_digest', 'Risk Digest', 'home', true, true, true, 3),
  ('daily_quote', 'Daily Quote', 'home', true, true, true, 4),
  ('brain_update', 'Brain Update', 'home', true, true, true, 5),
  ('study_insights', 'Study Insights', 'home', false, true, true, 6),
  ('review_queue', 'Review Queue', 'home', true, true, true, 7),
  ('rl_policy', 'RL Policy Card', 'home', false, false, true, 8),
  ('ai_recommendations', 'AI Recommendations', 'home', false, true, true, 9),
  ('burnout_warning', 'Burnout Warning', 'home', false, true, true, 10),
  ('weekly_reminder', 'Weekly Reminder', 'home', false, true, true, 11),
  ('exam_simulator', 'Exam Simulator', 'action', false, true, true, 12),
  ('focus_mode', 'Focus Mode', 'action', true, true, true, 13),
  ('study_plan', 'AI Study Plan', 'action', false, true, true, 14),
  ('knowledge_graph', 'Knowledge Graph', 'brain', false, false, true, 15),
  ('brain_evolution', 'Brain Evolution', 'brain', false, true, true, 16),
  ('cognitive_twin', 'Cognitive Twin', 'brain', false, false, true, 17),
  ('voice_notifications', 'Voice Notifications', 'settings', false, true, true, 18),
  ('data_backup', 'Data Backup & Export', 'settings', false, false, true, 19),
  ('leaderboard', 'Leaderboard', 'progress', true, true, true, 20),
  ('weekly_report', 'Weekly AI Report', 'progress', false, true, true, 21),
  ('what_if_simulator', 'What-If Simulator', 'progress', false, false, true, 22),
  ('competition_intel', 'Competition Intel', 'progress', false, false, true, 23),
  ('ml_dashboard', 'ML Dashboard', 'settings', false, false, true, 24);
