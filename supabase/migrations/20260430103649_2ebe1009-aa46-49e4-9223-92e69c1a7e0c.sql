DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_session_tokens'
      AND policyname = 'Users read own session token'
  ) THEN
    CREATE POLICY "Users read own session token"
    ON public.user_session_tokens
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
  END IF;
END $$;