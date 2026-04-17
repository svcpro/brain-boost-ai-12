-- Add buttons column to whatsapp_meta_templates for URL/CTA buttons
ALTER TABLE public.whatsapp_meta_templates
ADD COLUMN IF NOT EXISTS buttons jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.whatsapp_meta_templates.buttons IS 'Array of button objects: [{ type: "URL"|"PHONE_NUMBER"|"QUICK_REPLY", text: string, url?: string, phone_number?: string, example?: string[] }]';

-- Seed URL buttons for the existing 12 production templates so each one has a clickable CTA
UPDATE public.whatsapp_meta_templates SET buttons = '[
  {"type":"URL","text":"Resume Streak","url":"https://acry.ai/action","example":["action"]}
]'::jsonb WHERE template_name = 'streak_break';

UPDATE public.whatsapp_meta_templates SET buttons = '[
  {"type":"URL","text":"Open Exam Plan","url":"https://acry.ai/home","example":["home"]}
]'::jsonb WHERE template_name = 'exam_countdown';

UPDATE public.whatsapp_meta_templates SET buttons = '[
  {"type":"URL","text":"Revise Now","url":"https://acry.ai/brain","example":["brain"]}
]'::jsonb WHERE template_name = 'memory_decay';

UPDATE public.whatsapp_meta_templates SET buttons = '[
  {"type":"URL","text":"Start Mission","url":"https://acry.ai/action","example":["action"]}
]'::jsonb WHERE template_name = 'daily_mission';

UPDATE public.whatsapp_meta_templates SET buttons = '[
  {"type":"URL","text":"View Result","url":"https://acry.ai/sureshot","example":["sureshot"]}
]'::jsonb WHERE template_name = 'mock_test_result';

UPDATE public.whatsapp_meta_templates SET buttons = '[
  {"type":"URL","text":"Join Rank War","url":"https://acry.ai/sureshot","example":["sureshot"]}
]'::jsonb WHERE template_name = 'rank_war';

UPDATE public.whatsapp_meta_templates SET buttons = '[
  {"type":"URL","text":"Renew Now","url":"https://acry.ai/you","example":["you"]}
]'::jsonb WHERE template_name = 'subscription_expiry';

UPDATE public.whatsapp_meta_templates SET buttons = '[
  {"type":"URL","text":"Upgrade to Premium","url":"https://acry.ai/you","example":["you"]}
]'::jsonb WHERE template_name = 'trial_ending';

UPDATE public.whatsapp_meta_templates SET buttons = '[
  {"type":"URL","text":"Open ACRY","url":"https://acry.ai/home","example":["home"]}
]'::jsonb WHERE template_name = 'welcome_message';

-- OTP templates do not allow URL buttons per Meta policy → keep empty
UPDATE public.whatsapp_meta_templates SET buttons = '[]'::jsonb WHERE template_name = 'otp_verification';

UPDATE public.whatsapp_meta_templates SET buttons = '[
  {"type":"URL","text":"Come Back","url":"https://acry.ai/home","example":["home"]}
]'::jsonb WHERE template_name = 'inactivity_reminder';

UPDATE public.whatsapp_meta_templates SET buttons = '[
  {"type":"URL","text":"View Full Report","url":"https://acry.ai/brain","example":["brain"]}
]'::jsonb WHERE template_name = 'weekly_brain_report';