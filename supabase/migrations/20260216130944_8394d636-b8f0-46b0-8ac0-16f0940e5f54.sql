
-- ===== COMMUNITIES =====
CREATE TABLE public.communities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'general', -- exam, subject, topic
  exam_type TEXT, -- JEE, NEET, UPSC, SSC
  subject TEXT,
  icon_url TEXT,
  banner_url TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  member_count INTEGER NOT NULL DEFAULT 0,
  post_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view approved communities" ON public.communities FOR SELECT USING (is_approved = true AND is_active = true);
CREATE POLICY "Admins can view all communities" ON public.communities FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Authenticated users can create communities" ON public.communities FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins can update communities" ON public.communities FOR UPDATE USING (is_admin(auth.uid()));
CREATE POLICY "Admins can delete communities" ON public.communities FOR DELETE USING (is_admin(auth.uid()));

CREATE INDEX idx_communities_category ON public.communities(category);
CREATE INDEX idx_communities_slug ON public.communities(slug);

-- ===== COMMUNITY MEMBERS =====
CREATE TABLE public.community_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- member, moderator
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(community_id, user_id)
);

ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view members" ON public.community_members FOR SELECT USING (true);
CREATE POLICY "Users can join communities" ON public.community_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave communities" ON public.community_members FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage members" ON public.community_members FOR ALL USING (is_admin(auth.uid()));

CREATE INDEX idx_community_members_community ON public.community_members(community_id);
CREATE INDEX idx_community_members_user ON public.community_members(user_id);

-- ===== COMMUNITY POSTS =====
CREATE TABLE public.community_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  post_type TEXT NOT NULL DEFAULT 'question', -- question, solution, doubt, strategy
  image_urls TEXT[] DEFAULT '{}',
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  upvote_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  ai_answer TEXT,
  ai_answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view non-deleted posts" ON public.community_posts FOR SELECT USING (is_deleted = false);
CREATE POLICY "Admins can view all posts" ON public.community_posts FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Auth users can create posts" ON public.community_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON public.community_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can update any post" ON public.community_posts FOR UPDATE USING (is_admin(auth.uid()));
CREATE POLICY "Admins can delete posts" ON public.community_posts FOR DELETE USING (is_admin(auth.uid()));

CREATE INDEX idx_community_posts_community ON public.community_posts(community_id);
CREATE INDEX idx_community_posts_user ON public.community_posts(user_id);

-- ===== POST COMMENTS =====
CREATE TABLE public.post_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  parent_id UUID REFERENCES public.post_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_ai_answer BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  upvote_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view non-deleted comments" ON public.post_comments FOR SELECT USING (is_deleted = false);
CREATE POLICY "Auth users can create comments" ON public.post_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON public.post_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can update any comment" ON public.post_comments FOR UPDATE USING (is_admin(auth.uid()));
CREATE POLICY "Admins can delete comments" ON public.post_comments FOR DELETE USING (is_admin(auth.uid()));

CREATE INDEX idx_post_comments_post ON public.post_comments(post_id);
CREATE INDEX idx_post_comments_parent ON public.post_comments(parent_id);

-- ===== POST VOTES =====
CREATE TABLE public.post_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  target_id UUID NOT NULL, -- post_id or comment_id
  target_type TEXT NOT NULL DEFAULT 'post', -- post, comment
  vote_type TEXT NOT NULL DEFAULT 'upvote',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, target_id, target_type)
);

ALTER TABLE public.post_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view votes" ON public.post_votes FOR SELECT USING (true);
CREATE POLICY "Auth users can vote" ON public.post_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own votes" ON public.post_votes FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_post_votes_target ON public.post_votes(target_id, target_type);

-- ===== USER REPUTATION =====
CREATE TABLE public.user_reputation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  total_score INTEGER NOT NULL DEFAULT 0,
  post_score INTEGER NOT NULL DEFAULT 0,
  answer_score INTEGER NOT NULL DEFAULT 0,
  upvote_score INTEGER NOT NULL DEFAULT 0,
  level TEXT NOT NULL DEFAULT 'beginner', -- beginner, contributor, expert, master
  posts_count INTEGER NOT NULL DEFAULT 0,
  answers_count INTEGER NOT NULL DEFAULT 0,
  best_answers_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_reputation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reputation" ON public.user_reputation FOR SELECT USING (true);
CREATE POLICY "System can insert reputation" ON public.user_reputation FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "System can update own reputation" ON public.user_reputation FOR UPDATE USING (auth.uid() = user_id);

-- Enable realtime for posts and comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;

-- Update triggers
CREATE TRIGGER update_communities_updated_at BEFORE UPDATE ON public.communities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_community_posts_updated_at BEFORE UPDATE ON public.community_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_post_comments_updated_at BEFORE UPDATE ON public.post_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
