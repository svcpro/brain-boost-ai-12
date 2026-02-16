
-- Post bookmarks/saves
CREATE TABLE IF NOT EXISTS public.post_bookmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);
ALTER TABLE public.post_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own bookmarks" ON public.post_bookmarks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Post reactions (beyond upvote: insightful, helpful, mind_blown, agree, disagree)
CREATE TABLE IF NOT EXISTS public.post_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL DEFAULT 'upvote',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id, reaction_type)
);
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own reactions" ON public.post_reactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can read reactions" ON public.post_reactions FOR SELECT USING (true);

-- User reputation table (if not exists)
CREATE TABLE IF NOT EXISTS public.user_reputation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  karma_points INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  answers_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  best_answer_count INTEGER DEFAULT 0,
  reputation_level TEXT DEFAULT 'newbie',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_reputation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read reputation" ON public.user_reputation FOR SELECT USING (true);
CREATE POLICY "Users manage own reputation" ON public.user_reputation FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Add hot_score and trending columns to community_posts
ALTER TABLE public.community_posts
ADD COLUMN IF NOT EXISTS hot_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS bookmark_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS reaction_counts JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS is_best_answer BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_quality_score INTEGER DEFAULT 0;

-- Add rules and trending to communities
ALTER TABLE public.communities
ADD COLUMN IF NOT EXISTS rules JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS trending_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS weekly_active_users INTEGER DEFAULT 0;

-- Enable realtime for reactions and bookmarks
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_bookmarks;
