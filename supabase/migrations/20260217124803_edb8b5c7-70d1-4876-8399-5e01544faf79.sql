-- Make leaderboard and WhatsApp opt-in default to TRUE for new signups
ALTER TABLE public.profiles ALTER COLUMN opt_in_leaderboard SET DEFAULT true;
ALTER TABLE public.profiles ALTER COLUMN whatsapp_opted_in SET DEFAULT true;