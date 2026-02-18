
-- Add email and phone columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

-- Backfill existing profiles from auth.users
UPDATE public.profiles p
SET email = u.email, phone = u.phone
FROM auth.users u
WHERE p.id = u.id;

-- Update the handle_new_user trigger to also populate email and phone
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''),
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    NEW.phone
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = CASE 
      WHEN COALESCE(NULLIF(public.profiles.display_name, ''), NULL) IS NULL 
      THEN EXCLUDED.display_name 
      ELSE public.profiles.display_name 
    END,
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone);
  RETURN NEW;
END;
$$;
