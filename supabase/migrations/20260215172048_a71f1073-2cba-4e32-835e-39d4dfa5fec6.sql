
-- Add unique constraint on flag_key to prevent duplicates
ALTER TABLE public.feature_flags ADD CONSTRAINT feature_flags_flag_key_unique UNIQUE (flag_key);

-- Seed section-level feature flags for all tabs
INSERT INTO public.feature_flags (flag_key, enabled, label) VALUES
-- Home Tab Sections
('home_brain_health', true, 'Brain Health Badge'),
('home_brain_missions', true, 'Brain Missions'),
('home_cognitive_embedding', true, 'Cognitive DNA'),
('home_risk_digest', true, 'Risk Digest'),
('home_daily_quote', true, 'Daily Quote'),
('home_brain_update', true, 'Brain Update Hero'),
('home_quick_start', true, 'Quick Start Study'),
('home_recently_studied', true, 'Recently Studied'),
('home_burnout_warning', true, 'Burnout Warning'),
('home_daily_goal', true, 'Daily Goal Tracker'),
('home_streak', true, 'Streak Tracker'),
('home_streak_milestone', true, 'Streak Milestone'),
('home_streak_recovery', true, 'Streak Recovery'),
('home_daily_tip', true, 'Daily Study Tip'),
('home_weekly_reminder', true, 'Weekly Reminder Summary'),
('home_study_insights', true, 'Study Insights'),
('home_forget_risk', true, 'Forget Risk Radar'),
('home_review_queue', true, 'Review Queue'),
('home_rl_policy', true, 'RL Policy Card'),
('home_recommendations', true, 'AI Recommendations'),
('home_stats', true, 'Stats Row'),
-- Action Tab Sections
('action_study_modes', true, 'Study Modes'),
('action_focus_history', true, 'Focus Session History'),
('action_study_planner', true, 'AI Study Planner'),
('action_upload', true, 'Upload Content'),
-- Brain Tab Sections
('brain_health_score', true, 'Brain Health Score'),
('brain_subjects', true, 'Subject Breakdown'),
('brain_cognitive_twin', true, 'Cognitive Twin'),
('brain_ai_agent', true, 'AI Brain Agent'),
('brain_global_intel', true, 'Global Intelligence'),
('brain_ai_performance', true, 'AI Performance'),
('brain_pipeline', true, 'Pipeline Latency'),
('brain_tools', true, 'Brain Tools'),
-- Progress Tab Sections
('progress_streak', true, 'Study Streak'),
('progress_streak_freeze', true, 'Streak Freeze'),
('progress_gifts', true, 'Freeze Gift Inbox'),
('progress_badges', true, 'Badge Gallery'),
('progress_push_notif', true, 'Push Notifications'),
('progress_weekly_report', true, 'Weekly Report'),
('progress_weekly_digest', true, 'Weekly Digest'),
('progress_consistency', true, 'Consistency Score'),
('progress_weekly_focus', true, 'Weekly Focus Chart'),
('progress_confidence', true, 'Confidence Trend'),
('progress_monthly', true, 'Monthly Charts'),
('progress_rank', true, 'Rank Prediction'),
('progress_leaderboard', true, 'Leaderboard'),
('progress_features', true, 'Advanced Features'),
('progress_exam', true, 'Exam Simulator'),
('progress_weak_questions', true, 'Weak Questions'),
-- You Tab Sections
('you_profile', true, 'Profile Card'),
('you_level_plan', true, 'Brain Level & Plan'),
('you_badges', true, 'Badge Gallery'),
('you_study_learning', true, 'Study & Learning'),
('you_notifications', true, 'Notifications'),
('you_data', true, 'Data & Privacy'),
('you_subscription', true, 'Subscription')
ON CONFLICT (flag_key) DO NOTHING;
