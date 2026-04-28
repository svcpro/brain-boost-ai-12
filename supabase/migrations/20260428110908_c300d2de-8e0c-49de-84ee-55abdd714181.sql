
-- 1. FIX is_admin: require an actual admin role
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'super_admin')
  )
$$;

-- 2. HASH whatsapp_otps
ALTER TABLE public.whatsapp_otps ALTER COLUMN otp DROP NOT NULL;
ALTER TABLE public.whatsapp_otps ADD COLUMN IF NOT EXISTS otp_hash text;

UPDATE public.whatsapp_otps
SET otp_hash = encode(digest(otp, 'sha256'), 'hex')
WHERE otp_hash IS NULL AND otp IS NOT NULL;

UPDATE public.whatsapp_otps SET otp = NULL WHERE otp_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.verify_whatsapp_otp(p_mobile text, p_otp text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hash text;
  v_match boolean;
BEGIN
  v_hash := encode(digest(p_otp, 'sha256'), 'hex');
  SELECT EXISTS (
    SELECT 1 FROM public.whatsapp_otps
    WHERE mobile = p_mobile
      AND otp_hash = v_hash
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO v_match;
  RETURN v_match;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_whatsapp_otp(text, text) FROM public, anon, authenticated;

DROP POLICY IF EXISTS "Admins can view all OTPs" ON public.whatsapp_otps;

-- 3. LOCK DOWN open policies
DROP POLICY IF EXISTS "Service manages churn" ON public.churn_predictions;
CREATE POLICY "Service role manages churn"
ON public.churn_predictions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users view own churn"
ON public.churn_predictions FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service manages intel briefs" ON public.exam_intel_student_briefs;
CREATE POLICY "Service role manages intel briefs"
ON public.exam_intel_student_briefs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service manages channel stats" ON public.channel_effectiveness;
CREATE POLICY "Service role manages channel stats"
ON public.channel_effectiveness FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service manages engagement" ON public.user_engagement_patterns;
CREATE POLICY "Service role manages engagement"
ON public.user_engagement_patterns FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages journeys" ON public.growth_journeys;
CREATE POLICY "Service role only manages journeys"
ON public.growth_journeys FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users view own journey"
ON public.growth_journeys FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages growth logs" ON public.growth_trigger_log;
CREATE POLICY "Service role only manages growth logs"
ON public.growth_trigger_log FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service manages escalations" ON public.notification_escalations;
CREATE POLICY "Service role manages escalations"
ON public.notification_escalations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users view own escalations"
ON public.notification_escalations FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service manages AB tests" ON public.notification_ab_tests;
CREATE POLICY "Service role manages AB tests"
ON public.notification_ab_tests FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Admins view AB tests"
ON public.notification_ab_tests FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view recalibration logs" ON public.model_recalibration_logs;
DROP POLICY IF EXISTS "Service role can insert recalibration logs" ON public.model_recalibration_logs;
DROP POLICY IF EXISTS "Service role can update recalibration logs" ON public.model_recalibration_logs;
CREATE POLICY "Service role manages recalibration logs"
ON public.model_recalibration_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Admins view recalibration logs"
ON public.model_recalibration_logs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
