CREATE POLICY "Admins can view all OTPs"
ON public.whatsapp_otps
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));