
INSERT INTO public.feature_flags (flag_key, label, enabled) VALUES
  ('you_notif_study_reminders', 'Study Reminders', true),
  ('you_notif_push', 'Push Notifications', true),
  ('you_notif_history', 'Notification History', true),
  ('you_notif_email', 'Email Notifications', true),
  ('you_notif_sound', 'Sound & Haptics', true),
  ('you_notif_voice', 'Voice Notifications', true)
ON CONFLICT (flag_key) DO NOTHING;
