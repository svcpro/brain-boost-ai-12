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

// ─── Complete ACRY API Route Registry (120+ endpoints) ───
const ACRY_API_ROUTES = [
  // ── Section 2: Authentication (9 endpoints) ──
  { group: "Authentication", path: "auth/signup", method: "POST", desc: "Register new user account", auth: false, request: { email: "string", password: "string", display_name: "string" }, response: { token: "JWT_TOKEN", refresh_token: "string", user: { id: "uuid", email: "string" } } },
  { group: "Authentication", path: "auth/login", method: "POST", desc: "Login with email & password", auth: false, request: { email: "string", password: "string" }, response: { token: "JWT_TOKEN", refresh_token: "string", user: { id: "uuid", email: "string" } } },
  { group: "Authentication", path: "auth/logout", method: "POST", desc: "Invalidate current session", auth: true, request: {}, response: { success: true } },
  { group: "Authentication", path: "auth/refresh-token", method: "POST", desc: "Refresh expired JWT token", auth: false, request: { refresh_token: "string" }, response: { token: "NEW_JWT_TOKEN", expires_in: 3600 } },
  { group: "Authentication", path: "auth/forgot-password", method: "POST", desc: "Send password reset email", auth: false, request: { email: "string" }, response: { success: true, message: "Reset link sent" } },
  { group: "Authentication", path: "auth/reset-password", method: "POST", desc: "Reset password with token", auth: false, request: { token: "string", new_password: "string" }, response: { success: true } },
  { group: "Authentication", path: "auth/send-otp", method: "POST", desc: "Send OTP to phone/email", auth: false, request: { email: "string", type: "email" }, response: { success: true, expires_in: 300 } },
  { group: "Authentication", path: "auth/verify-otp", method: "POST", desc: "Verify OTP code", auth: false, request: { email: "string", otp: "123456" }, response: { token: "JWT_TOKEN", verified: true } },
  { group: "Authentication", path: "auth/session-status", method: "GET", desc: "Check current session validity", auth: true, request: {}, response: { active: true, expires_at: "ISO_DATE", user_id: "uuid" } },

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
];

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-400",
  POST: "bg-blue-500/15 text-blue-400",
  PUT: "bg-amber-500/15 text-amber-400",
  DELETE: "bg-red-500/15 text-red-400",
};

const GROUP_ICONS: Record<string, string> = {
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
            <Code className="w-3.5 h-3.5 text-primary" /> Step 3: Auth Flow (Login → Store Token)
          </h4>
          <CodeBlock code={`final api = AcryApi();

// Login
final result = await api.post('auth/login', {
  'email': 'user@example.com',
  'password': 'password123',
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
    try {
      const fnName = path.split("/")[0];
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: method === "GET" ? { action: path.split("/").slice(1).join("-") || "status" } : JSON.parse(body),
      });
      const elapsed = Date.now() - start;
      setLatency(elapsed);
      if (error) {
        setStatusCode(500);
        setResponse(JSON.stringify({ success: false, message: error.message, error_code: 500 }, null, 2));
      } else {
        setStatusCode(200);
        setResponse(JSON.stringify({ success: true, message: "OK", data }, null, 2));
      }
    } catch (e: any) {
      setLatency(Date.now() - start);
      setStatusCode(500);
      setResponse(JSON.stringify({ success: false, message: e.message, error_code: 500 }, null, 2));
    }
    setLoading(false);
  }, [path, method, body]);

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
          <input value={path} onChange={e => setPath(e.target.value)} placeholder="endpoint/path"
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
