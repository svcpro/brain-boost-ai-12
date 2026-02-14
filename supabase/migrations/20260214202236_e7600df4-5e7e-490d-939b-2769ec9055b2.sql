
-- Table to track freeze gift requests
CREATE TABLE public.freeze_gifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  freeze_id UUID NOT NULL REFERENCES public.streak_freezes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, declined
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.freeze_gifts ENABLE ROW LEVEL SECURITY;

-- Senders can see their sent gifts
CREATE POLICY "Senders can view own sent gifts"
ON public.freeze_gifts FOR SELECT
USING (auth.uid() = sender_id);

-- Recipients can see gifts sent to them
CREATE POLICY "Recipients can view received gifts"
ON public.freeze_gifts FOR SELECT
USING (auth.uid() = recipient_id);

-- Authenticated users can insert (send) gifts
CREATE POLICY "Users can send gifts"
ON public.freeze_gifts FOR INSERT
WITH CHECK (auth.uid() = sender_id);

-- Recipients can update (accept/decline) gifts sent to them
CREATE POLICY "Recipients can resolve gifts"
ON public.freeze_gifts FOR UPDATE
USING (auth.uid() = recipient_id);
