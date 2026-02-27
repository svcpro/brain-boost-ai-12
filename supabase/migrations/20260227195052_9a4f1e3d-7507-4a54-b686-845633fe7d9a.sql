
-- Add ACQIS cognitive intelligence columns to brainlens_queries
ALTER TABLE public.brainlens_queries
ADD COLUMN IF NOT EXISTS cognitive_gap_type text,
ADD COLUMN IF NOT EXISTS cognitive_gap_code text,
ADD COLUMN IF NOT EXISTS micro_concepts jsonb,
ADD COLUMN IF NOT EXISTS reinforcement_questions jsonb,
ADD COLUMN IF NOT EXISTS exam_impact jsonb,
ADD COLUMN IF NOT EXISTS explanation_depth text DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS knowledge_graph_node jsonb,
ADD COLUMN IF NOT EXISTS policy_intelligence jsonb,
ADD COLUMN IF NOT EXISTS confidence_score numeric DEFAULT 0.8,
ADD COLUMN IF NOT EXISTS cross_validated boolean DEFAULT false;
