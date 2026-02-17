-- Auto-create a lead record when a new profile is inserted
CREATE OR REPLACE FUNCTION public.handle_new_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.leads (user_id, stage, score)
  VALUES (NEW.id, 'new', 0)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_create_lead
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_lead();