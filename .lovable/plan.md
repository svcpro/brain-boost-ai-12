# Campus Ambassador Dashboard — Build Plan

This is a large, multi-system build. To keep quality high and avoid a 4000-line mega-file, I'll ship it in phases. Each phase is independently usable. Confirm the phase order (or pick a subset) and I'll start with Phase 1.

## Foundation (always first)

**Route + shell**
- New route `/ambassador` (post-approval gated) with a sticky bottom nav on mobile + sidebar on desktop
- Reuses existing `CampusAmbassadorBlueprint` Emerald Prestige tokens, but adds dashboard-specific dark palette: deep blue `#0a0f2a`, electric purple `#7c4dff`, neon cyan `#00e5ff`
- Glassmorphism card primitive (`AmbCard`), animated counter, progress ring, neon button — all in `src/components/ambassador/ui/`
- Framer-motion `MotionConfig reducedMotion="user"` + the existing `usePerfMode` hook for low-end devices

**Backend (one migration)**
- `ambassador_profiles` (linked to existing `campus_ambassador_applications` on approval): rank, ai_level, xp, points, streak, badges[], city, college, bio, socials, public_slug
- `ambassador_missions`, `ambassador_mission_submissions` (with proof URLs)
- `ambassador_referrals` (link + conversions)
- `ambassador_workshops` (request → approval lifecycle)
- `ambassador_events`, `ambassador_event_rsvps`
- `ambassador_rewards`, `ambassador_reward_claims`
- `ambassador_certificates`
- `ambassador_community_posts`, `ambassador_post_reactions`
- `ambassador_training_modules`, `ambassador_module_progress`
- `ambassador_founder_updates`
- All RLS scoped to `auth.uid()`; admin writes via `has_role(_, 'admin')`
- Promotion trigger: when `campus_ambassador_applications.status = 'approved'`, auto-create `ambassador_profiles` row

## Phase 1 — Shell + Welcome + Profile (ship-ready core)
- `/ambassador` layout shell with sidebar + bottom nav (10 sections)
- Welcome dashboard: greeting, profile chip, rank, AI level (Rookie → Champion), XP progress ring, weekly summary, campus impact tiles, floating particles
- Profile section: edit form (bio, skills, socials, college), avatar upload to existing `avatars` bucket, public-profile preview modal

## Phase 2 — Gamification engines
- Mission Center: weekly task cards, deadline countdown, proof upload, completion confetti, daily-streak ring
- Leaderboard: top ambassadors / campuses / cities tabs, weekly/monthly/all-time filter, animated rank changes, top-3 trophy podium
- Badge system: shareable badge grid with unlock animations
- Reward Center: tiered unlock ladder (100/500/1000 XP), claim flow

## Phase 3 — Growth tools
- Referral engine: unique link, copy/WhatsApp share, referral table, conversion funnel chart
- Workshop management: request form, status tracker, downloadable toolkit
- Event & Summit center: upcoming list, countdown timers, RSVP

## Phase 4 — Community + content + recognition
- Community hub (Discord-style feed): posts, emoji reactions, city/campus channels, pinned announcements (realtime via Supabase channels)
- Content Creator panel: challenge cards, content templates, submission tracker
- Certificate center: downloadable PDFs + LinkedIn share + QR verify route
- Founder message: weekly video card

## Phase 5 — Analytics + admin extensions
- Personal analytics dashboard (students impacted, referrals, workshops, engagement) with Recharts
- City Chapter pages with local leaderboards
- Admin: extend existing `CampusAmbassadorManagement` with mission assignment, workshop approval, reward management, broadcast announcements, city performance overview

## Technical details

- **Stack:** React + TS + Tailwind + framer-motion + Recharts (already installed) + shadcn primitives
- **Realtime:** community posts + leaderboard delta via Supabase Realtime
- **Auth gate:** check `campus_ambassador_applications.status = 'approved'` for current user before rendering dashboard; otherwise show pending/rejected state
- **Files:** all new code under `src/pages/ambassador/` and `src/components/ambassador/`; existing landing/admin pages untouched
- **Performance:** lazy-load each phase's main page via `React.lazy`; keep individual files <500 lines

## What I need from you

1. **Start with Phase 1 only?** (recommended — gives you a working shell + welcome + profile this turn, then we iterate)
2. **Or build Phases 1+2 in one go?** (larger turn, ~6–8 files)
3. **Different priority?** Tell me which 2–3 sections matter most and I'll start there.

Reply with the phase scope and I'll create the migration + ship the code.