
INSERT INTO public.feature_flags (flag_key, label, enabled) VALUES
  ('you_data_ml_panel', 'ML Control Panel', true),
  ('you_data_trash', 'Trash', true),
  ('you_data_backup', 'Data Backup', true),
  ('you_data_privacy', 'Privacy & Security', true)
ON CONFLICT (flag_key) DO NOTHING;
