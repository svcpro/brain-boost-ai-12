
-- Fix: Extract name from multiple OAuth metadata fields (Google: full_name/name, Apple: full_name, Email: display_name)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''),
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = CASE 
      WHEN COALESCE(NULLIF(public.profiles.display_name, ''), NULL) IS NULL 
      THEN EXCLUDED.display_name 
      ELSE public.profiles.display_name 
    END;
  RETURN NEW;
END;
$$;

-- Also fix existing users who have empty/null display_name or email-as-name
UPDATE public.profiles p
SET display_name = COALESCE(
  NULLIF(u.raw_user_meta_data ->> 'full_name', ''),
  NULLIF(u.raw_user_meta_data ->> 'name', ''),
  NULLIF(u.raw_user_meta_data ->> 'display_name', ''),
  split_part(u.email, '@', 1)
)
FROM auth.users u
WHERE p.id = u.id
AND (p.display_name IS NULL OR p.display_name = '' OR p.display_name = split_part(u.email, '@', 1));
