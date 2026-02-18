
-- Fix admin_audit_logs INSERT policy to prevent impersonation
-- Drop existing INSERT policy and recreate with admin_id = auth.uid() check
DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.admin_audit_logs;

CREATE POLICY "Admins can insert audit logs"
ON public.admin_audit_logs
FOR INSERT
WITH CHECK (
  public.is_admin(auth.uid())
  AND admin_id = auth.uid()
);

-- Ensure no UPDATE or DELETE is allowed (append-only audit log)
DROP POLICY IF EXISTS "No updates to audit logs" ON public.admin_audit_logs;
CREATE POLICY "No updates to audit logs"
ON public.admin_audit_logs
FOR UPDATE
USING (false);

DROP POLICY IF EXISTS "No deletes from audit logs" ON public.admin_audit_logs;
CREATE POLICY "No deletes from audit logs"
ON public.admin_audit_logs
FOR DELETE
USING (false);
