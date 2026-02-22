-- Add auto-policy-analysis toggle to ca_autopilot_config
ALTER TABLE public.ca_autopilot_config 
ADD COLUMN IF NOT EXISTS auto_policy_analysis_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_apply_tpi_adjustments boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS total_policy_analyses_run integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_tpi_adjustments_applied integer NOT NULL DEFAULT 0;