
-- Fix the overly permissive INSERT policy on api_request_logs
DROP POLICY IF EXISTS "Service can insert api_request_logs" ON public.api_request_logs;
-- Allow authenticated users and service role to insert logs
CREATE POLICY "Authenticated can insert api_request_logs" ON public.api_request_logs 
FOR INSERT TO authenticated WITH CHECK (true);
