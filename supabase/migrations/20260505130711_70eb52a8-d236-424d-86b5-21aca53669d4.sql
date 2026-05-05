
-- 1. community_members: restrict viewing to authenticated users
DROP POLICY IF EXISTS "Anyone can view members" ON public.community_members;
CREATE POLICY "Authenticated can view members"
ON public.community_members FOR SELECT
TO authenticated
USING (true);

-- 2. study_pod_members: restrict viewing to authenticated users
DROP POLICY IF EXISTS "Anyone can view pod members" ON public.study_pod_members;
CREATE POLICY "Authenticated can view pod members"
ON public.study_pod_members FOR SELECT
TO authenticated
USING (true);

-- 3. whatsapp_config: remove public read; admins can already manage
DROP POLICY IF EXISTS "wa_config_public_read" ON public.whatsapp_config;

-- 4. exam_intel_practice_questions: restrict ALL policy to service_role
DROP POLICY IF EXISTS "Service manages intel questions" ON public.exam_intel_practice_questions;
CREATE POLICY "Service manages intel questions"
ON public.exam_intel_practice_questions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 5. realtime.messages: deny-by-default for non-service users
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all realtime subscriptions by default" ON realtime.messages;
CREATE POLICY "Deny all realtime subscriptions by default"
ON realtime.messages FOR SELECT
TO authenticated
USING (false);
