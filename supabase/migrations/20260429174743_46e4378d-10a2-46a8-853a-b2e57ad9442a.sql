-- 1. rank_predictions_v2: drop overly permissive INSERT policy
DROP POLICY IF EXISTS "Service role can insert rank predictions" ON public.rank_predictions_v2;

CREATE POLICY "Service role inserts rank predictions"
ON public.rank_predictions_v2
FOR INSERT
TO service_role
WITH CHECK (true);

-- 2. notification_segments: drop public ALL policy, restrict to service_role
DROP POLICY IF EXISTS "Service role manages segments" ON public.notification_segments;

CREATE POLICY "Service role manages notification segments"
ON public.notification_segments
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 3. growth_analytics: drop public ALL policy, restrict to service_role
DROP POLICY IF EXISTS "Service role manages growth analytics" ON public.growth_analytics;

CREATE POLICY "Service role manages growth analytics data"
ON public.growth_analytics
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 4. device_sessions: remove from realtime publication to stop broadcasting IP/user-agent
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'device_sessions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.device_sessions';
  END IF;
END $$;