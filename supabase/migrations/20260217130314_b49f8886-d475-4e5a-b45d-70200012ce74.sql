-- Add foreign key from leads.user_id to profiles.id so PostgREST joins work
ALTER TABLE public.leads
  ADD CONSTRAINT leads_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;