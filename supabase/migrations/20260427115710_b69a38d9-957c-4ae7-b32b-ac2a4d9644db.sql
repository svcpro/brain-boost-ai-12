
ALTER TABLE public.admin_backup_runs
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS since_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS skipped_tables text[];

CREATE INDEX IF NOT EXISTS idx_admin_backup_runs_mode_finished
  ON public.admin_backup_runs (mode, finished_at DESC)
  WHERE status = 'completed';
