
-- Invites table
CREATE TABLE IF NOT EXISTS public.institution_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  role text NOT NULL DEFAULT 'faculty' CHECK (role IN ('faculty','staff','admin','student')),
  email text,
  phone text,
  note text,
  invited_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired')),
  accepted_by uuid,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_institution_invites_inst ON public.institution_invites(institution_id);
CREATE INDEX IF NOT EXISTS idx_institution_invites_token ON public.institution_invites(token);
CREATE INDEX IF NOT EXISTS idx_institution_invites_status ON public.institution_invites(status);

ALTER TABLE public.institution_invites ENABLE ROW LEVEL SECURITY;

-- Institute admin can manage their invites
CREATE POLICY "Institution admin manages invites"
  ON public.institution_invites
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.institutions i WHERE i.id = institution_invites.institution_id AND i.admin_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.institutions i WHERE i.id = institution_invites.institution_id AND i.admin_user_id = auth.uid()));

-- Platform super-admin override
CREATE POLICY "Super admin manages all invites"
  ON public.institution_invites
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Accept invite RPC: validates token, inserts membership, marks accepted
CREATE OR REPLACE FUNCTION public.accept_institution_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_invite record;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_invite FROM public.institution_invites WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  IF v_invite.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_' || v_invite.status);
  END IF;

  IF v_invite.expires_at < now() THEN
    UPDATE public.institution_invites SET status = 'expired' WHERE id = v_invite.id;
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  -- Upsert membership
  INSERT INTO public.institution_members (institution_id, user_id, role, is_active)
  VALUES (v_invite.institution_id, v_uid, v_invite.role, true)
  ON CONFLICT (institution_id, user_id) DO UPDATE
    SET role = EXCLUDED.role, is_active = true;

  UPDATE public.institution_invites
    SET status = 'accepted', accepted_by = v_uid, accepted_at = now()
    WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'ok', true,
    'institution_id', v_invite.institution_id,
    'role', v_invite.role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_institution_invite(text) TO authenticated;

-- Public peek so accept page can show institution name before login
CREATE OR REPLACE FUNCTION public.peek_institution_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
  v_inst record;
BEGIN
  SELECT * INTO v_invite FROM public.institution_invites WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  SELECT name, type, logo_url, primary_color INTO v_inst FROM public.institutions WHERE id = v_invite.institution_id;

  RETURN jsonb_build_object(
    'ok', true,
    'role', v_invite.role,
    'status', v_invite.status,
    'expires_at', v_invite.expires_at,
    'institution_name', v_inst.name,
    'institution_type', v_inst.type,
    'logo_url', v_inst.logo_url,
    'primary_color', v_inst.primary_color
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.peek_institution_invite(text) TO anon, authenticated;
