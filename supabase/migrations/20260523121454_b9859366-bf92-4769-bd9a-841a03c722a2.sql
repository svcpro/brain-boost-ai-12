
-- Tasks table
CREATE TABLE IF NOT EXISTS public.ambassador_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  week_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'engagement',
  priority TEXT NOT NULL DEFAULT 'medium',
  reward_points INTEGER NOT NULL DEFAULT 25,
  requires_proof BOOLEAN NOT NULL DEFAULT false,
  ai_reasoning TEXT,
  estimated_minutes INTEGER DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'pending',
  proof_url TEXT,
  proof_uploaded_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_amb_tasks_user_week ON public.ambassador_tasks(user_id, week_key);
CREATE INDEX IF NOT EXISTS idx_amb_tasks_user_status ON public.ambassador_tasks(user_id, status);

ALTER TABLE public.ambassador_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ambassadors view own tasks" ON public.ambassador_tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Ambassadors insert own tasks" ON public.ambassador_tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Ambassadors update own tasks" ON public.ambassador_tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER trg_amb_tasks_updated_at
  BEFORE UPDATE ON public.ambassador_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('ambassador-proofs', 'ambassador-proofs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Ambassadors read own proofs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'ambassador-proofs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Ambassadors upload own proofs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'ambassador-proofs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Ambassadors update own proofs" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'ambassador-proofs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Ambassadors delete own proofs" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'ambassador-proofs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
