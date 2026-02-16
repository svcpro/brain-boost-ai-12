
INSERT INTO public.role_permissions (role, permission_key, permission_label, category, enabled)
SELECT r.role::app_role, p.permission_key, p.permission_label, 'Community Management' as category,
  CASE 
    WHEN r.role = 'super_admin' THEN true
    WHEN r.role = 'admin' THEN true
    WHEN r.role = 'support_admin' AND p.permission_key IN ('community.view', 'community.moderate', 'community.view_flags', 'community.view_audit') THEN true
    ELSE false
  END as enabled
FROM (VALUES ('super_admin'), ('admin'), ('ai_admin'), ('support_admin'), ('finance_admin'), ('api_admin')) AS r(role)
CROSS JOIN (VALUES
  ('community.view', 'View Communities'),
  ('community.manage', 'Manage Communities'),
  ('community.moderate', 'Moderate Content'),
  ('community.ban_users', 'Ban/Restrict Users'),
  ('community.view_flags', 'View Abuse Flags'),
  ('community.manage_rules', 'Manage Moderation Rules'),
  ('community.view_analytics', 'View Analytics'),
  ('community.view_audit', 'View Audit Log')
) AS p(permission_key, permission_label)
ON CONFLICT DO NOTHING;
