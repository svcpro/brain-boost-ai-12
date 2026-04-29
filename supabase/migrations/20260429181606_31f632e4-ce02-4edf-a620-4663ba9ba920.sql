-- Fix 1: myrank_shares — restrict anonymous SELECT to specific session ID match
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'myrank_shares' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.myrank_shares', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users view own shares"
ON public.myrank_shares FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Anon views shares by exact session id"
ON public.myrank_shares FOR SELECT
TO anon
USING (
  anon_session_id IS NOT NULL
  AND anon_session_id = current_setting('request.headers', true)::json->>'x-anon-session-id'
);

CREATE POLICY "Service role manages myrank shares"
ON public.myrank_shares FOR ALL
TO service_role
USING (true) WITH CHECK (true);

-- Fix 2: exam_intel_pipeline_runs — restrict ALL to service_role only
DROP POLICY IF EXISTS "Service manages pipeline runs" ON public.exam_intel_pipeline_runs;

CREATE POLICY "Service role manages pipeline runs"
ON public.exam_intel_pipeline_runs FOR ALL
TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Admins view pipeline runs"
ON public.exam_intel_pipeline_runs FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));