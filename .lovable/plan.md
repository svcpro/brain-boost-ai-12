# Voice Broadcast Automation Flow

Build an end-to-end automated voice call broadcast system: **Text → AI Voice (TTS) → Voice Library → Event-triggered Auto Scheduling**.

## 1. Voice Library (TTS generation)

Extend the existing `voice-broadcast` edge function (it already has `tts_preview` and `tts_generate_voice` actions using ElevenLabs + OBD upload).

Admin UI flow in `VoiceBroadcastCenter.tsx`:
- "Create Voice from Text" panel: textarea for script + voice picker (ElevenLabs voices) + language + event tag dropdown.
- On generate → calls `tts_generate_voice` → uploads MP3 to OBD → row saved in `voice_broadcast_voice_files` with new column `event_key` (which automation event this voice belongs to).
- Voice Library list (existing) shows all generated voices, filterable by `event_key`, with Preview / Delete (already added) / "Set as default for event" action.

## 2. Event → Voice mapping

New table `voice_broadcast_event_voices`:
- `event_key` (unique) — one of the 11 events below
- `voice_file_id` → references the chosen library voice (`prompt_id`)
- `is_active`, `cooldown_hours`, `send_window_start/end` (e.g., 09:00–20:00 IST), `location` (Ahmedabad/Bangalore)

Supported events:
1. `signup_welcome`
2. `onboarding_incomplete`
3. `inactive_24h`
4. `inactive_24h_plus`
5. `inactive_3d_7d`
6. `daily_ai_tools_alert`
7. `leaderboard_alert`
8. `missing_activity`
9. `weekly_performance`
10. `trial_end`
11. `premium_upgrade`
12. `final_reengagement`

Admin UI: new "Event Automation" tab in `VoiceBroadcastCenter` — table listing each event with: assigned voice (dropdown from library), active toggle, cooldown, send window, location, "Test Call to me" button.

## 3. Scheduling engine

New edge function `voice-broadcast-scheduler` (cron-driven, runs every 15 min via `pg_cron` + `pg_net`):

For each active event, resolves the eligible user cohort using existing tables:
- `signup_welcome`: profiles.created_at within last 30 min, not yet called
- `onboarding_incomplete`: profile created >2h ago, onboarding_completed=false
- `inactive_24h`: last activity 22–26h ago
- `inactive_24h_plus`: last activity 26–72h ago
- `inactive_3d_7d`: 3–7 days inactive
- `daily_ai_tools_alert`: daily 10:00 IST batch, all active users
- `leaderboard_alert`: weekly, top-50 boundary users
- `missing_activity`: scheduled study task missed today
- `weekly_performance`: every Sunday 18:00 IST
- `trial_end`: trial expires in <48h
- `premium_upgrade`: trial ended <24h ago, not subscribed
- `final_reengagement`: inactive 14+ days, last attempt

For each cohort batch, calls existing `voice-broadcast` action `compose` with:
- the event's mapped `voice_file_id` (already uploaded to OBD)
- phone list from `profiles.phone` (normalized to Indian format)
- the event's `location` setting
- unique campaign name `evt_{event_key}_{ts}`
- `schedule_dt` = now + 1 min

Logs each send into new table `voice_broadcast_event_logs` (`event_key`, `user_id`, `campaign_id_external`, `sent_at`, `status`) — enforces the per-user cooldown and prevents double-calls.

## 4. Cron setup

Enable `pg_cron` + `pg_net`, schedule `voice-broadcast-scheduler` every 15 minutes via `cron.schedule` (inserted via insert tool with the real function URL + anon key).

## 5. Admin observability

In `VoiceBroadcastCenter`, add an "Automation Logs" tab showing recent `voice_broadcast_event_logs` rows with event, user phone, campaign id, status, time — filterable by event.

## Technical details

- Reuses existing OBD integration (no new third-party). Voice files only generated once per event and reused for every campaign.
- All cohort queries use service-role admin client inside the scheduler function.
- Cohort batch size capped at 200 numbers per `compose` call; loop if larger.
- `event_key` constants centralized in `supabase/functions/_shared/voice-events.ts`.
- RLS: admin-only on `voice_broadcast_event_voices` and `voice_broadcast_event_logs` (using existing `is_admin()` SECURITY DEFINER function).
- No client-side changes outside the admin panel — end users just receive calls.

## Files to create/edit

- `supabase/functions/voice-broadcast/index.ts` — add `event_key` to voice upload, add `list_event_voices` / `set_event_voice` / `test_event_call` actions.
- `supabase/functions/voice-broadcast-scheduler/index.ts` — new cron handler.
- `supabase/functions/_shared/voice-events.ts` — event constants + cohort query helpers.
- `src/components/admin/VoiceBroadcastCenter.tsx` — add "Event Automation" + "Automation Logs" tabs and TTS event-tag selector.
- Migration: `voice_broadcast_voice_files.event_key`, `voice_broadcast_event_voices`, `voice_broadcast_event_logs` + RLS.
- Insert: `pg_cron` schedule for the scheduler function.
