
-- Add column to track last brain update timestamp
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_brain_update_at timestamptz;
