
-- Storage bucket for backups (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('admin-backups', 'admin-backups', false, 5368709120)
ON CONFLICT (id) DO NOTHING;

-- Backup history table
CREATE TABLE IF NOT EXISTS public.admin_backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued',
  format text NOT NULL DEFAULT 'json',
  scope text NOT NULL DEFAULT 'full',
  selected_tables text[] DEFAULT NULL,
  total_tables int DEFAULT 0,
  completed_tables int DEFAULT 0,
  failed_tables text[] DEFAULT '{}',
  total_rows bigint DEFAULT 0,
  size_bytes bigint DEFAULT 0,
  storage_path text,
  download_url text,
  error_message text,
  duration_ms int,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_backup_runs_created ON public.admin_backup_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_backup_runs_status ON public.admin_backup_runs (status);

ALTER TABLE public.admin_backup_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view backup runs"
ON public.admin_backup_runs FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert backup runs"
ON public.admin_backup_runs FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update backup runs"
ON public.admin_backup_runs FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete backup runs"
ON public.admin_backup_runs FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Storage policies for admin-backups bucket
CREATE POLICY "Admins can read backup files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'admin-backups' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can upload backup files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'admin-backups' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete backup files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'admin-backups' AND public.is_admin(auth.uid()));
