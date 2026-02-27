
-- BrainLens queries table
CREATE TABLE public.brainlens_queries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  input_type TEXT NOT NULL CHECK (input_type IN ('scan', 'upload', 'url', 'text')),
  input_content TEXT,
  extracted_text TEXT,
  detected_topic TEXT,
  detected_subtopic TEXT,
  detected_difficulty TEXT,
  detected_exam_type TEXT,
  short_answer TEXT,
  detailed_explanation JSONB,
  related_pyqs JSONB,
  processing_time_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.brainlens_queries ENABLE ROW LEVEL SECURITY;

-- Users can view their own queries
CREATE POLICY "Users can view own brainlens queries"
ON public.brainlens_queries FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own queries
CREATE POLICY "Users can create brainlens queries"
ON public.brainlens_queries FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own queries
CREATE POLICY "Users can update own brainlens queries"
ON public.brainlens_queries FOR UPDATE
USING (auth.uid() = user_id);

-- Admins can view all queries
CREATE POLICY "Admins can view all brainlens queries"
ON public.brainlens_queries FOR SELECT
USING (public.is_admin(auth.uid()));

-- BrainLens config table (admin)
CREATE TABLE public.brainlens_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  max_daily_queries_per_user INTEGER NOT NULL DEFAULT 50,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.brainlens_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read brainlens config"
ON public.brainlens_config FOR SELECT
USING (true);

CREATE POLICY "Admins can update brainlens config"
ON public.brainlens_config FOR UPDATE
USING (public.is_admin(auth.uid()));

-- Insert default config
INSERT INTO public.brainlens_config (is_enabled, max_daily_queries_per_user) VALUES (true, 50);

-- Indexes
CREATE INDEX idx_brainlens_queries_user_id ON public.brainlens_queries(user_id);
CREATE INDEX idx_brainlens_queries_created_at ON public.brainlens_queries(created_at DESC);
CREATE INDEX idx_brainlens_queries_input_type ON public.brainlens_queries(input_type);
CREATE INDEX idx_brainlens_queries_detected_topic ON public.brainlens_queries(detected_topic);

-- Trigger for updated_at
CREATE TRIGGER update_brainlens_queries_updated_at
BEFORE UPDATE ON public.brainlens_queries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_brainlens_config_updated_at
BEFORE UPDATE ON public.brainlens_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
