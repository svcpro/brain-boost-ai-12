
-- SEO Pages table
CREATE TABLE public.seo_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_url TEXT NOT NULL UNIQUE,
  page_type TEXT NOT NULL DEFAULT 'landing',
  meta_title TEXT,
  meta_description TEXT,
  meta_keywords TEXT[],
  canonical_url TEXT,
  robots_index BOOLEAN NOT NULL DEFAULT true,
  robots_follow BOOLEAN NOT NULL DEFAULT true,
  og_title TEXT,
  og_description TEXT,
  og_image TEXT,
  twitter_title TEXT,
  twitter_description TEXT,
  twitter_image TEXT,
  schema_markup_json JSONB DEFAULT '{}',
  seo_score INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.seo_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage seo_pages" ON public.seo_pages FOR ALL USING (is_admin(auth.uid()));

-- SEO Keywords table
CREATE TABLE public.seo_keywords (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword TEXT NOT NULL,
  search_volume INTEGER DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'medium',
  target_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.seo_keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage seo_keywords" ON public.seo_keywords FOR ALL USING (is_admin(auth.uid()));

-- SEO Redirects table
CREATE TABLE public.seo_redirects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_url TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  redirect_type TEXT NOT NULL DEFAULT '301',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.seo_redirects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage seo_redirects" ON public.seo_redirects FOR ALL USING (is_admin(auth.uid()));

-- SEO Sitemap table
CREATE TABLE public.seo_sitemap (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_url TEXT NOT NULL UNIQUE,
  last_modified TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  priority NUMERIC NOT NULL DEFAULT 0.5,
  change_frequency TEXT NOT NULL DEFAULT 'weekly'
);
ALTER TABLE public.seo_sitemap ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage seo_sitemap" ON public.seo_sitemap FOR ALL USING (is_admin(auth.uid()));

-- SEO AI Suggestions table
CREATE TABLE public.seo_ai_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id UUID REFERENCES public.seo_pages(id) ON DELETE CASCADE,
  page_url TEXT NOT NULL,
  suggested_meta_title TEXT,
  suggested_meta_description TEXT,
  suggested_keywords TEXT[],
  suggested_schema JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.seo_ai_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage seo_ai_suggestions" ON public.seo_ai_suggestions FOR ALL USING (is_admin(auth.uid()));

-- SEO Analytics table
CREATE TABLE public.seo_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_url TEXT NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  ranking_position NUMERIC,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.seo_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage seo_analytics" ON public.seo_analytics FOR ALL USING (is_admin(auth.uid()));

-- Add SEO permissions
INSERT INTO public.role_permissions (role, permission_key, permission_label, category, enabled) VALUES
  ('super_admin', 'seo.view', 'View SEO Dashboard', 'SEO Management', true),
  ('super_admin', 'seo.manage_pages', 'Manage SEO Pages', 'SEO Management', true),
  ('super_admin', 'seo.manage_keywords', 'Manage Keywords', 'SEO Management', true),
  ('super_admin', 'seo.manage_redirects', 'Manage Redirects', 'SEO Management', true),
  ('super_admin', 'seo.manage_sitemap', 'Manage Sitemap', 'SEO Management', true),
  ('super_admin', 'seo.manage_schema', 'Manage Schema Markup', 'SEO Management', true),
  ('super_admin', 'seo.ai_suggestions', 'Use AI SEO Suggestions', 'SEO Management', true),
  ('admin', 'seo.view', 'View SEO Dashboard', 'SEO Management', true),
  ('admin', 'seo.manage_pages', 'Manage SEO Pages', 'SEO Management', true),
  ('admin', 'seo.manage_keywords', 'Manage Keywords', 'SEO Management', true),
  ('admin', 'seo.manage_redirects', 'Manage Redirects', 'SEO Management', true),
  ('admin', 'seo.manage_sitemap', 'Manage Sitemap', 'SEO Management', true),
  ('admin', 'seo.manage_schema', 'Manage Schema Markup', 'SEO Management', true),
  ('admin', 'seo.ai_suggestions', 'Use AI SEO Suggestions', 'SEO Management', true);

-- Updated at trigger for seo_pages
CREATE TRIGGER update_seo_pages_updated_at BEFORE UPDATE ON public.seo_pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
