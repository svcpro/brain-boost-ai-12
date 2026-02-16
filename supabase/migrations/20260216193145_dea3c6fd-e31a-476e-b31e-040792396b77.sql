-- Fix seo_pages policy: ALL needs WITH CHECK for INSERT/UPDATE to work
DROP POLICY IF EXISTS "Admins can manage seo_pages" ON public.seo_pages;

CREATE POLICY "Admins can manage seo_pages"
ON public.seo_pages FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));
