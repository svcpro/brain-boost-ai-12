
ALTER TABLE public.profiles
  ADD COLUMN weekly_report_day INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN weekly_report_hour INTEGER NOT NULL DEFAULT 7;

COMMENT ON COLUMN public.profiles.weekly_report_day IS '0=Sunday, 1=Monday, ..., 6=Saturday';
COMMENT ON COLUMN public.profiles.weekly_report_hour IS 'Hour in UTC (0-23) for weekly report delivery';
