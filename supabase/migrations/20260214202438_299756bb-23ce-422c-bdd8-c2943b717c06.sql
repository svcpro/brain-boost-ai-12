
-- Function to accept a freeze gift: transfers freeze ownership atomically
CREATE OR REPLACE FUNCTION public.accept_freeze_gift(gift_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_freeze_id UUID;
  v_recipient_id UUID;
  v_status TEXT;
BEGIN
  -- Get and validate the gift
  SELECT fg.freeze_id, fg.recipient_id, fg.status
  INTO v_freeze_id, v_recipient_id, v_status
  FROM freeze_gifts fg
  WHERE fg.id = gift_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gift not found';
  END IF;

  IF v_recipient_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_status != 'pending' THEN
    RAISE EXCEPTION 'Gift already resolved';
  END IF;

  -- Transfer freeze ownership
  UPDATE streak_freezes SET user_id = v_recipient_id WHERE id = v_freeze_id;

  -- Mark gift as accepted
  UPDATE freeze_gifts SET status = 'accepted', resolved_at = now() WHERE id = gift_id;
END;
$$;
