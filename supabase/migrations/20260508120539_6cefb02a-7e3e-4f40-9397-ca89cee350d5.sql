-- Extend peek to include active batches
CREATE OR REPLACE FUNCTION public.peek_institution_by_referral(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inst record;
  v_batches jsonb;
BEGIN
  SELECT id, name, type, logo_url, primary_color, city, branch, is_active, settings
    INTO v_inst FROM public.institutions
    WHERE referral_code = upper(trim(p_code)) AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', b.id,
    'name', b.name,
    'description', b.description,
    'academic_year', b.academic_year
  ) ORDER BY b.created_at DESC), '[]'::jsonb)
  INTO v_batches
  FROM public.institution_batches b
  WHERE b.institution_id = v_inst.id AND b.is_active = true;

  RETURN jsonb_build_object(
    'ok', true,
    'institution_id', v_inst.id,
    'name', v_inst.name,
    'type', v_inst.type,
    'logo_url', v_inst.logo_url,
    'primary_color', v_inst.primary_color,
    'city', v_inst.city,
    'branch', v_inst.branch,
    'batches', v_batches,
    'exam_types', COALESCE(v_inst.settings->'exam_types', '[]'::jsonb)
  );
END;
$function$;

-- Extend join to accept batch + exam choice
CREATE OR REPLACE FUNCTION public.join_institution_by_referral(
  p_code text,
  p_source text DEFAULT 'referral'::text,
  p_batch_id uuid DEFAULT NULL,
  p_exam_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_inst_id uuid;
  v_valid_batch boolean := false;
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

  -- Optional batch enrollment (validate it belongs to this institute)
  IF p_batch_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.institution_batches
      WHERE id = p_batch_id AND institution_id = v_inst_id AND is_active = true
    ) INTO v_valid_batch;

    IF v_valid_batch THEN
      INSERT INTO public.batch_students (batch_id, student_user_id, is_active)
      VALUES (p_batch_id, v_uid, true)
      ON CONFLICT (batch_id, student_user_id) DO UPDATE SET is_active = true;
    END IF;
  END IF;

  -- Optional exam selection -> drives onboarding plan
  IF p_exam_type IS NOT NULL AND length(trim(p_exam_type)) > 0 THEN
    INSERT INTO public.profiles (id, exam_type)
    VALUES (v_uid, trim(p_exam_type))
    ON CONFLICT (id) DO UPDATE
      SET exam_type = EXCLUDED.exam_type,
          updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'institution_id', v_inst_id,
    'batch_enrolled', v_valid_batch,
    'exam_set', (p_exam_type IS NOT NULL)
  );
END;
$function$;