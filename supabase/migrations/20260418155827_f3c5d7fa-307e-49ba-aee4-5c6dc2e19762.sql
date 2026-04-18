ALTER TABLE public.myrank_tests
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS last_reengaged_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_myrank_tests_leaderboard
  ON public.myrank_tests (category, percentile DESC, completed_at DESC)
  WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_myrank_tests_city
  ON public.myrank_tests (city, category, percentile DESC)
  WHERE city IS NOT NULL AND completed_at IS NOT NULL;