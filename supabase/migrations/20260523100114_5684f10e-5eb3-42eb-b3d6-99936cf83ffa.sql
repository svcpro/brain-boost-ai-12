
-- =============================================================
-- AMBASSADOR PROFILES
-- =============================================================
CREATE TABLE public.ambassador_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID UNIQUE REFERENCES public.campus_ambassador_applications(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  college TEXT,
  city TEXT,
  course TEXT,
  bio TEXT,
  skills TEXT[] DEFAULT '{}',
  instagram TEXT,
  linkedin TEXT,
  twitter TEXT,
  youtube TEXT,
  website TEXT,
  public_slug TEXT UNIQUE,
  ambassador_code TEXT UNIQUE,
  ai_level TEXT NOT NULL DEFAULT 'AI Rookie',
  xp INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  streak_days INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_active_at TIMESTAMPTZ DEFAULT now(),
  badges JSONB NOT NULL DEFAULT '[]'::jsonb,
  weekly_xp INTEGER NOT NULL DEFAULT 0,
  monthly_xp INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ambassador_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ambassadors view own profile"
  ON public.ambassador_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public can view active ambassador cards"
  ON public.ambassador_profiles FOR SELECT TO anon, authenticated
  USING (status = 'active' AND public_slug IS NOT NULL);

CREATE POLICY "Ambassadors update own profile"
  ON public.ambassador_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins manage all profiles"
  ON public.ambassador_profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_amb_profiles_user ON public.ambassador_profiles(user_id);
CREATE INDEX idx_amb_profiles_city ON public.ambassador_profiles(city);
CREATE INDEX idx_amb_profiles_xp ON public.ambassador_profiles(xp DESC);

CREATE TRIGGER trg_amb_profiles_updated_at
BEFORE UPDATE ON public.ambassador_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- MISSIONS
-- =============================================================
CREATE TABLE public.ambassador_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  reward_xp INTEGER NOT NULL DEFAULT 50,
  reward_points INTEGER NOT NULL DEFAULT 50,
  difficulty TEXT NOT NULL DEFAULT 'easy',
  proof_type TEXT NOT NULL DEFAULT 'screenshot',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  is_published BOOLEAN NOT NULL DEFAULT true,
  is_weekly BOOLEAN NOT NULL DEFAULT true,
  max_submissions INTEGER,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ambassador_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ambassadors view published missions"
  ON public.ambassador_missions FOR SELECT TO authenticated
  USING (is_published = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage missions"
  ON public.ambassador_missions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.ambassador_mission_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.ambassador_missions(id) ON DELETE CASCADE,
  ambassador_id UUID NOT NULL REFERENCES public.ambassador_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  proof_url TEXT,
  proof_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewer_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  awarded_xp INTEGER DEFAULT 0,
  awarded_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ambassador_mission_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ambassadors view own submissions"
  ON public.ambassador_mission_submissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Ambassadors create own submissions"
  ON public.ambassador_mission_submissions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins manage submissions"
  ON public.ambassador_mission_submissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_amb_sub_user ON public.ambassador_mission_submissions(user_id);
CREATE INDEX idx_amb_sub_mission ON public.ambassador_mission_submissions(mission_id);

-- =============================================================
-- REFERRALS
-- =============================================================
CREATE TABLE public.ambassador_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id UUID NOT NULL REFERENCES public.ambassador_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  referred_email TEXT,
  referred_user_id UUID,
  source TEXT,
  converted BOOLEAN NOT NULL DEFAULT false,
  converted_at TIMESTAMPTZ,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ambassador_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ambassadors view own referrals"
  ON public.ambassador_referrals FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages referrals"
  ON public.ambassador_referrals FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX idx_amb_ref_user ON public.ambassador_referrals(user_id);

-- =============================================================
-- WORKSHOPS
-- =============================================================
CREATE TABLE public.ambassador_workshops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id UUID NOT NULL REFERENCES public.ambassador_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  college TEXT NOT NULL,
  city TEXT,
  faculty_contact TEXT,
  expected_attendance INTEGER,
  venue TEXT,
  scheduled_for TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  reward_xp INTEGER DEFAULT 200,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ambassador_workshops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ambassadors view own workshops"
  ON public.ambassador_workshops FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Ambassadors create workshops"
  ON public.ambassador_workshops FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Ambassadors update own pending workshops"
  ON public.ambassador_workshops FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete workshops"
  ON public.ambassador_workshops FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =============================================================
-- EVENTS
-- =============================================================
CREATE TABLE public.ambassador_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  type TEXT NOT NULL DEFAULT 'webinar',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  location TEXT,
  registration_url TEXT,
  capacity INTEGER,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ambassador_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published events"
  ON public.ambassador_events FOR SELECT TO anon, authenticated
  USING (is_published = true);

CREATE POLICY "Admins manage events"
  ON public.ambassador_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.ambassador_event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.ambassador_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'going',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE public.ambassador_event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own rsvps"
  ON public.ambassador_event_rsvps FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =============================================================
-- REWARDS
-- =============================================================
CREATE TABLE public.ambassador_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  unlock_xp INTEGER NOT NULL DEFAULT 100,
  tier TEXT NOT NULL DEFAULT 'bronze',
  reward_type TEXT NOT NULL DEFAULT 'certificate',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ambassador_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view active rewards"
  ON public.ambassador_rewards FOR SELECT TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage rewards"
  ON public.ambassador_rewards FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.ambassador_reward_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id UUID NOT NULL REFERENCES public.ambassador_rewards(id) ON DELETE CASCADE,
  ambassador_id UUID NOT NULL REFERENCES public.ambassador_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'claimed',
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reward_id, user_id)
);

ALTER TABLE public.ambassador_reward_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ambassadors view own claims"
  ON public.ambassador_reward_claims FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Ambassadors create own claims"
  ON public.ambassador_reward_claims FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins manage claims"
  ON public.ambassador_reward_claims FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =============================================================
-- CERTIFICATES
-- =============================================================
CREATE TABLE public.ambassador_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id UUID NOT NULL REFERENCES public.ambassador_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  cert_type TEXT NOT NULL DEFAULT 'participation',
  verify_code TEXT UNIQUE NOT NULL DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  url TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ambassador_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ambassadors view own certs"
  ON public.ambassador_certificates FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public can verify cert by code"
  ON public.ambassador_certificates FOR SELECT TO anon
  USING (true);

CREATE POLICY "Admins manage certs"
  ON public.ambassador_certificates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =============================================================
-- COMMUNITY
-- =============================================================
CREATE TABLE public.ambassador_community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ambassador_id UUID REFERENCES public.ambassador_profiles(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL,
  media_url TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_announcement BOOLEAN NOT NULL DEFAULT false,
  reaction_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ambassador_community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view posts"
  ON public.ambassador_community_posts FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Ambassadors create posts"
  ON public.ambassador_community_posts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Authors update own posts"
  ON public.ambassador_community_posts FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authors delete own posts"
  ON public.ambassador_community_posts FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.ambassador_post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.ambassador_community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🔥',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, emoji)
);

ALTER TABLE public.ambassador_post_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view reactions"
  ON public.ambassador_post_reactions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users manage own reactions"
  ON public.ambassador_post_reactions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =============================================================
-- TRAINING
-- =============================================================
CREATE TABLE public.ambassador_training_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'ai_basics',
  video_url TEXT,
  pdf_url TEXT,
  duration_minutes INTEGER DEFAULT 10,
  xp_reward INTEGER DEFAULT 25,
  unlock_xp INTEGER DEFAULT 0,
  order_index INTEGER DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ambassador_training_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view published modules"
  ON public.ambassador_training_modules FOR SELECT TO authenticated
  USING (is_published = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage modules"
  ON public.ambassador_training_modules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.ambassador_module_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.ambassador_training_modules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  progress_pct INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (module_id, user_id)
);

ALTER TABLE public.ambassador_module_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own progress"
  ON public.ambassador_module_progress FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =============================================================
-- FOUNDER UPDATES
-- =============================================================
CREATE TABLE public.ambassador_founder_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ambassador_founder_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view founder updates"
  ON public.ambassador_founder_updates FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins manage founder updates"
  ON public.ambassador_founder_updates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =============================================================
-- CLAIM RPC + auto-link trigger
-- =============================================================
CREATE OR REPLACE FUNCTION public.claim_ambassador_profile()
RETURNS public.ambassador_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
  v_app RECORD;
  v_existing public.ambassador_profiles%ROWTYPE;
  v_new public.ambassador_profiles%ROWTYPE;
  v_slug TEXT;
  v_code TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_existing FROM public.ambassador_profiles WHERE user_id = v_uid;
  IF FOUND THEN
    RETURN v_existing;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'no_email';
  END IF;

  SELECT * INTO v_app FROM public.campus_ambassador_applications
    WHERE lower(email) = lower(v_email) AND status = 'approved'
    ORDER BY updated_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_approved';
  END IF;

  v_slug := lower(regexp_replace(split_part(v_email, '@', 1), '[^a-z0-9]+', '-', 'g')) || '-' || substr(md5(v_uid::text), 1, 6);
  v_code := 'ACRY-' || upper(substr(md5(v_uid::text), 1, 6));

  INSERT INTO public.ambassador_profiles (
    user_id, application_id, email, full_name, college, city, course,
    instagram, linkedin, public_slug, ambassador_code
  ) VALUES (
    v_uid, v_app.id, v_email, v_app.full_name, v_app.college, v_app.city, v_app.course,
    v_app.instagram, v_app.linkedin, v_slug, v_code
  )
  RETURNING * INTO v_new;

  RETURN v_new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_ambassador_profile() TO authenticated;
