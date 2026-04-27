// Server-side full / incremental database backup engine.
// - Uses service role to bypass RLS so admin tables export cleanly.
// - Streams pages of 1000 rows per table with up to 4 tables in parallel.
// - Incremental mode: only exports rows where updated_at/created_at > last_run cutoff.
// - Uploads JSON or NDJSON to Storage and returns a 24h signed URL.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const ALL_TABLES = [
  "accelerator_enrollments","adaptive_lock_config","admin_audit_logs","ai_chat_messages",
  "ai_recalibration_logs","ai_recommendations","api_endpoints","api_integrations",
  "api_keys","api_rate_limits","api_request_logs","attention_predictions",
  "autopilot_config","autopilot_sessions","batch_analytics","batch_students",
  "behavioral_micro_events","behavioral_profiles","brain_missions","brain_reports",
  "brainlens_config","brainlens_queries","ca_autopilot_config","ca_debate_analyses",
  "ca_entities","ca_event_entities","ca_events","ca_framework_applications",
  "ca_generated_questions","ca_graph_edges","ca_impact_forecasts","ca_policy_analyses",
  "ca_policy_similarities","ca_probability_adjustments","ca_syllabus_links",
  "ca_writing_evaluations","campaign_recipients","campaigns","channel_effectiveness",
  "chat_admin_config","chat_usage_logs","churn_predictions","cognitive_profiles",
  "cognitive_state_history","cognitive_twins","coming_soon_config","coming_soon_emails",
  "communities","community_members","community_posts","competitive_intel_config",
  "confidence_events","content_flags","curriculum_shift_events","device_sessions",
  "discussion_recommendations","distraction_events","distraction_scores","drip_sequences",
  "edge_function_rate_limits","email_logs","email_queue","email_templates","email_triggers",
  "event_log","exam_countdown_config","exam_countdown_predictions","exam_datasets",
  "exam_evolution_patterns","exam_evolution_reports","exam_intel_alerts",
  "exam_intel_pipeline_runs","exam_intel_practice_questions","exam_intel_student_briefs",
  "exam_intel_topic_scores","exam_results","exam_trend_patterns","faculty_assignments",
  "fatigue_config","fatigue_events","feature_flags","focus_interventions",
  "focus_shield_config","focus_shield_warnings","freeze_gifts","generated_exam_questions",
  "global_learning_patterns","growth_analytics","growth_journeys","growth_trigger_log",
  "hybrid_predictions","institution_api_keys","institution_audit_logs","institution_batches",
  "institution_invoices","institution_licenses","institution_members","institutions",
  "language_performance","leads","learning_simulations","memory_scores",
  "meta_learning_strategies","meta_template_submissions","micro_concepts","ml_events",
  "ml_training_logs","model_metrics","model_predictions","model_recalibration_logs",
  "model_selections","moderation_actions","moderation_rules","neural_discipline_scores",
  "notification_ab_tests","notification_analytics","notification_bundles",
  "notification_delivery_log","notification_escalations","notification_history",
  "notification_segments","omnichannel_rules","opponent_simulation_config",
  "pattern_evolution_logs","plan_feature_gates","plan_quality_logs","plan_sessions",
  "post_bookmarks","post_comments","post_reactions","post_votes","practice_progress",
  "practice_set_submissions","precision_scores","predicted_questions",
  "prediction_confidence_bands","profiles","push_notification_logs",
  "push_notification_queue","push_notification_templates","push_notification_triggers",
  "push_subscriptions","question_bank","question_bank_tags",
  "rank_predictions","role_permissions","seo_config",
  "sms_config","sms_event_registry","sms_logs","sms_quota","sms_scheduled_dispatches",
  "streak_freezes","study_logs","study_plans","subjects",
  "subscription_plans","sureshot_questions","topics",
  "user_roles","user_settings","user_subscriptions",
  "whatsapp_config","whatsapp_quota",
  "admin_backup_runs",
];

const PAGE_SIZE = 1000;
const PARALLEL = 4;

// Try common timestamp columns in priority order
const INCR_COLUMNS = ["updated_at", "created_at", "inserted_at", "started_at"];

async function fetchTable(sb: any, table: string, sinceCol: string | null, sinceIso: string | null) {
  const rows: any[] = [];
  let page = 0;
  while (true) {
    let q = sb.from(table).select("*").range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (sinceCol && sinceIso) q = q.gt(sinceCol, sinceIso);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }
  return rows;
}

// Detect which timestamp column a table actually has by probing 1 row
async function detectTimestampColumn(sb: any, table: string): Promise<string | null> {
  const { data, error } = await sb.from(table).select("*").limit(1);
  if (error || !data || data.length === 0) return null;
  const sample = data[0];
  for (const col of INCR_COLUMNS) {
    if (col in sample && sample[col] != null) return col;
    if (col in sample) return col; // accept even if null in sample
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "missing_token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: isAdmin } = await sb.rpc("is_admin", { _user_id: user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "start";

    if (action === "list_tables") {
      return new Response(JSON.stringify({ tables: ALL_TABLES }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Return last successful run timestamp (for UI preview of "since")
    if (action === "last_run") {
      const { data: last } = await sb.from("admin_backup_runs")
        .select("id, finished_at, mode, total_rows, size_bytes")
        .eq("status", "completed")
        .order("finished_at", { ascending: false })
        .limit(1).maybeSingle();
      return new Response(JSON.stringify({ last }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const format: "json" | "ndjson" = body.format === "ndjson" ? "ndjson" : "json";
    const mode: "full" | "incremental" = body.mode === "incremental" ? "incremental" : "full";
    const requested: string[] = Array.isArray(body.tables) && body.tables.length
      ? body.tables.filter((t: string) => ALL_TABLES.includes(t))
      : ALL_TABLES;

    // Resolve incremental cutoff: explicit `since` or last completed run
    let sinceIso: string | null = null;
    if (mode === "incremental") {
      if (body.since) {
        sinceIso = new Date(body.since).toISOString();
      } else {
        const { data: last } = await sb.from("admin_backup_runs")
          .select("finished_at").eq("status", "completed")
          .order("finished_at", { ascending: false }).limit(1).maybeSingle();
        if (last?.finished_at) sinceIso = last.finished_at;
      }
      // No prior run → fall back to a full export, but record as incremental for first baseline
      if (!sinceIso) {
        sinceIso = new Date(0).toISOString(); // epoch = effectively full
      }
    }

    const startedAt = Date.now();
    const { data: runRow, error: runErr } = await sb.from("admin_backup_runs").insert({
      triggered_by: user.id,
      status: "running",
      format,
      mode,
      since_timestamp: sinceIso,
      scope: requested.length === ALL_TABLES.length ? "full" : "partial",
      selected_tables: requested.length === ALL_TABLES.length ? null : requested,
      total_tables: requested.length,
    }).select().single();
    if (runErr) throw runErr;
    const runId = runRow.id;

    const results: Record<string, { count: number; data?: any[]; error?: string; sinceCol?: string | null }> = {};
    const failed: string[] = [];
    const skipped: string[] = []; // incremental: tables w/ 0 changes
    let totalRows = 0;
    let completed = 0;

    let cursor = 0;
    async function worker() {
      while (cursor < requested.length) {
        const idx = cursor++;
        const table = requested[idx];
        try {
          let sinceCol: string | null = null;
          if (mode === "incremental") {
            sinceCol = await detectTimestampColumn(sb, table);
            // If no timestamp column, include the whole table (safer than dropping data)
          }
          const rows = await fetchTable(sb, table, sinceCol, sinceCol ? sinceIso : null);
          results[table] = { count: rows.length, data: rows, sinceCol };
          totalRows += rows.length;
          if (mode === "incremental" && rows.length === 0) skipped.push(table);
        } catch (e: any) {
          results[table] = { count: 0, data: [], error: e.message };
          failed.push(table);
        }
        completed++;
        if (completed % 8 === 0 || completed === requested.length) {
          await sb.from("admin_backup_runs")
            .update({ completed_tables: completed, failed_tables: failed, total_rows: totalRows, skipped_tables: skipped })
            .eq("id", runId);
        }
      }
    }
    await Promise.all(Array.from({ length: PARALLEL }, worker));

    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    let blob: Uint8Array;
    let ext: string;
    let contentType: string;

    const metaCommon = {
      exportedAt: new Date().toISOString(),
      version: "3.1",
      mode,
      since: sinceIso,
      totalTables: requested.length,
      successfulTables: requested.length - failed.length,
      skippedTables: skipped,
      failedTables: failed,
      totalRows,
    };

    if (format === "ndjson") {
      const enc = new TextEncoder();
      const chunks: Uint8Array[] = [];
      chunks.push(enc.encode(JSON.stringify({ _meta: { ...metaCommon, format: "ndjson" } }) + "\n"));
      for (const t of requested) {
        const r = results[t];
        if (!r?.data?.length) continue;
        for (const row of r.data) {
          chunks.push(enc.encode(JSON.stringify({ _table: t, row }) + "\n"));
        }
      }
      const total = chunks.reduce((s, c) => s + c.length, 0);
      blob = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) { blob.set(c, off); off += c.length; }
      ext = "ndjson";
      contentType = "application/x-ndjson";
    } else {
      const payload = {
        _meta: { ...metaCommon, format: "json", type: mode === "incremental" ? "incremental_backup" : "full_database_backup" },
        tables: results,
      };
      blob = new TextEncoder().encode(JSON.stringify(payload));
      ext = "json";
      contentType = "application/json";
    }

    const prefix = mode === "incremental" ? "acry-incr" : "acry-backup";
    const path = `${user.id}/${prefix}-${ts}.${ext}`;
    const { error: upErr } = await sb.storage.from("admin-backups")
      .upload(path, blob, { contentType, upsert: true });
    if (upErr) throw upErr;

    const { data: signed } = await sb.storage.from("admin-backups")
      .createSignedUrl(path, 60 * 60 * 24);

    const duration = Date.now() - startedAt;
    await sb.from("admin_backup_runs").update({
      status: failed.length === requested.length ? "failed" : "completed",
      completed_tables: completed,
      failed_tables: failed,
      skipped_tables: skipped,
      total_rows: totalRows,
      size_bytes: blob.byteLength,
      storage_path: path,
      download_url: signed?.signedUrl,
      duration_ms: duration,
      finished_at: new Date().toISOString(),
    }).eq("id", runId);

    return new Response(JSON.stringify({
      ok: true,
      run_id: runId,
      mode,
      since: sinceIso,
      status: failed.length === requested.length ? "failed" : "completed",
      total_tables: requested.length,
      completed_tables: completed,
      skipped_tables: skipped,
      failed_tables: failed,
      total_rows: totalRows,
      size_bytes: blob.byteLength,
      duration_ms: duration,
      download_url: signed?.signedUrl,
      storage_path: path,
      format,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error("admin-full-backup error:", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
