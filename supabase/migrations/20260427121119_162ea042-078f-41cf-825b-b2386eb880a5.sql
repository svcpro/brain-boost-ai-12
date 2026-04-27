CREATE OR REPLACE FUNCTION public.admin_list_public_tables()
RETURNS TABLE(table_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.tablename::text
  FROM pg_catalog.pg_tables t
  WHERE t.schemaname = 'public'
  ORDER BY t.tablename;
$$;

REVOKE ALL ON FUNCTION public.admin_list_public_tables() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_public_tables() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_public_tables() TO authenticated;