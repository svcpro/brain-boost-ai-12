
-- MyRank tests (test attempts)
CREATE TABLE public.myrank_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  anon_session_id TEXT,
  category TEXT NOT NULL CHECK (category IN ('UPSC','SSC','JEE','NEET','IQ')),
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  accuracy NUMERIC NOT NULL DEFAULT 0,
  time_taken_seconds INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  percentile NUMERIC,
  ai_tag TEXT,
  ai_insight TEXT,
  referred_by_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_myrank_tests_user ON public.myrank_tests(user_id);
CREATE INDEX idx_myrank_tests_category_score ON public.myrank_tests(category, score DESC, time_taken_seconds ASC);
CREATE INDEX idx_myrank_tests_created ON public.myrank_tests(created_at DESC);

ALTER TABLE public.myrank_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create tests" ON public.myrank_tests
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Users view own tests" ON public.myrank_tests
  FOR SELECT USING (
    auth.uid() = user_id 
    OR (user_id IS NULL AND anon_session_id IS NOT NULL)
  );
CREATE POLICY "Users update own tests" ON public.myrank_tests
  FOR UPDATE USING (
    auth.uid() = user_id 
    OR (user_id IS NULL AND anon_session_id IS NOT NULL)
  );
CREATE POLICY "Public leaderboard read" ON public.myrank_tests
  FOR SELECT USING (rank IS NOT NULL AND rank <= 100);

-- Referrals
CREATE TABLE public.myrank_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID,
  referrer_code TEXT NOT NULL,
  referred_user_id UUID,
  referred_anon_id TEXT,
  status TEXT NOT NULL DEFAULT 'clicked' CHECK (status IN ('clicked','signed_up','completed_test')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  converted_at TIMESTAMPTZ
);
CREATE INDEX idx_myrank_referrals_referrer ON public.myrank_referrals(referrer_user_id);
CREATE INDEX idx_myrank_referrals_code ON public.myrank_referrals(referrer_code);

ALTER TABLE public.myrank_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone insert referrals" ON public.myrank_referrals
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Users see own referrals" ON public.myrank_referrals
  FOR SELECT USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);
CREATE POLICY "System update referrals" ON public.myrank_referrals
  FOR UPDATE USING (true);

-- Shares
CREATE TABLE public.myrank_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  anon_session_id TEXT,
  test_id UUID REFERENCES public.myrank_tests(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  share_type TEXT DEFAULT 'rank_card',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_myrank_shares_user ON public.myrank_shares(user_id);

ALTER TABLE public.myrank_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone insert shares" ON public.myrank_shares
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Users see own shares" ON public.myrank_shares
  FOR SELECT USING (auth.uid() = user_id OR anon_session_id IS NOT NULL);

-- Global stats (single row)
CREATE TABLE public.myrank_stats (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  total_tests BIGINT NOT NULL DEFAULT 234567,
  total_users BIGINT NOT NULL DEFAULT 0,
  total_shares BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.myrank_stats (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.myrank_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public stats read" ON public.myrank_stats FOR SELECT USING (true);
CREATE POLICY "System updates stats" ON public.myrank_stats FOR UPDATE USING (true);
