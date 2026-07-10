DROP POLICY IF EXISTS "Public can view active ambassador cards" ON public.ambassador_profiles;
REVOKE SELECT (email) ON public.ambassador_profiles FROM anon;