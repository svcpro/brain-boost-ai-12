UPDATE public.whatsapp_config SET is_enabled = false, updated_at = now();

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT jobname FROM cron.job WHERE jobname ILIKE '%whatsapp%' OR command ILIKE '%whatsapp%' LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;
END $$;