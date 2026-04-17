
-- Meta WhatsApp Business approved templates registry
CREATE TABLE IF NOT EXISTS public.whatsapp_meta_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  category text NOT NULL DEFAULT 'UTILITY',  -- UTILITY | MARKETING | AUTHENTICATION
  language text NOT NULL DEFAULT 'en',
  namespace text,
  header_type text DEFAULT 'NONE',           -- NONE | TEXT | IMAGE | VIDEO | DOCUMENT
  header_content text,
  body_text text NOT NULL,
  footer_text text,
  buttons jsonb DEFAULT '[]'::jsonb,
  variables jsonb DEFAULT '[]'::jsonb,        -- example: [{"key":"name","example":"John"}]
  sample_values jsonb DEFAULT '{}'::jsonb,
  approval_status text NOT NULL DEFAULT 'pending', -- pending | submitted | approved | rejected | paused
  approved_at timestamptz,
  rejection_reason text,
  meta_template_id text,                       -- ID returned by Meta after approval
  msg91_template_id text,                      -- mapped MSG91 template id
  use_case text,                               -- e.g. "streak_break", "exam_countdown"
  quality_score text,                          -- GREEN | YELLOW | RED
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_meta_templates_status ON public.whatsapp_meta_templates(approval_status);
CREATE INDEX IF NOT EXISTS idx_wa_meta_templates_category ON public.whatsapp_meta_templates(category);

ALTER TABLE public.whatsapp_meta_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read meta templates"
  ON public.whatsapp_meta_templates FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage meta templates"
  ON public.whatsapp_meta_templates FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER set_wa_meta_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_meta_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed all current notification template categories required for Meta approval
INSERT INTO public.whatsapp_meta_templates
  (template_name, display_name, category, language, header_type, body_text, footer_text, variables, use_case, approval_status)
VALUES
  ('streak_break_alert', 'Streak Break Alert', 'UTILITY', 'en', 'TEXT',
   'Hi {{1}}, your {{2}}-day study streak is at risk! Open ACRY now to keep it alive. ⚡',
   'ACRY · Brain Performance',
   '[{"key":"name","example":"Santosh"},{"key":"streak_days","example":"7"}]'::jsonb,
   'streak_break', 'pending'),
  ('exam_countdown', 'Exam Countdown', 'UTILITY', 'en', 'TEXT',
   'Hi {{1}}, only {{2}} days left for {{3}}. Today''s focus topic: {{4}}.',
   'ACRY · Exam Prep',
   '[{"key":"name","example":"Santosh"},{"key":"days_left","example":"45"},{"key":"exam_name","example":"NEET UG"},{"key":"focus_topic","example":"Thermodynamics"}]'::jsonb,
   'exam_countdown', 'pending'),
  ('memory_decay_alert', 'Memory Decay Alert', 'UTILITY', 'en', 'TEXT',
   'Hi {{1}}, your memory for {{2}} dropped to {{3}}%. Quick 3-min revision can save it!',
   'ACRY · Decay Shield',
   '[{"key":"name","example":"Santosh"},{"key":"topic","example":"Newton''s Laws"},{"key":"memory_score","example":"42"}]'::jsonb,
   'memory_decay', 'pending'),
  ('daily_mission_reminder', 'Daily Mission Reminder', 'UTILITY', 'en', 'TEXT',
   'Hi {{1}}, your mission today: {{2}}. Estimated time: {{3}} mins. Tap to begin.',
   'ACRY · Today''s Mission',
   '[{"key":"name","example":"Santosh"},{"key":"mission_title","example":"Master Optics"},{"key":"duration","example":"25"}]'::jsonb,
   'daily_mission', 'pending'),
  ('mock_test_result', 'Mock Test Result', 'UTILITY', 'en', 'TEXT',
   'Hi {{1}}, your {{2}} mock score: {{3}}/{{4}}. Predicted rank: {{5}}. View full analysis in app.',
   'ACRY · Mock Analysis',
   '[{"key":"name","example":"Santosh"},{"key":"mock_name","example":"NEET Mock 12"},{"key":"score","example":"540"},{"key":"total","example":"720"},{"key":"rank","example":"2,341"}]'::jsonb,
   'mock_result', 'pending'),
  ('rank_war_invite', 'Rank War Invite', 'MARKETING', 'en', 'TEXT',
   'Hi {{1}}, you''re invited to a Rank War with {{2}}! Battle starts in {{3}} mins.',
   'ACRY · Rank War',
   '[{"key":"name","example":"Santosh"},{"key":"opponent","example":"Aarti"},{"key":"start_in","example":"15"}]'::jsonb,
   'rank_war', 'pending'),
  ('subscription_expiry', 'Subscription Expiry Warning', 'UTILITY', 'en', 'TEXT',
   'Hi {{1}}, your ACRY Premium expires in {{2}} days. Renew at ₹149 to keep your streak & analytics.',
   'ACRY · Subscription',
   '[{"key":"name","example":"Santosh"},{"key":"days_left","example":"3"}]'::jsonb,
   'subscription_expiry', 'pending'),
  ('trial_ending', 'Trial Ending', 'UTILITY', 'en', 'TEXT',
   'Hi {{1}}, your 15-day free trial ends in {{2}} days. Upgrade now to keep all features.',
   'ACRY · Trial',
   '[{"key":"name","example":"Santosh"},{"key":"days_left","example":"2"}]'::jsonb,
   'trial_ending', 'pending'),
  ('welcome_message', 'Welcome Message', 'UTILITY', 'en', 'TEXT',
   'Welcome to ACRY, {{1}}! Your AI study brain is ready. Target exam: {{2}}. Tap to start.',
   'ACRY · Welcome',
   '[{"key":"name","example":"Santosh"},{"key":"exam","example":"NEET UG"}]'::jsonb,
   'welcome', 'pending'),
  ('otp_verification', 'OTP Verification', 'AUTHENTICATION', 'en', 'NONE',
   '{{1}} is your ACRY verification code. Valid for 10 minutes. Do not share with anyone.',
   NULL,
   '[{"key":"otp","example":"123456"}]'::jsonb,
   'otp', 'approved'),
  ('inactivity_reengagement', 'Inactivity Re-engagement', 'MARKETING', 'en', 'TEXT',
   'Hi {{1}}, we miss you! It''s been {{2}} days. Your topics are decaying — come back & recover.',
   'ACRY · Re-engagement',
   '[{"key":"name","example":"Santosh"},{"key":"days_inactive","example":"5"}]'::jsonb,
   'inactivity', 'pending'),
  ('weekly_brain_report', 'Weekly Brain Report', 'UTILITY', 'en', 'TEXT',
   'Hi {{1}}, your weekly brain report: {{2}} topics mastered, rank moved by {{3}}. View details.',
   'ACRY · Weekly Report',
   '[{"key":"name","example":"Santosh"},{"key":"topics_mastered","example":"12"},{"key":"rank_change","example":"+340"}]'::jsonb,
   'weekly_report', 'pending')
ON CONFLICT (template_name) DO NOTHING;
