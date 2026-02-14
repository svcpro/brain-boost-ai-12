
ALTER TABLE public.profiles
ADD COLUMN email_study_reminders boolean NOT NULL DEFAULT true,
ADD COLUMN email_weekly_reports boolean NOT NULL DEFAULT true;
