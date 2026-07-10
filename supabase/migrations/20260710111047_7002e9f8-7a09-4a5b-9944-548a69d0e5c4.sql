DROP POLICY IF EXISTS "Handles are public readable" ON public.myrank_handles;

REVOKE SELECT ON public.myrank_handles FROM anon;
REVOKE SELECT ON public.myrank_handles FROM authenticated;
REVOKE SELECT ON public.myrank_handles FROM public;

GRANT SELECT, INSERT, UPDATE ON public.myrank_handles TO authenticated;
GRANT ALL ON public.myrank_handles TO service_role;

CREATE POLICY "Users can view own handles"
ON public.myrank_handles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);