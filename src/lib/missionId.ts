/**
 * Shared mission_id validation helper.
 *
 * Mission lifecycle endpoints (start / progress / complete) require a real
 * DB-backed UUID. Synthetic local IDs (e.g. "mission-2026-05-01") must be
 * filtered client-side to prevent 404 "Mission not found" errors.
 *
 * Mirror of `isValidMissionId` in `supabase/functions/_shared/missionId.ts`.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isValidMissionId = (id: unknown): id is string =>
  typeof id === "string" && UUID_RE.test(id);

export { UUID_RE };
