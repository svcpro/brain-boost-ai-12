
-- Fix overly permissive policy - restrict writes to service role only
DROP POLICY "Service role can manage predictions" ON public.exam_countdown_predictions;

-- Only allow inserts/updates via service role (edge functions)
-- RLS is bypassed by service role anyway, so we just need user SELECT policies
