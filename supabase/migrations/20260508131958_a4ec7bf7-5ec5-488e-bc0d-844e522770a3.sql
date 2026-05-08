CREATE POLICY "Institution admin can view member profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.institution_members im
    JOIN public.institutions i ON i.id = im.institution_id
    WHERE im.user_id = profiles.id
      AND i.admin_user_id = auth.uid()
  )
);