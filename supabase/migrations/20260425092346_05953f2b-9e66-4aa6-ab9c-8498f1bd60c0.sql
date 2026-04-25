-- Set variable_map to identity-match each template's actual body placeholders.
-- Engine resolves by looking up data[key]; identity mapping means the data payload
-- key === template placeholder, which matches what sms-broadcast-test-all and
-- production callers already produce.

UPDATE public.sms_event_registry SET variable_map = '{"name":"name","topic":"topic","link":"link"}'::jsonb WHERE event_key = 'emergency_revision';
UPDATE public.sms_event_registry SET variable_map = '{"name":"name","topic":"topic","link":"link"}'::jsonb WHERE event_key = 'study_reminder';

-- auth_account_locked body uses ##url##
UPDATE public.sms_event_registry SET variable_map = '{"url":"url"}'::jsonb WHERE event_key = 'account_locked';

UPDATE public.sms_event_registry SET variable_map = '{"device":"device","time":"time","link":"link"}'::jsonb WHERE event_key = 'login_detected';

-- auth_security_alert body only has {{link}}
UPDATE public.sms_event_registry SET variable_map = '{"link":"link"}'::jsonb WHERE event_key = 'mobile_verified';

UPDATE public.sms_event_registry SET variable_map = '{"name":"name","stability":"stability","link":"link"}'::jsonb WHERE event_key = 'daily_brief_generated';
UPDATE public.sms_event_registry SET variable_map = '{"name":"name","days":"days","link":"link"}'::jsonb WHERE event_key = 'comeback_user';
UPDATE public.sms_event_registry SET variable_map = '{"name":"name","days":"days","hours":"hours","link":"link"}'::jsonb WHERE event_key = 'streak_risk';
UPDATE public.sms_event_registry SET variable_map = '{"name":"name","days":"days","link":"link"}'::jsonb WHERE event_key = 'final_streak_save';
UPDATE public.sms_event_registry SET variable_map = '{"name":"name","friend":"friend","exam":"exam","link":"link"}'::jsonb WHERE event_key = 'friend_joined';
UPDATE public.sms_event_registry SET variable_map = '{"name":"name","exam":"exam","positions":"positions","rank":"rank","link":"link"}'::jsonb WHERE event_key = 'leaderboard_climb';
UPDATE public.sms_event_registry SET variable_map = '{"name":"name","points":"points","link":"link"}'::jsonb WHERE event_key = 'rank_drop';
UPDATE public.sms_event_registry SET variable_map = '{"name":"name","questions":"questions","accuracy":"accuracy","rank":"rank","link":"link"}'::jsonb WHERE event_key = 'weekly_summary_ready';
UPDATE public.sms_event_registry SET variable_map = '{"name":"name","days":"days","exam":"exam","link":"link"}'::jsonb WHERE event_key = 'exam_countdown';
UPDATE public.sms_event_registry SET variable_map = '{"name":"name","exam":"exam","link":"link"}'::jsonb WHERE event_key = 'exam_today';
UPDATE public.sms_event_registry SET variable_map = '{"name":"name","exam":"exam","time":"time","link":"link"}'::jsonb WHERE event_key = 'mock_test_due';
UPDATE public.sms_event_registry SET variable_map = '{"name":"name","topic":"topic","strength":"strength","link":"link"}'::jsonb WHERE event_key = 'weak_topic_detected';
UPDATE public.sms_event_registry SET variable_map = '{"amount":"amount","link":"link"}'::jsonb WHERE event_key = 'invoice_generated';
UPDATE public.sms_event_registry SET variable_map = '{"name":"name","milestone":"milestone","link":"link"}'::jsonb WHERE event_key = 'milestone_unlocked';
UPDATE public.sms_event_registry SET variable_map = '{"amount":"amount","link":"link"}'::jsonb WHERE event_key = 'payment_failed';
UPDATE public.sms_event_registry SET variable_map = '{"amount":"amount","expiry":"expiry","link":"link"}'::jsonb WHERE event_key = 'payment_success';
UPDATE public.sms_event_registry SET variable_map = '{"name":"name","friend":"friend","reward":"reward","link":"link"}'::jsonb WHERE event_key = 'referral_reward';
UPDATE public.sms_event_registry SET variable_map = '{"days":"days","link":"link"}'::jsonb WHERE event_key = 'subscription_expiring';
UPDATE public.sms_event_registry SET variable_map = '{"days":"days","link":"link"}'::jsonb WHERE event_key = 'trial_ending';