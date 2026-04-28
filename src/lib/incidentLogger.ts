import { supabase } from "@/integrations/supabase/client";

export type IncidentEventType = "alert" | "snapshot" | "recommendation" | "upgrade" | "rollback" | "resolved";
export type IncidentSeverity = "info" | "warning" | "critical";

export interface IncidentPayload {
  event_type: IncidentEventType;
  severity?: IncidentSeverity;
  title: string;
  description?: string;
  metric_name?: string;
  metric_value?: number;
  threshold_value?: number;
  current_tier?: string;
  recommended_tier?: string;
  snapshot?: Record<string, any>;
  metadata?: Record<string, any>;
}

const DEDUPE_WINDOW_MS = 5 * 60 * 1000;
const dedupeCache = new Map<string, number>();

/**
 * Fire-and-forget incident logger.
 * Deduplicates same-key alerts inside a 5-minute window.
 */
export async function logIncident(payload: IncidentPayload, dedupeKey?: string): Promise<void> {
  try {
    if (dedupeKey) {
      const last = dedupeCache.get(dedupeKey);
      if (last && Date.now() - last < DEDUPE_WINDOW_MS) return;
      dedupeCache.set(dedupeKey, Date.now());
    }
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("incident_history" as any).insert({
      ...payload,
      severity: payload.severity || "info",
      created_by: user?.id || null,
    });
  } catch (e) {
    console.warn("[incidentLogger] failed:", e);
  }
}
