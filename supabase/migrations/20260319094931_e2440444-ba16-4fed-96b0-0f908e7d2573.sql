-- Mission sessions table for tracking multi-step mission progress
CREATE TABLE public.mission_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mission_id text NOT NULL,
  mission_title text NOT NULL,
  topic_id text,
  topic_name text,
  subject_name text,
  mission_type text NOT NULL DEFAULT 'review',
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_step int NOT NULL DEFAULT 0,
  total_steps int NOT NULL DEFAULT 4,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  time_limit_seconds int DEFAULT 600,
  time_used_seconds int DEFAULT 0,
  speed_bonus_pct int DEFAULT 0,
  initial_difficulty text NOT NULL DEFAULT 'medium',
  final_difficulty text NOT NULL DEFAULT 'medium',
  difficulty_changes int DEFAULT 0,
  questions_total int NOT NULL DEFAULT 0,
  questions_correct int NOT NULL DEFAULT 0,
  accuracy_pct int DEFAULT 0,
  score int DEFAULT 0,
  xp_earned int DEFAULT 0,
  brain_boost_pct numeric(5,2) DEFAULT 0,
  streak_extended boolean DEFAULT false,
  badges_earned jsonb DEFAULT '[]'::jsonb,
  memory_before numeric(5,2) DEFAULT 0,
  memory_after numeric(5,2) DEFAULT 0,
  rank_before int DEFAULT 0,
  rank_after int DEFAULT 0,
  next_mission_preview jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.mission_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  current_streak int NOT NULL DEFAULT 0,
  longest_streak int NOT NULL DEFAULT 0,
  last_completed_date date,
  total_missions_completed int NOT NULL DEFAULT 0,
  total_xp_earned int NOT NULL DEFAULT 0,
  current_tier text NOT NULL DEFAULT 'rookie',
  tier_progress_pct int DEFAULT 0,
  weekly_missions_completed int DEFAULT 0,
  weekly_reset_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mission_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own mission sessions" ON public.mission_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own mission sessions" ON public.mission_sessions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own mission sessions" ON public.mission_sessions FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can read own mission streaks" ON public.mission_streaks FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own mission streaks" ON public.mission_streaks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own mission streaks" ON public.mission_streaks FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE INDEX idx_mission_sessions_user_date ON public.mission_sessions(user_id, created_at DESC);
CREATE INDEX idx_mission_sessions_status ON public.mission_sessions(user_id, status);
CREATE INDEX idx_mission_streaks_user ON public.mission_streaks(user_id);