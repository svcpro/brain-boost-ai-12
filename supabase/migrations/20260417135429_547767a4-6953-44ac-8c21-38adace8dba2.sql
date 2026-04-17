UPDATE public.profiles
SET study_preferences = COALESCE(study_preferences, '{}'::jsonb) || jsonb_build_object('onboarded', true)
WHERE (study_preferences->>'onboarded') IS NULL
  AND exam_type IS NOT NULL
  AND display_name IS NOT NULL;