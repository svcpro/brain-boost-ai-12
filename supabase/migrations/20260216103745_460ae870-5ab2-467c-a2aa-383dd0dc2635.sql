
-- Global AI chat configuration (single-row config table)
CREATE TABLE public.chat_admin_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  active_model text NOT NULL DEFAULT 'google/gemini-2.5-flash-lite',
  max_tokens integer NOT NULL DEFAULT 1024,
  temperature numeric(3,2) NOT NULL DEFAULT 0.7,
  global_daily_limit integer NOT NULL DEFAULT 100,
  global_chat_enabled boolean NOT NULL DEFAULT true,
  cost_per_request numeric(10,6) NOT NULL DEFAULT 0.001,
  max_conversation_history integer NOT NULL DEFAULT 20,
  response_timeout_seconds integer NOT NULL DEFAULT 60,
  system_prompt_override text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.chat_admin_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read chat config"
  ON public.chat_admin_config FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update chat config"
  ON public.chat_admin_config FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert chat config"
  ON public.chat_admin_config FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- Insert default config row
INSERT INTO public.chat_admin_config (active_model, max_tokens, temperature) 
VALUES ('google/gemini-2.5-flash-lite', 1024, 0.7);

-- Per-user chat limits and access control
CREATE TABLE public.user_chat_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  chat_enabled boolean NOT NULL DEFAULT true,
  daily_message_limit integer NOT NULL DEFAULT 100,
  messages_used_today integer NOT NULL DEFAULT 0,
  total_messages_sent integer NOT NULL DEFAULT 0,
  total_tokens_used bigint NOT NULL DEFAULT 0,
  estimated_cost numeric(10,4) NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  limit_reset_at timestamptz NOT NULL DEFAULT (now() + interval '1 day'),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_chat_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage user chat limits"
  ON public.user_chat_limits FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can read own chat limits"
  ON public.user_chat_limits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Chat usage analytics log (per-request tracking)
CREATE TABLE public.chat_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  model_used text NOT NULL,
  tokens_input integer,
  tokens_output integer,
  latency_ms integer,
  estimated_cost numeric(10,6),
  status text NOT NULL DEFAULT 'success',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read chat usage logs"
  ON public.chat_usage_logs FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Service role inserts logs"
  ON public.chat_usage_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_chat_usage_logs_user ON public.chat_usage_logs(user_id);
CREATE INDEX idx_chat_usage_logs_created ON public.chat_usage_logs(created_at DESC);
CREATE INDEX idx_user_chat_limits_user ON public.user_chat_limits(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_chat_admin_config_updated_at
  BEFORE UPDATE ON public.chat_admin_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_chat_limits_updated_at
  BEFORE UPDATE ON public.user_chat_limits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
