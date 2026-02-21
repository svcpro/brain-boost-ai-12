
-- ═══════════════════════════════════════════════════
-- ACRY v6.0 White-Label SaaS Architecture
-- ═══════════════════════════════════════════════════

-- 1. White-Label Branding Config (extends institutions)
CREATE TABLE public.whitelabel_branding (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID NOT NULL UNIQUE REFERENCES public.institutions(id) ON DELETE CASCADE,
  logo_url TEXT,
  logo_dark_url TEXT,
  favicon_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#6366f1',
  secondary_color TEXT NOT NULL DEFAULT '#8b5cf6',
  accent_color TEXT DEFAULT '#f59e0b',
  font_family TEXT DEFAULT 'Inter',
  custom_css TEXT,
  email_sender_name TEXT,
  email_sender_address TEXT,
  email_reply_to TEXT,
  email_logo_url TEXT,
  app_title TEXT,
  tagline TEXT,
  support_email TEXT,
  support_url TEXT,
  privacy_url TEXT,
  terms_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Domain Mapping & Verification
CREATE TABLE public.whitelabel_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  domain TEXT NOT NULL UNIQUE,
  subdomain TEXT,
  domain_type TEXT NOT NULL DEFAULT 'custom',
  verification_token TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  verified_at TIMESTAMPTZ,
  ssl_status TEXT DEFAULT 'pending',
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Feature Toggles per Institution
CREATE TABLE public.whitelabel_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  feature_label TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(institution_id, feature_key)
);

-- 4. SaaS Contracts
CREATE TABLE public.whitelabel_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  contract_number TEXT NOT NULL,
  contract_type TEXT NOT NULL DEFAULT 'standard',
  setup_fee NUMERIC(12,2) DEFAULT 0,
  monthly_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  annual_fee NUMERIC(12,2),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  sla_tier TEXT DEFAULT 'standard',
  sla_uptime_guarantee NUMERIC(5,2) DEFAULT 99.5,
  sla_support_response_hours INTEGER DEFAULT 24,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  auto_renew BOOLEAN DEFAULT true,
  signed_at TIMESTAMPTZ,
  signed_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Institution API Keys (per white-label client)
CREATE TABLE public.institution_api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  permissions TEXT[] DEFAULT '{}',
  rate_limit_per_minute INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Institution Audit Logs
CREATE TABLE public.institution_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════════

ALTER TABLE public.whitelabel_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whitelabel_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whitelabel_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whitelabel_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_audit_logs ENABLE ROW LEVEL SECURITY;

-- Platform admins: full access
CREATE POLICY "Admins full access branding" ON public.whitelabel_branding FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins full access domains" ON public.whitelabel_domains FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins full access features" ON public.whitelabel_features FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins full access contracts" ON public.whitelabel_contracts FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins full access inst_api_keys" ON public.institution_api_keys FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins full access inst_audit" ON public.institution_audit_logs FOR ALL USING (public.is_admin(auth.uid()));

-- Institution admins: manage their own branding/features
CREATE POLICY "Inst admins manage branding" ON public.whitelabel_branding FOR ALL
  USING (EXISTS (SELECT 1 FROM public.institution_members im WHERE im.institution_id = whitelabel_branding.institution_id AND im.user_id = auth.uid() AND im.role = 'institution_admin'));

CREATE POLICY "Inst admins view domains" ON public.whitelabel_domains FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.institution_members im WHERE im.institution_id = whitelabel_domains.institution_id AND im.user_id = auth.uid() AND im.role = 'institution_admin'));

CREATE POLICY "Inst admins manage features" ON public.whitelabel_features FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.institution_members im WHERE im.institution_id = whitelabel_features.institution_id AND im.user_id = auth.uid() AND im.role IN ('institution_admin', 'teacher')));

CREATE POLICY "Inst admins view contracts" ON public.whitelabel_contracts FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.institution_members im WHERE im.institution_id = whitelabel_contracts.institution_id AND im.user_id = auth.uid() AND im.role = 'institution_admin'));

CREATE POLICY "Inst admins view api_keys" ON public.institution_api_keys FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.institution_members im WHERE im.institution_id = institution_api_keys.institution_id AND im.user_id = auth.uid() AND im.role = 'institution_admin'));

CREATE POLICY "Inst admins view audit" ON public.institution_audit_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.institution_members im WHERE im.institution_id = institution_audit_logs.institution_id AND im.user_id = auth.uid() AND im.role = 'institution_admin'));

-- Triggers
CREATE TRIGGER update_whitelabel_branding_updated_at BEFORE UPDATE ON public.whitelabel_branding FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_whitelabel_domains_updated_at BEFORE UPDATE ON public.whitelabel_domains FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_whitelabel_features_updated_at BEFORE UPDATE ON public.whitelabel_features FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_whitelabel_contracts_updated_at BEFORE UPDATE ON public.whitelabel_contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_whitelabel_domains_domain ON public.whitelabel_domains(domain);
CREATE INDEX idx_whitelabel_features_inst ON public.whitelabel_features(institution_id);
CREATE INDEX idx_whitelabel_contracts_inst ON public.whitelabel_contracts(institution_id);
CREATE INDEX idx_inst_api_keys_inst ON public.institution_api_keys(institution_id);
CREATE INDEX idx_inst_audit_inst ON public.institution_audit_logs(institution_id);
CREATE INDEX idx_inst_audit_created ON public.institution_audit_logs(created_at DESC);
