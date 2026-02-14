
-- Add soft-delete columns
ALTER TABLE public.subjects ADD COLUMN deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.topics ADD COLUMN deleted_at timestamptz DEFAULT NULL;

-- Create indexes for efficient filtering
CREATE INDEX idx_subjects_deleted_at ON public.subjects (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_topics_deleted_at ON public.topics (deleted_at) WHERE deleted_at IS NOT NULL;
