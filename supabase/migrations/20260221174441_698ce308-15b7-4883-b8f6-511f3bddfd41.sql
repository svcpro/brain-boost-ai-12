
-- ═══════════════════════════════════════════════════
-- ACRY v6.0 Multi-Tenant Institutional System
-- ═══════════════════════════════════════════════════

-- 1. Institution Batches (Classes)
CREATE TABLE public.institution_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  academic_year TEXT,
  start_date DATE,
  end_date DATE,
  max_students INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Batch-Student Assignment
CREATE TABLE public.batch_students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.institution_batches(id) ON DELETE CASCADE,
  student_user_id UUID NOT NULL,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  roll_number TEXT,
  UNIQUE(batch_id, student_user_id)
);

-- 3. Institution Licenses
CREATE TABLE public.institution_licenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL DEFAULT 'starter',
  max_students INTEGER NOT NULL DEFAULT 50,
  price_per_student NUMERIC(10,2) NOT NULL DEFAULT 99.00,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  status TEXT NOT NULL DEFAULT 'active',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  auto_renew BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Institution Invoices
CREATE TABLE public.institution_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  license_id UUID REFERENCES public.institution_licenses(id),
  invoice_number TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'pending',
  student_count INTEGER NOT NULL DEFAULT 0,
  billing_period_start DATE,
  billing_period_end DATE,
  paid_at TIMESTAMPTZ,
  razorpay_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Batch Analytics Snapshots (cached)
CREATE TABLE public.batch_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.institution_batches(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  avg_score NUMERIC(5,2),
  avg_memory_strength NUMERIC(5,2),
  active_students INTEGER DEFAULT 0,
  dropout_risk_count INTEGER DEFAULT 0,
  top_weak_topics JSONB DEFAULT '[]',
  subject_distribution JSONB DEFAULT '{}',
  rank_projection JSONB DEFAULT '{}',
  stability_heatmap JSONB DEFAULT '{}',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(batch_id, snapshot_date)
);

-- 6. Faculty members linked to batches
CREATE TABLE public.faculty_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.institution_batches(id) ON DELETE CASCADE,
  faculty_user_id UUID NOT NULL,
  subject TEXT,
  is_primary BOOLEAN DEFAULT false,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(batch_id, faculty_user_id)
);

-- Add student_limit and license fields to institutions
ALTER TABLE public.institutions 
  ADD COLUMN IF NOT EXISTS max_students INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS license_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS license_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS branch TEXT;

-- ═══════════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════════

ALTER TABLE public.institution_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty_assignments ENABLE ROW LEVEL SECURITY;

-- Admins can manage all
CREATE POLICY "Admins full access on batches" ON public.institution_batches FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins full access on batch_students" ON public.batch_students FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins full access on licenses" ON public.institution_licenses FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins full access on invoices" ON public.institution_invoices FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins full access on batch_analytics" ON public.batch_analytics FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins full access on faculty_assignments" ON public.faculty_assignments FOR ALL USING (public.is_admin(auth.uid()));

-- Institution admins can manage their own institution data
CREATE POLICY "Inst admins manage batches" ON public.institution_batches FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.institution_members im WHERE im.institution_id = institution_batches.institution_id AND im.user_id = auth.uid() AND im.role = 'institution_admin'));

CREATE POLICY "Inst admins manage batch_students" ON public.batch_students FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.institution_batches ib JOIN public.institution_members im ON im.institution_id = ib.institution_id WHERE ib.id = batch_students.batch_id AND im.user_id = auth.uid() AND im.role = 'institution_admin'));

CREATE POLICY "Inst admins view licenses" ON public.institution_licenses FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.institution_members im WHERE im.institution_id = institution_licenses.institution_id AND im.user_id = auth.uid() AND im.role = 'institution_admin'));

CREATE POLICY "Inst admins view invoices" ON public.institution_invoices FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.institution_members im WHERE im.institution_id = institution_invoices.institution_id AND im.user_id = auth.uid() AND im.role = 'institution_admin'));

CREATE POLICY "Inst admins view analytics" ON public.batch_analytics FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.institution_members im WHERE im.institution_id = batch_analytics.institution_id AND im.user_id = auth.uid() AND im.role IN ('institution_admin', 'teacher')));

CREATE POLICY "Faculty view own assignments" ON public.faculty_assignments FOR SELECT 
  USING (faculty_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.institution_members im WHERE im.institution_id = faculty_assignments.institution_id AND im.user_id = auth.uid() AND im.role = 'institution_admin'));

-- Triggers
CREATE TRIGGER update_institution_batches_updated_at BEFORE UPDATE ON public.institution_batches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_institution_licenses_updated_at BEFORE UPDATE ON public.institution_licenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_batch_students_batch ON public.batch_students(batch_id);
CREATE INDEX idx_batch_students_student ON public.batch_students(student_user_id);
CREATE INDEX idx_batch_analytics_batch_date ON public.batch_analytics(batch_id, snapshot_date);
CREATE INDEX idx_institution_invoices_inst ON public.institution_invoices(institution_id);
CREATE INDEX idx_faculty_assignments_batch ON public.faculty_assignments(batch_id);
