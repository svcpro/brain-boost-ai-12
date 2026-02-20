
-- Table to track per-user rate limiting for edge functions
CREATE TABLE public.edge_function_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  function_name TEXT NOT NULL,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  request_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint for upserts
CREATE UNIQUE INDEX idx_rate_limit_user_fn_window 
  ON public.edge_function_rate_limits (user_id, function_name, window_start);

-- Index for cleanup queries
CREATE INDEX idx_rate_limit_window_start 
  ON public.edge_function_rate_limits (window_start);

-- Enable RLS
ALTER TABLE public.edge_function_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role can access (edge functions use service role)
CREATE POLICY "Service role only" ON public.edge_function_rate_limits
  FOR ALL USING (false);

-- Auto-cleanup old rate limit records (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.edge_function_rate_limits 
  WHERE window_start < now() - interval '1 hour';
END;
$$;
