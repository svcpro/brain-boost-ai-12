INSERT INTO public.whatsapp_meta_templates
(template_name, display_name, category, language, body_text, variables, sample_values, use_case, approval_status, is_active)
VALUES
('ai_new_user_welcome', 'AI Welcome (Never Signed In)', 'MARKETING', 'en',
 'Hi {{1}}, welcome to ACRY AI! {{2}}',
 '["name","ai_body"]'::jsonb,
 '{"name":"Rahul","ai_body":"Your personalized brain is ready — log in to start your first 3-min session."}'::jsonb,
 'ai_reengagement_new_user', 'pending', true),
('ai_inactivity_nudge', 'AI Inactivity Nudge (24h / 3d)', 'MARKETING', 'en',
 'Hey {{1}}, {{2}}',
 '["name","ai_body"]'::jsonb,
 '{"name":"Rahul","ai_body":"Your memory decay starts after 48h. One 3-min session keeps your streak alive."}'::jsonb,
 'ai_reengagement_inactive', 'pending', true),
('ai_promo_reengagement', 'AI Promo Reengagement (7d)', 'MARKETING', 'en',
 '{{1}}, {{2}}',
 '["name","ai_body"]'::jsonb,
 '{"name":"Rahul","ai_body":"Your rank is slipping — come back and reclaim your topper zone today."}'::jsonb,
 'ai_reengagement_promo', 'pending', true)
ON CONFLICT (template_name) DO NOTHING;