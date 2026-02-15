
-- Create a function to increment API usage count (fire-and-forget from edge functions)
CREATE OR REPLACE FUNCTION public.increment_api_usage(p_service_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE api_integrations
  SET monthly_usage_count = COALESCE(monthly_usage_count, 0) + 1,
      updated_at = now()
  WHERE service_name = p_service_name;
END;
$$;
