-- ─── Security hardening migration ─────────────────────────────────────────
-- Addresses scanner findings: institutions_public_read_sensitive,
-- ambassador_profiles_email_public, myrank_handles_user_id_exposed,
-- ml_training_logs_all_authenticated_read, user_session_tokens_authenticated_access,
-- webhook_endpoints_secret_exposed, institution_commissions_realtime_broadcast,
-- SUPA_anon_security_definer_function_executable,
-- campus_ambassador_applications_no_read_policy (rate-limit hook)

-- ────────────────────────────────────────────────────────────────────
-- 1. institutions: hide commission/admin/settings/etc. from anon & authenticated
--    Anon and authenticated only need branding columns to render the public
--    institution card. Admin UIs read these via service-role edge functions.
REVOKE SELECT (commission_rate, admin_user_id, settings, referral_code, domain, max_students, license_status, license_expires_at)
  ON public.institutions FROM anon, authenticated;

-- 2. ambassador_profiles: anon must never see PII / contact handles
REVOKE SELECT (email, instagram, linkedin, twitter, youtube, website)
  ON public.ambassador_profiles FROM anon;

-- 3. myrank_handles: anon must never see internal user_id
REVOKE SELECT (user_id, anon_session_id)
  ON public.myrank_handles FROM anon, authenticated;

-- 4. ml_training_logs: restrict reads to admins only
DROP POLICY IF EXISTS "Authenticated users view training logs" ON public.ml_training_logs;
DROP POLICY IF EXISTS "System updates training logs" ON public.ml_training_logs;
CREATE POLICY "Admins view training logs"
  ON public.ml_training_logs FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins update training logs"
  ON public.ml_training_logs FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- 5. user_session_tokens: never expose tokens to end-users via PostgREST.
--    Only service_role may read/write tokens.
DROP POLICY IF EXISTS "Users read own session token" ON public.user_session_tokens;
DROP POLICY IF EXISTS "Users update own session token" ON public.user_session_tokens;
DROP POLICY IF EXISTS "Users insert own session token" ON public.user_session_tokens;
REVOKE ALL ON public.user_session_tokens FROM anon, authenticated;

-- 6. webhook_endpoints: secret column must not be readable by institution
--    admins via the API. Edge functions use service_role and bypass RLS.
REVOKE SELECT (secret) ON public.webhook_endpoints FROM anon, authenticated;

-- 7. institution_commissions: remove from Realtime publication so financial
--    rows aren't broadcast at all. Admin dashboards can poll via service-role
--    edge functions instead.
ALTER PUBLICATION supabase_realtime DROP TABLE public.institution_commissions;

-- 8. SECURITY DEFINER functions executable by anon — revoke EXECUTE from anon
--    on internal-only functions. Public peek endpoints stay accessible.
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint)            FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb)            FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_push_prefs()          FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_institution_referral_code()       FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_record_referral_commission()      FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_referral_commission(uuid)      FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_ambassador_profile()            FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gen_short_referral_code()             FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accept_institution_invite(text)       FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.join_institution_by_referral(text, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.join_institution_by_referral(text, text, uuid, text) FROM anon, PUBLIC;

-- 9. campus_ambassador_applications: simple per-(email) rate limit to deter
--    abuse of the open INSERT policy. Reject more than 3 submissions per
--    email per 24 hours.
CREATE OR REPLACE FUNCTION public.enforce_ambassador_application_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count int;
BEGIN
  SELECT count(*) INTO recent_count
  FROM public.campus_ambassador_applications
  WHERE lower(email) = lower(NEW.email)
    AND created_at > now() - interval '24 hours';
  IF recent_count >= 3 THEN
    RAISE EXCEPTION 'Too many applications from this email in the last 24 hours' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enforce_ambassador_application_rate_limit() FROM anon, PUBLIC;

DROP TRIGGER IF EXISTS trg_campus_ambassador_rate_limit ON public.campus_ambassador_applications;
CREATE TRIGGER trg_campus_ambassador_rate_limit
  BEFORE INSERT ON public.campus_ambassador_applications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ambassador_application_rate_limit();
