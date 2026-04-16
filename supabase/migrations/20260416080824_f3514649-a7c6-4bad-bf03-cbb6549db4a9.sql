DROP POLICY IF EXISTS "Service can manage otp auth sessions" ON public.otp_auth_sessions;
CREATE POLICY "No direct client access to otp auth sessions"
ON public.otp_auth_sessions
FOR ALL
USING (false)
WITH CHECK (false);