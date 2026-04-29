-- Fix 1: Remove admin ability to read raw user session tokens (impersonation risk)
DROP POLICY IF EXISTS "Admins view all session tokens" ON public.user_session_tokens;

-- Fix 2: Remove public leaderboard read policy that exposed full questions and answers.
-- Public leaderboard data is served via edge functions using the service role,
-- which already bypasses RLS and returns only safe columns.
DROP POLICY IF EXISTS "Public leaderboard read" ON public.myrank_tests;

-- Fix 3: Lock down ai_recalibration_logs INSERT — require ownership
DROP POLICY IF EXISTS "System can insert recalibration logs" ON public.ai_recalibration_logs;
CREATE POLICY "Users insert own recalibration logs"
ON public.ai_recalibration_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);