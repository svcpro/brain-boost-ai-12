
-- Leaderboard RPC (security definer, callable by anon + authenticated)
CREATE OR REPLACE FUNCTION public.get_ambassador_leaderboard(
  p_period text DEFAULT 'all',
  p_limit int DEFAULT 50
)
RETURNS TABLE(
  rank int,
  ambassador_id uuid,
  display_name text,
  college text,
  city text,
  avatar_url text,
  ai_level text,
  xp int,
  weekly_xp int,
  monthly_xp int,
  badge_count int,
  public_slug text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT
      p.id AS ambassador_id,
      -- Mask name: first name + initial
      (split_part(p.full_name, ' ', 1) || ' ' ||
        CASE WHEN position(' ' in p.full_name) > 0
             THEN upper(substr(split_part(p.full_name, ' ', 2), 1, 1)) || '.'
             ELSE '' END) AS display_name,
      p.college,
      p.city,
      p.avatar_url,
      p.ai_level,
      p.xp,
      p.weekly_xp,
      p.monthly_xp,
      COALESCE(jsonb_array_length(p.badges), 0) AS badge_count,
      p.public_slug,
      CASE
        WHEN p_period = 'weekly' THEN p.weekly_xp
        WHEN p_period = 'monthly' THEN p.monthly_xp
        ELSE p.xp
      END AS sort_score
    FROM public.ambassador_profiles p
    WHERE p.status IN ('active','approved')
  )
  SELECT
    row_number() OVER (ORDER BY sort_score DESC, ambassador_id)::int AS rank,
    ambassador_id, display_name, college, city, avatar_url,
    ai_level, xp, weekly_xp, monthly_xp, badge_count, public_slug
  FROM ranked
  ORDER BY sort_score DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_ambassador_leaderboard(text, int) TO anon, authenticated;

-- Seed missions (idempotent on title)
INSERT INTO public.ambassador_missions (title, description, category, reward_xp, reward_points, difficulty, proof_type, is_weekly)
SELECT * FROM (VALUES
  ('Post an Instagram Reel about ACRY', 'Create a 15-30s reel introducing ACRY.ai to your followers. Tag @acry.ai and use #ACRYAmbassador.', 'social', 100, 100, 'easy', 'url', true),
  ('Share on LinkedIn', 'Write a post on LinkedIn about your ACRY ambassador journey and how AI is transforming exam prep.', 'social', 80, 80, 'easy', 'url', true),
  ('Invite 5 friends to ACRY', 'Use your referral link to onboard 5 friends from your campus.', 'growth', 200, 200, 'medium', 'auto', true),
  ('Host a campus AI workshop', 'Organize a 30-min AI study workshop and submit photos.', 'event', 500, 500, 'hard', 'screenshot', false),
  ('Create a study tip carousel', 'Design a 5-slide carousel teaching one exam strategy. Submit the image.', 'content', 150, 150, 'medium', 'screenshot', true),
  ('Win the weekly community challenge', 'Participate in the weekly Discord challenge and finish in top 10.', 'community', 250, 250, 'medium', 'screenshot', true)
) AS m(title, description, category, reward_xp, reward_points, difficulty, proof_type, is_weekly)
WHERE NOT EXISTS (SELECT 1 FROM public.ambassador_missions WHERE ambassador_missions.title = m.title);

-- Seed rewards (idempotent on title)
INSERT INTO public.ambassador_rewards (title, description, icon, unlock_xp, tier, reward_type)
SELECT * FROM (VALUES
  ('Welcome Kit', 'Digital onboarding kit + ambassador starter pack PDF.', '🎁', 0, 'bronze', 'digital'),
  ('1-Month ACRY Premium', 'Unlock all premium AI features free for 30 days.', '⚡', 250, 'bronze', 'subscription'),
  ('ACRY Swag Pack', 'Stickers, badge, and notebook delivered to your address.', '🎒', 750, 'silver', 'physical'),
  ('Official Ambassador Certificate', 'Verified digital certificate signed by founders.', '📜', 1500, 'silver', 'certificate'),
  ('1:1 Mentor Call with Founder', '30-min private call with ACRY founding team.', '📞', 3000, 'gold', 'experience'),
  ('Champion Hoodie', 'Limited-edition ACRY Champion hoodie shipped worldwide.', '👑', 5000, 'platinum', 'physical')
) AS r(title, description, icon, unlock_xp, tier, reward_type)
WHERE NOT EXISTS (SELECT 1 FROM public.ambassador_rewards WHERE ambassador_rewards.title = r.title);
