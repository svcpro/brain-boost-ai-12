-- Add push notification preferences column to profiles
ALTER TABLE public.profiles 
ADD COLUMN push_notification_prefs jsonb NOT NULL DEFAULT '{"freezeGifts": true, "streakMilestones": true, "studyReminders": true}'::jsonb;