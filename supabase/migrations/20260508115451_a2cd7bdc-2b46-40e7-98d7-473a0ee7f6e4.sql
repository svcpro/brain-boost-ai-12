-- 1) Referral code column on institutions
ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS referral_code text;

CREATE OR REPLACE FUNCTION public.gen_short_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
  v_attempts int := 0;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..7 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.institutions WHERE referral_code = v_code) THEN
      RETURN v_code;
    END IF;
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RAISE EXCEPTION 'Could not generate unique referral code';
    END IF;
  END LOOP;
END;
$$;

-- Backfill existing institutions
UPDATE public.institutions
SET referral_code = public.gen_short_referral_code()
WHERE referral_code IS NULL;

ALTER TABLE public.institutions
  ALTER COLUMN referral_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS institutions_referral_code_key
  ON public.institutions (referral_code);

-- Auto-generate on insert if not provided
CREATE OR REPLACE FUNCTION public.set_institution_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL OR NEW.referral_code = '' THEN
    NEW.referral_code := public.gen_short_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_institutions_referral_code ON public.institutions;
CREATE TRIGGER trg_institutions_referral_code
BEFORE INSERT ON public.institutions
FOR EACH ROW EXECUTE FUNCTION public.set_institution_referral_code();

-- 2) Source attribution on members
ALTER TABLE public.institution_members
  ADD COLUMN IF NOT EXISTS source text;

-- 3) Public lookup by referral code (logo, name, type only)
CREATE OR REPLACE FUNCTION public.peek_institution_by_referral(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inst record;
BEGIN
  SELECT id, name, type, logo_url, primary_color, city, branch, is_active
    INTO v_inst FROM public.institutions
    WHERE referral_code = upper(trim(p_code)) AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'institution_id', v_inst.id,
    'name', v_inst.name,
    'type', v_inst.type,
    'logo_url', v_inst.logo_url,
    'primary_color', v_inst.primary_color,
    'city', v_inst.city,
    'branch', v_inst.branch
  );
END;
$$;

-- 4) Authenticated join by referral code
CREATE OR REPLACE FUNCTION public.join_institution_by_referral(p_code text, p_source text DEFAULT 'referral')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inst_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT id INTO v_inst_id FROM public.institutions
    WHERE referral_code = upper(trim(p_code)) AND is_active = true;

  IF v_inst_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  INSERT INTO public.institution_members (institution_id, user_id, role, is_active, source)
  VALUES (v_inst_id, v_uid, 'student', true, COALESCE(p_source, 'referral'))
  ON CONFLICT (institution_id, user_id) DO UPDATE
    SET is_active = true,
        source = COALESCE(institution_members.source, EXCLUDED.source);

  RETURN jsonb_build_object('ok', true, 'institution_id', v_inst_id);
END;
$$;