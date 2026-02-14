
ALTER TABLE public.profiles
ADD COLUMN email_notifications_enabled boolean NOT NULL DEFAULT true;
