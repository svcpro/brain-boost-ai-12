
-- Add AI discussion intelligence columns to community_posts
ALTER TABLE public.community_posts
ADD COLUMN IF NOT EXISTS ai_summary TEXT,
ADD COLUMN IF NOT EXISTS ai_detailed_summary TEXT,
ADD COLUMN IF NOT EXISTS ai_key_points JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS ai_tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS importance_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS importance_level TEXT DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS ai_key_insights JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS summary_updated_at TIMESTAMPTZ;

-- Create discussion recommendations table
CREATE TABLE IF NOT EXISTS public.discussion_recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  relevance_score NUMERIC DEFAULT 0,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen BOOLEAN DEFAULT false,
  UNIQUE(user_id, post_id)
);

ALTER TABLE public.discussion_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recommendations"
ON public.discussion_recommendations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage recommendations"
ON public.discussion_recommendations FOR ALL
USING (true)
WITH CHECK (true);

-- Enable realtime for recommendations
ALTER PUBLICATION supabase_realtime ADD TABLE public.discussion_recommendations;
