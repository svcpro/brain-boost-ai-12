
-- Allow senders to delete their own pending gifts (cancel)
CREATE POLICY "Senders can delete own pending gifts"
ON public.freeze_gifts FOR DELETE
USING (auth.uid() = sender_id AND status = 'pending');
