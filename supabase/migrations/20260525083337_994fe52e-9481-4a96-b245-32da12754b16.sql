UPDATE public.sms_templates
SET body_template = 'ACRY: Your free trial will expire in ##day## days. You can continue using your account services using ##url## . -ACRYAI',
    variables = '["day","url"]'::jsonb
WHERE name = 'you_trial_ending';

UPDATE public.sms_event_registry
SET variable_map = '{"day":"days","url":"link"}'::jsonb
WHERE event_key = 'trial_ending';