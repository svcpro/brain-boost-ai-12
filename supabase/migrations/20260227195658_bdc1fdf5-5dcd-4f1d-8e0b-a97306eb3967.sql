
-- Add ALIS (Autonomous Learning Intervention System) columns to brainlens_queries
ALTER TABLE public.brainlens_queries
ADD COLUMN IF NOT EXISTS pre_query_predictions JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS silent_repair_plan JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS future_style_questions JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cognitive_drift JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS personal_examiner JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS strategic_mastery_index JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS strategy_switch JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS alis_version TEXT DEFAULT 'v3.0';
