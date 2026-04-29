-- 1. Remove anonymous read leak on myrank_tests
DROP POLICY IF EXISTS "Anonymous can view their tests" ON public.myrank_tests;
DROP POLICY IF EXISTS "Anonymous read own session tests" ON public.myrank_tests;
DROP POLICY IF EXISTS "anon_session_select" ON public.myrank_tests;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='myrank_tests'
      AND qual ILIKE '%anon_session_id%' AND qual ILIKE '%user_id IS NULL%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.myrank_tests', pol.policyname);
  END LOOP;
END $$;

-- 2. Restrict precision_scores writes to owner
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='precision_scores'
      AND cmd IN ('INSERT','UPDATE','ALL')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.precision_scores', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users insert own precision scores"
ON public.precision_scores FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own precision scores"
ON public.precision_scores FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role manages precision scores"
ON public.precision_scores FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- 3. Restrict exam_intel_topic_scores writes to service_role only
DROP POLICY IF EXISTS "Service can manage intel topic scores" ON public.exam_intel_topic_scores;

CREATE POLICY "Service role manages intel topic scores"
ON public.exam_intel_topic_scores FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Preserve public read if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='exam_intel_topic_scores'
      AND cmd IN ('SELECT','ALL') AND policyname <> 'Service role manages intel topic scores'
  ) THEN
    EXECUTE 'CREATE POLICY "Public can read intel topic scores" ON public.exam_intel_topic_scores FOR SELECT USING (true)';
  END IF;
END $$;