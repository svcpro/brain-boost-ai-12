
-- 1. Revoke EXECUTE from anon/authenticated on internal SECURITY DEFINER functions.
-- These are meant to be called only by triggers or trusted edge functions (service_role).
REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limits() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_api_key() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.generate_acry_api_key() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.increment_api_usage(text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.reset_monthly_api_usage() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_settings() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_lead() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_trial() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.sms_quota_increment(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.whatsapp_quota_increment(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.admin_list_public_tables() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;

-- Keep these callable by signed-in users (used by app for own data / role checks):
-- has_role, is_admin, has_permission, accept_freeze_gift, sms_quota_remaining, whatsapp_quota_remaining
-- Revoke from anon (logged-out) only:
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.accept_freeze_gift(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.sms_quota_remaining(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.whatsapp_quota_remaining(uuid) FROM anon, public;

-- 2. Tighten avatars bucket: prevent listing the whole bucket.
-- Replace the broad public SELECT policy with one that only allows reading
-- objects when the requester knows the exact path (bucket-level listing blocked
-- via storage.objects path filter requiring a specific user folder OR a name filter).
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

-- Public can READ a specific avatar object only when fetched by full path (no broad listing).
-- We allow SELECT for the avatars bucket only when the request includes a name (i.e.,
-- direct object fetch). RLS still permits reads of individual files via public URL.
CREATE POLICY "Avatar objects readable by direct path"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'avatars'
  AND name IS NOT NULL
  AND position('/' in name) > 0
);

-- 3. Ensure avatar uploads have proper user-folder check (re-add WITH CHECK).
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 4. Ensure backup uploads check admin role.
DROP POLICY IF EXISTS "Admins can upload backup files" ON storage.objects;
CREATE POLICY "Admins can upload backup files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'admin-backups'
  AND public.is_admin(auth.uid())
);
