/**
 * Shared mission_id validation helper for Edge Functions.
 *
 * Mirror of `src/lib/missionId.ts` — keep both files in sync.
 * Returns true only for canonical UUID v1–v5 strings; synthetic local IDs
 * (e.g. "mission-2026-05-01") return false so callers can safely skip DB lookups.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isValidMissionId = (id: unknown): id is string =>
  typeof id === "string" && UUID_RE.test(id);

export { UUID_RE };
