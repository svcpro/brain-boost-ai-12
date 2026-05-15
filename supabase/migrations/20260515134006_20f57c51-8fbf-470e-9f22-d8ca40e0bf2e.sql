CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, phone)
  VALUES (
    NEW.id,
    -- Only use explicit metadata; do NOT fall back to email prefix (which would
    -- create an ugly auto-name like the phone number for MSG91 signups).
    NULLIF(COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      NEW.raw_user_meta_data ->> 'display_name'
    ), ''),
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
$function$;