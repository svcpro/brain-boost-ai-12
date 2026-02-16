
-- API Keys table: generate, manage, revoke API keys per environment
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'development' CHECK (environment IN ('development', 'staging', 'production')),
  key_type TEXT NOT NULL DEFAULT 'app' CHECK (key_type IN ('user', 'app', 'admin')),
  permissions TEXT[] NOT NULL DEFAULT '{}',
  rate_limit_per_minute INTEGER DEFAULT 60,
  usage_count BIGINT DEFAULT 0,
  usage_limit BIGINT DEFAULT NULL,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  last_used_at TIMESTAMPTZ DEFAULT NULL,
  created_by UUID NOT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage api_keys" ON public.api_keys FOR ALL USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON public.api_keys
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- API Endpoints registry
CREATE TABLE public.api_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'POST',
  display_name TEXT NOT NULL,
  description TEXT DEFAULT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  is_enabled BOOLEAN DEFAULT true,
  requires_auth BOOLEAN DEFAULT true,
  rate_limit_per_minute INTEGER DEFAULT 60,
  version TEXT DEFAULT 'v1',
  request_schema JSONB DEFAULT NULL,
  response_schema JSONB DEFAULT NULL,
  total_requests BIGINT DEFAULT 0,
  total_errors BIGINT DEFAULT 0,
  avg_latency_ms NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.api_endpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage api_endpoints" ON public.api_endpoints FOR ALL USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_api_endpoints_updated_at BEFORE UPDATE ON public.api_endpoints
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- API Request Logs for analytics
CREATE TABLE public.api_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID REFERENCES public.api_endpoints(id) ON DELETE SET NULL,
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  user_id UUID DEFAULT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  latency_ms INTEGER DEFAULT 0,
  request_size_bytes INTEGER DEFAULT 0,
  response_size_bytes INTEGER DEFAULT 0,
  error_message TEXT DEFAULT NULL,
  ip_address TEXT DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view api_request_logs" ON public.api_request_logs FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Service can insert api_request_logs" ON public.api_request_logs FOR INSERT WITH CHECK (true);

-- Create index for fast querying
CREATE INDEX idx_api_request_logs_created_at ON public.api_request_logs(created_at DESC);
CREATE INDEX idx_api_request_logs_endpoint_id ON public.api_request_logs(endpoint_id);
CREATE INDEX idx_api_request_logs_api_key_id ON public.api_request_logs(api_key_id);
CREATE INDEX idx_api_request_logs_user_id ON public.api_request_logs(user_id);

-- API Rate Limit configs
CREATE TABLE public.api_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL CHECK (target_type IN ('global', 'endpoint', 'api_key', 'user')),
  target_id TEXT DEFAULT NULL,
  requests_per_minute INTEGER NOT NULL DEFAULT 60,
  requests_per_hour INTEGER DEFAULT NULL,
  requests_per_day INTEGER DEFAULT NULL,
  burst_limit INTEGER DEFAULT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage api_rate_limits" ON public.api_rate_limits FOR ALL USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_api_rate_limits_updated_at BEFORE UPDATE ON public.api_rate_limits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default endpoints from existing edge functions
INSERT INTO public.api_endpoints (path, method, display_name, category, version, requires_auth) VALUES
('ai-support-chat', 'POST', 'AI Support Chat', 'ai', 'v1', true),
('ai-brain-agent', 'POST', 'AI Brain Agent', 'ai', 'v1', true),
('ai-topic-manager', 'POST', 'AI Topic Manager', 'ai', 'v1', true),
('memory-engine', 'POST', 'Memory Engine', 'prediction', 'v1', false),
('leaderboard', 'POST', 'Leaderboard', 'user', 'v1', false),
('adaptive-difficulty', 'POST', 'Adaptive Difficulty', 'ai', 'v1', false),
('burnout-detection', 'POST', 'Burnout Detection', 'ai', 'v1', false),
('cognitive-twin', 'POST', 'Cognitive Twin', 'ai', 'v1', false),
('continual-learning', 'POST', 'Continual Learning', 'ai', 'v1', false),
('hybrid-prediction', 'POST', 'Hybrid Prediction', 'prediction', 'v1', false),
('inference-pipeline', 'POST', 'Inference Pipeline', 'prediction', 'v1', true),
('meta-learning', 'POST', 'Meta Learning', 'ai', 'v1', false),
('rl-agent', 'POST', 'RL Agent', 'ai', 'v1', true),
('study-insights', 'POST', 'Study Insights', 'analytics', 'v1', false),
('voice-notification', 'POST', 'Voice Notification', 'voice', 'v1', true),
('transcribe-voice', 'POST', 'Transcribe Voice', 'voice', 'v1', false),
('extract-pdf-topics', 'POST', 'Extract PDF Topics', 'extraction', 'v1', false),
('extract-image-topics', 'POST', 'Extract Image Topics', 'extraction', 'v1', false),
('extract-voice-topics', 'POST', 'Extract Voice Topics', 'extraction', 'v1', false),
('razorpay-order', 'POST', 'Razorpay Order', 'payments', 'v1', false),
('razorpay-webhook', 'POST', 'Razorpay Webhook', 'payments', 'v1', false),
('send-push-notification', 'POST', 'Push Notification', 'notifications', 'v1', false),
('send-study-reminder-emails', 'POST', 'Study Reminder Emails', 'notifications', 'v1', false),
('send-weekly-report-email', 'POST', 'Weekly Report Email', 'notifications', 'v1', false),
('generate-notification', 'POST', 'Generate Notification', 'notifications', 'v1', false),
('brain-missions', 'POST', 'Brain Missions', 'ai', 'v1', false),
('daily-brain-briefing', 'POST', 'Daily Brain Briefing', 'ai', 'v1', false),
('daily-risk-digest', 'POST', 'Daily Risk Digest', 'analytics', 'v1', false),
('weekly-brain-digest', 'POST', 'Weekly Brain Digest', 'analytics', 'v1', false),
('user-embedding', 'POST', 'User Embedding', 'ai', 'v1', false),
('ml-feature-engine', 'POST', 'ML Feature Engine', 'prediction', 'v1', false),
('world-model-simulation', 'POST', 'World Model Simulation', 'ai', 'v1', false),
('collective-intelligence', 'POST', 'Collective Intelligence', 'ai', 'v1', false),
('check-subscription-expiry', 'POST', 'Check Subscription Expiry', 'payments', 'v1', false),
('send-campaign-email', 'POST', 'Send Campaign Email', 'notifications', 'v1', false),
('generate-campaign-templates', 'POST', 'Campaign Templates', 'notifications', 'v1', false),
('email-webhook', 'POST', 'Email Webhook', 'notifications', 'v1', false),
('email-unsubscribe', 'GET', 'Email Unsubscribe', 'notifications', 'v1', false),
('purge-trash', 'POST', 'Purge Trash', 'system', 'v1', false);

-- Insert default global rate limit
INSERT INTO public.api_rate_limits (target_type, requests_per_minute, requests_per_hour, requests_per_day)
VALUES ('global', 100, 3000, 50000);
