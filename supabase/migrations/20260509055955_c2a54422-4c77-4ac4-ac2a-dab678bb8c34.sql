ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'admin';
CREATE INDEX IF NOT EXISTS idx_institutions_source ON public.institutions(source);