-- Table to capture latest access token per user at login
CREATE TABLE IF NOT EXISTS public.user_session_tokens (
  user_id UUID NOT NULL PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  provider TEXT,
  user_agent TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_session_tokens ENABLE ROW LEVEL SECURITY;

-- Owner can upsert/select own row
CREATE POLICY "Users insert own session token"
  ON public.user_session_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own session token"
  ON public.user_session_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users view own session token"
  ON public.user_session_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all (for admin panel display)
CREATE POLICY "Admins view all session tokens"
  ON public.user_session_tokens FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_user_session_tokens_updated_at
  BEFORE UPDATE ON public.user_session_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();