
-- Add banned flag to profiles
ALTER TABLE public.profiles ADD COLUMN is_banned boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN banned_at timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN ban_reason text;
