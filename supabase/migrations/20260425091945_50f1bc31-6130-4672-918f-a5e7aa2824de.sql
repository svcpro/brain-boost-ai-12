DELETE FROM public.sms_event_registry
WHERE event_key IN (
  'email_verified',
  'password_changed',
  'suspicious_activity',
  'feature_announcement',
  'test_completed',
  'user_signup',
  'badge_earned',
  'refund_processed',
  'plan_downgraded',
  'plan_upgraded'
);