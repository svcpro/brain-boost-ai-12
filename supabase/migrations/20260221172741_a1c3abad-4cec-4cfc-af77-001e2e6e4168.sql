
-- ═══════════════════════════════════════════════
-- ACRY V6.0: AI Exam Operating System
-- ═══════════════════════════════════════════════

-- 1. Institutions table
CREATE TABLE public.institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'coaching', -- coaching, school, university, enterprise
  logo_url TEXT,
  primary_color TEXT DEFAULT '#6366f1',
  secondary_color TEXT DEFAULT '#8b5cf6',
  domain TEXT, -- custom domain for white-label
  admin_user_id UUID NOT NULL, -- institution creator/owner
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  student_count INTEGER DEFAULT 0,
  teacher_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage institutions" ON public.institutions
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Institution admin can view own" ON public.institutions
  FOR SELECT USING (admin_user_id = auth.uid());

-- 2. Institution members (students & teachers)
CREATE TABLE public.institution_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'student', -- student, teacher, institution_admin
  joined_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  UNIQUE(institution_id, user_id)
);

ALTER TABLE public.institution_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage institution members" ON public.institution_members
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Institution admin can manage members" ON public.institution_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.institutions i
      WHERE i.id = institution_id AND i.admin_user_id = auth.uid()
    )
  );

CREATE POLICY "Members can view own membership" ON public.institution_members
  FOR SELECT USING (user_id = auth.uid());

-- 3. Webhook endpoints for enterprise API
CREATE TABLE public.webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL, -- HMAC signing secret
  events TEXT[] NOT NULL DEFAULT '{}', -- session_completed, score_changed, topic_mastered, etc.
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  last_status_code INTEGER,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage webhooks" ON public.webhook_endpoints
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Institution admin can manage own webhooks" ON public.webhook_endpoints
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.institutions i
      WHERE i.id = institution_id AND i.admin_user_id = auth.uid()
    )
  );

-- 4. Webhook delivery logs
CREATE TABLE public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status_code INTEGER,
  response_body TEXT,
  delivered_at TIMESTAMPTZ DEFAULT now(),
  latency_ms INTEGER
);

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook deliveries" ON public.webhook_deliveries
  FOR SELECT USING (public.is_admin(auth.uid()));

-- 5. Teacher practice sets
CREATE TABLE public.teacher_practice_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID NOT NULL,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  topics TEXT[] DEFAULT '{}',
  difficulty TEXT DEFAULT 'mixed', -- easy, medium, hard, mixed, adaptive
  question_count INTEGER DEFAULT 10,
  questions JSONB DEFAULT '[]',
  ai_generated BOOLEAN DEFAULT false,
  assigned_to UUID[] DEFAULT '{}', -- student user_ids
  due_date TIMESTAMPTZ,
  status TEXT DEFAULT 'draft', -- draft, published, archived
  avg_score NUMERIC,
  completion_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.teacher_practice_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage own sets" ON public.teacher_practice_sets
  FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "Students can view assigned sets" ON public.teacher_practice_sets
  FOR SELECT USING (auth.uid() = ANY(assigned_to) AND status = 'published');

CREATE POLICY "Admins can manage all sets" ON public.teacher_practice_sets
  FOR ALL USING (public.is_admin(auth.uid()));

-- 6. Practice set submissions
CREATE TABLE public.practice_set_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_set_id UUID REFERENCES public.teacher_practice_sets(id) ON DELETE CASCADE NOT NULL,
  student_id UUID NOT NULL,
  answers JSONB DEFAULT '[]',
  score NUMERIC,
  time_spent_minutes INTEGER,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  graded_at TIMESTAMPTZ,
  feedback JSONB
);

ALTER TABLE public.practice_set_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can manage own submissions" ON public.practice_set_submissions
  FOR ALL USING (student_id = auth.uid());

CREATE POLICY "Teachers can view submissions for their sets" ON public.practice_set_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.teacher_practice_sets ps
      WHERE ps.id = practice_set_id AND ps.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all submissions" ON public.practice_set_submissions
  FOR ALL USING (public.is_admin(auth.uid()));

-- 7. Device sessions for multi-device sync
CREATE TABLE public.device_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  device_id TEXT NOT NULL,
  device_name TEXT,
  device_type TEXT DEFAULT 'web', -- web, tablet, desktop, mobile
  last_active_at TIMESTAMPTZ DEFAULT now(),
  is_current BOOLEAN DEFAULT false,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, device_id)
);

ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own device sessions" ON public.device_sessions
  FOR ALL USING (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_institution_members_user ON public.institution_members(user_id);
CREATE INDEX idx_institution_members_inst ON public.institution_members(institution_id);
CREATE INDEX idx_webhook_endpoints_inst ON public.webhook_endpoints(institution_id);
CREATE INDEX idx_webhook_deliveries_webhook ON public.webhook_deliveries(webhook_id);
CREATE INDEX idx_teacher_sets_inst ON public.teacher_practice_sets(institution_id);
CREATE INDEX idx_teacher_sets_teacher ON public.teacher_practice_sets(teacher_id);
CREATE INDEX idx_submissions_set ON public.practice_set_submissions(practice_set_id);
CREATE INDEX idx_device_sessions_user ON public.device_sessions(user_id);

-- Triggers for updated_at
CREATE TRIGGER update_institutions_updated_at BEFORE UPDATE ON public.institutions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_webhook_endpoints_updated_at BEFORE UPDATE ON public.webhook_endpoints FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_teacher_practice_sets_updated_at BEFORE UPDATE ON public.teacher_practice_sets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for device sync
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_sessions;
