
-- Track claimed MyRank referral rewards (Premium Test access window + AI Study Plan)
CREATE TABLE IF NOT EXISTS public.myrank_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reward_type text NOT NULL CHECK (reward_type IN ('premium_test', 'ai_study_plan')),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  study_plan_id uuid REFERENCES public.study_plans(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, reward_type)
);

CREATE INDEX IF NOT EXISTS idx_myrank_rewards_user ON public.myrank_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_myrank_rewards_expires ON public.myrank_rewards(expires_at) WHERE expires_at IS NOT NULL;

ALTER TABLE public.myrank_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rewards"
  ON public.myrank_rewards FOR SELECT
  USING (auth.uid() = user_id);

-- Inserts/updates only via service role (edge function), never directly from client
CREATE POLICY "Service role manages rewards"
  ON public.myrank_rewards FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
