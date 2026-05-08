-- 1) Commission rate on institutions (0..1)
ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS commission_rate numeric(5,4) NOT NULL DEFAULT 0.20;

-- 2) Commissions ledger
CREATE TABLE IF NOT EXISTS public.institution_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  subscription_id uuid NOT NULL,
  source text,
  gross_amount numeric(12,2) NOT NULL DEFAULT 0,
  commission_rate numeric(5,4) NOT NULL DEFAULT 0.20,
  commission_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'pending', -- pending | approved | paid | reversed
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  notes text,
  UNIQUE (subscription_id)
);

CREATE INDEX IF NOT EXISTS idx_inst_commissions_inst
  ON public.institution_commissions (institution_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inst_commissions_status
  ON public.institution_commissions (institution_id, status);

ALTER TABLE public.institution_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage all commissions" ON public.institution_commissions;
CREATE POLICY "Admins manage all commissions"
ON public.institution_commissions
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Institute admin can view own commissions" ON public.institution_commissions;
CREATE POLICY "Institute admin can view own commissions"
ON public.institution_commissions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.institutions i
    WHERE i.id = institution_commissions.institution_id
      AND i.admin_user_id = auth.uid()
  )
);

-- 3) Recording function (idempotent via UNIQUE on subscription_id)
CREATE OR REPLACE FUNCTION public.record_referral_commission(p_subscription_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub record;
  v_member record;
  v_inst record;
  v_amount numeric(12,2);
  v_commission numeric(12,2);
BEGIN
  SELECT id, user_id, amount, currency, status, is_trial
    INTO v_sub
    FROM public.user_subscriptions
    WHERE id = p_subscription_id;

  IF NOT FOUND THEN RETURN; END IF;
  IF v_sub.status <> 'active' THEN RETURN; END IF;
  IF COALESCE(v_sub.is_trial, false) THEN RETURN; END IF;
  IF COALESCE(v_sub.amount, 0) <= 0 THEN RETURN; END IF;

  SELECT institution_id, source
    INTO v_member
    FROM public.institution_members
    WHERE user_id = v_sub.user_id
      AND role = 'student'
      AND is_active = true
    ORDER BY joined_at ASC
    LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT id, commission_rate INTO v_inst FROM public.institutions WHERE id = v_member.institution_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_amount := v_sub.amount::numeric;
  v_commission := round(v_amount * COALESCE(v_inst.commission_rate, 0.20), 2);

  INSERT INTO public.institution_commissions (
    institution_id, user_id, subscription_id, source,
    gross_amount, commission_rate, commission_amount, currency, status
  ) VALUES (
    v_inst.id, v_sub.user_id, v_sub.id, COALESCE(v_member.source, 'direct'),
    v_amount, COALESCE(v_inst.commission_rate, 0.20), v_commission, COALESCE(v_sub.currency, 'INR'), 'pending'
  )
  ON CONFLICT (subscription_id) DO NOTHING;
END;
$$;

-- 4) Trigger: when subscription becomes a paid active one, record commission
CREATE OR REPLACE FUNCTION public.trg_record_referral_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' AND COALESCE(NEW.is_trial, false) = false AND COALESCE(NEW.amount, 0) > 0 THEN
    PERFORM public.record_referral_commission(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_subscriptions_commission ON public.user_subscriptions;
CREATE TRIGGER trg_user_subscriptions_commission
AFTER INSERT OR UPDATE OF status, amount, is_trial
ON public.user_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.trg_record_referral_commission();

-- 5) Backfill: record commissions for existing eligible subscriptions
INSERT INTO public.institution_commissions (
  institution_id, user_id, subscription_id, source,
  gross_amount, commission_rate, commission_amount, currency, status
)
SELECT
  im.institution_id,
  s.user_id,
  s.id,
  COALESCE(im.source, 'direct'),
  s.amount::numeric,
  i.commission_rate,
  round(s.amount::numeric * i.commission_rate, 2),
  COALESCE(s.currency, 'INR'),
  'pending'
FROM public.user_subscriptions s
JOIN public.institution_members im
  ON im.user_id = s.user_id AND im.role = 'student' AND im.is_active = true
JOIN public.institutions i ON i.id = im.institution_id
WHERE s.status = 'active'
  AND COALESCE(s.is_trial, false) = false
  AND COALESCE(s.amount, 0) > 0
ON CONFLICT (subscription_id) DO NOTHING;