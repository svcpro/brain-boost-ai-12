CREATE POLICY "Institution admin can view member leads"
ON public.leads
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.institution_members im
    JOIN public.institutions i ON i.id = im.institution_id
    WHERE im.user_id = leads.user_id
      AND i.admin_user_id = auth.uid()
  )
);