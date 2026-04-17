-- Helper: generate a random acry_ key
CREATE OR REPLACE FUNCTION public.generate_acry_api_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
BEGIN
  v_key := 'acry_' || replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
  RETURN v_key;
END;
$$;

-- Trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user_api_key()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.api_keys
    WHERE created_by = NEW.id AND name = 'Default API Key'
  ) THEN
    RETURN NEW;
  END IF;

  v_key := public.generate_acry_api_key();

  INSERT INTO public.api_keys (
    name, key_hash, key_prefix, environment, key_type,
    permissions, rate_limit_per_minute, is_active, created_by, notes
  ) VALUES (
    'Default API Key',
    v_key,
    substring(v_key from 1 for 10) || '...',
    'production',
    'user',
    ARRAY['read','write']::text[],
    60, true, NEW.id,
    'auto_generated'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to auto-create api key for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_api_key ON auth.users;
CREATE TRIGGER on_auth_user_created_api_key
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_api_key();

-- Backfill existing users
DO $$
DECLARE
  u RECORD;
  v_key text;
BEGIN
  FOR u IN
    SELECT au.id
    FROM auth.users au
    WHERE NOT EXISTS (
      SELECT 1 FROM public.api_keys ak
      WHERE ak.created_by = au.id AND ak.name = 'Default API Key'
    )
  LOOP
    v_key := public.generate_acry_api_key();
    INSERT INTO public.api_keys (
      name, key_hash, key_prefix, environment, key_type,
      permissions, rate_limit_per_minute, is_active, created_by, notes
    ) VALUES (
      'Default API Key',
      v_key,
      substring(v_key from 1 for 10) || '...',
      'production',
      'user',
      ARRAY['read','write']::text[],
      60, true, u.id,
      'auto_generated'
    );
  END LOOP;
END $$;

-- RLS: users can read their own api keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='api_keys'
      AND policyname='Users can view their own api keys'
  ) THEN
    CREATE POLICY "Users can view their own api keys"
      ON public.api_keys
      FOR SELECT
      TO authenticated
      USING (auth.uid() = created_by);
  END IF;
END $$;