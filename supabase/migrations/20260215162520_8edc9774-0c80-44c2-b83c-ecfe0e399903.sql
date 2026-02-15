
-- User Cognitive Embeddings: vector representation of each user's cognitive state
CREATE TABLE public.user_cognitive_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  embedding JSONB NOT NULL DEFAULT '[]'::jsonb,
  embedding_version INTEGER NOT NULL DEFAULT 1,
  dimensions INTEGER NOT NULL DEFAULT 16,
  feature_labels JSONB NOT NULL DEFAULT '[]'::jsonb,
  cognitive_fingerprint TEXT,
  cluster_id TEXT,
  similarity_group TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_cognitive_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own embeddings"
  ON public.user_cognitive_embeddings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own embeddings"
  ON public.user_cognitive_embeddings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own embeddings"
  ON public.user_cognitive_embeddings FOR UPDATE
  USING (auth.uid() = user_id);

-- Brain Missions: personalized daily missions per user
CREATE TABLE public.brain_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  mission_type TEXT NOT NULL DEFAULT 'review',
  priority TEXT NOT NULL DEFAULT 'medium',
  target_topic_id UUID REFERENCES public.topics(id),
  target_metric TEXT,
  target_value NUMERIC,
  current_value NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  reward_type TEXT DEFAULT 'xp',
  reward_value INTEGER DEFAULT 10,
  reasoning TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brain_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own missions"
  ON public.brain_missions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own missions"
  ON public.brain_missions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own missions"
  ON public.brain_missions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own missions"
  ON public.brain_missions FOR DELETE
  USING (auth.uid() = user_id);

-- Hybrid prediction cache: stores merged global+personal predictions
CREATE TABLE public.hybrid_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  prediction_type TEXT NOT NULL,
  personal_score NUMERIC,
  global_score NUMERIC,
  hybrid_score NUMERIC,
  personal_weight NUMERIC DEFAULT 0.7,
  global_weight NUMERIC DEFAULT 0.3,
  confidence NUMERIC,
  metadata JSONB DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hybrid_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own hybrid predictions"
  ON public.hybrid_predictions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own hybrid predictions"
  ON public.hybrid_predictions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_brain_missions_user_status ON public.brain_missions(user_id, status);
CREATE INDEX idx_brain_missions_expires ON public.brain_missions(expires_at);
CREATE INDEX idx_hybrid_predictions_user_type ON public.hybrid_predictions(user_id, prediction_type);
CREATE INDEX idx_user_embeddings_user ON public.user_cognitive_embeddings(user_id);

-- Triggers for updated_at
CREATE TRIGGER update_user_cognitive_embeddings_updated_at
  BEFORE UPDATE ON public.user_cognitive_embeddings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_brain_missions_updated_at
  BEFORE UPDATE ON public.brain_missions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
