
-- Unique memorable referral handles (e.g., "rahul123")
CREATE TABLE IF NOT EXISTS public.myrank_handles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle text NOT NULL UNIQUE,
  user_id uuid NULL,
  anon_session_id text NULL,
  display_name text NULL,
  click_count integer NOT NULL DEFAULT 0,
  signup_count integer NOT NULL DEFAULT 0,
  last_clicked_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_myrank_handles_user ON public.myrank_handles(user_id);
CREATE INDEX IF NOT EXISTS idx_myrank_handles_anon ON public.myrank_handles(anon_session_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_myrank_handles_user_unique ON public.myrank_handles(user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.myrank_handles ENABLE ROW LEVEL SECURITY;

-- Anyone can read a handle (needed for ?ref= lookup on landing)
CREATE POLICY "Handles are public readable"
  ON public.myrank_handles FOR SELECT
  USING (true);

-- Authenticated users can create their own handle
CREATE POLICY "Users can create own handle"
  ON public.myrank_handles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own handle
CREATE POLICY "Users can update own handle"
  ON public.myrank_handles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_myrank_handles_updated_at
  BEFORE UPDATE ON public.myrank_handles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
