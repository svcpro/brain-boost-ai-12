-- Allow self-signup: a signed-in user can create an institution where they are the admin
CREATE POLICY "Users can self-create their institution"
ON public.institutions
FOR INSERT
TO authenticated
WITH CHECK (admin_user_id = auth.uid());

-- Allow admin of an institution to view all members of that institution
CREATE POLICY "Institution admin can view members"
ON public.institution_members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.institutions i
    WHERE i.id = institution_members.institution_id
      AND i.admin_user_id = auth.uid()
  )
);