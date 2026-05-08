ALTER TABLE public.institution_members REPLICA IDENTITY FULL;
ALTER TABLE public.institution_commissions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.institution_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.institution_commissions;