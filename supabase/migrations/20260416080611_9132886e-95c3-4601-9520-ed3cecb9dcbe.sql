CREATE TABLE IF NOT EXISTS public.otp_auth_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_auth_sessions_token_hash ON public.otp_auth_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_otp_auth_sessions_user_id ON public.otp_auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_auth_sessions_expires_at ON public.otp_auth_sessions(expires_at);

ALTER TABLE public.otp_auth_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service can manage otp auth sessions"
ON public.otp_auth_sessions
FOR ALL
USING (false)
WITH CHECK (false);