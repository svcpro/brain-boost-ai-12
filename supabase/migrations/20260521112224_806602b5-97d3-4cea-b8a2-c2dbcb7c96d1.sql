
-- Voice Broadcast Automation: event mapping + logs
ALTER TABLE public.voice_broadcast_voice_files
  ADD COLUMN IF NOT EXISTS event_key text;

CREATE TABLE IF NOT EXISTS public.voice_broadcast_event_voices (
  event_key text PRIMARY KEY,
  voice_prompt_id text,
  is_active boolean NOT NULL DEFAULT false,
  cooldown_hours integer NOT NULL DEFAULT 72,
  send_window_start time NOT NULL DEFAULT '09:00',
  send_window_end time NOT NULL DEFAULT '20:00',
  location_json text NOT NULL DEFAULT '{"locationList":[{"locationId":1,"locationName":"ahmedabad"},{"locationId":3,"locationName":"Bangalore"}]}',
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_broadcast_event_voices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vbev_admin_all ON public.voice_broadcast_event_voices;
CREATE POLICY vbev_admin_all ON public.voice_broadcast_event_voices
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.voice_broadcast_event_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL,
  user_id uuid,
  phone text,
  voice_prompt_id text,
  campaign_id_external text,
  status text NOT NULL DEFAULT 'queued',
  response jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vbel_event_user_time
  ON public.voice_broadcast_event_logs (event_key, user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_vbel_time
  ON public.voice_broadcast_event_logs (sent_at DESC);

ALTER TABLE public.voice_broadcast_event_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vbel_admin_all ON public.voice_broadcast_event_logs;
CREATE POLICY vbel_admin_all ON public.voice_broadcast_event_logs
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Seed all 12 events as inactive rows so admin UI can render them
INSERT INTO public.voice_broadcast_event_voices (event_key, description) VALUES
  ('signup_welcome',         'New signup welcome call (within ~30 min of signup)'),
  ('onboarding_incomplete',  'Profile created but onboarding not completed (>2h)'),
  ('inactive_24h',           'User inactive for ~24 hours'),
  ('inactive_24h_plus',      'User inactive 26–72 hours'),
  ('inactive_3d_7d',         'User inactive 3–7 days'),
  ('daily_ai_tools_alert',   'Daily morning push of new AI tools / features'),
  ('leaderboard_alert',      'Weekly leaderboard rank change alert'),
  ('missing_activity',       'Today''s scheduled study activity missed'),
  ('weekly_performance',     'Weekly performance summary (Sun 18:00 IST)'),
  ('trial_end',              'Trial ends within 48 hours'),
  ('premium_upgrade',        'Trial just ended without paid upgrade'),
  ('final_reengagement',     'Last-attempt re-engagement (14+ days inactive)')
ON CONFLICT (event_key) DO NOTHING;
