import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Copy, Send, CheckCircle2, XCircle, ChevronDown, ChevronRight,
  Code, BookOpen, Play, Smartphone, Shield, Zap, Globe, Lock, Search,
  Download, FileJson, Terminal, Eye, EyeOff, AlertTriangle, Clock,
  FileText, Package, Braces
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

// ─── Complete ACRY API Route Registry (150+ endpoints) ───
const ACRY_API_ROUTES = [
  // ── Section 1: Home Dashboard (29 endpoints) ──
  { group: "Home Dashboard", path: "home-api/brain-health", method: "GET", desc: "Get overall brain health score, at-risk count, strong/weak topic counts", auth: true, request: {}, response: { overall_health: 72, health_label: "Needs care", at_risk_count: 5, total_topics: 120, strong_topics: 45, weak_topics: 12 } },
  { group: "Home Dashboard", path: "home-api/rank-prediction", method: "GET", desc: "Get latest AI rank prediction with trend and confidence factors", auth: true, request: {}, response: { predicted_rank: 150, rank_range: { min: 120, max: 200 }, trend: "improving", confidence: 0.78, factors: {} } },
  { group: "Home Dashboard", path: "home-api/exam-countdown", method: "GET", desc: "Get days remaining until target exam date with urgency level", auth: true, request: {}, response: { days_left: 45, exam_date: "2025-05-01", urgency: "warning" } },
  { group: "Home Dashboard", path: "home-api/refresh-ai", method: "POST", desc: "Trigger full AI refresh pipeline — Fast Lane (memory-engine, precision-intelligence) + Deep Lane (embeddings, missions, RL-agent)", auth: true, request: { deep_refresh: true }, response: { status: "refreshed", overall_health: 72, predicted_rank: 150, recommendations_count: 5, deep_tasks_queued: true } },
  { group: "Home Dashboard", path: "home-api/ai-recommendations", method: "GET", desc: "Get active AI-generated study recommendations (uncompleted)", auth: true, request: { limit: 5 }, response: { recommendations: [{ id: "uuid", title: "Review Optics", description: "Memory dropping fast", type: "urgent", priority: "high", topic_id: "uuid" }] } },
  { group: "Home Dashboard", path: "home-api/burnout-status", method: "GET", desc: "Get burnout risk assessment with signals and wellness tips", auth: true, request: {}, response: { burnout_score: 35, risk_level: "low", recommendations: ["Take a 10-min break"], signals: { hours_24h: 2.5, confidence_decline: 0.1 } } },
  { group: "Home Dashboard", path: "home-api/streak-status", method: "GET", desc: "Get current streak, longest streak, freeze count, and next milestone", auth: true, request: {}, response: { current_streak: 15, longest_streak: 42, today_met: true, auto_shield_used: false, freezes_available: 2, next_milestone: 21 } },
  { group: "Home Dashboard", path: "home-api/streak-details", method: "GET", desc: "Alias for streak-status — full streak details with freeze availability", auth: true, request: {}, response: { current_streak: 15, longest_streak: 42, today_met: true, auto_shield_used: false, freezes_available: 2, next_milestone: 21 } },
  { group: "Home Dashboard", path: "home-api/daily-goal", method: "GET", desc: "Get daily study goal progress — minutes studied vs target", auth: true, request: {}, response: { goal_minutes: 60, studied_minutes: 45, completion_pct: 75 } },
  { group: "Home Dashboard", path: "home-api/todays-mission", method: "GET", desc: "Get today's top priority mission with full metadata for the Advanced Mission Wizard (multi-step, adaptive difficulty)", auth: true, request: {}, response: { mission: { id: "uuid", title: "Review: Optics", description: "Memory at 28% — urgent review needed", type: "review", priority: "critical", topic_id: "uuid", topic_name: "Optics", subject_name: "Physics", estimated_minutes: 10, brain_improvement_pct: 8, reasoning: "This topic has dropped below 30% memory strength" }, source: "risk_topic" } },
  { group: "Home Dashboard", path: "home-api/quick-actions", method: "GET", desc: "Get available quick action buttons (smart recall, risk shield, rank boost, focus shield)", auth: true, request: {}, response: { smart_recall: { available: true, topic: { id: "uuid", name: "Optics" } }, risk_shield: { available: true, count: 5, top_topic: {} }, rank_boost: { available: true }, focus_shield: { available: true } } },
  { group: "Home Dashboard", path: "home-api/review-queue", method: "GET", desc: "Get topics due for review today (past next_review_at)", auth: true, request: { limit: 10 }, response: { queue: [{ id: "uuid", name: "Thermodynamics", memory_strength: 45, risk_level: "high", next_review_at: "ISO_DATE" }], count: 8 } },
  { group: "Home Dashboard", path: "home-api/brain-missions", method: "GET", desc: "Get active brain missions with progress tracking", auth: true, request: { status: "active" }, response: { missions: [{ id: "uuid", title: "Master 3 topics", mission_type: "mastery", target_value: 3, current_value: 1, reward_type: "xp", reward_value: 50, expires_at: "ISO_DATE" }] } },
  { group: "Home Dashboard", path: "home-api/mission-generate", method: "POST", desc: "Step 1: Generate AI-powered daily mission. Call once per day on app launch if no active mission exists.", auth: true, request: {}, response: { success: true, ai_mission: { title: "Quick Quiz: Algebra", description: "Review weak topic...", mission_type: "review" }, active_missions: [{ id: "uuid", title: "Review Algebra", status: "active" }], message: "Daily mission generated" } },
  { group: "Home Dashboard", path: "home-api/mission-start", method: "POST", desc: "Step 2: Start a brain mission — marks it in_progress. Supports both real UUIDs and synthetic IDs (risk-*, weak-*, review-*, practice-*, onboard-start)", auth: true, request: { mission_id: "uuid-or-synthetic-id" }, response: { success: true, already_started: false, mission: { id: "uuid", title: "🚨 Rescue: Optics", mission_type: "rescue", priority: "critical", status: "in_progress", target_topic_id: "uuid", target_value: 60, current_value: 28, reward_value: 25, reward_type: "xp" }, started_at: "ISO_DATE", action_hint: "Review the topic to improve your memory_strength", navigate_to: "/study/uuid", message: "🚀 Mission started!" } },
  { group: "Home Dashboard", path: "home-api/mission-questions", method: "POST", desc: "Step 3: Fetch adaptive MCQs for current mission step. Accepts mission_id OR topic_name. Difficulty auto-adjusts based on step performance.", auth: true, request: { mission_id: "uuid-or-undefined", topic_name: "Optics", difficulty: "medium", count: 4 }, response: { success: true, mission: { id: "uuid", title: "🚨 Rescue: Optics" }, topic_name: "Optics", subject_name: "Physics", difficulty: "medium", count: 4, questions: [{ question: "What is total internal reflection?", options: ["A", "B", "C", "D"], correct_index: 2, explanation: "Because light...", difficulty: "medium" }] } },
  { group: "Home Dashboard", path: "home-api/mission-progress", method: "POST", desc: "Step 4 (Optional): Update progress while user studies. Returns target_reached=true when goal met.", auth: true, request: { mission_id: "uuid", progress_value: 3 }, response: { success: true, mission_id: "uuid", current_value: 3, target_value: 5, target_reached: false, progress_pct: 60, message: "Progress updated: 3/5" } },
  { group: "Home Dashboard", path: "home-api/mission-complete", method: "POST", desc: "Step 5: Complete mission — finalizes status, triggers XP reward, updates streak. Send session results for brain impact calculation.", auth: true, request: { mission_id: "uuid-of-mission", score: 85, accuracy: 0.75, time_used_seconds: 420, xp_earned: 50, difficulty_changes: ["medium", "hard"] }, response: { success: true, completed_mission: { id: "uuid", title: "🚨 Rescue: Optics", mission_type: "rescue", reward_value: 25, reward_type: "xp" }, completed_at: "ISO_DATE", remaining_missions: 3, message: "🎉 Mission completed! +25 XP" } },
  { group: "Home Dashboard", path: "home-api/todays-mission-flow", method: "GET", desc: "Full mission lifecycle guide — returns current state, all 5 flow steps with endpoints, and Flutter code example", auth: true, request: {}, response: { current_state: { has_mission: true, current_mission: {}, completed_today: 1 }, flow_steps: ["5 steps with endpoint details"], flutter_example: { code: "Dart code snippet" } } },

  // ── Section 1b: UNIFIED Today's Mission API (Single Endpoint) ──
  { group: "Today's Mission API", path: "home-api/todays-mission-api", method: "POST", desc: "🔥 UNIFIED SINGLE ENDPOINT for entire mission lifecycle. Use action parameter to control flow. Actions: fetch, generate, start, questions, progress, complete, brain-impact, history", auth: true,
    request: { action: "fetch" },
    response: { mission: { id: "uuid", title: "🚨 Rescue: Optics", description: "Memory at 35%...", type: "rescue", priority: "critical", status: "active", topic_id: "uuid", topic_name: "Optics", subject_name: "Physics", estimated_minutes: 15, brain_improvement_pct: 10, reward_value: 25, reward_type: "xp", target_value: 1, current_value: 0, reasoning: "...", expires_at: "ISO_DATE" }, source: "brain_mission", is_real_mission: true }
  },
  { group: "Today's Mission API", path: "home-api/todays-mission-api", method: "POST", desc: "action=generate — Force AI to generate new daily missions. Returns the top generated mission.", auth: true,
    request: { action: "generate" },
    response: { success: true, mission: { id: "uuid", title: "...", type: "rescue", topic_name: "Optics", subject_name: "Physics" }, all_active_missions: [], source: "ai_generated", message: "Mission ready: ..." }
  },
  { group: "Today's Mission API", path: "home-api/todays-mission-api", method: "POST", desc: "action=start — Mark mission as in_progress. Supports both real UUIDs and synthetic IDs (risk-, weak-, practice-). Returns navigation hints.", auth: true,
    request: { action: "start", mission_id: "uuid-or-synthetic" },
    response: { success: true, already_started: false, is_synthetic: false, mission: { id: "uuid", title: "...", status: "in_progress", topic_name: "Optics", subject_name: "Physics" }, started_at: "ISO_DATE", action_hint: "Review to improve memory", navigate_to: "/study/uuid" }
  },
  { group: "Today's Mission API", path: "home-api/todays-mission-api", method: "POST", desc: "action=questions — Fetch AI-generated quiz questions for the mission. Auto-resolves topic from mission_id.", auth: true,
    request: { action: "questions", mission_id: "uuid-or-synthetic", count: 5, difficulty: "medium" },
    response: { success: true, mission_id: "uuid", topic_name: "Optics", subject_name: "Physics", difficulty: "medium", count: 5, questions: [{ question: "What is...", options: ["A", "B", "C", "D"], correct_index: 2, explanation: "Because...", difficulty: "medium" }], quiz_title: "Quick Fix: Optics", quiz_description: "5 medium questions on Optics" }
  },
  { group: "Today's Mission API", path: "home-api/todays-mission-api", method: "POST", desc: "action=progress — Update current_value during study. Works for both real and synthetic missions.", auth: true,
    request: { action: "progress", mission_id: "uuid", progress_value: 3 },
    response: { success: true, mission_id: "uuid", current_value: 3, target_value: 5, target_reached: false, progress_pct: 60, message: "Progress: 3/5" }
  },
  { group: "Today's Mission API", path: "home-api/todays-mission-api", method: "POST", desc: "action=complete — Finalize mission. Logs study session, calculates brain impact, returns XP reward. Send quiz results for accurate impact.", auth: true,
    request: { action: "complete", mission_id: "uuid", score: 85, accuracy: 78, time_taken_seconds: 480, questions_attempted: 5, questions_correct: 4 },
    response: { success: true, mission_id: "uuid", completed_at: "ISO_DATE", reward: { value: 25, type: "xp" }, remaining_missions: 2, brain_impact: { topic_name: "Optics", subject_name: "Physics", score: 85, accuracy: 78, memory_boost_pct: 15, estimated_rank_change: -75 }, message: "🎉 Mission completed! +25 XP" }
  },
  { group: "Today's Mission API", path: "home-api/todays-mission-api", method: "POST", desc: "action=brain-impact — Get post-mission brain health report with streak, study minutes, and motivational message.", auth: true,
    request: { action: "brain-impact", mission_id: "uuid" },
    response: { brain_health: 72, today_study_minutes: 45, missions_completed_today: 2, streak: { current: 16, longest: 42, today_met: true }, completed_mission: { id: "uuid", title: "...", reward: 25 }, motivational_message: "💪 Great work!" }
  },
  { group: "Today's Mission API", path: "home-api/todays-mission-api", method: "POST", desc: "action=history — Get all active and today's completed missions.", auth: true,
    request: { action: "history" },
    response: { active_missions: [], completed_today: [], active_count: 3, completed_today_count: 2 }
  },

  // ── Section 1c: Legacy Mission Sessions (kept for backward compatibility) ──
  { group: "Mission Sessions", path: "home-api/mission-session-start", method: "POST", desc: "[LEGACY] Use todays-mission-api instead. Create a mission_session row when user enters the 4-step wizard", auth: true, request: { mission_id: "uuid-or-synthetic", topic_name: "Optics", subject_name: "Physics", estimated_minutes: 10, urgency: "critical" }, response: { success: true, session_id: "uuid", status: "active", steps: [], created_at: "ISO_DATE" } },
  { group: "Mission Sessions", path: "home-api/mission-session-step", method: "POST", desc: "[LEGACY] Use todays-mission-api instead. Record a completed step in the wizard.", auth: true, request: { session_id: "uuid", step_index: 1, step_type: "quiz", score: 80, accuracy: 0.75, time_seconds: 120, difficulty: "medium", questions_count: 4, correct_count: 3 }, response: { success: true, step_recorded: true, current_step: 2, next_difficulty: "hard", xp_for_step: 15 } },
  { group: "Mission Sessions", path: "home-api/mission-session-complete", method: "POST", desc: "[LEGACY] Use todays-mission-api instead. Finalize the mission session.", auth: true, request: { session_id: "uuid", total_score: 85, total_accuracy: 0.78, total_time_seconds: 480, xp_earned: 50 }, response: { success: true, session: { id: "uuid", status: "completed" }, brain_impact: {}, streak_updated: true } },
  { group: "Mission Sessions", path: "home-api/mission-session-history", method: "GET", desc: "[LEGACY] Use todays-mission-api?action=history instead.", auth: true, request: { limit: 10 }, response: { sessions: [], total_sessions: 42, total_xp: 2150 } },
  { group: "Mission Sessions", path: "home-api/mission-streak", method: "GET", desc: "[LEGACY] Use todays-mission-api?action=brain-impact instead.", auth: true, request: {}, response: { current_streak: 16, longest_streak: 42 } },
  { group: "Mission Sessions", path: "home-api/mission-leaderboard", method: "GET", desc: "[LEGACY] Mission completion leaderboard", auth: true, request: { period: "weekly", limit: 20 }, response: { leaderboard: [], user_rank: 5 } },
  { group: "Mission Sessions", path: "home-api/mission-brain-impact", method: "GET", desc: "[LEGACY] Use todays-mission-api?action=brain-impact instead.", auth: true, request: { session_id: "uuid" }, response: { memory_strength: { before: 42, after: 50.5 }, rank_prediction: { before: 4500, after: 4380 } } },
  { group: "Mission Sessions", path: "home-api/mission-share-data", method: "GET", desc: "[LEGACY] Get shareable mission card data", auth: true, request: { session_id: "uuid" }, response: { share_text: "...", stats: {}, share_url: "https://acry.ai/share/uuid" } },


  { group: "Home Dashboard", path: "home-api/cognitive-embedding", method: "GET", desc: "Get user's cognitive embedding data — learning style and strengths", auth: true, request: {}, response: { embedding_summary: {}, learning_style: "visual", cognitive_strengths: ["pattern_recognition", "spatial"], last_computed_at: "ISO_DATE" } },
  { group: "Home Dashboard", path: "home-api/rl-policy", method: "GET", desc: "Get reinforcement learning policy state for adaptive scheduling", auth: true, request: {}, response: { policy_version: "v1", optimization_target: "memory_retention", current_reward: 0.72, actions_taken: 45, last_updated_at: "ISO_DATE" } },
  { group: "Home Dashboard", path: "home-api/auto-study-summary", method: "GET", desc: "Get AI-generated study summary for last N days with patterns", auth: true, request: { days: 7 }, response: { summary: "You studied 420 minutes across 18 sessions in the last 7 days.", total_minutes: 420, sessions_count: 18, top_subjects: [{ name: "Physics", minutes: 180 }], patterns: [], suggestions: [] } },
  { group: "Home Dashboard", path: "home-api/precision-intelligence", method: "GET", desc: "Get precision rank intelligence with competition density and improvement potential", auth: true, request: {}, response: { predicted_rank: 150, rank_range: { min: 120, max: 200 }, probability: 0.78, trend: "improving", improvement_potential: {}, competition_density: 0.65 } },
  { group: "Home Dashboard", path: "home-api/decay-forecast", method: "GET", desc: "Get memory decay forecast — at-risk topics with predicted drop dates and urgency", auth: true, request: { limit: 10 }, response: { at_risk_topics: [{ topic_id: "uuid", topic_name: "Optics", subject_name: "Physics", memory_strength: 28, predicted_drop_date: "ISO_DATE", decay_rate: 0.05, urgency: "critical" }], overall_decay_rate: 0.03 } },
  { group: "Home Dashboard", path: "home-api/risk-digest", method: "GET", desc: "Get digest of all critical and high-risk topics", auth: true, request: {}, response: { risk_topics: [{ id: "uuid", name: "Optics", memory_strength: 28, risk_level: "critical" }], count: 5 } },
  { group: "Home Dashboard", path: "home-api/brain-feed", method: "GET", desc: "Get brain report feed — recent AI-generated insights and reports", auth: true, request: {}, response: { feed: [{ id: "uuid", report_type: "weekly", summary: "string", metrics: {}, created_at: "ISO_DATE" }] } },
  { group: "Home Dashboard", path: "home-api/recently-studied", method: "GET", desc: "Get last 10 study sessions with subject, topic, duration, and mode", auth: true, request: {}, response: { sessions: [{ id: "uuid", subject_name: "Physics", topic_name: "Optics", duration_minutes: 25, mode: "review", created_at: "ISO_DATE" }] } },
  { group: "Home Dashboard", path: "home-api/study-insights", method: "GET", desc: "Get AI-powered study insights and optimization suggestions", auth: true, request: {}, response: { insights: [{ type: "pattern", title: "string", description: "string", priority: "high" }] } },
  { group: "Home Dashboard", path: "home-api/autopilot-status", method: "GET", desc: "Get autopilot session status for today — enabled, completed, and total sessions", auth: true, request: {}, response: { enabled: true, today_session: {}, completed: 3, total: 5 } },
  { group: "Home Dashboard", path: "home-api/daily-quote", method: "GET", desc: "Get motivational quote of the day (rotates daily)", auth: true, request: {}, response: { quote: "The secret of getting ahead is getting started.", author: "Mark Twain", category: "motivation" } },
  { group: "Home Dashboard", path: "home-api/weekly-summary", method: "GET", desc: "Get weekly study summary with improvement percentage vs last week", auth: true, request: {}, response: { total_minutes: 420, sessions: 18, topics_covered: 12, improvement_pct: 15, highlights: [], weak_areas: [] } },
  { group: "Home Dashboard", path: "home-api/streak-recovery", method: "GET", desc: "Check if streak recovery is available — freeze count and recovery session type", auth: true, request: {}, response: { recovery_available: true, freezes_count: 2, recovery_session_type: "quick_review", streak_at_risk: true } },
  { group: "Home Dashboard", path: "home-api/trial-status", method: "GET", desc: "Get subscription trial status — plan details, trial days remaining", auth: true, request: {}, response: { plan_key: "premium", plan_name: "Premium Brain", is_trial: true, trial_days_remaining: 8, status: "active", expires_at: "ISO_DATE" } },
  { group: "Home Dashboard", path: "home-api/welcome-status", method: "GET", desc: "Get welcome screen data — greeting, display name, avatar, new user check", auth: true, request: {}, response: { show_welcome: false, display_name: "Rahul", avatar_url: "https://...", greeting: "Good morning" } },
  { group: "Home Dashboard", path: "home-api/completion-rate", method: "GET", desc: "Get overall study plan completion rate with trend direction", auth: true, request: {}, response: { completion_rate: 72, trend: "improving" } },
  { group: "Home Dashboard", path: "home-api/dashboard", method: "GET", desc: "⚡ UNIFIED — All Home Tab data in one call", auth: true, request: {}, response: { brain_health: {}, rank_prediction: {}, exam_countdown: {}, daily_goal: {}, streak: {}, todays_mission: {}, ai_recommendations: {}, brain_missions: {}, quick_actions: {}, review_queue: {}, risk_digest: {}, weekly_summary: {}, recently_studied: {}, brain_feed: {}, autopilot: {}, trial_status: {}, completion_rate: {}, welcome: {}, daily_quote: {} } },

  // ── Section 2: Authentication — OTP-First + OAuth (19 endpoints) ──
  // PRIMARY FLOW: Passwordless Mobile OTP via MSG91 (SMS & WhatsApp)
  { group: "Authentication", path: "msg91-otp/send", method: "POST", desc: "Send 4-digit OTP via SMS. Accepts mobile in JSON body, query params, or form-encoded. Supports formats: 9876543210, 09876543210, 919876543210, +919876543210", auth: false, request: { action: "send", mobile: "919876543210" }, response: { success: true, message: "OTP sent via SMS", channel: "sms" } },
  { group: "Authentication", path: "msg91-otp/send-whatsapp", method: "POST", desc: "Send 4-digit OTP via WhatsApp template message (no SMS sent)", auth: false, request: { action: "send_whatsapp", mobile: "919876543210" }, response: { success: true, message: "OTP sent via WhatsApp only", channel: "whatsapp" } },
  { group: "Authentication", path: "msg91-otp/verify", method: "POST", desc: "Verify 4-digit OTP (works for both SMS & WhatsApp). Returns magiclink token on success.", auth: false, request: { action: "verify", mobile: "919876543210", otp: "1234" }, response: { success: true, verified: true, isNewUser: false, userId: "uuid", token_hash: "string", verification_type: "magiclink" } },
  { group: "Authentication", path: "msg91-otp/resend", method: "POST", desc: "Resend OTP via SMS (rate-limited by MSG91)", auth: false, request: { action: "resend", mobile: "919876543210" }, response: { success: true, message: "OTP resent via SMS", channel: "sms" } },
  { group: "Authentication", path: "msg91-otp/resend-whatsapp", method: "POST", desc: "Resend OTP via WhatsApp only (generates new 4-digit OTP, no SMS)", auth: false, request: { action: "resend_whatsapp", mobile: "919876543210" }, response: { success: true, message: "OTP resent via WhatsApp only", channel: "whatsapp" } },
  // SECONDARY FLOW: Passwordless Email OTP
  { group: "Authentication", path: "auth/send-otp", method: "POST", desc: "Send 6-digit OTP to email (secondary auth method — creates user if new)", auth: false, request: { email: "string", options: { shouldCreateUser: true } }, response: { success: true, expires_in: 300, message: "6-digit OTP sent to email" } },
  { group: "Authentication", path: "auth/verify-otp", method: "POST", desc: "Verify 6-digit OTP code and get session (works for both login & signup)", auth: false, request: { email: "string", token: "123456", type: "email" }, response: { access_token: "JWT_TOKEN", refresh_token: "string", user: { id: "uuid", email: "string", created_at: "ISO_DATE" }, expires_in: 3600 } },
  { group: "Authentication", path: "auth/resend-otp", method: "POST", desc: "Resend OTP to same email (rate-limited to 1/60s)", auth: false, request: { email: "string" }, response: { success: true, expires_in: 300 } },
  // OAUTH FLOW: Google & Apple (via Lovable Cloud managed OAuth)
  { group: "Authentication", path: "auth/oauth/google", method: "POST", desc: "Initiate Google OAuth sign-in (redirects to Google consent screen)", auth: false, request: { redirect_uri: "https://your-app.com", extraParams: { prompt: "select_account" } }, response: { redirected: true, url: "https://accounts.google.com/..." } },
  { group: "Authentication", path: "auth/oauth/apple", method: "POST", desc: "Initiate Apple OAuth sign-in (redirects to Apple ID)", auth: false, request: { redirect_uri: "https://your-app.com" }, response: { redirected: true, url: "https://appleid.apple.com/..." } },
  { group: "Authentication", path: "auth/oauth/callback", method: "GET", desc: "OAuth callback handler — exchanges code for session tokens", auth: false, request: { code: "string", state: "string" }, response: { access_token: "JWT_TOKEN", refresh_token: "string", user: { id: "uuid", email: "string", app_metadata: { provider: "google" } } } },
  { group: "Authentication", path: "auth/set-session", method: "POST", desc: "Set session from OAuth tokens (used after OAuth callback in Flutter)", auth: false, request: { access_token: "string", refresh_token: "string" }, response: { session: { user: { id: "uuid", email: "string" } }, expires_at: "ISO_DATE" } },
  // SESSION MANAGEMENT
  { group: "Authentication", path: "auth/session-status", method: "GET", desc: "Check current session validity & user info", auth: true, request: {}, response: { active: true, expires_at: "ISO_DATE", user: { id: "uuid", email: "string", created_at: "ISO_DATE" } } },
  { group: "Authentication", path: "auth/refresh-token", method: "POST", desc: "Refresh expired JWT using refresh token", auth: false, request: { refresh_token: "string" }, response: { access_token: "NEW_JWT_TOKEN", refresh_token: "string", expires_in: 3600 } },
  { group: "Authentication", path: "auth/logout", method: "POST", desc: "Sign out and invalidate current session", auth: true, request: {}, response: { success: true } },
  // PASSWORD RESET (secondary — not primary login method)
  { group: "Authentication", path: "auth/forgot-password", method: "POST", desc: "Send password reset link to email", auth: false, request: { email: "string", redirectTo: "https://your-app.com/reset-password" }, response: { success: true, message: "Reset link sent" } },
  { group: "Authentication", path: "auth/reset-password", method: "POST", desc: "Set new password from reset link token", auth: false, request: { access_token: "string", new_password: "string" }, response: { success: true, user: { id: "uuid" } } },
  // NEW USER DETECTION (used by AuthContext to distinguish signup vs login)
  { group: "Authentication", path: "auth/detect-new-user", method: "GET", desc: "Check if user is new (created_at < 120s ago) for welcome flow", auth: true, request: {}, response: { is_new_user: true, created_at: "ISO_DATE", provider: "email", needs_onboarding: true } },
  { group: "Authentication", path: "auth/update-user-metadata", method: "PUT", desc: "Update user metadata (display_name, avatar, etc.)", auth: true, request: { data: { display_name: "string" } }, response: { success: true, user: { id: "uuid", user_metadata: { display_name: "string" } } } },

  // ── Section 3: User Profile (11 endpoints) ──
  { group: "User Profile", path: "user/profile", method: "GET", desc: "Get current user profile", auth: true, request: {}, response: { id: "uuid", display_name: "string", email: "string", avatar_url: "string", exam_type: "NEET", exam_date: "2025-05-01", daily_study_goal_minutes: 60 } },
  { group: "User Profile", path: "user/profile/update", method: "PUT", desc: "Update user profile fields", auth: true, request: { display_name: "string", avatar_url: "string" }, response: { success: true, data: { id: "uuid", display_name: "string" } } },
  { group: "User Profile", path: "user/profile/upload-avatar", method: "POST", desc: "Upload profile avatar image", auth: true, request: { image_base64: "string", content_type: "image/png" }, response: { avatar_url: "https://..." } },
  { group: "User Profile", path: "user/exam-profile", method: "GET", desc: "Get exam configuration", auth: true, request: {}, response: { exam_type: "NEET", exam_date: "2025-05-01", target_rank: 500, subjects: ["Physics", "Chemistry", "Biology"] } },
  { group: "User Profile", path: "user/exam-profile/setup", method: "POST", desc: "Setup exam profile for first time", auth: true, request: { exam_type: "NEET", exam_date: "2025-05-01", target_rank: 500 }, response: { success: true } },
  { group: "User Profile", path: "user/exam-profile/update", method: "PUT", desc: "Update exam configuration", auth: true, request: { exam_date: "2025-06-01", target_rank: 300 }, response: { success: true } },
  { group: "User Profile", path: "user/preferences", method: "GET", desc: "Get study preferences", auth: true, request: {}, response: { daily_goal: 60, weekly_goal: 300, email_reminders: true, push_notifications: true, voice_enabled: false } },
  { group: "User Profile", path: "user/preferences/update", method: "PUT", desc: "Update study preferences", auth: true, request: { daily_study_goal_minutes: 90, email_study_reminders: true }, response: { success: true } },
  { group: "User Profile", path: "user/stats", method: "GET", desc: "Get user study statistics", auth: true, request: {}, response: { total_study_hours: 240, streak_days: 15, topics_mastered: 42, avg_memory_strength: 72 } },
  { group: "User Profile", path: "user/activity-history", method: "GET", desc: "Get user activity timeline", auth: true, request: {}, response: { activities: [{ type: "study", topic: "Physics", duration: 25, created_at: "ISO_DATE" }] } },
  { group: "User Profile", path: "user/account", method: "DELETE", desc: "Delete user account permanently", auth: true, request: { confirmation: "DELETE_MY_ACCOUNT" }, response: { success: true, message: "Account scheduled for deletion" } },

  // ── Section 4: Brain Intelligence (12 endpoints) ──
  { group: "Brain Intelligence", path: "brain/status", method: "GET", desc: "Get overall brain status dashboard", auth: true, request: {}, response: { health_score: 78, total_topics: 120, mastered: 45, at_risk: 12, evolution_score: 72 } },
  { group: "Brain Intelligence", path: "brain/memory-strength", method: "GET", desc: "Get memory strength per topic", auth: true, request: {}, response: { topics: [{ topic_id: "uuid", name: "string", memory_strength: 72, forget_risk: 28, next_review: "ISO_DATE" }] } },
  { group: "Brain Intelligence", path: "brain/forget-prediction", method: "GET", desc: "Predict forgetting curve per topic", auth: true, request: {}, response: { predictions: [{ topic_id: "uuid", name: "string", predicted_drop_date: "ISO_DATE", current_strength: 65, predicted_strength_7d: 42 }] } },
  { group: "Brain Intelligence", path: "brain/knowledge-graph", method: "GET", desc: "Get full knowledge dependency graph", auth: true, request: {}, response: { nodes: [{ id: "uuid", label: "string", strength: 72 }], edges: [{ from: "uuid", to: "uuid", weight: 0.8 }] } },
  { group: "Brain Intelligence", path: "brain/brain-evolution", method: "GET", desc: "Get brain evolution score & timeline", auth: true, request: {}, response: { evolution_score: 72, learning_speed: 0.8, decay_rate: 0.3, timeline: [{ date: "ISO_DATE", score: 68 }] } },
  { group: "Brain Intelligence", path: "brain/cognitive-state", method: "GET", desc: "Get current cognitive state assessment", auth: true, request: {}, response: { recall_pattern: "visual", optimal_session: 25, cognitive_load: 0.6, focus_quality: 0.82 } },
  { group: "Brain Intelligence", path: "brain/fatigue-level", method: "GET", desc: "Detect current study fatigue level", auth: true, request: {}, response: { fatigue_score: 35, recommendation: "Continue studying", max_remaining_minutes: 45, burnout_risk: "low" } },
  { group: "Brain Intelligence", path: "brain/performance-score", method: "GET", desc: "Get overall performance score", auth: true, request: {}, response: { score: 78, percentile: 82, trend: "improving", factors: { consistency: 85, retention: 72, coverage: 68 } } },
  { group: "Brain Intelligence", path: "brain/weak-topics", method: "GET", desc: "Get weakest topics needing attention", auth: true, request: {}, response: { topics: [{ topic_id: "uuid", name: "string", strength: 28, subject: "Physics", priority: 1 }] } },
  { group: "Brain Intelligence", path: "brain/strong-topics", method: "GET", desc: "Get strongest mastered topics", auth: true, request: {}, response: { topics: [{ topic_id: "uuid", name: "string", strength: 92, subject: "Biology", last_review: "ISO_DATE" }] } },
  { group: "Brain Intelligence", path: "brain/risk-topics", method: "GET", desc: "Topics at risk of being forgotten", auth: true, request: {}, response: { topics: [{ topic_id: "uuid", name: "string", risk_score: 78, predicted_drop: "ISO_DATE" }] } },
  { group: "Brain Intelligence", path: "brain/brain-health-report", method: "GET", desc: "Comprehensive brain health report", auth: true, request: {}, response: { overall_health: 75, sections: { memory: 72, consistency: 80, coverage: 68, efficiency: 78 }, recommendations: ["string"] } },

  // ── Section 5: Study & Action (13 endpoints) ──
  { group: "Study & Action", path: "study/log-session", method: "POST", desc: "Log a completed study session", auth: true, request: { topic_id: "uuid", duration_minutes: 25, confidence_level: 4, study_mode: "review" }, response: { success: true, streak_updated: true, new_memory_score: 78 } },
  { group: "Study & Action", path: "study/log-lazy-mode", method: "POST", desc: "Log passive/lazy mode study", auth: true, request: { topic_id: "uuid", duration_minutes: 10, content_type: "audio" }, response: { success: true, partial_credit: 5 } },
  { group: "Study & Action", path: "study/start-session", method: "POST", desc: "Start a tracked study session", auth: true, request: { topic_id: "uuid", planned_duration: 25 }, response: { session_id: "uuid", started_at: "ISO_DATE" } },
  { group: "Study & Action", path: "study/end-session", method: "POST", desc: "End an active study session", auth: true, request: { session_id: "uuid", confidence_level: 4 }, response: { duration_minutes: 23, memory_delta: 8, streak_updated: true } },
  { group: "Study & Action", path: "study/log-recall", method: "POST", desc: "Submit recall test answer", auth: true, request: { topic_id: "uuid", confidence: 4, correct: true }, response: { new_score: 85, next_review: "ISO_DATE" } },
  { group: "Study & Action", path: "study/log-confidence", method: "POST", desc: "Log confidence level for topic", auth: true, request: { topic_id: "uuid", confidence: 4 }, response: { success: true, adjusted_score: 78 } },
  { group: "Study & Action", path: "study/history", method: "GET", desc: "Get study session history", auth: true, request: {}, response: { sessions: [{ id: "uuid", topic: "string", duration: 25, date: "ISO_DATE", mode: "review" }], total: 150 } },
  { group: "Study & Action", path: "study/daily-summary", method: "GET", desc: "Get today's study summary", auth: true, request: {}, response: { total_minutes: 85, sessions_count: 3, topics_covered: 5, goal_progress: 0.85 } },
  { group: "Study & Action", path: "study/weekly-summary", method: "GET", desc: "Get weekly study summary", auth: true, request: {}, response: { total_minutes: 420, daily_avg: 60, best_day: "Monday", topics_reviewed: 18, consistency_score: 82 } },
  { group: "Study & Action", path: "study/upload-notes", method: "POST", desc: "Upload text study notes", auth: true, request: { content: "string", subject_id: "uuid" }, response: { topics_extracted: ["string"], notes_id: "uuid" } },
  { group: "Study & Action", path: "study/upload-pdf", method: "POST", desc: "Upload PDF for topic extraction", auth: true, request: { file_base64: "string", filename: "notes.pdf" }, response: { topics_extracted: ["string"], pages_processed: 12 } },
  { group: "Study & Action", path: "study/upload-image", method: "POST", desc: "Upload image for topic extraction", auth: true, request: { image_base64: "string", content_type: "image/jpeg" }, response: { topics_extracted: ["string"], text_detected: "string" } },
  { group: "Study & Action", path: "study/upload-voice", method: "POST", desc: "Upload voice recording for topics", auth: true, request: { audio_base64: "string", language: "en" }, response: { transcript: "string", topics_extracted: ["string"] } },

  // ── Section 6: Fix Sessions (9 endpoints) ──
  { group: "Fix Sessions", path: "fix/get-risk-topics", method: "GET", desc: "Get topics at risk needing fixing", auth: true, request: {}, response: { topics: [{ topic_id: "uuid", name: "string", risk_score: 85, times_wrong: 4, recommended_fix: "quiz" }] } },
  { group: "Fix Sessions", path: "fix/start-fix-session", method: "POST", desc: "Start a fix session for weak topics", auth: true, request: { topic_id: "uuid", mode: "quiz" }, response: { session_id: "uuid", total_questions: 10, time_limit: 600 } },
  { group: "Fix Sessions", path: "fix/submit-answer", method: "POST", desc: "Submit answer during fix session", auth: true, request: { session_id: "uuid", question_id: "uuid", answer_index: 2, time_taken_seconds: 15 }, response: { correct: true, explanation: "string", score_delta: 5 } },
  { group: "Fix Sessions", path: "fix/get-question", method: "GET", desc: "Get next question in fix session", auth: true, request: {}, response: { question_id: "uuid", question_text: "string", options: ["A", "B", "C", "D"], difficulty: "medium", topic: "string" } },
  { group: "Fix Sessions", path: "fix/get-hint", method: "GET", desc: "Get hint for current question", auth: true, request: {}, response: { hint: "string", confidence_penalty: 0.1 } },
  { group: "Fix Sessions", path: "fix/end-session", method: "POST", desc: "End current fix session", auth: true, request: { session_id: "uuid" }, response: { score: 78, correct: 8, total: 10, memory_improvement: 12, time_used: 480 } },
  { group: "Fix Sessions", path: "fix/session-result", method: "GET", desc: "Get detailed fix session results", auth: true, request: {}, response: { session_id: "uuid", score: 78, questions: [{ correct: true, time_taken: 15 }], improvement: 12 } },
  { group: "Fix Sessions", path: "fix/history", method: "GET", desc: "Get fix session history", auth: true, request: {}, response: { sessions: [{ id: "uuid", topic: "string", score: 78, date: "ISO_DATE" }] } },
  { group: "Fix Sessions", path: "fix/emergency-fix", method: "POST", desc: "Start emergency fix for critical topics", auth: true, request: { max_topics: 3 }, response: { session_id: "uuid", topics: ["string"], estimated_time: 15 } },

  // ── Section 7: AI Agent (11 endpoints) ──
  { group: "AI Agent", path: "ai-agent/status", method: "GET", desc: "Get AI agent current status", auth: true, request: {}, response: { active: true, last_analysis: "ISO_DATE", confidence: 0.85, model_version: "v3.2" } },
  { group: "AI Agent", path: "ai-agent/daily-plan", method: "GET", desc: "Get AI-generated daily study plan", auth: true, request: {}, response: { sessions: [{ topic: "string", duration: 25, mode: "review", reason: "string", priority: 1 }] } },
  { group: "AI Agent", path: "ai-agent/next-best-topic", method: "GET", desc: "Get optimal next topic to study", auth: true, request: {}, response: { topic_id: "uuid", name: "string", reason: "string", estimated_duration: 25, urgency: "high" } },
  { group: "AI Agent", path: "ai-agent/recommendations", method: "GET", desc: "Get personalized study recommendations", auth: true, request: {}, response: { recommendations: [{ title: "string", body: "string", priority: 1, type: "urgent", topic: "string" }] } },
  { group: "AI Agent", path: "ai-agent/strategy-plan", method: "GET", desc: "Get long-term strategy plan", auth: true, request: {}, response: { plan: { focus_areas: ["string"], weekly_targets: {}, intensity: "medium", estimated_improvement: 15 } } },
  { group: "AI Agent", path: "ai-agent/revision-plan", method: "GET", desc: "Get optimized revision schedule", auth: true, request: {}, response: { schedule: [{ date: "ISO_DATE", topics: ["string"], duration: 60 }] } },
  { group: "AI Agent", path: "ai-agent/simulation", method: "GET", desc: "Run what-if scenario simulation", auth: true, request: {}, response: { scenario: "string", predicted_outcome: { rank: 120, retention: 82 }, confidence: 0.75 } },
  { group: "AI Agent", path: "ai-agent/predicted-outcome", method: "GET", desc: "Get predicted exam outcome", auth: true, request: {}, response: { predicted_rank: 150, predicted_score: 580, confidence: 0.78, trend: "improving" } },
  { group: "AI Agent", path: "ai-agent/cognitive-twin", method: "GET", desc: "Get cognitive twin digital model", auth: true, request: {}, response: { recall_pattern: "visual", optimal_session: 25, fatigue_threshold: 90, efficiency: 0.82, learning_speed: 0.8 } },
  { group: "AI Agent", path: "ai-agent/feedback", method: "POST", desc: "Submit feedback on AI recommendations", auth: true, request: { recommendation_id: "uuid", helpful: true, comment: "string" }, response: { success: true } },
  { group: "AI Agent", path: "ai-agent/evolution-status", method: "GET", desc: "Get AI agent evolution & accuracy", auth: true, request: {}, response: { version: "3.2", accuracy: 0.87, predictions_made: 1240, last_retrained: "ISO_DATE" } },

  // ── Section 8: Rank Prediction (8 endpoints) ──
  { group: "Rank Prediction", path: "rank/prediction", method: "GET", desc: "Get AI rank prediction", auth: true, request: {}, response: { predicted_rank: 150, confidence: 0.78, model_version: "v3" } },
  { group: "Rank Prediction", path: "rank/range", method: "GET", desc: "Get rank prediction range", auth: true, request: {}, response: { best_case: 80, expected: 150, worst_case: 300, confidence: 0.78 } },
  { group: "Rank Prediction", path: "rank/probability", method: "GET", desc: "Rank probability distribution", auth: true, request: {}, response: { probabilities: [{ rank_range: "1-100", probability: 0.15 }, { rank_range: "101-500", probability: 0.55 }] } },
  { group: "Rank Prediction", path: "rank/trend", method: "GET", desc: "Get rank prediction trend over time", auth: true, request: {}, response: { trend: [{ date: "ISO_DATE", predicted_rank: 180 }], direction: "improving", delta_30d: -25 } },
  { group: "Rank Prediction", path: "rank/competition-analysis", method: "GET", desc: "Competitive positioning analysis", auth: true, request: {}, response: { percentile: 82, ahead_of: 45000, behind: 10000, similar_profiles: 1200 } },
  { group: "Rank Prediction", path: "rank/improvement-simulation", method: "GET", desc: "Simulate rank with different effort", auth: true, request: {}, response: { scenarios: [{ extra_hours: 2, predicted_rank: 100 }, { extra_hours: 4, predicted_rank: 60 }] } },
  { group: "Rank Prediction", path: "rank/history", method: "GET", desc: "Historical rank predictions", auth: true, request: {}, response: { history: [{ date: "ISO_DATE", predicted_rank: 200, actual_rank: null }] } },
  { group: "Rank Prediction", path: "rank/projection", method: "GET", desc: "Long-term rank projection", auth: true, request: {}, response: { current: 150, at_exam: 95, if_consistent: 70, if_increased: 45 } },

  // ── Section 9: Knowledge Graph (6 endpoints) ──
  { group: "Knowledge Graph", path: "knowledge-graph/full", method: "GET", desc: "Get complete knowledge graph", auth: true, request: {}, response: { nodes: [{ id: "uuid", label: "string", type: "topic", strength: 72 }], edges: [{ from: "uuid", to: "uuid", type: "depends_on" }], stats: { total_nodes: 120, total_edges: 340 } } },
  { group: "Knowledge Graph", path: "knowledge-graph/topic", method: "GET", desc: "Get graph around specific topic", auth: true, request: {}, response: { center: { id: "uuid", label: "string" }, neighbors: [{ id: "uuid", label: "string", relation: "prerequisite" }] } },
  { group: "Knowledge Graph", path: "knowledge-graph/connections", method: "GET", desc: "Get topic connections & relations", auth: true, request: {}, response: { connections: [{ from: "string", to: "string", type: "depends_on", strength: 0.8 }] } },
  { group: "Knowledge Graph", path: "knowledge-graph/dependencies", method: "GET", desc: "Get prerequisite dependency tree", auth: true, request: {}, response: { tree: { topic: "string", prerequisites: [{ topic: "string", mastered: true }] } } },
  { group: "Knowledge Graph", path: "knowledge-graph/weak-root", method: "GET", desc: "Find weak root causes in graph", auth: true, request: {}, response: { weak_roots: [{ topic_id: "uuid", name: "string", dependent_count: 8, impact_score: 92 }] } },
  { group: "Knowledge Graph", path: "knowledge-graph/recommend-fix", method: "GET", desc: "AI-recommended fix order from graph", auth: true, request: {}, response: { fix_order: [{ topic_id: "uuid", name: "string", reason: "string", priority: 1 }] } },

  // ── Section 10: Chat & Voice (8 endpoints) ──
  { group: "Chat & Voice", path: "chat/send-message", method: "POST", desc: "Send message to AI support chat", auth: true, request: { message: "string", language: "en" }, response: { reply: "string", suggestions: ["string"] } },
  { group: "Chat & Voice", path: "chat/history", method: "GET", desc: "Get chat conversation history", auth: true, request: {}, response: { messages: [{ role: "user", content: "string", created_at: "ISO_DATE" }] } },
  { group: "Chat & Voice", path: "chat/voice-input", method: "POST", desc: "Send voice message for transcription", auth: true, request: { audio_base64: "string", language: "en" }, response: { transcript: "string", reply: "string", audio_reply_url: "string" } },
  { group: "Chat & Voice", path: "chat/voice-response", method: "GET", desc: "Get voice response audio", auth: true, request: {}, response: { audio_url: "string", transcript: "string", duration_seconds: 12 } },
  { group: "Chat & Voice", path: "chat/suggestions", method: "GET", desc: "Get suggested questions", auth: true, request: {}, response: { suggestions: ["How do I improve in Physics?", "What should I study today?"] } },
  { group: "Chat & Voice", path: "chat/clear-history", method: "DELETE", desc: "Clear all chat history", auth: true, request: {}, response: { success: true, deleted_count: 45 } },
  { group: "Chat & Voice", path: "chat/support-status", method: "GET", desc: "Check AI chat availability", auth: true, request: {}, response: { available: true, model: "gemini-3-flash", avg_response_ms: 800 } },
  { group: "Chat & Voice", path: "chat/feedback", method: "POST", desc: "Submit feedback on chat response", auth: true, request: { message_id: "uuid", helpful: true, rating: 5 }, response: { success: true } },

  // ── Section 11: Notifications (6 endpoints) ──
  { group: "Notifications", path: "notification/list", method: "GET", desc: "Get all notifications", auth: true, request: {}, response: { notifications: [{ id: "uuid", title: "string", body: "string", read: false, type: "reminder", created_at: "ISO_DATE" }], unread_count: 5 } },
  { group: "Notifications", path: "notification/read", method: "POST", desc: "Mark notification as read", auth: true, request: { notification_id: "uuid" }, response: { success: true } },
  { group: "Notifications", path: "notification/read-all", method: "POST", desc: "Mark all notifications as read", auth: true, request: {}, response: { success: true, updated_count: 12 } },
  { group: "Notifications", path: "notification/settings", method: "GET", desc: "Get notification preferences", auth: true, request: {}, response: { email_enabled: true, push_enabled: true, study_reminders: true, weekly_reports: true, voice_enabled: false } },
  { group: "Notifications", path: "notification/settings/update", method: "PUT", desc: "Update notification preferences", auth: true, request: { push_enabled: true, study_reminders: true }, response: { success: true } },
  { group: "Notifications", path: "notification/history", method: "GET", desc: "Get notification delivery history", auth: true, request: {}, response: { history: [{ id: "uuid", title: "string", channel: "push", delivered_at: "ISO_DATE", read_at: "ISO_DATE" }] } },

  // ── Section 12: Subscription & Payment (8 endpoints) ──
  { group: "Subscription", path: "subscription/plans", method: "GET", desc: "Get available subscription plans", auth: false, request: {}, response: { plans: [{ id: "string", name: "Pro Brain", price: 299, currency: "INR", features: ["AI Agent", "Voice Chat"], period: "monthly" }] } },
  { group: "Subscription", path: "subscription/subscribe", method: "POST", desc: "Subscribe to a plan", auth: true, request: { plan_id: "string", payment_method: "razorpay" }, response: { order_id: "string", payment_url: "string", status: "pending" } },
  { group: "Subscription", path: "subscription/cancel", method: "POST", desc: "Cancel active subscription", auth: true, request: { reason: "string" }, response: { success: true, active_until: "ISO_DATE" } },
  { group: "Subscription", path: "subscription/status", method: "GET", desc: "Get current subscription status", auth: true, request: {}, response: { plan: "pro", status: "active", expires_at: "ISO_DATE", features: ["string"] } },
  { group: "Subscription", path: "subscription/history", method: "GET", desc: "Get subscription payment history", auth: true, request: {}, response: { payments: [{ id: "uuid", amount: 299, date: "ISO_DATE", status: "paid" }] } },
  { group: "Subscription", path: "subscription/upgrade", method: "POST", desc: "Upgrade to higher plan", auth: true, request: { plan_id: "ultra" }, response: { order_id: "string", prorated_amount: 150 } },
  { group: "Subscription", path: "subscription/downgrade", method: "POST", desc: "Downgrade to lower plan", auth: true, request: { plan_id: "free" }, response: { success: true, effective_date: "ISO_DATE" } },
  { group: "Subscription", path: "subscription/invoice", method: "GET", desc: "Get invoice for a payment", auth: true, request: {}, response: { invoice_id: "string", amount: 299, tax: 54, total: 353, pdf_url: "string" } },

  // ── Section 13: Admin Control (10 endpoints) ──
  { group: "Admin Control", path: "admin/dashboard", method: "GET", desc: "Get admin dashboard overview", auth: true, request: {}, response: { total_users: 15000, active_today: 3200, revenue_mtd: 450000, ai_requests_today: 28000 } },
  { group: "Admin Control", path: "admin/users", method: "GET", desc: "List all users with filters", auth: true, request: {}, response: { users: [{ id: "uuid", email: "string", plan: "pro", last_active: "ISO_DATE" }], total: 15000, page: 1 } },
  { group: "Admin Control", path: "admin/user/update", method: "PUT", desc: "Update user details (admin)", auth: true, request: { user_id: "uuid", plan: "pro", is_banned: false }, response: { success: true } },
  { group: "Admin Control", path: "admin/user/suspend", method: "POST", desc: "Suspend a user account", auth: true, request: { user_id: "uuid", reason: "string", duration_days: 7 }, response: { success: true, suspended_until: "ISO_DATE" } },
  { group: "Admin Control", path: "admin/ai-model/status", method: "GET", desc: "Get AI model health & metrics", auth: true, request: {}, response: { models: [{ name: "memory_engine", accuracy: 0.87, latency_ms: 120, last_trained: "ISO_DATE" }] } },
  { group: "Admin Control", path: "admin/ai-model/retrain", method: "POST", desc: "Trigger AI model retraining", auth: true, request: { model_name: "memory_engine" }, response: { job_id: "uuid", status: "queued", estimated_time: 1800 } },
  { group: "Admin Control", path: "admin/system-health", method: "GET", desc: "Get system health metrics", auth: true, request: {}, response: { uptime: "99.9%", avg_latency: 120, db_connections: 45, active_functions: 28 } },
  { group: "Admin Control", path: "admin/logs", method: "GET", desc: "Get system audit logs", auth: true, request: {}, response: { logs: [{ action: "string", admin_id: "uuid", target: "string", created_at: "ISO_DATE" }] } },
  { group: "Admin Control", path: "admin/send-notification", method: "POST", desc: "Send notification to users", auth: true, request: { title: "string", body: "string", audience: "all" }, response: { success: true, recipients: 15000 } },
  { group: "Admin Control", path: "admin/revenue", method: "GET", desc: "Get revenue analytics", auth: true, request: {}, response: { mtd: 450000, last_month: 380000, growth: 18.4, by_plan: { pro: 280000, ultra: 170000 } } },

  // ── Section 14: API Key Management (8 endpoints) ──
  { group: "API Key Mgmt", path: "api-key/generate", method: "POST", desc: "Generate new API key", auth: true, request: { name: "string", environment: "production", permissions: ["read", "write"] }, response: { api_key: "acry_live_...", key_id: "uuid", prefix: "acry_live" } },
  { group: "API Key Mgmt", path: "api-key/list", method: "GET", desc: "List all API keys", auth: true, request: {}, response: { keys: [{ id: "uuid", name: "string", prefix: "acry_live", is_active: true, usage_count: 1200 }] } },
  { group: "API Key Mgmt", path: "api-key/update", method: "PUT", desc: "Update API key settings", auth: true, request: { key_id: "uuid", name: "string", permissions: ["read"] }, response: { success: true } },
  { group: "API Key Mgmt", path: "api-key/revoke", method: "DELETE", desc: "Revoke an API key permanently", auth: true, request: { key_id: "uuid" }, response: { success: true, revoked_at: "ISO_DATE" } },
  { group: "API Key Mgmt", path: "api-key/usage", method: "GET", desc: "Get API key usage statistics", auth: true, request: {}, response: { key_id: "uuid", total_requests: 12000, today: 450, errors: 12, avg_latency: 85 } },
  { group: "API Key Mgmt", path: "api-key/logs", method: "GET", desc: "Get API key request logs", auth: true, request: {}, response: { logs: [{ path: "string", method: "GET", status: 200, latency_ms: 85, created_at: "ISO_DATE" }] } },
  { group: "API Key Mgmt", path: "api-key/permissions", method: "PUT", desc: "Update API key permissions", auth: true, request: { key_id: "uuid", permissions: ["read", "write", "admin"] }, response: { success: true } },
  { group: "API Key Mgmt", path: "api-key/stats", method: "GET", desc: "Get aggregated API key stats", auth: true, request: {}, response: { total_keys: 8, active: 6, total_requests: 85000, error_rate: 0.2 } },

  // ── Section 15: Analytics (5 endpoints) ──
  { group: "Analytics", path: "analytics/user-growth", method: "GET", desc: "Get user growth analytics", auth: true, request: {}, response: { total: 15000, new_today: 45, new_this_week: 280, trend: [{ date: "ISO_DATE", users: 14800 }] } },
  { group: "Analytics", path: "analytics/brain-usage", method: "GET", desc: "Get brain feature usage stats", auth: true, request: {}, response: { daily_predictions: 28000, avg_accuracy: 0.87, popular_features: [{ feature: "memory_engine", usage: 12000 }] } },
  { group: "Analytics", path: "analytics/api-usage", method: "GET", desc: "Get API usage analytics", auth: true, request: {}, response: { total_requests: 1200000, by_endpoint: [{ path: "string", count: 45000 }], avg_latency: 95 } },
  { group: "Analytics", path: "analytics/performance", method: "GET", desc: "Get system performance metrics", auth: true, request: {}, response: { avg_response_ms: 95, p95_ms: 250, p99_ms: 450, uptime: 99.95, error_rate: 0.15 } },
  { group: "Analytics", path: "analytics/ai-accuracy", method: "GET", desc: "Get AI prediction accuracy", auth: true, request: {}, response: { overall: 0.87, by_model: [{ model: "memory_engine", accuracy: 0.89 }, { model: "rank_predictor", accuracy: 0.82 }] } },

  // ── Section 16: Topics & Subjects (14 endpoints) ──
  { group: "Topics & Subjects", path: "subjects/list", method: "GET", desc: "Get all user subjects", auth: true, request: {}, response: { subjects: [{ id: "uuid", name: "Physics", topic_count: 32, avg_strength: 72 }] } },
  { group: "Topics & Subjects", path: "subjects/create", method: "POST", desc: "Create a new subject", auth: true, request: { name: "Physics" }, response: { id: "uuid", name: "Physics", created_at: "ISO_DATE" } },
  { group: "Topics & Subjects", path: "subjects/update", method: "PUT", desc: "Rename or update a subject", auth: true, request: { subject_id: "uuid", name: "Advanced Physics" }, response: { success: true } },
  { group: "Topics & Subjects", path: "subjects/delete", method: "DELETE", desc: "Delete a subject (soft delete)", auth: true, request: { subject_id: "uuid" }, response: { success: true } },
  { group: "Topics & Subjects", path: "topics/list", method: "GET", desc: "Get all topics (with filters)", auth: true, request: {}, response: { topics: [{ id: "uuid", name: "Thermodynamics", subject_id: "uuid", memory_strength: 0.72, next_review: "ISO_DATE", last_revision_date: "ISO_DATE", revision_count: 8 }] } },
  { group: "Topics & Subjects", path: "topics/create", method: "POST", desc: "Create topic under a subject", auth: true, request: { name: "Thermodynamics", subject_id: "uuid" }, response: { id: "uuid", name: "Thermodynamics" } },
  { group: "Topics & Subjects", path: "topics/bulk-create", method: "POST", desc: "Create multiple topics at once", auth: true, request: { subject_id: "uuid", topics: ["Thermodynamics", "Optics", "Mechanics"] }, response: { created: 3, topics: [{ id: "uuid", name: "string" }] } },
  { group: "Topics & Subjects", path: "topics/update", method: "PUT", desc: "Update topic name or metadata", auth: true, request: { topic_id: "uuid", name: "Advanced Thermodynamics" }, response: { success: true } },
  { group: "Topics & Subjects", path: "topics/delete", method: "DELETE", desc: "Soft-delete a topic", auth: true, request: { topic_id: "uuid" }, response: { success: true } },
  { group: "Topics & Subjects", path: "topics/restore", method: "POST", desc: "Restore soft-deleted topic from trash", auth: true, request: { topic_id: "uuid" }, response: { success: true } },
  { group: "Topics & Subjects", path: "topics/trash", method: "GET", desc: "Get all soft-deleted topics", auth: true, request: {}, response: { topics: [{ id: "uuid", name: "string", deleted_at: "ISO_DATE" }] } },
  { group: "Topics & Subjects", path: "topics/by-subject", method: "GET", desc: "Get topics filtered by subject", auth: true, request: {}, response: { topics: [{ id: "uuid", name: "string", memory_strength: 0.65 }] } },
  { group: "Topics & Subjects", path: "topics/ai-extract", method: "POST", desc: "AI-extract topics from text/PDF/image", auth: true, request: { content: "string", source_type: "text" }, response: { extracted_topics: ["string"], subject_suggestion: "Physics" } },
  { group: "Topics & Subjects", path: "topics/merge", method: "POST", desc: "Merge duplicate topics into one", auth: true, request: { source_topic_ids: ["uuid"], target_topic_id: "uuid" }, response: { success: true, merged_count: 2 } },

  // ── Section 17: Streaks & Gamification (12 endpoints) ──
  { group: "Streaks & Gamification", path: "streak/status", method: "GET", desc: "Get current streak status", auth: true, request: {}, response: { current_streak: 15, longest_streak: 42, streak_active: true, last_study_date: "ISO_DATE", freeze_count: 2 } },
  { group: "Streaks & Gamification", path: "streak/history", method: "GET", desc: "Get streak history timeline", auth: true, request: {}, response: { history: [{ date: "ISO_DATE", studied: true, minutes: 45, freeze_used: false }] } },
  { group: "Streaks & Gamification", path: "streak/freeze/list", method: "GET", desc: "Get available streak freezes", auth: true, request: {}, response: { freezes: [{ id: "uuid", source: "earned", expires_at: "ISO_DATE" }], total: 3 } },
  { group: "Streaks & Gamification", path: "streak/freeze/use", method: "POST", desc: "Use a streak freeze for today", auth: true, request: { freeze_id: "uuid" }, response: { success: true, remaining_freezes: 2 } },
  { group: "Streaks & Gamification", path: "streak/freeze/gift", method: "POST", desc: "Gift a streak freeze to another user", auth: true, request: { freeze_id: "uuid", recipient_email: "string" }, response: { gift_id: "uuid", status: "pending" } },
  { group: "Streaks & Gamification", path: "streak/freeze/accept", method: "POST", desc: "Accept a gifted streak freeze", auth: true, request: { gift_id: "uuid" }, response: { success: true } },
  { group: "Streaks & Gamification", path: "xp/status", method: "GET", desc: "Get XP and level status", auth: true, request: {}, response: { total_xp: 2450, current_level: 7, xp_to_next: 550, level_name: "Brain Architect" } },
  { group: "Streaks & Gamification", path: "xp/history", method: "GET", desc: "Get XP earning history", auth: true, request: {}, response: { history: [{ date: "ISO_DATE", xp_earned: 45, source: "study_session" }] } },
  { group: "Streaks & Gamification", path: "achievements/list", method: "GET", desc: "Get all achievements & badges", auth: true, request: {}, response: { achievements: [{ id: "string", title: "7-Day Streak", unlocked: true, unlocked_at: "ISO_DATE", icon: "flame" }] } },
  { group: "Streaks & Gamification", path: "leaderboard/global", method: "GET", desc: "Get global leaderboard rankings", auth: true, request: {}, response: { rankings: [{ rank: 1, user_id: "uuid", display_name: "string", xp: 9500 }], my_rank: 234 } },
  { group: "Streaks & Gamification", path: "leaderboard/friends", method: "GET", desc: "Get friends leaderboard", auth: true, request: {}, response: { rankings: [{ rank: 1, user_id: "uuid", display_name: "string", xp: 5200 }] } },
  { group: "Streaks & Gamification", path: "missions/active", method: "GET", desc: "Get active brain missions", auth: true, request: {}, response: { missions: [{ id: "uuid", title: "string", target_value: 5, current_value: 3, reward_xp: 50, expires_at: "ISO_DATE" }] } },

  // ── Section 18: Community (14 endpoints) ──
  { group: "Community", path: "community/list", method: "GET", desc: "List all active communities", auth: true, request: {}, response: { communities: [{ id: "uuid", name: "string", slug: "string", category: "exam", member_count: 1200, is_member: true }] } },
  { group: "Community", path: "community/create", method: "POST", desc: "Create a new community", auth: true, request: { name: "NEET Warriors", description: "string", category: "exam" }, response: { id: "uuid", slug: "neet-warriors" } },
  { group: "Community", path: "community/join", method: "POST", desc: "Join a community", auth: true, request: { community_id: "uuid" }, response: { success: true, member_count: 1201 } },
  { group: "Community", path: "community/leave", method: "POST", desc: "Leave a community", auth: true, request: { community_id: "uuid" }, response: { success: true } },
  { group: "Community", path: "community/posts/feed", method: "GET", desc: "Get community posts feed", auth: true, request: {}, response: { posts: [{ id: "uuid", title: "string", body: "string", author: "string", upvote_count: 24, comment_count: 8, community_name: "string", created_at: "ISO_DATE" }] } },
  { group: "Community", path: "community/posts/create", method: "POST", desc: "Create a new community post", auth: true, request: { community_id: "uuid", title: "string", body: "string", tags: ["neet"] }, response: { id: "uuid", slug: "string" } },
  { group: "Community", path: "community/posts/vote", method: "POST", desc: "Upvote or downvote a post", auth: true, request: { post_id: "uuid", vote_type: "up" }, response: { success: true, new_score: 25 } },
  { group: "Community", path: "community/posts/comment", method: "POST", desc: "Comment on a community post", auth: true, request: { post_id: "uuid", body: "string" }, response: { comment_id: "uuid" } },
  { group: "Community", path: "community/posts/bookmark", method: "POST", desc: "Bookmark a community post", auth: true, request: { post_id: "uuid" }, response: { success: true } },
  { group: "Community", path: "community/posts/saved", method: "GET", desc: "Get all bookmarked/saved posts", auth: true, request: {}, response: { posts: [{ id: "uuid", title: "string", saved_at: "ISO_DATE" }] } },
  { group: "Community", path: "community/karma", method: "GET", desc: "Get user karma/reputation score", auth: true, request: {}, response: { karma_points: 450, rank_title: "Rising Star" } },
  { group: "Community", path: "community/study-pods/list", method: "GET", desc: "List available study pods", auth: true, request: {}, response: { pods: [{ id: "uuid", name: "string", members: 5, max_members: 8, subject: "Physics", active: true }] } },
  { group: "Community", path: "community/study-pods/join", method: "POST", desc: "Join a study pod", auth: true, request: { pod_id: "uuid" }, response: { success: true } },
  { group: "Community", path: "community/ai-answer", method: "POST", desc: "Get AI-generated answer for a post", auth: true, request: { post_id: "uuid" }, response: { answer: "string", confidence: 0.92 } },

  // ── Section 19: SureShot & Confidence Practice (10 endpoints) ──
  { group: "SureShot", path: "sureshot/dashboard", method: "GET", desc: "Get SureShot confidence dashboard", auth: true, request: {}, response: { match_score: 87, readiness_level: "high", weak_areas: 3, strong_areas: 18, last_practice: "ISO_DATE" } },
  { group: "SureShot", path: "sureshot/start-session", method: "POST", desc: "Start confidence practice session", auth: true, request: { exam_type: "NEET", subject: "Physics", difficulty: "medium", question_count: 10 }, response: { session_id: "uuid", questions: [{ id: "uuid", text: "string", options: ["A","B","C","D"], difficulty: "medium" }] } },
  { group: "SureShot", path: "sureshot/submit-answer", method: "POST", desc: "Submit answer during practice", auth: true, request: { session_id: "uuid", question_id: "uuid", selected_option: 2, time_taken_seconds: 18 }, response: { correct: true, correct_answer: 2, explanation: "string", confidence_delta: 3 } },
  { group: "SureShot", path: "sureshot/end-session", method: "POST", desc: "End confidence practice session", auth: true, request: { session_id: "uuid" }, response: { score: 82, correct: 8, total: 10, time_used: 180, confidence_improvement: 5, mentor_suggestion: "string" } },
  { group: "SureShot", path: "sureshot/history", method: "GET", desc: "Get practice session history", auth: true, request: {}, response: { sessions: [{ id: "uuid", exam_type: "NEET", score: 82, date: "ISO_DATE", questions: 10 }] } },
  { group: "SureShot", path: "sureshot/exam-types", method: "GET", desc: "Get supported exam types & subjects", auth: false, request: {}, response: { exams: [{ name: "NEET", subjects: ["Physics", "Chemistry", "Biology"] }] } },
  { group: "SureShot", path: "sureshot/weak-analysis", method: "GET", desc: "Get weak area analysis per exam", auth: true, request: {}, response: { weak_areas: [{ subject: "Physics", topic: "Optics", accuracy: 45, attempts: 12 }] } },
  { group: "SureShot", path: "sureshot/progress-trend", method: "GET", desc: "Get confidence progress over time", auth: true, request: {}, response: { trend: [{ date: "ISO_DATE", accuracy: 72, confidence: 68 }], improvement_rate: 2.5 } },
  { group: "SureShot", path: "sureshot/mentor-tip", method: "GET", desc: "Get AI mentor suggestion for practice", auth: true, request: {}, response: { tip: "string", focus_area: "Optics", recommended_questions: 15 } },
  { group: "SureShot", path: "sureshot/download-report", method: "GET", desc: "Download practice performance report", auth: true, request: {}, response: { report_url: "string", generated_at: "ISO_DATE" } },

  // ── Section 20: Current Affairs Intelligence (10 endpoints) ──
  { group: "Current Affairs", path: "current-affairs/events", method: "GET", desc: "Get latest current affairs events", auth: true, request: {}, response: { events: [{ id: "uuid", title: "string", category: "economy", importance_score: 85, event_date: "ISO_DATE", summary: "string" }] } },
  { group: "Current Affairs", path: "current-affairs/event-detail", method: "GET", desc: "Get detailed event with analysis", auth: true, request: {}, response: { id: "uuid", title: "string", raw_content: "string", ai_analysis: {}, syllabus_links: [{ subject: "string", micro_topic: "string", relevance_score: 0.9 }] } },
  { group: "Current Affairs", path: "current-affairs/quiz", method: "POST", desc: "Generate CA quiz from recent events", auth: true, request: { category: "economy", count: 10 }, response: { questions: [{ id: "uuid", text: "string", options: ["A","B","C","D"], correct: 2, event_id: "uuid" }] } },
  { group: "Current Affairs", path: "current-affairs/debate-topics", method: "GET", desc: "Get debate/essay topics from events", auth: true, request: {}, response: { topics: [{ id: "uuid", title: "string", pro_arguments: ["string"], counter_arguments: ["string"], exam_relevance: 0.85 }] } },
  { group: "Current Affairs", path: "current-affairs/policy-analysis", method: "GET", desc: "Get policy impact analysis", auth: true, request: {}, response: { policies: [{ id: "uuid", title: "string", impact_score: 0.78, exam_probability: 0.65, affected_topics: ["string"] }] } },
  { group: "Current Affairs", path: "current-affairs/syllabus-mapping", method: "GET", desc: "Map events to exam syllabus", auth: true, request: {}, response: { mappings: [{ event_id: "uuid", subject: "string", topic: "string", tpi_impact: 0.12 }] } },
  { group: "Current Affairs", path: "current-affairs/writing-practice", method: "POST", desc: "Submit essay/answer for evaluation", auth: true, request: { topic_id: "uuid", answer: "string" }, response: { overall_score: 78, structure_score: 80, clarity_score: 75, feedback: "string", model_answer: "string" } },
  { group: "Current Affairs", path: "current-affairs/daily-digest", method: "GET", desc: "Get daily CA digest briefing", auth: true, request: {}, response: { date: "ISO_DATE", events_count: 8, top_events: [{ title: "string", importance: "high" }], exam_alerts: ["string"] } },
  { group: "Current Affairs", path: "current-affairs/knowledge-graph", method: "GET", desc: "Get CA event knowledge graph", auth: true, request: {}, response: { nodes: [{ id: "uuid", label: "string", type: "event" }], edges: [{ event_id: "uuid", target_label: "string", edge_type: "impacts" }] } },
  { group: "Current Affairs", path: "current-affairs/probability-adjustments", method: "GET", desc: "Get topic probability shifts from CA", auth: true, request: {}, response: { adjustments: [{ topic_name: "string", old_probability: 0.3, new_probability: 0.45, reason: "string" }] } },

  // ── Section 21: Onboarding Flow — 6-Step Wizard (14 endpoints) ──
  { group: "Onboarding", path: "onboarding/status", method: "GET", desc: "Get onboarding progress & current step", auth: true, request: {}, response: { completed: false, current_step: 2, total_steps: 6, steps_data: { display_name: "string", exam_type: "string", exam_date: "string" } } },
  { group: "Onboarding", path: "onboarding/save-step", method: "POST", desc: "Save individual step data (auto-advances)", auth: true, request: { step: 1, data: { display_name: "string" } }, response: { success: true, next_step: 2 } },
  // Step 1: Display Name
  { group: "Onboarding", path: "onboarding/step1-name", method: "POST", desc: "Step 1 — Save display name (min 2 chars, pre-filled from OAuth metadata)", auth: true, request: { display_name: "string" }, response: { success: true, next_step: 2 } },
  // Step 2: Exam Selection (30+ exams across 3 categories)
  { group: "Onboarding", path: "onboarding/exam-types", method: "GET", desc: "Step 2 — Get available exam types grouped by category (Government/Entrance/Global)", auth: false, request: {}, response: { categories: [{ id: "government", label: "🏛️ Government", exams: [{ id: "ssc_cgl", label: "SSC CGL", desc: "Staff Selection" }] }, { id: "entrance", label: "🎓 Entrance", exams: [{ id: "neet_ug", label: "NEET UG", desc: "Medical" }] }, { id: "global", label: "🌍 Global", exams: [{ id: "sat", label: "SAT", desc: "US Colleges" }] }] } },
  { group: "Onboarding", path: "onboarding/step2-exam", method: "POST", desc: "Step 2 — Save selected exam type (supports custom exam via 'other_*' ids)", auth: true, request: { exam_type: "neet_ug", custom_exam_name: null }, response: { success: true, suggested_subjects: ["Physics", "Chemistry", "Biology"], next_step: 3 } },
  // Step 3: Exam Date
  { group: "Onboarding", path: "onboarding/step3-date", method: "POST", desc: "Step 3 — Save target exam date", auth: true, request: { exam_date: "2025-05-01" }, response: { success: true, days_until_exam: 120, next_step: 4 } },
  // Step 4: Subjects
  { group: "Onboarding", path: "onboarding/suggested-subjects", method: "GET", desc: "Step 4 — Get AI-suggested subjects for selected exam type", auth: true, request: {}, response: { subjects: ["Physics", "Chemistry", "Biology (Botany)", "Biology (Zoology)"] } },
  { group: "Onboarding", path: "onboarding/step4-subjects", method: "POST", desc: "Step 4 — Save selected subjects (can add custom subjects)", auth: true, request: { subjects: ["Physics", "Chemistry", "Biology"] }, response: { success: true, next_step: 5 } },
  // Step 5: Topics per Subject + AI Curriculum Generation
  { group: "Onboarding", path: "onboarding/suggested-topics", method: "GET", desc: "Step 5 — Get suggested topics for a specific subject", auth: true, request: { subject: "Physics" }, response: { topics: ["Mechanics", "Thermodynamics", "Optics", "Electromagnetism", "Modern Physics", "Waves"] } },
  { group: "Onboarding", path: "onboarding/ai-generate-curriculum", method: "POST", desc: "Step 5 — AI auto-generates full curriculum (subjects + topics) for exam type using Gemini", auth: true, request: { exam_type: "NEET UG" }, response: { subjects: [{ name: "Physics", topics: [{ name: "Mechanics" }, { name: "Thermodynamics" }] }, { name: "Chemistry", topics: [{ name: "Organic Chemistry" }] }], model: "gemini-2.5-flash-lite" } },
  { group: "Onboarding", path: "onboarding/step5-topics", method: "POST", desc: "Step 5 — Save topics mapped to each subject", auth: true, request: { topics_by_subject: { Physics: ["Mechanics", "Optics"], Chemistry: ["Organic", "Inorganic"] } }, response: { success: true, total_topics: 25, next_step: 6 } },
  // Step 6: Study Mode
  { group: "Onboarding", path: "onboarding/step6-mode", method: "POST", desc: "Step 6 — Save study mode preference (lazy/focus/emergency)", auth: true, request: { study_mode: "focus" }, response: { success: true } },
  // Completion
  { group: "Onboarding", path: "onboarding/complete", method: "POST", desc: "Finalize onboarding — updates profile, creates subjects & topics in DB, triggers welcome events", auth: true, request: { display_name: "string", exam_type: "NEET UG", exam_date: "2025-05-01", subjects: ["Physics"], topics_by_subject: { Physics: ["Mechanics"] }, study_mode: "focus" }, response: { success: true, redirect_to: "/app", profile_updated: true, subjects_created: 4, topics_created: 28 } },
  { group: "Onboarding", path: "onboarding/skip", method: "POST", desc: "Skip onboarding (sets minimal profile, can complete later)", auth: true, request: {}, response: { success: true, redirect_to: "/app" } },

  // ── Section 22: Storage & File Management (5 endpoints) ──
  { group: "Storage", path: "storage/upload-avatar", method: "POST", desc: "Upload user avatar image", auth: true, request: { image_base64: "string", content_type: "image/png" }, response: { url: "https://...", size_kb: 85 } },
  { group: "Storage", path: "storage/upload-note-image", method: "POST", desc: "Upload image attachment for notes", auth: true, request: { image_base64: "string" }, response: { url: "https://..." } },
  { group: "Storage", path: "storage/upload-voice", method: "POST", desc: "Upload voice recording", auth: true, request: { audio_base64: "string", duration_seconds: 30 }, response: { url: "https://...", transcript: "string" } },
  { group: "Storage", path: "storage/list-files", method: "GET", desc: "List user uploaded files", auth: true, request: {}, response: { files: [{ name: "string", url: "string", size_kb: 120, type: "image", created_at: "ISO_DATE" }] } },
  { group: "Storage", path: "storage/delete-file", method: "DELETE", desc: "Delete an uploaded file", auth: true, request: { file_path: "string" }, response: { success: true } },

  // ── Section 23: Focus Shield & Cognitive Control (14 endpoints) ──
  { group: "Focus Shield", path: "focus-shield/status", method: "GET", desc: "Get Focus Shield active status & config", auth: true, request: {}, response: { enabled: true, focus_level: "deep", shield_strength: 85, session_active: true, config: { warning_interval: 300, freeze_duration: 60, micro_recall: true } } },
  { group: "Focus Shield", path: "focus-shield/cognitive-predict", method: "POST", desc: "Run predictive cognitive analysis", auth: true, request: { time_of_day: 14, fatigue_level: 0.4, app_switches: 12, error_cluster: 0.3, latency_spikes: 0.2, mock_frustration: 0.15 }, response: { distraction_probability: 0.67, cognitive_state: "surface_focus", impulse_score: 0.45, intervention_stage: 1, lock_duration_seconds: 120 } },
  { group: "Focus Shield", path: "focus-shield/attention-prediction", method: "GET", desc: "Get latest attention drift prediction", auth: true, request: {}, response: { distraction_probability: 0.67, cognitive_state: "deep_focus", impulse_score: 0.3, fatigue_level: 0.4, time_of_day_risk: 0.5, predicted_at: "ISO_DATE" } },
  { group: "Focus Shield", path: "focus-shield/attention-history", method: "GET", desc: "Get attention prediction history", auth: true, request: {}, response: { predictions: [{ predicted_at: "ISO_DATE", distraction_probability: 0.45, cognitive_state: "deep_focus", intervention_triggered: null }] } },
  { group: "Focus Shield", path: "focus-shield/cognitive-state", method: "GET", desc: "Get current cognitive state classification", auth: true, request: {}, response: { state: "deep_focus", confidence: 0.85, factors: { fatigue: 0.2, impulse: 0.3, focus_duration: 45 }, recommendation: "Continue current session" } },
  { group: "Focus Shield", path: "focus-shield/cognitive-history", method: "GET", desc: "Get cognitive state history timeline", auth: true, request: {}, response: { history: [{ state: "deep_focus", started_at: "ISO_DATE", duration_minutes: 25 }] } },
  { group: "Focus Shield", path: "focus-shield/neural-discipline", method: "GET", desc: "Get neural discipline score & stats", auth: true, request: {}, response: { total_score: 450, distractions_resisted: 28, total_distractions: 35, resistance_rate: 0.8, streak_days: 7, level: "Disciplined" } },
  { group: "Focus Shield", path: "focus-shield/neural-discipline/history", method: "GET", desc: "Get neural discipline score trend", auth: true, request: {}, response: { trend: [{ date: "ISO_DATE", score: 420, resisted: 5, total: 6 }] } },
  { group: "Focus Shield", path: "focus-shield/intervention/log", method: "POST", desc: "Log intervention response (accepted/dismissed)", auth: true, request: { intervention_stage: 2, action: "accepted", recall_passed: true, time_to_respond_seconds: 8 }, response: { success: true, discipline_xp_earned: 15, new_score: 465 } },
  { group: "Focus Shield", path: "focus-shield/lock-config", method: "GET", desc: "Get adaptive lock engine configuration", auth: true, request: {}, response: { base_lock_seconds: 60, min_lock: 30, max_lock: 300, exam_proximity_multiplier: 1.5, burnout_reduction_factor: 0.7, cognitive_state_enabled: true } },
  { group: "Focus Shield", path: "focus-shield/lock-config/update", method: "PUT", desc: "Update adaptive lock configuration (admin)", auth: true, request: { base_lock_seconds: 90, prediction_threshold: 0.7 }, response: { success: true } },
  { group: "Focus Shield", path: "focus-shield/dopamine-reward", method: "POST", desc: "Trigger dopamine replacement reward", auth: true, request: { reward_type: "stability_boost", focus_streak_minutes: 50 }, response: { animation: "stability_boost", multiplier: 1.5, xp_earned: 25, message: "Amazing focus streak!" } },
  { group: "Focus Shield", path: "focus-shield/impulse-challenge", method: "GET", desc: "Get impulse delay challenge (recall/breathing)", auth: true, request: {}, response: { challenge_type: "micro_recall", question: "What is the SI unit of force?", options: ["Newton", "Joule", "Watt", "Pascal"], correct_answer: 0, time_limit_seconds: 15 } },
  { group: "Focus Shield", path: "focus-shield/impulse-challenge/submit", method: "POST", desc: "Submit impulse challenge response", auth: true, request: { challenge_type: "micro_recall", answer_index: 0, time_taken_seconds: 8 }, response: { passed: true, can_unlock: true, discipline_xp: 10 } },

  // ── Section 24: Accelerator Program (8 endpoints) ──
  { group: "Accelerator", path: "accelerator/status", method: "GET", desc: "Get accelerator enrollment status", auth: true, request: {}, response: { enrolled: true, status: "active", days_completed: 12, total_days: 30, progress_percentage: 40, intensity_level: "high", ai_strategy: "aggressive_weak_first" } },
  { group: "Accelerator", path: "accelerator/enroll", method: "POST", desc: "Enroll in accelerator program", auth: true, request: { start_date: "2025-03-01", end_date: "2025-03-30", intensity_level: "high", target_exam_type: "NEET" }, response: { enrollment_id: "uuid", daily_schedule: {}, ai_strategy: "aggressive_weak_first" } },
  { group: "Accelerator", path: "accelerator/daily-plan", method: "GET", desc: "Get today's accelerator study plan", auth: true, request: {}, response: { day_number: 12, sessions: [{ topic: "string", duration: 30, mode: "focus", priority: 1 }], total_minutes: 180, target_topics: 8 } },
  { group: "Accelerator", path: "accelerator/log-progress", method: "POST", desc: "Log daily accelerator progress", auth: true, request: { day_number: 12, sessions_completed: 5, total_minutes: 150 }, response: { success: true, new_progress: 42, on_track: true } },
  { group: "Accelerator", path: "accelerator/weak-topics", method: "GET", desc: "Get AI-identified weak topics for accelerator", auth: true, request: {}, response: { topics: [{ name: "string", strength: 28, priority: 1, recommended_sessions: 3 }] } },
  { group: "Accelerator", path: "accelerator/high-probability", method: "GET", desc: "Get high-probability exam topics", auth: true, request: {}, response: { topics: [{ name: "string", probability: 0.85, last_appeared: "2024", recommended_depth: "deep" }] } },
  { group: "Accelerator", path: "accelerator/adjust-strategy", method: "PUT", desc: "AI-adjust accelerator strategy", auth: true, request: { intensity_level: "medium" }, response: { success: true, new_strategy: "balanced", adjusted_schedule: {} } },
  { group: "Accelerator", path: "accelerator/report", method: "GET", desc: "Get accelerator progress report", auth: true, request: {}, response: { total_days: 30, completed: 12, avg_daily_minutes: 145, topics_improved: 18, strength_gain: 15, predicted_rank_improvement: 50 } },

  // ── Section 25: Debate & Writing Lab (9 endpoints) ──
  { group: "Debate & Writing", path: "debate/topics", method: "GET", desc: "Get debate topics from current affairs", auth: true, request: {}, response: { topics: [{ id: "uuid", title: "string", pro_arguments: ["string"], counter_arguments: ["string"], constitutional_link: "string", exam_relevance: 0.85 }] } },
  { group: "Debate & Writing", path: "debate/topic-detail", method: "GET", desc: "Get full debate topic analysis", auth: true, request: {}, response: { topic: { title: "string", context: "string", ethical_dimension: "string", economic_dimension: "string", international_perspective: "string", frameworks: ["PESTLE", "SWOT"] } } },
  { group: "Debate & Writing", path: "debate/start-practice", method: "POST", desc: "Start a debate writing practice session", auth: true, request: { topic_id: "uuid", time_limit_minutes: 30 }, response: { session_id: "uuid", topic: {}, started_at: "ISO_DATE" } },
  { group: "Debate & Writing", path: "debate/submit-answer", method: "POST", desc: "Submit written answer for AI evaluation", auth: true, request: { topic_id: "uuid", answer: "string", time_taken_seconds: 1200 }, response: { overall_score: 78, structure_score: 80, clarity_score: 75, depth_score: 72, evidence_score: 70, logical_flow_score: 82, feedback: "string", model_answer: "string", improvement_areas: ["string"], strengths: ["string"] } },
  { group: "Debate & Writing", path: "debate/evaluations/history", method: "GET", desc: "Get writing evaluation history", auth: true, request: {}, response: { evaluations: [{ id: "uuid", topic_title: "string", overall_score: 78, created_at: "ISO_DATE", word_count: 450 }] } },
  { group: "Debate & Writing", path: "debate/frameworks", method: "GET", desc: "Get analytical frameworks for a topic", auth: true, request: {}, response: { frameworks: [{ type: "PESTLE", summary: "string", quality_score: 0.8 }] } },
  { group: "Debate & Writing", path: "debate/model-answer", method: "GET", desc: "Get AI model answer for a topic", auth: true, request: {}, response: { answer: "string", structure: { intro: "string", body: ["string"], conclusion: "string" }, word_count: 500 } },
  { group: "Debate & Writing", path: "debate/compare", method: "POST", desc: "Compare user answer with model answer", auth: true, request: { evaluation_id: "uuid" }, response: { user_score: 78, model_score: 92, gap_analysis: ["string"], key_points_missed: ["string"] } },
  { group: "Debate & Writing", path: "debate/improvement-plan", method: "GET", desc: "Get personalized writing improvement plan", auth: true, request: {}, response: { weak_dimensions: ["evidence", "structure"], recommended_topics: ["string"], daily_practice_minutes: 20, expected_improvement: 15 } },

  // ── Section 26: Voice & Push Notifications (10 endpoints) ──
  { group: "Voice & Push", path: "voice/generate", method: "POST", desc: "Generate voice notification audio", auth: true, request: { type: "welcome", language: "en", tone: "soft", context: { userName: "string" } }, response: { audio_url: "string", duration_seconds: 8, transcript: "string" } },
  { group: "Voice & Push", path: "voice/settings", method: "GET", desc: "Get user voice notification settings", auth: true, request: {}, response: { enabled: true, voice_type: "female_calm", language: "en", volume: 0.8, scheduled_times: ["08:00", "20:00"] } },
  { group: "Voice & Push", path: "voice/settings/update", method: "PUT", desc: "Update voice notification settings", auth: true, request: { enabled: true, voice_type: "male_motivational", language: "en" }, response: { success: true } },
  { group: "Voice & Push", path: "push/subscribe", method: "POST", desc: "Register push notification subscription", auth: true, request: { endpoint: "string", keys: { p256dh: "string", auth: "string" } }, response: { subscription_id: "uuid", success: true } },
  { group: "Voice & Push", path: "push/unsubscribe", method: "POST", desc: "Remove push notification subscription", auth: true, request: { subscription_id: "uuid" }, response: { success: true } },
  { group: "Voice & Push", path: "push/send", method: "POST", desc: "Send push notification to user", auth: true, request: { title: "string", body: "string", url: "string", tag: "reminder" }, response: { sent: true, delivered_count: 1 } },
  { group: "Voice & Push", path: "push/subscriptions", method: "GET", desc: "Get user's push subscriptions", auth: true, request: {}, response: { subscriptions: [{ id: "uuid", device_name: "string", created_at: "ISO_DATE" }] } },
  { group: "Voice & Push", path: "notification/welcome", method: "POST", desc: "Send welcome notification bundle (email+push+voice)", auth: true, request: { user_id: "uuid", email: "string", display_name: "string", event: "signup" }, response: { email: { status: "sent" }, push: { status: "sent" }, voice: { status: "generated" } } },
  { group: "Voice & Push", path: "notification/study-reminder", method: "POST", desc: "Send study reminder via optimal channel", auth: true, request: { user_id: "uuid", topic: "string", urgency: "medium" }, response: { channel_used: "push", sent: true } },
  { group: "Voice & Push", path: "notification/weekly-report", method: "POST", desc: "Generate and send weekly study report", auth: true, request: { user_id: "uuid" }, response: { report_generated: true, channels: ["email", "push"], summary: { total_minutes: 420, topics_reviewed: 18 } } },

  // ── Section 27: Exam Simulator & Mock Tests (7 endpoints) ──
  { group: "Exam Simulator", path: "mock/exam-types", method: "GET", desc: "Get available exam simulation types", auth: false, request: {}, response: { exams: [{ id: "string", name: "NEET UG", subjects: ["Physics", "Chemistry", "Biology"], total_questions: 180, duration_minutes: 180 }] } },
  { group: "Exam Simulator", path: "mock/start", method: "POST", desc: "Start a full mock exam simulation", auth: true, request: { exam_type: "neet_ug", mode: "full", time_limit: true }, response: { session_id: "uuid", questions: [{ id: "uuid", text: "string", options: ["A","B","C","D"], subject: "Physics", marks: 4, negative_marks: -1 }], total_questions: 180, duration_seconds: 10800 } },
  { group: "Exam Simulator", path: "mock/submit-answer", method: "POST", desc: "Submit answer during mock exam", auth: true, request: { session_id: "uuid", question_id: "uuid", selected_option: 2, time_taken_seconds: 45 }, response: { recorded: true, questions_remaining: 179 } },
  { group: "Exam Simulator", path: "mock/end", method: "POST", desc: "End mock exam and get results", auth: true, request: { session_id: "uuid" }, response: { score: 520, max_score: 720, correct: 130, wrong: 20, skipped: 30, accuracy: 86.7, time_used_seconds: 9600, subject_wise: [{ subject: "Physics", score: 160, max: 180 }] } },
  { group: "Exam Simulator", path: "mock/review", method: "GET", desc: "Review mock exam answers with explanations", auth: true, request: {}, response: { questions: [{ id: "uuid", text: "string", user_answer: 2, correct_answer: 3, explanation: "string", topic: "Thermodynamics" }] } },
  { group: "Exam Simulator", path: "mock/history", method: "GET", desc: "Get mock exam attempt history", auth: true, request: {}, response: { exams: [{ session_id: "uuid", exam_type: "NEET", score: 520, date: "ISO_DATE", percentile: 85 }] } },
  { group: "Exam Simulator", path: "mock/analytics", method: "GET", desc: "Get mock exam performance analytics", auth: true, request: {}, response: { attempts: 8, avg_score: 510, best_score: 580, trend: "improving", weak_subjects: ["Physics"], strong_subjects: ["Biology"], time_management: { avg_per_question: 55, optimal: 60 } } },

  // ── Action Tab API (Unified Single Endpoint — 13 routes) ──
  { group: "Action Tab API", path: "action-tab-api/init", method: "POST", desc: "🔥 FULL ACTION TAB BOOTSTRAP — Single call returns recommended topic, study modes (with lock status), today's gains, active tasks, exam countdown. Call on tab open.", auth: true,
    request: { action: "init" },
    response: { recommended_topic: { id: "uuid", name: "Optics", subject: "Physics", stability: 28, estimated_time: "25 min deep session" }, study_modes: [{ id: "focus", title: "Focus Study Mode", description: "Deep Pomodoro sessions...", duration: "25-50 min", gain: "+8-12% stability", is_locked: false }], todays_gains: { stability_gain: 7.5, risk_reduction: 15, rank_change: 4.5, focus_score: 70, focus_streak: 3, study_minutes: 45, sessions_count: 3, weekly_data: [{ day: "Mon", value: 30 }] }, active_tasks: { tasks: [{ id: "uuid", title: "Review Optics", description: "Memory dropping", priority: "high", type: "urgent", topic_id: "uuid", estimated_minutes: 5, impact_level: "high" }], completed_today: 2, daily_goal: 5 }, exam_countdown: { phase: "acceleration", days_remaining: 12, exam_date: "2025-05-01", exam_type: "NEET", locked_modes: [], lock_message: "", recommended_mode: "focus", can_bypass: true, is_enabled: true, ai_reasoning: "...", confidence: 0.85 } }
  },
  { group: "Action Tab API", path: "action-tab-api/todays-gains", method: "POST", desc: "Refresh today's gains — stability gain, risk reduction, rank change, focus score, weekly chart, focus streak", auth: true,
    request: { action: "todays-gains" },
    response: { stability_gain: 7.5, risk_reduction: 15, rank_change: 4.5, focus_score: 70, focus_streak: 3, study_minutes: 45, sessions_count: 3, weekly_data: [{ day: "Mon", value: 30 }, { day: "Tue", value: 45 }] }
  },
  { group: "Action Tab API", path: "action-tab-api/session-history", method: "POST", desc: "Get focus session history with resolved subject/topic names. Filter by study mode.", auth: true,
    request: { action: "session-history", mode: "focus", limit: 50 },
    response: { sessions: [{ id: "uuid", duration_minutes: 25, confidence_level: "high", created_at: "ISO_DATE", subject: "Physics", topic: "Optics", notes: "", study_mode: "focus" }], subjects: { "uuid": "Physics" }, topics: { "uuid": "Optics" } }
  },
  { group: "Action Tab API", path: "action-tab-api/start-session", method: "POST", desc: "Start a new study session — creates study_log entry, returns session_id for tracking", auth: true,
    request: { action: "start-session", mode: "focus", topic_id: "uuid", subject_id: "uuid" },
    response: { session_id: "uuid", started_at: "ISO_DATE" }
  },
  { group: "Action Tab API", path: "action-tab-api/end-session", method: "POST", desc: "End a study session — updates duration, confidence, notes. Auto-boosts topic memory_strength.", auth: true,
    request: { action: "end-session", session_id: "uuid", duration_minutes: 25, confidence_level: "high", notes: "Good session", topic_id: "uuid" },
    response: { success: true }
  },
  { group: "Action Tab API", path: "action-tab-api/log-session", method: "POST", desc: "Quick log a completed session (no start/end flow). Auto-boosts topic memory.", auth: true,
    request: { action: "log-session", mode: "focus", duration_minutes: 25, confidence_level: "high", topic_id: "uuid", subject_id: "uuid", notes: "" },
    response: { success: true, session_id: "uuid" }
  },
  { group: "Action Tab API", path: "action-tab-api/task-complete", method: "POST", desc: "Mark an AI recommendation task as completed", auth: true,
    request: { action: "task-complete", task_id: "uuid" },
    response: { success: true }
  },
  { group: "Action Tab API", path: "action-tab-api/topic-explorer", method: "POST", desc: "Deep Topic Explorer — without subject_id returns all subjects with health aggregates. With subject_id returns topics with strategy tags.", auth: true,
    request: { action: "topic-explorer", subject_id: "uuid-or-omit" },
    response: { subjects: [{ id: "uuid", name: "Physics", topic_count: 25, avg_strength: 58, critical_count: 3, strong_count: 10 }] }
  },
  { group: "Action Tab API", path: "action-tab-api/topic-strategy", method: "POST", desc: "Get AI-generated 3-step study strategy for a specific topic based on its memory strength level (critical/moderate/strong)", auth: true,
    request: { action: "topic-strategy", topic_id: "uuid" },
    response: { topic: { id: "uuid", name: "Optics", memory_strength: 28, subject: "Physics", last_revision_date: "" }, strategy: { level: "critical", steps: [{ title: "Recall Burst", description: "Quick 5-min recall exercise", mode: "emergency", duration: 5 }, { title: "Deep Focus", description: "15-min focused review", mode: "focus", duration: 15 }, { title: "Pressure Test", description: "10-min timed MCQ sprint", mode: "mock", duration: 10 }] } }
  },
  { group: "Action Tab API", path: "action-tab-api/questions", method: "POST", desc: "Get AI-generated MCQs for any topic. Proxies to ai-brain-agent. Accepts topic_id OR topic_name.", auth: true,
    request: { action: "questions", topic_id: "uuid", topic_name: "Optics", subject_name: "Physics", difficulty: "medium", count: 5 },
    response: { questions: [{ question: "What is total internal reflection?", options: ["A", "B", "C", "D"], correct_index: 2, explanation: "Because...", difficulty: "medium" }] }
  },
  { group: "Action Tab API", path: "action-tab-api/daily-summary", method: "POST", desc: "Quick daily stats — total minutes, session count, topics studied, mode breakdown, mission stats", auth: true,
    request: { action: "daily-summary" },
    response: { total_minutes: 120, session_count: 5, topics_studied: 8, mode_breakdown: { focus: 60, revision: 30, mock: 30 }, missions_completed: 2, missions_active: 1 }
  },
  { group: "Action Tab API", path: "action-tab-api/topics-list", method: "POST", desc: "Get all user topics sorted by memory strength (weakest first). Optional subject_id filter.", auth: true,
    request: { action: "topics-list", subject_id: "uuid-or-omit" },
    response: { topics: [{ id: "uuid", name: "Optics", memory_strength: 28, subject_id: "uuid", last_revision_date: "" }] }
  },
  { group: "Action Tab API", path: "action-tab-api/subjects-list", method: "POST", desc: "Get all user subjects", auth: true,
    request: { action: "subjects-list" },
    response: { subjects: [{ id: "uuid", name: "Physics" }] }
  },

  // ── Action Tab API: Recommended Next (Complete End-to-End Flow) ──
  { group: "Action Tab API", path: "action-tab-api/recommended-next", method: "POST", desc: "🔥 AI-powered 'What to do next' engine. Evaluates 6 categories: continue_topic (stability < 60%), weak_topic (stability < 50%), dropping_soon (predicted drop within 48h), mission (active missions), mode_switch (variety control), take_break (fatigue detection). Call after any session completes or on mode selection screen.", auth: true,
    request: { action: "recommended-next", topic_id: "uuid-of-last-studied-topic-or-omit", mode: "focus", session_minutes: 25 },
    response: { recommended_next: [{ type: "continue_topic", priority: "high", title: "Continue: Optics", subtitle: "28% stability — needs more reinforcement", topic_id: "uuid", topic_name: "Optics", subject: "Physics", memory_strength: 28, recommended_mode: "emergency", recommended_duration: 10, reason: "Critical stability — emergency recall burst recommended", icon: "refresh-cw", color: "#EF4444" }, { type: "weak_topic", priority: "critical", title: "Rescue: Thermodynamics", subtitle: "15% stability — Physics", topic_id: "uuid", topic_name: "Thermodynamics", subject: "Physics", memory_strength: 15, recommended_mode: "emergency", recommended_duration: 8, reason: "Memory critical — immediate rescue needed before full decay", icon: "alert-triangle", color: "#EF4444" }, { type: "dropping_soon", priority: "high", title: "Save: Organic Chemistry", subtitle: "Dropping in 12h — 42% stability", topic_id: "uuid", topic_name: "Organic Chemistry", subject: "Chemistry", memory_strength: 42, recommended_mode: "revision", recommended_duration: 10, reason: "Memory predicted to drop within 12 hours", icon: "clock", color: "#F59E0B" }, { type: "mission", priority: "medium", title: "Mission: Master Algebra", subtitle: "60% complete — expires tomorrow", mission_id: "uuid", topic_id: "uuid", progress: 60, recommended_mode: "focus", recommended_duration: 15, reason: "Active brain mission — completing earns rewards", icon: "target", color: "#8B5CF6" }, { type: "mode_switch", priority: "low", title: "Switch to Mock Practice", subtitle: "Variety improves retention by 23%", recommended_mode: "mock", recommended_duration: 20, reason: "3 focus sessions in a row — switching modes activates different memory pathways", icon: "shuffle", color: "#06B6D4" }], context: { current_topic: { id: "uuid", name: "Optics", memory_strength: 28 }, session_minutes: 25, today_total_minutes: 75, today_session_count: 4, is_fatigued: false, days_to_exam: 30, exam_urgency: "moderate", active_missions: 2 }, meta: { generated_at: "ISO_DATE", total_recommendations: 5 } }
  },

  // ── Action Tab API: Start Focus Session (Step 1 — Quiz Bootstrap) ──
  { group: "Action Tab API", path: "action-tab-api/start-focus-session", method: "POST", desc: "🎯 STEP 1: Start a study session for ANY mode (focus/revision/mock/emergency/current-affairs/intel-practice). Creates session, auto-picks weakest topic if no topic_id, fetches AI-generated MCQs, returns session_config with scoring rules & UI features. Single call bootstraps entire quiz UI.", auth: true,
    request: { action: "start-focus-session", mode: "focus", topic_id: "uuid-or-omit-for-auto-pick", duration_minutes: 25 },
    response: { session_id: "uuid", started_at: "ISO_DATE", topic: { id: "uuid", name: "Optics", subject: "Physics", memory_strength: 28, health: "critical", strategy: "recovery" }, questions: [{ id: "q_0_1234567890", question_text: "What is total internal reflection?", options: ["Light bending at boundary", "Complete reflection when angle > critical angle", "Refraction through prism", "Diffraction at slit"], correct_answer_index: 1, explanation: "Total internal reflection occurs when light travels from denser to rarer medium at angle greater than critical angle.", difficulty: "medium", marks: 1, topic_name: "Optics", subject_name: "Physics" }], session_config: { total_questions: 10, time_limit_seconds: 1500, mode: "focus", scoring: { correct: 4, incorrect: -1, unanswered: 0 }, features: { show_explanation_after_answer: true, show_correct_answer: true, allow_skip: true, show_timer: true, show_progress: true, auto_submit_on_timeout: true } }, meta: { question_count: 10, difficulty: "easy", estimated_duration_minutes: 25 } }
  },

  // ── Action Tab API: Submit Answer (Step 2 — Per-Question) ──
  { group: "Action Tab API", path: "action-tab-api/submit-answer", method: "POST", desc: "📝 STEP 2 (Optional per question): Record individual answer during an active session. Logs behavioral micro-event for analytics. Call after each question answer for real-time tracking.", auth: true,
    request: { action: "submit-answer", session_id: "uuid-from-step-1", question_id: "q_0_1234567890", selected_option_index: 1, correct_option_index: 1, time_taken_ms: 12000, is_correct: true },
    response: { success: true, is_correct: true, recorded_at: "ISO_DATE" }
  },

  // ── Action Tab API: Complete Focus Session (Step 3 — Results & Impact) ──
  { group: "Action Tab API", path: "action-tab-api/complete-focus-session", method: "POST", desc: "🏆 STEP 3: Complete session — calculates score (4/-1 marking), updates memory_strength, awards XP, generates result card with grade/speed analysis, identifies weak areas, and returns AI-powered recommended_next actions. Single call for entire result screen.", auth: true,
    request: { action: "complete-focus-session", session_id: "uuid-from-step-1", topic_id: "uuid", mode: "focus", duration_minutes: 25, total_questions: 10, answers: [{ question_id: "q_0_1234567890", selected_option_index: 1, correct_option_index: 1, is_correct: true, time_taken_ms: 12000 }, { question_id: "q_1_1234567891", selected_option_index: 0, correct_option_index: 2, is_correct: false, time_taken_ms: 25000 }] },
    response: { result: { session_id: "uuid", total_questions: 10, correct: 7, incorrect: 2, skipped: 1, total_marks: 26, max_marks: 40, percentage: 65, accuracy: 70, grade: "good", grade_label: "Good Effort 📖", grade_color: "#3B82F6", duration_minutes: 25, avg_time_per_question_ms: 18500, speed_analysis: "balanced" }, memory_impact: { before: 28, after: 35, change: 7, change_label: "+7% stability", topic_name: "Optics", subject: "Physics" }, rewards: { xp_earned: 120, sessions_today: 4, streak_maintained: true }, weak_areas: [{ type: "incorrect_answers", count: 2, message: "2 questions answered incorrectly — review explanations" }, { type: "skipped_questions", count: 1, message: "1 question skipped — attempt all for better assessment" }], question_results: [{ question_id: "q_0_1234567890", selected_option_index: 1, correct_option_index: 1, is_correct: true, time_taken_ms: 12000 }, { question_id: "q_1_1234567891", selected_option_index: 0, correct_option_index: 2, is_correct: false, time_taken_ms: 25000 }], recommended_next: [{ type: "continue_topic", priority: "high", title: "Continue: Optics", subtitle: "35% stability — needs more reinforcement", topic_id: "uuid", topic_name: "Optics", subject: "Physics", memory_strength: 35, recommended_mode: "revision", recommended_duration: 8, reason: "Below threshold — quick revision will lock in gains", icon: "refresh-cw", color: "#F59E0B" }], meta: { completed_at: "ISO_DATE", mode: "focus" } }
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-400",
  POST: "bg-blue-500/15 text-blue-400",
  PUT: "bg-amber-500/15 text-amber-400",
  DELETE: "bg-red-500/15 text-red-400",
};

const GROUP_ICONS: Record<string, string> = {
  "Home Dashboard": "🏠",
  "Authentication": "🔐",
  "User Profile": "👤",
  "Brain Intelligence": "🧠",
  "Study & Action": "📚",
  "Fix Sessions": "🔧",
  "AI Agent": "🤖",
  "Rank Prediction": "📊",
  "Knowledge Graph": "🕸️",
  "Chat & Voice": "💬",
  "Notifications": "🔔",
  "Subscription": "💳",
  "Admin Control": "⚙️",
  "API Key Mgmt": "🔑",
  "Analytics": "📈",
  "Topics & Subjects": "📖",
  "Streaks & Gamification": "🔥",
  "Community": "👥",
  "SureShot": "🎯",
  "Current Affairs": "📰",
  "Onboarding": "🚀",
  "Storage": "📁",
  "Focus Shield": "🛡️",
  "Accelerator": "⚡",
  "Debate & Writing": "✍️",
  "Voice & Push": "🔊",
  "Exam Simulator": "📝",
  "Mission Sessions": "🎮",
  "Today's Mission API": "🎯",
  "Action Tab API": "⚡",
};

const FlutterApiHub = () => {
  const [activeSection, setActiveSection] = useState<"overview" | "routes" | "examples" | "tester" | "errors" | "docs">("overview");

  return (
    <div className="space-y-4 mt-4">
      <div className="flex gap-1.5 flex-wrap">
        {([
          { key: "overview" as const, label: "Quick Start", icon: Zap },
          { key: "routes" as const, label: `API Routes (${ACRY_API_ROUTES.length})`, icon: Globe },
          { key: "examples" as const, label: "Flutter Examples", icon: Smartphone },
          { key: "tester" as const, label: "API Tester", icon: Terminal },
          { key: "errors" as const, label: "Error Codes", icon: AlertTriangle },
          { key: "docs" as const, label: "Export Docs", icon: Download },
        ]).map(s => (
          <button key={s.key} onClick={() => setActiveSection(s.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${activeSection === s.key ? "bg-primary text-primary-foreground" : "bg-secondary/70 text-muted-foreground hover:text-foreground"}`}>
            <s.icon className="w-3.5 h-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeSection} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          {activeSection === "overview" && <QuickStartSection />}
          {activeSection === "routes" && <RoutesSection />}
          {activeSection === "examples" && <FlutterExamplesSection />}
          {activeSection === "tester" && <ApiTesterSection />}
          {activeSection === "errors" && <ErrorCodesSection />}
          {activeSection === "docs" && <DocsExportSection />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// ─── Quick Start ───
const QuickStartSection = () => {
  const { toast } = useToast();
  const baseUrl = "https://api.acry.ai/v1";
  const copy = (text: string) => { navigator.clipboard.writeText(text); toast({ title: "Copied!" }); };

  const groupCounts = useMemo(() => 
    ACRY_API_ROUTES.reduce((acc, r) => { acc[r.group] = (acc[r.group] || 0) + 1; return acc; }, {} as Record<string, number>),
  []);

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-5 neural-border">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
          <Smartphone className="w-4 h-4 text-primary" /> Flutter Quick Start Guide
        </h3>
        <p className="text-xs text-muted-foreground mb-4">Complete API reference for Flutter integration — {ACRY_API_ROUTES.length} endpoints across {Object.keys(groupCounts).length} categories.</p>

        {/* Architecture */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          {[
            { title: "Base URL", value: baseUrl, sub: "All endpoints relative to this" },
            { title: "Auth Method", value: "Bearer JWT", sub: "Authorization: Bearer <token>" },
            { title: "Content Type", value: "application/json", sub: "All request & response bodies" },
          ].map(item => (
            <div key={item.title} className="bg-secondary/50 rounded-lg p-3">
              <span className="text-[10px] text-muted-foreground">{item.title}</span>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-xs font-mono text-foreground truncate flex-1">{item.value}</code>
                <button onClick={() => copy(item.value)} className="p-0.5 hover:bg-secondary rounded"><Copy className="w-3 h-3 text-primary" /></button>
              </div>
              <p className="text-[9px] text-muted-foreground mt-1">{item.sub}</p>
            </div>
          ))}
        </div>

        {/* Standard Response Format */}
        <div className="mb-5">
          <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <FileJson className="w-3.5 h-3.5 text-accent" /> Standard Response Format
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] text-emerald-400 font-medium mb-1 block">✓ Success Response</span>
              <pre className="text-[10px] bg-secondary rounded-lg p-3 font-mono text-foreground overflow-x-auto">{`{
  "success": true,
  "message": "Memory prediction successful",
  "data": {
    "memory_strength": 72,
    "forget_risk": 28
  }
}`}</pre>
            </div>
            <div>
              <span className="text-[10px] text-destructive font-medium mb-1 block">✗ Error Response</span>
              <pre className="text-[10px] bg-secondary rounded-lg p-3 font-mono text-foreground overflow-x-auto">{`{
  "success": false,
  "message": "Invalid API key",
  "error_code": 401
}`}</pre>
            </div>
          </div>
        </div>

        {/* Flutter Setup */}
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Code className="w-3.5 h-3.5 text-primary" /> Step 1: Add Dependencies (pubspec.yaml)
          </h4>
          <CodeBlock code={`dependencies:
  http: ^1.2.0
  flutter_secure_storage: ^9.0.0`} lang="yaml" />
        </div>

        <div className="mb-4">
          <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Code className="w-3.5 h-3.5 text-primary" /> Step 2: Create API Client (lib/api/acry_client.dart)
          </h4>
          <CodeBlock code={`import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AcryApi {
  static const String baseUrl = '${baseUrl}';
  static const String anonKey = '${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}';
  final _storage = const FlutterSecureStorage();

  Future<Map<String, String>> _headers({bool auth = true}) async {
    final headers = {
      'Content-Type': 'application/json',
      'apikey': anonKey,
    };
    if (auth) {
      final token = await _storage.read(key: 'jwt_token');
      if (token != null) headers['Authorization'] = 'Bearer \$token';
    }
    return headers;
  }

  Future<Map<String, dynamic>> get(String path, {bool auth = true, Map<String, String>? query}) async {
    var uri = Uri.parse('\$baseUrl/\$path');
    if (query != null) uri = uri.replace(queryParameters: query);
    final res = await http.get(uri, headers: await _headers(auth: auth));
    return _handleResponse(res);
  }

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body, {bool auth = true}) async {
    final res = await http.post(
      Uri.parse('\$baseUrl/\$path'),
      headers: await _headers(auth: auth),
      body: jsonEncode(body),
    );
    return _handleResponse(res);
  }

  Future<Map<String, dynamic>> put(String path, Map<String, dynamic> body, {bool auth = true}) async {
    final res = await http.put(
      Uri.parse('\$baseUrl/\$path'),
      headers: await _headers(auth: auth),
      body: jsonEncode(body),
    );
    return _handleResponse(res);
  }

  Future<Map<String, dynamic>> delete(String path, {bool auth = true, Map<String, dynamic>? body}) async {
    final res = await http.delete(
      Uri.parse('\$baseUrl/\$path'),
      headers: await _headers(auth: auth),
      body: body != null ? jsonEncode(body) : null,
    );
    return _handleResponse(res);
  }

  Map<String, dynamic> _handleResponse(http.Response res) {
    final data = jsonDecode(res.body);
    if (res.statusCode >= 400) {
      throw AcryApiException(
        message: data['message'] ?? 'Unknown error',
        code: data['error_code'] ?? res.statusCode,
      );
    }
    return data;
  }
}

class AcryApiException implements Exception {
  final String message;
  final int code;
  AcryApiException({required this.message, required this.code});
  @override
  String toString() => 'AcryApiException(\$code): \$message';
}`} lang="dart" />
        </div>

        <div>
          <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Code className="w-3.5 h-3.5 text-primary" /> Step 3: Auth Flow (OTP Login → Store Token)
          </h4>
          <CodeBlock code={`final api = AcryApi();

// Step 1: Send OTP to email
await api.post('auth/send-otp', {
  'email': 'user@example.com',
  'options': {'shouldCreateUser': true},
}, auth: false);

// Step 2: Verify 6-digit OTP code
final result = await api.post('auth/verify-otp', {
  'email': 'user@example.com',
  'token': '123456',
  'type': 'email',
}, auth: false);

// Store JWT token securely
await FlutterSecureStorage().write(
  key: 'jwt_token',
  value: result['data']['token'],
);

// All authenticated calls now work automatically
final profile = await api.get('user/profile');
print(profile['data']['display_name']);`} lang="dart" />
        </div>
      </div>

      {/* API Coverage Summary */}
      <div className="glass rounded-xl p-4 neural-border">
        <h4 className="text-xs font-semibold text-foreground mb-3">API Coverage — {ACRY_API_ROUTES.length} Endpoints</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {Object.entries(groupCounts).map(([group, count]) => (
            <div key={group} className="bg-secondary/50 rounded-lg p-2.5 text-center">
              <span className="text-lg">{GROUP_ICONS[group] || "📦"}</span>
              <p className="text-lg font-bold text-foreground">{count}</p>
              <p className="text-[9px] text-muted-foreground leading-tight">{group}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Page-Wise Dashboard Mapping */}
      <div className="glass rounded-xl p-5 neural-border">
        <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-primary" /> Page-Wise Dashboard → API Mapping
        </h4>
        <p className="text-[10px] text-muted-foreground mb-4">Every screen in the User Dashboard mapped to its required API endpoints for complete Flutter implementation.</p>
        <div className="space-y-3">
          {[
            { page: "🔐 Authentication Page", route: "/auth", sections: "Splash Screen (once-per-session via sessionStorage), Email OTP Flow (send OTP → 6-digit input grid with auto-focus & paste support → verify & sign in), Resend OTP button, Change Email button, Google OAuth (lovable.auth.signInWithOAuth with redirect_uri), Apple OAuth, Toggle Login/Signup text, Back to Landing arrow, Institution-aware branding (custom logo & name if institution domain), Ambient particle background, Floating animated logo with SVG triangle + orbiting ring", apis: "auth/send-otp, auth/verify-otp, auth/resend-otp, auth/oauth/google, auth/oauth/apple, auth/oauth/callback, auth/set-session, auth/session-status, auth/refresh-token, auth/logout, auth/detect-new-user, auth/update-user-metadata", components: "AuthPage.tsx → SplashScreen.tsx (conditional), 6-slot OTP input grid (refs + paste handler), Google/Apple OAuth buttons (lovable.auth.signInWithOAuth), InstitutionContext for branded login" },
            { page: "🚀 Onboarding Flow (6-Step Wizard)", route: "/onboarding", sections: "Segmented glowing progress bar (6 segments with step icons), Step 1: Display Name input (pre-filled from OAuth user_metadata — full_name/name/display_name, min 2 chars), Step 2: Exam Selection (3 category tabs: Government/Entrance/Global, 30+ exam cards with id/label/desc, custom exam input for 'Other' options), Step 3: Exam Date Picker (Calendar component with date-fns formatting, disables past dates), Step 4: Subject Selection (AI-suggested subjects per exam type from SUGGESTED_SUBJECTS map, manual add/remove, pill-style chips), Step 5: Topic Management per Subject (tab-based subject switcher, suggested topics from SUGGESTED_TOPICS map, manual add, AI Curriculum Generation button → invokes 'ai-topic-manager' edge function with animated progress bar showing 5 simulated steps: Analyzing exam pattern → Mapping syllabus → Generating subjects → Creating topic hierarchy → Assigning weightages), Step 6: Study Mode Selection (3 mode cards: 😴 Chill Mode / 🎯 Focus Mode / 🔥 Emergency Mode with descriptions), Final Submit → updates profile, bulk-creates subjects & topics, emits profile_completed + exam_setup events, redirects to /app", apis: "onboarding/status, onboarding/save-step, onboarding/step1-name, onboarding/exam-types, onboarding/step2-exam, onboarding/step3-date, onboarding/suggested-subjects, onboarding/step4-subjects, onboarding/suggested-topics, onboarding/ai-generate-curriculum, onboarding/step5-topics, onboarding/step6-mode, onboarding/complete, onboarding/skip, user/profile/update, subjects/create, topics/create", components: "OnboardingPage.tsx → 6-step AnimatePresence wizard, Calendar (ui/calendar), Popover (date picker), AI progress bar with shimmer animation, EXAM_TYPES array (30+ entries), SUGGESTED_SUBJECTS map (14 exam types), SUGGESTED_TOPICS map (13 subjects), STUDY_MODES array, eventBus (emitEvent for profile_completed + exam_setup)" },
            { page: "🏠 Home Tab", route: "/app (home)", sections: "Trial Banner, Brain Update Hero, Daily Goal Tracker (circular progress), Streak Tracker + Milestone Celebration, Quick Micro Actions (4-card grid: Revise/Fix/Quiz/Accelerator), Today's Mission, AI Recommendations, Review Queue, Risk Digest Card, AI Risk Reduction Engine, Brain Feed, Voice Brain Capture, Debate Engine Widget, Momentum Section, Brain Stability Control Center, Deep Analytics Section, Brain Missions Card, Accelerator Widget, Cognitive Embedding Card, RL Policy Card, Auto Study Summary Card, Precision Intelligence Card, Study Insights, Weekly Summary, Daily Quote, Recently Studied, Streak Recovery Card, Comeback Celebration, Autopilot Widget", apis: "brain/status, brain/weak-topics, brain/risk-topics, brain/performance-score, brain/fatigue-level, brain/brain-health-report, streak/status, streak/history, study/daily-summary, study/history, ai-agent/recommendations, ai-agent/daily-plan, ai-agent/next-best-topic, missions/active, rank/prediction, rank/range, focus-shield/status, focus-shield/neural-discipline, accelerator/status, notification/list", components: "HomeTab.tsx → 30+ lazy-loaded sub-components, useMemoryEngine, useRankPrediction, usePrecisionIntelligence, useStudyStreak hooks" },
            { page: "⚡ Action Tab", route: "/app (action)", sections: "6 Study Mode Cards (Focus Study 25-50min, AI Revision 5-15min, Mock Practice 15-30min, Emergency Rescue 5-8min, Current Affairs Quiz 5-10min, Intel Practice 10-20min), Active Task Engine, Today's Gains (study minutes/topics/XP), Focus Session History, Deep Topic Explorer, Exam Lock Modal, Exam Countdown Timer, CA Practice Session, Intel Practice Session", apis: "action-tab-api/init (BOOTSTRAP), action-tab-api/start-session, action-tab-api/end-session, action-tab-api/log-session, action-tab-api/todays-gains, action-tab-api/session-history, action-tab-api/task-complete, action-tab-api/topic-explorer, action-tab-api/topic-strategy, action-tab-api/questions, action-tab-api/daily-summary, action-tab-api/topics-list, action-tab-api/subjects-list", components: "ActionTab.tsx → FocusModeSession, LazyModeSession, EmergencyRecoverySession, MockPracticeSession, CAPracticeSession, IntelPracticeSession, ActiveTaskEngine, TodaysGains, FocusSessionHistory, DeepTopicExplorer, ExamLockModal" },
            { page: "🧠 Brain Tab", route: "/app (brain)", sections: "Brain Stability Overview (subject health cards with topic lists), Interactive Memory Map (visual strength indicators), Decay Forecast Timeline (predicted drop dates), AI Intelligence Insights (personalized AI analysis), Growth Identity System (brain level + XP), Competitive Intelligence Dashboard, Precision Intelligence Card, Rank Prediction V2 Card (range/probability/trend), Decay Forecast V2 Card, AI Topic Manager (add/edit/delete subjects & topics), SafePass Popup", apis: "brain/status, brain/memory-strength, brain/forget-prediction, brain/knowledge-graph, brain/brain-evolution, brain/cognitive-state, brain/brain-health-report, brain/strong-topics, brain/weak-topics, brain/risk-topics, rank/prediction, rank/range, rank/trend, rank/probability, rank/competition-analysis, rank/improvement-simulation, subjects/list, subjects/create, subjects/update, subjects/delete, topics/list, topics/create, topics/update, topics/delete, topics/restore, topics/trash, topics/ai-extract, topics/merge", components: "BrainTab.tsx → BrainStabilityOverview, InteractiveMemoryMap, DecayForecastTimeline, AIIntelligenceInsights, GrowthIdentitySystem, CompetitiveIntelDashboard, PrecisionIntelligenceCard, RankPredictionV2Card, DecayForecastV2Card, AITopicManager, SafePassPopup" },
            { page: "👥 Community Tab", route: "/app (community)", sections: "Community Feed (Hot/New/Top sorting), Communities List (browse & search), Join/Leave Communities, Create Community (with AI name/description suggestions), Create Post, Vote (upvote/downvote), Comment, Bookmark/Save Posts, Study Pods, AI-Generated Answers, Karma Score, AI Recommendations, Important Posts, Community Detail (posts within a community)", apis: "community/list, community/create, community/join, community/leave, community/posts/feed, community/posts/create, community/posts/vote, community/posts/comment, community/posts/bookmark, community/posts/saved, community/karma, community/study-pods/list, community/study-pods/join, community/ai-answer", components: "CommunityPage.tsx (inline=true inside dashboard), CommunityDetailPage.tsx → AI Community Assist edge function (suggest_names, suggest_exam_types, suggest_subjects, suggest_topics, suggest_community)" },
            { page: "🎯 SureShot Tab", route: "/app (progress)", sections: "SureShot Hero Dashboard (match score, readiness level, weak/strong areas), Confidence Practice Tab (30+ exam types with subject-wise practice), Question Flow (MCQ with timer, explanations, confidence tracking), Session Results (score breakdown, mentor suggestions), Weak Area Analysis, Progress Trends Chart, Report Download", apis: "sureshot/dashboard, sureshot/start-session, sureshot/submit-answer, sureshot/end-session, sureshot/history, sureshot/exam-types, sureshot/weak-analysis, sureshot/progress-trend, sureshot/mentor-tip, sureshot/download-report", components: "ProgressTab.tsx → SureShotHero, ConfidencePracticeTab" },
            { page: "👤 You Tab", route: "/app (you)", sections: "Identity Command Center (Avatar upload/remove, XP bar, Level display, Streak badge), Inline Name Edit, Learning Identity Summary, AI Personal Strategy, Achievement Wall (badges & milestones), Monthly Performance Snapshot, Subscription Overview + Plan Management, AI Personalization Control Center, AI Recalibration (retrain AI model), Cognitive Profile Card, Password Management (change password, forgot password), Sign Out", apis: "user/profile, user/profile/update, user/profile/upload-avatar, user/stats, user/activity-history, user/preferences, user/preferences/update, user/account, xp/status, xp/history, achievements/list, streak/status, streak/history, subscription/status, subscription/plans, subscription/subscribe, subscription/cancel, subscription/upgrade, subscription/downgrade, subscription/history, ai-agent/strategy-plan, ai-agent/cognitive-twin, ai-agent/evolution-status, voice/settings, voice/settings/update", components: "YouTab.tsx → IdentityCommandCenter, LearningIdentitySummary, AIPersonalStrategy, AchievementWall, MonthlyPerformanceSnapshot, SubscriptionOverview, SubscriptionPlan, AIRecalibration, AIPersonalizationControlCenter, CognitiveProfileCard, PasswordManagement" },
            { page: "🔔 Notifications (Global)", route: "All tabs (header bell icon)", sections: "Notification Bell with Unread Count Badge, Mark Read, Mark All Read, Notification History Feed (email/push/voice/in-app), Push/Email/Voice Preferences Panel", apis: "notification/list, notification/read, notification/read-all, notification/settings, notification/settings/update, notification/history, notification/welcome, notification/study-reminder, notification/weekly-report", components: "GlobalNotificationCenter.tsx (Suspense-loaded in AppDashboard header), NotificationPreferencesPanel, NotificationHistory" },
            { page: "📰 Current Affairs & Debate", route: "/debate + Action Tab CA Mode", sections: "Events Feed with Category Filter, Event Detail (AI analysis, syllabus links, knowledge graph edges), CA Quiz Mode, Debate Topics List, Policy Impact Analysis, Syllabus Mapping, Writing Practice (submit essay → AI evaluation with 6 dimension scores), Daily Digest Briefing, CA Knowledge Graph Visualization, Topic Probability Adjustments", apis: "current-affairs/events, current-affairs/event-detail, current-affairs/quiz, current-affairs/debate-topics, current-affairs/policy-analysis, current-affairs/syllabus-mapping, current-affairs/writing-practice, current-affairs/daily-digest, current-affairs/knowledge-graph, current-affairs/probability-adjustments, debate/topics, debate/topic-detail, debate/start-practice, debate/submit-answer, debate/evaluations/history, debate/frameworks, debate/model-answer, debate/compare, debate/improvement-plan", components: "DebatePracticePage.tsx, CAPracticeSession.tsx, DebateEngineWidget.tsx" },
            { page: "💬 AI Chat", route: "/chat", sections: "Chat Messages (user/assistant), Voice Input (speech-to-text), Voice Response (TTS), Suggested Questions, Chat History, Bookmark Messages, Language Selection, Feedback on Responses, Clear History", apis: "chat/send-message, chat/history, chat/voice-input, chat/voice-response, chat/suggestions, chat/clear-history, chat/support-status, chat/feedback", components: "AIChatPage.tsx → AIBrainAgent.tsx" },
            { page: "📖 Topics & Subjects Management", route: "Brain Tab + Onboarding + Action Tab", sections: "Subject CRUD (create, rename, delete), Topic CRUD (create, update, delete per subject), Bulk Topic Create, AI Topic Extraction (from text/PDF/image), Merge Duplicate Topics, Trash Bin (soft-delete with restore), AI Curriculum Generation (auto-generate subjects + topics for exam type)", apis: "subjects/list, subjects/create, subjects/update, subjects/delete, topics/list, topics/create, topics/bulk-create, topics/update, topics/delete, topics/restore, topics/trash, topics/by-subject, topics/ai-extract, topics/merge, onboarding/ai-suggest-topics", components: "AITopicManager.tsx, TrashBin.tsx, DeepTopicExplorer.tsx" },
            { page: "🛡️ Focus Shield Dashboard", route: "/app (home) → Focus Shield section", sections: "Focus Level Badge, Shield Strength Gauge, Cognitive Prediction (DP Ring + signal breakdown), Neural Discipline Score + Trend Chart, Intervention Ladder (soft nudge → recall challenge → hard lock), Dopamine Replacement Rewards, Impulse Delay Challenges, Adaptive Lock Duration, Warning & Freeze Overlays", apis: "focus-shield/status, focus-shield/cognitive-predict, focus-shield/attention-prediction, focus-shield/attention-history, focus-shield/cognitive-state, focus-shield/cognitive-history, focus-shield/neural-discipline, focus-shield/neural-discipline/history, focus-shield/intervention/log, focus-shield/lock-config, focus-shield/dopamine-reward, focus-shield/impulse-challenge, focus-shield/impulse-challenge/submit", components: "FocusShieldDashboard.tsx, FocusShieldOverlay.tsx → useFocusShield hook, useCognitivePrediction hook" },
            { page: "⚡ Accelerator Program", route: "/accelerator", sections: "Enrollment Form (date range, intensity, exam type), Daily Study Plan, Progress Tracking, Weak Topic Identification, High Probability Topics, Strategy Adjustment, Progress Report", apis: "accelerator/status, accelerator/enroll, accelerator/daily-plan, accelerator/log-progress, accelerator/weak-topics, accelerator/high-probability, accelerator/adjust-strategy, accelerator/report", components: "AcceleratorPage.tsx, AcceleratorWidget.tsx (in HomeTab)" },
            { page: "👤 User Profile Page", route: "/profile", sections: "Profile Details (name, email, exam info), Avatar Upload/Remove, Password Change, Forgot Password (reset email), Exam Stats Overview", apis: "user/profile, user/profile/update, user/profile/upload-avatar, user/stats, auth/forgot-password, auth/reset-password, storage/upload-avatar", components: "UserProfilePage.tsx" },
            { page: "🔑 Reset Password", route: "/reset-password", sections: "New Password Form (triggered from email link), Password Validation, Success Redirect", apis: "auth/reset-password", components: "ResetPasswordPage.tsx" },
            { page: "🏠 Landing Page", route: "/", sections: "Hero Section, Problem Section, How It Works, Brain Demo, Study Modes Showcase, Social Proof, Forgetting Curve Visualization, Rank Section, Pricing Plans, CTA Section, Footer, Navbar with 'Start Free' CTA, Auto-redirect logged-in users, Coming Soon Mode Check", apis: "auth/session-status, subscription/plans", components: "Index.tsx → HeroSection, ProblemSection, HowItWorksSection, BrainDemoSection, StudyModesSection, SocialProofSection, ForgettingCurveSection, RankSection, PricingSection, CTASection, Footer, NeuralBackground" },
          ].map((item) => (
            <div key={item.page} className="bg-secondary/40 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-foreground">{item.page}</span>
                <code className="text-[9px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{item.route}</code>
              </div>
              <p className="text-[10px] text-muted-foreground mb-2"><strong>Sections:</strong> {item.sections}</p>
              {"components" in item && (
                <p className="text-[10px] text-muted-foreground mb-2"><strong>Components:</strong> <span className="text-primary/80">{item.components}</span></p>
              )}
              <div className="flex flex-wrap gap-1">
                {item.apis.split(", ").map((api) => (
                  <code key={api} className="text-[8px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">{api}</code>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Routes Section ───
const RoutesSection = () => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);
  const [filterGroup, setFilterGroup] = useState<string>("all");
  const baseUrl = "https://api.acry.ai/v1";

  const groups = useMemo(() => ACRY_API_ROUTES.reduce((acc, route) => {
    if (!acc[route.group]) acc[route.group] = [];
    acc[route.group].push(route);
    return acc;
  }, {} as Record<string, typeof ACRY_API_ROUTES>), []);

  const filteredGroups = useMemo(() => {
    let result = filterGroup === "all" ? groups : { [filterGroup]: groups[filterGroup] || [] };
    if (search) {
      result = Object.fromEntries(
        Object.entries(result)
          .map(([g, routes]) => [g, routes.filter(r => r.path.toLowerCase().includes(search.toLowerCase()) || r.desc.toLowerCase().includes(search.toLowerCase()))])
          .filter(([, r]) => (r as any[]).length > 0)
      );
    }
    return result;
  }, [groups, search, filterGroup]);

  const filteredCount = Object.values(filteredGroups).reduce((s, r) => s + r.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search routes..."
            className="w-full pl-9 pr-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none" />
        </div>
        <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
          className="px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border outline-none">
          <option value="all">All Groups ({ACRY_API_ROUTES.length})</option>
          {Object.entries(groups).map(([g, r]) => (
            <option key={g} value={g}>{GROUP_ICONS[g] || ""} {g} ({r.length})</option>
          ))}
        </select>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{filteredCount} endpoints</span>
      </div>

      {Object.entries(filteredGroups).map(([group, routes]) => (
        <div key={group} className="glass rounded-xl neural-border overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-secondary/30 flex items-center gap-2">
            <span>{GROUP_ICONS[group] || "📦"}</span>
            <span className="text-xs font-semibold text-foreground">{group}</span>
            <span className="text-[10px] text-muted-foreground">({routes.length} endpoints)</span>
          </div>
          <div className="divide-y divide-border/50">
            {routes.map(route => {
              const key = `${route.method}-${route.path}`;
              const isExpanded = expandedRoute === key;
              return (
                <div key={key}>
                  <button onClick={() => setExpandedRoute(isExpanded ? null : key)}
                    className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-secondary/30 transition-colors text-left">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${METHOD_COLORS[route.method]}`}>{route.method}</span>
                    <code className="text-xs font-mono text-foreground flex-1 truncate">/v1/{route.path}</code>
                    <span className="text-[10px] text-muted-foreground hidden md:block max-w-[200px] truncate">{route.desc}</span>
                    {route.auth && <Lock className="w-3 h-3 text-warning shrink-0" />}
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="px-3 pb-3 space-y-3 border-t border-border/50">
                          <p className="text-[10px] text-muted-foreground mt-2">{route.desc}</p>
                          <div className="grid grid-cols-3 gap-2 text-[10px]">
                            <div><span className="text-muted-foreground block">Auth</span><span className="text-foreground">{route.auth ? "JWT Required" : "Public"}</span></div>
                            <div><span className="text-muted-foreground block">Method</span><span className="text-foreground font-mono">{route.method}</span></div>
                            <div><span className="text-muted-foreground block">URL</span>
                              <button onClick={() => { navigator.clipboard.writeText(`${baseUrl}/${route.path}`); toast({ title: "Copied!" }); }}
                                className="text-primary hover:underline font-mono truncate block">Copy URL</button>
                            </div>
                          </div>
                          {Object.keys(route.request).length > 0 && (
                            <div>
                              <span className="text-[10px] text-muted-foreground block mb-1">Request Body</span>
                              <pre className="text-[10px] bg-secondary rounded-lg p-2 font-mono text-foreground overflow-x-auto">{JSON.stringify(route.request, null, 2)}</pre>
                            </div>
                          )}
                          <div>
                            <span className="text-[10px] text-muted-foreground block mb-1">Response</span>
                            <pre className="text-[10px] bg-secondary rounded-lg p-2 font-mono text-foreground overflow-x-auto">{`{
  "success": true,
  "message": "OK",
  "data": ${JSON.stringify(route.response, null, 4)}
}`}</pre>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground block mb-1">Flutter Example</span>
                            <CodeBlock code={
                              route.method === "GET" ? `final data = await api.get('${route.path}');`
                              : route.method === "PUT" ? `final data = await api.put('${route.path}', ${JSON.stringify(route.request, null, 2)});`
                              : route.method === "DELETE" ? `final data = await api.delete('${route.path}');`
                              : `final data = await api.post('${route.path}', ${JSON.stringify(route.request, null, 2)});`
                            } lang="dart" />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Flutter Examples ───
const FlutterExamplesSection = () => {
  const examples = [
    {
      title: "🔐 Complete Auth Service",
      desc: "Login, signup, logout, token refresh",
      code: `class AuthService {
  final _api = AcryApi();
  final _storage = FlutterSecureStorage();

  Future<bool> login(String email, String password) async {
    try {
      final result = await _api.post('auth/login', {
        'email': email, 'password': password,
      }, auth: false);
      await _storage.write(key: 'jwt_token', value: result['data']['token']);
      await _storage.write(key: 'refresh_token', value: result['data']['refresh_token']);
      return true;
    } on AcryApiException catch (e) {
      print('Login failed: \${e.message}');
      return false;
    }
  }

  Future<bool> signup(String email, String password, String name) async {
    final result = await _api.post('auth/signup', {
      'email': email, 'password': password, 'display_name': name,
    }, auth: false);
    await _storage.write(key: 'jwt_token', value: result['data']['token']);
    return true;
  }

  Future<void> logout() async {
    await _api.post('auth/logout', {});
    await _storage.deleteAll();
  }

  Future<void> refreshToken() async {
    final refresh = await _storage.read(key: 'refresh_token');
    final result = await _api.post('auth/refresh-token', {
      'refresh_token': refresh,
    }, auth: false);
    await _storage.write(key: 'jwt_token', value: result['data']['token']);
  }
}`,
    },
    {
      title: "👤 User Profile Service",
      desc: "Get, update profile and exam setup",
      code: `class ProfileService {
  final _api = AcryApi();

  Future<UserProfile> getProfile() async {
    final result = await _api.get('user/profile');
    return UserProfile.fromJson(result['data']);
  }

  Future<void> updateProfile({String? name, String? examType}) async {
    await _api.put('user/profile/update', {
      if (name != null) 'display_name': name,
      if (examType != null) 'exam_type': examType,
    });
  }

  Future<void> setupExam(String examType, String date, int targetRank) async {
    await _api.post('user/exam-profile/setup', {
      'exam_type': examType,
      'exam_date': date,
      'target_rank': targetRank,
    });
  }

  Future<Map<String, dynamic>> getStats() async {
    final result = await _api.get('user/stats');
    return result['data'];
  }
}`,
    },
    {
      title: "🧠 Brain Intelligence Service",
      desc: "Memory status, predictions, knowledge graph",
      code: `class BrainService {
  final _api = AcryApi();

  Future<List<TopicMemory>> getMemoryStatus() async {
    final result = await _api.get('brain/memory-strength');
    return (result['data']['topics'] as List)
        .map((t) => TopicMemory.fromJson(t)).toList();
  }

  Future<Map<String, dynamic>> getForgetPrediction() async {
    final result = await _api.get('brain/forget-prediction');
    return result['data'];
  }

  Future<Map<String, dynamic>> getKnowledgeGraph() async {
    final result = await _api.get('brain/knowledge-graph');
    return result['data']; // { nodes: [], edges: [] }
  }

  Future<Map<String, dynamic>> getBrainHealth() async {
    final result = await _api.get('brain/brain-health-report');
    return result['data'];
  }

  Future<List<Map<String, dynamic>>> getWeakTopics() async {
    final result = await _api.get('brain/weak-topics');
    return List<Map<String, dynamic>>.from(result['data']['topics']);
  }
}`,
    },
    {
      title: "🔧 Fix Session Service",
      desc: "Start fix sessions, submit answers, get results",
      code: `class FixService {
  final _api = AcryApi();

  Future<Map<String, dynamic>> getRiskTopics() async {
    final result = await _api.get('fix/get-risk-topics');
    return result['data'];
  }

  Future<String> startSession(String topicId, {String mode = 'quiz'}) async {
    final result = await _api.post('fix/start-fix-session', {
      'topic_id': topicId, 'mode': mode,
    });
    return result['data']['session_id'];
  }

  Future<Map<String, dynamic>> getQuestion(String sessionId) async {
    final result = await _api.get('fix/get-question',
      query: {'session_id': sessionId});
    return result['data'];
  }

  Future<bool> submitAnswer(String sessionId, String questionId, int answer) async {
    final result = await _api.post('fix/submit-answer', {
      'session_id': sessionId,
      'question_id': questionId,
      'answer_index': answer,
    });
    return result['data']['correct'];
  }

  Future<Map<String, dynamic>> endSession(String sessionId) async {
    final result = await _api.post('fix/end-session', {
      'session_id': sessionId,
    });
    return result['data']; // { score, correct, total, improvement }
  }
}`,
    },
    {
      title: "🤖 AI Agent Service",
      desc: "Daily plans, recommendations, cognitive twin",
      code: `class AIAgentService {
  final _api = AcryApi();

  Future<List<Map<String, dynamic>>> getDailyPlan() async {
    final result = await _api.get('ai-agent/daily-plan');
    return List<Map<String, dynamic>>.from(result['data']['sessions']);
  }

  Future<Map<String, dynamic>> getNextBestTopic() async {
    final result = await _api.get('ai-agent/next-best-topic');
    return result['data'];
  }

  Future<List<Map<String, dynamic>>> getRecommendations() async {
    final result = await _api.get('ai-agent/recommendations');
    return List<Map<String, dynamic>>.from(
      result['data']['recommendations']);
  }

  Future<Map<String, dynamic>> getCognitiveTwin() async {
    final result = await _api.get('ai-agent/cognitive-twin');
    return result['data'];
  }

  Future<void> submitFeedback(String recId, bool helpful) async {
    await _api.post('ai-agent/feedback', {
      'recommendation_id': recId, 'helpful': helpful,
    });
  }
}`,
    },
    {
      title: "📊 Rank Prediction Service",
      desc: "Rank predictions, simulations, competition analysis",
      code: `class RankService {
  final _api = AcryApi();

  Future<Map<String, dynamic>> getPrediction() async {
    final result = await _api.get('rank/prediction');
    return result['data']; // { predicted_rank, confidence }
  }

  Future<Map<String, dynamic>> getRange() async {
    final result = await _api.get('rank/range');
    return result['data']; // { best_case, expected, worst_case }
  }

  Future<Map<String, dynamic>> getCompetitionAnalysis() async {
    final result = await _api.get('rank/competition-analysis');
    return result['data']; // { percentile, ahead_of, behind }
  }

  Future<List<Map<String, dynamic>>> simulateImprovement() async {
    final result = await _api.get('rank/improvement-simulation');
    return List<Map<String, dynamic>>.from(
      result['data']['scenarios']);
  }
}`,
    },
    {
      title: "💬 Chat & Voice Service",
      desc: "Send messages, voice input, get suggestions",
      code: `class ChatService {
  final _api = AcryApi();

  Future<String> sendMessage(String message, {String lang = 'en'}) async {
    final result = await _api.post('chat/send-message', {
      'message': message, 'language': lang,
    });
    return result['data']['reply'];
  }

  Future<List<ChatMessage>> getHistory() async {
    final result = await _api.get('chat/history');
    return (result['data']['messages'] as List)
        .map((m) => ChatMessage.fromJson(m)).toList();
  }

  Future<Map<String, dynamic>> sendVoice(String audioBase64) async {
    final result = await _api.post('chat/voice-input', {
      'audio_base64': audioBase64, 'language': 'en',
    });
    return result['data']; // { transcript, reply, audio_reply_url }
  }

  Future<List<String>> getSuggestions() async {
    final result = await _api.get('chat/suggestions');
    return List<String>.from(result['data']['suggestions']);
  }

  Future<void> clearHistory() async {
    await _api.delete('chat/clear-history');
  }
}`,
    },
    {
      title: "📚 Study Logger Service",
      desc: "Log sessions, uploads, daily/weekly summaries",
      code: `class StudyLoggerService {
  final _api = AcryApi();

  Future<Map<String, dynamic>> logSession({
    required String topicId,
    required int durationMinutes,
    required int confidence,
    String mode = 'review',
  }) async {
    final result = await _api.post('study/log-session', {
      'topic_id': topicId,
      'duration_minutes': durationMinutes,
      'confidence_level': confidence,
      'study_mode': mode,
    });
    return result['data'];
  }

  Future<Map<String, dynamic>> getDailySummary() async {
    final result = await _api.get('study/daily-summary');
    return result['data'];
  }

  Future<Map<String, dynamic>> getWeeklySummary() async {
    final result = await _api.get('study/weekly-summary');
    return result['data'];
  }

  Future<Map<String, dynamic>> uploadPdf(String base64, String name) async {
    final result = await _api.post('study/upload-pdf', {
      'file_base64': base64, 'filename': name,
    });
    return result['data'];
  }
}`,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Smartphone className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Production-Ready Flutter (Dart) Services</h3>
        <span className="text-[10px] text-muted-foreground">{examples.length} complete service classes</span>
      </div>
      {examples.map((ex, i) => (
        <motion.div key={ex.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
          className="glass rounded-xl neural-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h4 className="text-xs font-semibold text-foreground">{ex.title}</h4>
            <p className="text-[10px] text-muted-foreground">{ex.desc}</p>
          </div>
          <div className="p-3"><CodeBlock code={ex.code} lang="dart" /></div>
        </motion.div>
      ))}
    </div>
  );
};

// ─── API Tester ───
const ApiTesterSection = () => {
  const { toast } = useToast();
  const { session } = useAuth();
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("user/profile");
  const [body, setBody] = useState("{}");
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [presetGroup, setPresetGroup] = useState("all");

  const execute = useCallback(async () => {
    setLoading(true);
    setResponse(null);
    const start = Date.now();

    const parseEndpointInput = (rawPath: string) => {
      let normalized = rawPath.trim();
      let searchParams = new URLSearchParams();
      let parsedFromFullUrl: URL | null = null;

      if (!normalized) return { path: "", searchParams, parsedFromFullUrl };

      if (/^https?:\/\//i.test(normalized)) {
        try {
          const parsed = new URL(normalized);
          parsedFromFullUrl = parsed;
          normalized = `${parsed.pathname}${parsed.search}`;
        } catch {
          // fall back to raw input
        }
      }

      const [pathnamePart, queryPart] = normalized.split("?");

      if (queryPart) {
        searchParams = new URLSearchParams(queryPart);
      }

      const cleanPath = pathnamePart
        .replace(/^\/+/, "")
        .replace(/^v\d+(?:\/|$)/i, "")
        .replace(/^functions\/v\d+\//i, "")
        .replace(/\/+$/, "");

      return { path: cleanPath, searchParams, parsedFromFullUrl };
    };

    const buildCandidateBases = (parsedFromFullUrl: URL | null) => {
      const defaults = ["https://api.acry.ai/v1", "https://api.acry.app/v1"];

      if (!parsedFromFullUrl || !/^https?:$/i.test(parsedFromFullUrl.protocol)) {
        return defaults;
      }

      const pathname = parsedFromFullUrl.pathname || "";
      const versionMatch = pathname.match(/^\/v\d+(?=\/|$)/i);
      const versionPrefix = versionMatch ? versionMatch[0] : "/v1";
      const preferred = `${parsedFromFullUrl.origin}${versionPrefix}`;

      return Array.from(new Set([preferred, ...defaults]));
    };

    const buildCandidatePaths = (cleanPath: string) => {
      const base = cleanPath.replace(/^\/+|\/+$/g, "");
      if (!base) return [] as string[];

      const withoutVersion = base.replace(/^v\d+\//i, "");
      const withApi = withoutVersion.startsWith("api/") ? withoutVersion : `api/${withoutVersion}`;
      const withoutApi = withoutVersion.replace(/^api\//i, "");

      return Array.from(new Set([base, withoutVersion, withApi, withoutApi].filter(Boolean)));
    };

    const { path: normalizedPath, searchParams, parsedFromFullUrl } = parseEndpointInput(path);
    const candidatePaths = buildCandidatePaths(normalizedPath);
    const candidateBases = buildCandidateBases(parsedFromFullUrl);

    if (candidatePaths.length === 0) {
      setStatusCode(400);
      setLatency(Date.now() - start);
      setResponse(JSON.stringify({ success: false, message: "Invalid endpoint path. Add a path like /auth/session-status after /v1.", error_code: 400 }, null, 2));
      setLoading(false);
      return;
    }

    try {
      const parsedBody = method === "GET"
        ? undefined
        : (() => {
            try {
              return JSON.parse(body || "{}");
            } catch {
              throw new Error("Invalid JSON body");
            }
          })();

      const headers: Record<string, string> = {
        Accept: "application/json",
      };

      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      if (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
        headers.apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      }

      let finalStatus = 500;
      let finalParsed: any = null;

      const parseToObject = (params: URLSearchParams) =>
        Object.fromEntries(Array.from(params.entries()));

      const isTransportFailure = (message: string) => {
        const lower = message.toLowerCase();
        return lower.includes("handshakefailure") ||
          lower.includes("tls") ||
          lower.includes("ssl") ||
          lower.includes("unable to resolve") ||
          lower.includes("dns") ||
          lower.includes("connect");
      };

      outer:
      for (const candidateBase of candidateBases) {
        for (const candidatePath of candidatePaths) {
          const { data, error } = await supabase.functions.invoke("api-gateway-proxy", {
            body: {
              method,
              path: candidatePath,
              query: parseToObject(searchParams),
              headers,
              body: parsedBody,
              base_url: candidateBase,
            },
          });

          if (error) {
            finalStatus = 503;
            finalParsed = {
              message: "API proxy unavailable",
              details: error.message,
              target_base: candidateBase,
              target_path: candidatePath,
            };
            continue;
          }

          const proxyRes = (data && typeof data === "object") ? (data as any) : null;
          if (!proxyRes) {
            finalStatus = 500;
            finalParsed = { message: "Invalid proxy response" };
            continue;
          }

          // Support old/new proxy formats and recover from deeply nested wrappers
          const isObject = (value: unknown): value is Record<string, unknown> =>
            Boolean(value) && typeof value === "object" && !Array.isArray(value);

          const hasSuccessFlag = (value: unknown) =>
            isObject(value) && (value.ok === true || value.success === true);

          const extractSuccessPayload = (value: unknown, depth = 0): Record<string, unknown> | null => {
            if (!isObject(value) || depth > 6) return null;
            if (hasSuccessFlag(value)) return value;

            const nestedCandidates = [
              value.data,
              value.payload,
              value.result,
              value.response,
            ];

            for (const candidate of nestedCandidates) {
              const hit = extractSuccessPayload(candidate, depth + 1);
              if (hit) return hit;
            }

            return null;
          };

          const successPayload = extractSuccessPayload(proxyRes);
          const normalizedSuccessPayload = successPayload ?? (proxyRes.data ?? proxyRes);
          const isOk = Boolean(successPayload);

          const rawStatus = Number(
            proxyRes.status_code ??
            proxyRes.status ??
            proxyRes?.data?.status_code ??
            proxyRes?.data?.status
          );

          finalStatus = Number.isFinite(rawStatus) && rawStatus > 0
            ? rawStatus
            : (isOk ? 200 : 500);

          if (isOk && finalStatus >= 400) finalStatus = 200;

          finalParsed = isOk
            ? normalizedSuccessPayload
            : {
                message: proxyRes.error || proxyRes.message || "Request failed",
                details: proxyRes.details,
                target_url: proxyRes.target_url,
                target_base: proxyRes.target_base,
                data: proxyRes.data,
              };

          if (finalStatus < 400) break outer;

          const errorMessage =
            (typeof finalParsed === "object" && (finalParsed as any)?.message) || "";

          if (!isTransportFailure(errorMessage)) break outer;
        }
      }

      const elapsed = Date.now() - start;
      setLatency(elapsed);
      setStatusCode(finalStatus);

      if (finalStatus >= 400) {
        const message =
          (typeof finalParsed === "object" && finalParsed?.message) ||
          (typeof finalParsed === "object" && finalParsed?.error) ||
          "Request failed";

        setResponse(JSON.stringify({ success: false, message, error_code: finalStatus, data: finalParsed }, null, 2));
      } else {
        setResponse(JSON.stringify({ success: true, message: "OK", data: finalParsed }, null, 2));
      }
    } catch (e: any) {
      setLatency(Date.now() - start);
      setStatusCode(500);
      setResponse(JSON.stringify({ success: false, message: e.message, error_code: 500 }, null, 2));
    }

    setLoading(false);
  }, [path, method, body, session?.access_token]);

  const groups = useMemo(() => {
    const g: Record<string, typeof ACRY_API_ROUTES> = {};
    ACRY_API_ROUTES.forEach(r => { if (!g[r.group]) g[r.group] = []; g[r.group].push(r); });
    return g;
  }, []);

  const presets = presetGroup === "all" ? ACRY_API_ROUTES.slice(0, 20) : (groups[presetGroup] || []);

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-4 neural-border">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
          <Terminal className="w-4 h-4 text-primary" /> API Test Console
        </h3>

        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-3 text-xs ${session ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
          {session ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          {session ? "Authenticated — requests use your session token" : "Not authenticated — log in to test protected endpoints"}
          {session && (
            <button onClick={() => setShowToken(!showToken)} className="ml-auto p-0.5 hover:bg-secondary rounded">
              {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </button>
          )}
        </div>
        {showToken && session?.access_token && (
          <div className="mb-3"><code className="text-[9px] font-mono text-muted-foreground break-all bg-secondary rounded p-2 block">{session.access_token.substring(0, 50)}...</code></div>
        )}

        {/* Quick Presets */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] text-muted-foreground">Presets</span>
            <select value={presetGroup} onChange={e => setPresetGroup(e.target.value)}
              className="px-2 py-0.5 bg-secondary rounded text-[10px] text-foreground border border-border outline-none">
              <option value="all">All</option>
              {Object.keys(groups).map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
            {presets.map(p => (
              <button key={`${p.method}-${p.path}`} onClick={() => { setMethod(p.method); setPath(p.path); setBody(JSON.stringify(p.request, null, 2)); }}
                className="px-2 py-1 bg-secondary/70 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors font-mono">
                <span className={`${METHOD_COLORS[p.method].split(" ")[1]} font-bold mr-1`}>{p.method}</span>
                /{p.path}
              </button>
            ))}
          </div>
        </div>

        {/* Request Builder */}
        <div className="grid grid-cols-[80px_1fr_auto] gap-2 mb-3">
          <select value={method} onChange={e => setMethod(e.target.value)}
            className="px-2 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border outline-none font-mono font-bold">
            <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option>
          </select>
          <input value={path} onChange={e => setPath(e.target.value)} placeholder="onboarding/exam-types or full URL"
            className="px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none font-mono" />
          <button onClick={execute} disabled={loading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 flex items-center gap-1.5 disabled:opacity-50">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Send
          </button>
        </div>

        {method !== "GET" && (
          <div className="mb-3">
            <span className="text-[10px] text-muted-foreground mb-1 block">Request Body (JSON)</span>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={4}
              className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none font-mono resize-y" />
          </div>
        )}

        {response && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${statusCode && statusCode < 400 ? "bg-emerald-500/15 text-emerald-400" : "bg-destructive/15 text-destructive"}`}>
                {statusCode}
              </span>
              {latency !== null && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{latency}ms</span>}
              <button onClick={() => { navigator.clipboard.writeText(response); toast({ title: "Response copied" }); }} className="ml-auto p-1 hover:bg-secondary rounded">
                <Copy className="w-3 h-3 text-primary" />
              </button>
            </div>
            <pre className="text-[10px] bg-secondary rounded-lg p-3 font-mono text-foreground overflow-x-auto max-h-[300px] overflow-y-auto">{response}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Error Codes ───
const ErrorCodesSection = () => {
  const errorCodes = [
    { code: 200, status: "OK", desc: "Request successful. Data returned in 'data' field.", color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { code: 201, status: "Created", desc: "Resource created successfully.", color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { code: 400, status: "Bad Request", desc: "Invalid request body or missing required parameters.", color: "text-amber-400", bg: "bg-amber-500/10" },
    { code: 401, status: "Unauthorized", desc: "Missing or invalid JWT token. Call auth/login first.", color: "text-destructive", bg: "bg-destructive/10" },
    { code: 403, status: "Forbidden", desc: "Valid token but insufficient permissions.", color: "text-destructive", bg: "bg-destructive/10" },
    { code: 404, status: "Not Found", desc: "Endpoint or resource doesn't exist.", color: "text-amber-400", bg: "bg-amber-500/10" },
    { code: 409, status: "Conflict", desc: "Resource already exists (duplicate signup, etc).", color: "text-amber-400", bg: "bg-amber-500/10" },
    { code: 422, status: "Unprocessable", desc: "Valid JSON but semantic validation failed.", color: "text-amber-400", bg: "bg-amber-500/10" },
    { code: 429, status: "Too Many Requests", desc: "Rate limit exceeded. Implement exponential backoff.", color: "text-amber-400", bg: "bg-amber-500/10" },
    { code: 500, status: "Server Error", desc: "Internal server error. Contact admin.", color: "text-destructive", bg: "bg-destructive/10" },
    { code: 503, status: "Service Unavailable", desc: "Service temporarily down. Retry with backoff.", color: "text-destructive", bg: "bg-destructive/10" },
  ];

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-4 neural-border">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" /> Error Handling Reference
        </h3>

        <div className="space-y-2 mb-5">
          {errorCodes.map(ec => (
            <div key={ec.code} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg ${ec.bg}`}>
              <span className={`text-sm font-bold font-mono ${ec.color} w-10`}>{ec.code}</span>
              <div className="flex-1">
                <span className={`text-xs font-semibold ${ec.color}`}>{ec.status}</span>
                <p className="text-[10px] text-muted-foreground">{ec.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
          <Code className="w-3.5 h-3.5 text-primary" /> Flutter Error Handler Pattern
        </h4>
        <CodeBlock code={`Future<T> safeApiCall<T>(Future<T> Function() apiCall) async {
  try {
    return await apiCall();
  } on AcryApiException catch (e) {
    switch (e.code) {
      case 401:
        // Token expired — try refresh
        await AuthService().refreshToken();
        return await apiCall(); // retry once
      case 429:
        // Rate limited — wait and retry
        await Future.delayed(Duration(seconds: 2));
        return await apiCall();
      case 503:
        // Service down — show maintenance message
        throw Exception('Service temporarily unavailable');
      default:
        // Show error to user
        throw Exception(e.message);
    }
  }
}

// Usage:
final profile = await safeApiCall(() => api.get('user/profile'));`} lang="dart" />
      </div>
    </div>
  );
};

// ─── Documentation Export ───
const DocsExportSection = () => {
  const { toast } = useToast();
  const baseUrl = "https://api.acry.ai/v1";

  const generateOpenApiSpec = useCallback(() => {
    const paths: Record<string, any> = {};
    ACRY_API_ROUTES.forEach(route => {
      const p = `/v1/${route.path}`;
      if (!paths[p]) paths[p] = {};
      paths[p][route.method.toLowerCase()] = {
        summary: route.desc,
        tags: [route.group],
        security: route.auth ? [{ bearerAuth: [] }] : [],
        ...(Object.keys(route.request).length > 0 && route.method !== "GET" ? {
          requestBody: { content: { "application/json": { schema: { type: "object", properties: Object.fromEntries(Object.entries(route.request).map(([k, v]) => [k, { type: typeof v === "number" ? "number" : typeof v === "boolean" ? "boolean" : "string", example: v }])) } } } }
        } : {}),
        responses: { "200": { description: "Success", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, message: { type: "string" }, data: { type: "object" } } } } } } },
      };
    });

    const spec = {
      openapi: "3.0.3",
      info: { title: "ACRY API", version: "1.0.0", description: "AI Second Brain for All Exams — Complete API Reference" },
      servers: [{ url: baseUrl, description: "Production" }],
      components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } },
      paths,
    };
    return JSON.stringify(spec, null, 2);
  }, [baseUrl]);

  const generatePostmanCollection = useCallback(() => {
    const groups = ACRY_API_ROUTES.reduce((acc, r) => {
      if (!acc[r.group]) acc[r.group] = [];
      acc[r.group].push(r);
      return acc;
    }, {} as Record<string, typeof ACRY_API_ROUTES>);

    const collection = {
      info: { name: "ACRY API Collection", schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json", description: `${ACRY_API_ROUTES.length} endpoints across ${Object.keys(groups).length} categories` },
      auth: { type: "bearer", bearer: [{ key: "token", value: "{{jwt_token}}", type: "string" }] },
      variable: [{ key: "base_url", value: baseUrl }, { key: "jwt_token", value: "" }],
      item: Object.entries(groups).map(([group, routes]) => ({
        name: group,
        item: routes.map(r => ({
          name: `${r.method} ${r.desc}`,
          request: {
            method: r.method,
            header: [{ key: "Content-Type", value: "application/json" }, { key: "apikey", value: "{{anon_key}}" }],
            url: { raw: `{{base_url}}/${r.path}`, host: ["{{base_url}}"], path: r.path.split("/") },
            ...(Object.keys(r.request).length > 0 && r.method !== "GET" ? { body: { mode: "raw", raw: JSON.stringify(r.request, null, 2) } } : {}),
          },
        })),
      })),
    };
    return JSON.stringify(collection, null, 2);
  }, [baseUrl]);

  const generateMarkdown = useCallback(() => {
    const groups = ACRY_API_ROUTES.reduce((acc, r) => {
      if (!acc[r.group]) acc[r.group] = [];
      acc[r.group].push(r);
      return acc;
    }, {} as Record<string, typeof ACRY_API_ROUTES>);

    let md = `# ACRY API Documentation\n\n`;
    md += `> ${ACRY_API_ROUTES.length} endpoints across ${Object.keys(groups).length} categories\n\n`;
    md += `**Base URL:** \`${baseUrl}\`\n\n**Auth:** \`Authorization: Bearer <JWT_TOKEN>\`\n\n---\n\n`;

    Object.entries(groups).forEach(([group, routes]) => {
      md += `## ${GROUP_ICONS[group] || ""} ${group} (${routes.length} endpoints)\n\n`;
      md += `| Method | Endpoint | Auth | Description |\n|--------|----------|------|-------------|\n`;
      routes.forEach(r => {
        md += `| \`${r.method}\` | \`/v1/${r.path}\` | ${r.auth ? "🔒" : "🌐"} | ${r.desc} |\n`;
      });
      md += `\n`;
    });

    return md;
  }, [baseUrl]);

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Downloaded ${filename}` });
  };

  const exports = [
    { label: "OpenAPI 3.0 (Swagger)", desc: "Import into Swagger UI, Stoplight, or any OpenAPI tool", icon: Braces, filename: "acry-api-openapi.json", type: "application/json", generate: generateOpenApiSpec },
    { label: "Postman Collection", desc: "Import directly into Postman for team API testing", icon: Package, filename: "acry-api-postman.json", type: "application/json", generate: generatePostmanCollection },
    { label: "Markdown Docs", desc: "Human-readable endpoint reference for documentation sites", icon: FileText, filename: "acry-api-docs.md", type: "text/markdown", generate: generateMarkdown },
  ];

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-4 neural-border">
        <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          <Download className="w-4 h-4 text-primary" /> Export API Documentation
        </h3>
        <p className="text-[10px] text-muted-foreground mb-4">Auto-generated from {ACRY_API_ROUTES.length} registered endpoints. Always up-to-date.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {exports.map(ex => (
            <motion.button key={ex.label} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => downloadFile(ex.generate(), ex.filename, ex.type)}
              className="flex flex-col items-center gap-3 p-5 bg-secondary/50 rounded-xl border border-border hover:border-primary/50 transition-colors text-center">
              <ex.icon className="w-8 h-8 text-primary" />
              <div>
                <p className="text-xs font-semibold text-foreground">{ex.label}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{ex.desc}</p>
              </div>
              <span className="text-[10px] text-primary font-medium flex items-center gap-1">
                <Download className="w-3 h-3" /> Download
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Quick Preview */}
      <div className="glass rounded-xl p-4 neural-border">
        <h4 className="text-xs font-semibold text-foreground mb-3">Endpoint Summary</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          <div className="bg-emerald-500/10 rounded-lg p-2">
            <span className="text-lg font-bold text-emerald-400">{ACRY_API_ROUTES.filter(r => r.method === "GET").length}</span>
            <p className="text-[10px] text-muted-foreground">GET</p>
          </div>
          <div className="bg-blue-500/10 rounded-lg p-2">
            <span className="text-lg font-bold text-blue-400">{ACRY_API_ROUTES.filter(r => r.method === "POST").length}</span>
            <p className="text-[10px] text-muted-foreground">POST</p>
          </div>
          <div className="bg-amber-500/10 rounded-lg p-2">
            <span className="text-lg font-bold text-amber-400">{ACRY_API_ROUTES.filter(r => r.method === "PUT").length}</span>
            <p className="text-[10px] text-muted-foreground">PUT</p>
          </div>
          <div className="bg-red-500/10 rounded-lg p-2">
            <span className="text-lg font-bold text-red-400">{ACRY_API_ROUTES.filter(r => r.method === "DELETE").length}</span>
            <p className="text-[10px] text-muted-foreground">DELETE</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Code Block Helper ───
const CodeBlock = ({ code, lang }: { code: string; lang: string }) => {
  const { toast } = useToast();
  return (
    <div className="relative group">
      <button onClick={() => { navigator.clipboard.writeText(code); toast({ title: "Code copied!" }); }}
        className="absolute top-2 right-2 p-1 bg-secondary/80 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <Copy className="w-3 h-3 text-primary" />
      </button>
      <pre className="text-[10px] bg-secondary rounded-lg p-3 font-mono text-foreground overflow-x-auto whitespace-pre">{code}</pre>
    </div>
  );
};

export default FlutterApiHub;
