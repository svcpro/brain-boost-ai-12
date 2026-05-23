DROP POLICY IF EXISTS "Admins can view ambassador applications" ON public.campus_ambassador_applications;
DROP POLICY IF EXISTS "Admins can update ambassador applications" ON public.campus_ambassador_applications;

CREATE POLICY "Admins can view ambassador applications"
ON public.campus_ambassador_applications FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update ambassador applications"
ON public.campus_ambassador_applications FOR UPDATE
USING (public.is_admin(auth.uid()));

-- Apply same fix to ambassador_profiles & related admin-visible tables
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['ambassador_profiles','ambassador_missions','ambassador_mission_submissions','ambassador_referrals','ambassador_workshops','ambassador_events','ambassador_event_rsvps','ambassador_rewards','ambassador_reward_claims','ambassador_certificates','ambassador_community_posts','ambassador_post_reactions','ambassador_training_modules','ambassador_module_progress','ambassador_founder_updates'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admins manage %1$s" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "Admins manage %1$s" ON public.%1$s FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()))', t);
  END LOOP;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;