
-- Replace overly permissive INSERT policies with properly scoped ones
DROP POLICY "Service can insert flags" ON public.content_flags;
DROP POLICY "Service can insert actions" ON public.moderation_actions;
DROP POLICY "Service can upsert profiles" ON public.user_moderation_profiles;
DROP POLICY "Service can update profiles" ON public.user_moderation_profiles;

-- Edge functions use service role which bypasses RLS, so these open policies aren't needed
-- Instead, only allow authenticated admins to insert via client
CREATE POLICY "Admins can insert content flags" ON public.content_flags FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can insert moderation actions" ON public.moderation_actions FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can insert moderation profiles" ON public.user_moderation_profiles FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update moderation profiles" ON public.user_moderation_profiles FOR UPDATE USING (public.is_admin(auth.uid()));
