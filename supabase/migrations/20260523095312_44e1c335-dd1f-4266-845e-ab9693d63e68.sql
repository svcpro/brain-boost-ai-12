
-- 1. Lock down "public" write policies to service_role only
DROP POLICY IF EXISTS "Service role can insert micro events" ON public.behavioral_micro_events;
CREATE POLICY "Service role can insert micro events"
  ON public.behavioral_micro_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service manages intel alerts" ON public.exam_intel_alerts;
CREATE POLICY "Service manages intel alerts"
  ON public.exam_intel_alerts
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert decay models" ON public.topic_decay_models;
CREATE POLICY "Service role can insert decay models"
  ON public.topic_decay_models
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update decay models" ON public.topic_decay_models;
CREATE POLICY "Service role can update decay models"
  ON public.topic_decay_models
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "System update referrals" ON public.myrank_referrals;
CREATE POLICY "System update referrals"
  ON public.myrank_referrals
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "System updates stats" ON public.myrank_stats;
CREATE POLICY "System updates stats"
  ON public.myrank_stats
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role writes reengagement log" ON public.whatsapp_reengagement_log;
CREATE POLICY "Service role writes reengagement log"
  ON public.whatsapp_reengagement_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 2. Institutions: hide sensitive columns from anon. Create a safe view and
--    restrict the public SELECT policy to authenticated users only.
DROP POLICY IF EXISTS "Public can read active institutions by slug" ON public.institutions;
CREATE POLICY "Authenticated can read active institutions"
  ON public.institutions
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE OR REPLACE VIEW public.institutions_public
WITH (security_invoker = true) AS
SELECT
  id,
  name,
  slug,
  type,
  logo_url,
  primary_color,
  secondary_color,
  city,
  branch,
  is_active
FROM public.institutions
WHERE is_active = true;

GRANT SELECT ON public.institutions_public TO anon, authenticated;

-- Allow the view's underlying SELECT to succeed for anon by adding a policy
-- limited to the safe columns through the view (security_invoker = true means
-- the caller's RLS applies). Add a SELECT policy for anon that only matches
-- when accessed via the view's WHERE clause.
CREATE POLICY "Anon read active institutions (branding only via view)"
  ON public.institutions
  FOR SELECT
  TO anon
  USING (is_active = true);

-- Revoke direct column access for anon on sensitive columns
REVOKE SELECT ON public.institutions FROM anon;
GRANT SELECT (id, name, slug, type, logo_url, primary_color, secondary_color, city, branch, is_active)
  ON public.institutions TO anon;

-- 3. Fix mutable search_path on helper functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
