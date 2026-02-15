
-- Allow admins to insert notifications for broadcast
CREATE POLICY "Admins can insert notifications"
ON public.notification_history FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));
