
-- Performance indexes for scalability (millions of users)

-- Profiles: common lookups
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON public.profiles (is_banned) WHERE is_banned = true;
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON public.profiles (display_name text_pattern_ops);

-- Study logs: time-range queries and user aggregation
CREATE INDEX IF NOT EXISTS idx_study_logs_user_created ON public.study_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_logs_created_at ON public.study_logs (created_at DESC);

-- Rank predictions: leaderboard queries
CREATE INDEX IF NOT EXISTS idx_rank_predictions_user_recorded ON public.rank_predictions (user_id, recorded_at DESC);

-- Model predictions: dashboard counts
CREATE INDEX IF NOT EXISTS idx_model_predictions_created_at ON public.model_predictions (created_at DESC);

-- User subscriptions: plan lookups
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status ON public.user_subscriptions (user_id, status);

-- Admin audit logs: time-ordered admin views
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.admin_audit_logs (created_at DESC);

-- Topics: memory engine queries
CREATE INDEX IF NOT EXISTS idx_topics_user_deleted ON public.topics (user_id, deleted_at);

-- User roles: admin lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles (user_id);
