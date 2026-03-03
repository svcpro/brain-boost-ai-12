
CREATE TABLE public.whatsapp_otps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mobile TEXT NOT NULL,
  otp TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes'),
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup
CREATE INDEX idx_whatsapp_otps_mobile ON public.whatsapp_otps (mobile, verified);

-- Enable RLS
ALTER TABLE public.whatsapp_otps ENABLE ROW LEVEL SECURITY;

-- No client access - only edge functions via service role
