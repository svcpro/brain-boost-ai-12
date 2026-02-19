
-- Exam countdown adaptive mode config (admin-configurable)
CREATE TABLE public.exam_countdown_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Phase thresholds (days before exam)
  normal_mode_min_days INTEGER NOT NULL DEFAULT 30,
  acceleration_mode_min_days INTEGER NOT NULL DEFAULT 15,
  lockdown_mode_min_days INTEGER NOT NULL DEFAULT 0,
  
  -- Locked modes per phase (array of mode IDs: focus, revision, mock, emergency)
  normal_locked_modes TEXT[] NOT NULL DEFAULT '{}',
  acceleration_locked_modes TEXT[] NOT NULL DEFAULT '{}',
  lockdown_locked_modes TEXT[] NOT NULL DEFAULT '{revision}',
  
  -- Lock messages per phase
  acceleration_lock_message TEXT DEFAULT 'Your exam is approaching. This mode is restricted during Acceleration phase to maximize focus.',
  lockdown_lock_message TEXT DEFAULT 'Your exam is imminent. This mode is locked during Lockdown to eliminate distractions and optimize preparation.',
  
  -- Recommended mode per phase
  acceleration_recommended_mode TEXT DEFAULT 'mock',
  lockdown_recommended_mode TEXT DEFAULT 'emergency',
  
  -- Plan-based override: which plans can bypass locks
  bypass_plan_keys TEXT[] NOT NULL DEFAULT '{ultra}',
  
  -- Enable/disable the system
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.exam_countdown_config ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read config
CREATE POLICY "Anyone can read exam countdown config"
ON public.exam_countdown_config
FOR SELECT
TO authenticated
USING (true);

-- Only admins can modify
CREATE POLICY "Admins can manage exam countdown config"
ON public.exam_countdown_config
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Insert default config row
INSERT INTO public.exam_countdown_config (id) VALUES (gen_random_uuid());

-- Trigger for updated_at
CREATE TRIGGER update_exam_countdown_config_updated_at
BEFORE UPDATE ON public.exam_countdown_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
