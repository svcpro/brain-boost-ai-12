
-- Table to manage third-party API integrations from admin panel
CREATE TABLE public.api_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  api_key_masked TEXT,
  key_last_updated_at TIMESTAMP WITH TIME ZONE,
  monthly_cost_estimate NUMERIC DEFAULT 0,
  monthly_usage_count INTEGER DEFAULT 0,
  usage_limit INTEGER,
  usage_reset_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.api_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view api integrations"
ON public.api_integrations FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert api integrations"
ON public.api_integrations FOR INSERT
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update api integrations"
ON public.api_integrations FOR UPDATE
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete api integrations"
ON public.api_integrations FOR DELETE
USING (is_admin(auth.uid()));

CREATE TRIGGER update_api_integrations_updated_at
BEFORE UPDATE ON public.api_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with known integrations
INSERT INTO public.api_integrations (service_name, display_name, description, category, config) VALUES
('resend', 'Resend', 'Transactional email service for study reminders, weekly reports, and notifications', 'email', '{"secret_name": "RESEND_API_KEY", "docs_url": "https://resend.com/docs", "pricing_url": "https://resend.com/pricing", "used_in": ["send-study-reminder-emails", "send-weekly-report-email", "check-subscription-expiry", "weekly-brain-digest", "daily-brain-briefing"]}'::jsonb),
('elevenlabs', 'ElevenLabs', 'AI voice generation for voice notifications and text-to-speech', 'voice', '{"secret_name": "ELEVENLABS_API_KEY", "docs_url": "https://elevenlabs.io/docs", "pricing_url": "https://elevenlabs.io/pricing", "used_in": ["voice-notification"], "managed_by_connector": true}'::jsonb),
('razorpay', 'Razorpay', 'Payment gateway for subscription billing and order processing', 'payments', '{"secret_name": "RAZORPAY_KEY_ID", "secret_name_2": "RAZORPAY_KEY_SECRET", "docs_url": "https://razorpay.com/docs", "pricing_url": "https://razorpay.com/pricing", "used_in": ["razorpay-order", "razorpay-webhook"]}'::jsonb),
('vapid', 'Web Push (VAPID)', 'Push notification delivery via VAPID keys for browser notifications', 'notifications', '{"secret_name": "VAPID_PUBLIC_KEY", "secret_name_2": "VAPID_PRIVATE_KEY", "docs_url": "https://web.dev/push-notifications-overview", "used_in": ["send-push-notification"]}'::jsonb),
('lovable_ai', 'Lovable AI', 'AI-powered features including study insights, brain agents, and content generation', 'ai', '{"secret_name": "LOVABLE_API_KEY", "docs_url": "https://docs.lovable.dev/features/ai", "used_in": ["ai-brain-agent", "study-insights", "burnout-detection", "extract-image-topics", "extract-pdf-topics", "extract-voice-topics", "world-model-simulation", "weekly-brain-digest", "daily-brain-briefing", "adaptive-difficulty", "brain-missions", "on-demand-briefing"]}'::jsonb);
