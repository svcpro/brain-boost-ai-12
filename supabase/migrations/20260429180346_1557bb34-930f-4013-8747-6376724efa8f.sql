-- 1. notification_bundles: remove unrestricted public ALL policy
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='notification_bundles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.notification_bundles', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users view own notification bundles"
ON public.notification_bundles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role manages notification bundles"
ON public.notification_bundles FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- 2. user_session_tokens: prevent client read/update of plaintext tokens
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='user_session_tokens'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_session_tokens', pol.policyname);
  END LOOP;
END $$;

-- Allow owner to INSERT/UPSERT their own captured token (needed by AuthContext)
CREATE POLICY "Users insert own session token"
ON public.user_session_tokens FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own session token"
ON public.user_session_tokens FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- NO SELECT policy for clients: tokens are write-only from the client side.
-- Service role retains full access for backend session management.
CREATE POLICY "Service role manages session tokens"
ON public.user_session_tokens FOR ALL TO service_role
USING (true) WITH CHECK (true);