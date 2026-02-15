
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create function to reset monthly usage counts
CREATE OR REPLACE FUNCTION public.reset_monthly_api_usage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE api_integrations
  SET monthly_usage_count = 0,
      usage_reset_at = now(),
      updated_at = now();
END;
$$;
