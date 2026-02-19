
-- Store per-user AI-predicted exam countdown phases
CREATE TABLE public.exam_countdown_predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  exam_date DATE NOT NULL,
  predicted_acceleration_days INTEGER NOT NULL DEFAULT 20,
  predicted_lockdown_days INTEGER NOT NULL DEFAULT 7,
  locked_modes_acceleration TEXT[] DEFAULT '{}',
  locked_modes_lockdown TEXT[] DEFAULT '{}',
  recommended_mode_acceleration TEXT DEFAULT 'mock',
  recommended_mode_lockdown TEXT DEFAULT 'emergency',
  acceleration_message TEXT DEFAULT 'AI has detected you need focused preparation. Some modes are restricted.',
  lockdown_message TEXT DEFAULT 'Your exam is imminent. AI has locked non-essential modes for maximum focus.',
  ai_reasoning TEXT,
  confidence_score NUMERIC(4,2) DEFAULT 0.5,
  factors JSONB DEFAULT '{}',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.exam_countdown_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own predictions"
  ON public.exam_countdown_predictions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage predictions"
  ON public.exam_countdown_predictions FOR ALL
  USING (true)
  WITH CHECK (true);

-- Admin read access
CREATE POLICY "Admins can read all predictions"
  ON public.exam_countdown_predictions FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_exam_countdown_predictions_updated_at
  BEFORE UPDATE ON public.exam_countdown_predictions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
