-- Add voice and push enabled flags to profiles, defaulting to true
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS voice_notifications_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_notifications_enabled boolean NOT NULL DEFAULT true;
