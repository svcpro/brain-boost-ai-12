
-- WhatsApp Automation Triggers table
CREATE TABLE public.whatsapp_triggers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trigger_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  template_name TEXT,
  meta_template_id UUID,
  conditions JSONB NOT NULL DEFAULT '{}',
  cooldown_minutes INTEGER DEFAULT 60,
  priority TEXT NOT NULL DEFAULT 'normal',
  target_filter JSONB DEFAULT '{}',
  schedule_type TEXT NOT NULL DEFAULT 'instant',
  schedule_cron TEXT,
  last_triggered_at TIMESTAMPTZ,
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage whatsapp_triggers"
  ON public.whatsapp_triggers FOR ALL
  USING (public.is_admin(auth.uid()));

-- WhatsApp Message Queue
CREATE TABLE public.whatsapp_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  to_number TEXT NOT NULL,
  message_body TEXT NOT NULL,
  template_name TEXT,
  template_params JSONB,
  media_url TEXT,
  category TEXT DEFAULT 'automation',
  trigger_key TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage whatsapp_queue"
  ON public.whatsapp_queue FOR ALL
  USING (public.is_admin(auth.uid()));

-- WhatsApp Cost Tracking
CREATE TABLE public.whatsapp_cost_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  messages_sent INTEGER DEFAULT 0,
  messages_delivered INTEGER DEFAULT 0,
  messages_read INTEGER DEFAULT 0,
  messages_failed INTEGER DEFAULT 0,
  cost_per_message NUMERIC(10,4) DEFAULT 0.0523,
  total_cost NUMERIC(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  provider TEXT DEFAULT 'meta',
  category TEXT DEFAULT 'all',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(date, provider, category)
);

ALTER TABLE public.whatsapp_cost_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage whatsapp_cost_tracking"
  ON public.whatsapp_cost_tracking FOR ALL
  USING (public.is_admin(auth.uid()));

-- Indexes for performance
CREATE INDEX idx_whatsapp_triggers_key ON public.whatsapp_triggers(trigger_key);
CREATE INDEX idx_whatsapp_triggers_category ON public.whatsapp_triggers(category);
CREATE INDEX idx_whatsapp_queue_status ON public.whatsapp_queue(status);
CREATE INDEX idx_whatsapp_queue_scheduled ON public.whatsapp_queue(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_whatsapp_cost_date ON public.whatsapp_cost_tracking(date);

-- Triggers for updated_at
CREATE TRIGGER update_whatsapp_triggers_updated_at
  BEFORE UPDATE ON public.whatsapp_triggers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_queue_updated_at
  BEFORE UPDATE ON public.whatsapp_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_cost_updated_at
  BEFORE UPDATE ON public.whatsapp_cost_tracking
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
