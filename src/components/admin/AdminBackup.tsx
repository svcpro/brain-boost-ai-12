import { useState } from "react";
import { motion } from "framer-motion";
import { Database, Download, Loader2, CheckCircle2, HardDrive, FileJson, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// All public tables in the database
const ALL_TABLES = [
  "accelerator_enrollments", "adaptive_lock_config", "admin_audit_logs", "ai_chat_messages",
  "ai_recalibration_logs", "ai_recommendations", "api_endpoints", "api_integrations",
  "api_keys", "api_rate_limits", "api_request_logs", "attention_predictions",
  "autopilot_config", "autopilot_sessions", "batch_analytics", "batch_students",
  "behavioral_micro_events", "behavioral_profiles", "brain_missions", "brain_reports",
  "brainlens_config", "brainlens_queries", "ca_autopilot_config", "ca_debate_analyses",
  "ca_entities", "ca_event_entities", "ca_events", "ca_framework_applications",
  "ca_generated_questions", "ca_graph_edges", "ca_impact_forecasts", "ca_policy_analyses",
  "ca_policy_similarities", "ca_probability_adjustments", "ca_syllabus_links",
  "ca_writing_evaluations", "campaign_recipients", "campaigns", "channel_effectiveness",
  "chat_admin_config", "chat_usage_logs", "churn_predictions", "cognitive_profiles",
  "cognitive_state_history", "cognitive_twins", "coming_soon_config", "coming_soon_emails",
  "communities", "community_members", "community_posts", "competitive_intel_config",
  "confidence_events", "content_flags", "curriculum_shift_events", "device_sessions",
  "discussion_recommendations", "distraction_events", "distraction_scores", "drip_sequences",
  "edge_function_rate_limits", "email_logs", "email_queue", "email_templates", "email_triggers",
  "event_log", "exam_countdown_config", "exam_countdown_predictions", "exam_datasets",
  "exam_evolution_patterns", "exam_evolution_reports", "exam_intel_alerts",
  "exam_intel_pipeline_runs", "exam_intel_practice_questions", "exam_intel_student_briefs",
  "exam_intel_topic_scores", "exam_results", "exam_trend_patterns", "faculty_assignments",
  "fatigue_config", "fatigue_events", "feature_flags", "focus_interventions",
  "focus_shield_config", "focus_shield_warnings", "freeze_gifts", "generated_exam_questions",
  "global_learning_patterns", "growth_analytics", "growth_journeys", "growth_trigger_log",
  "hybrid_predictions", "institution_api_keys", "institution_audit_logs", "institution_batches",
  "institution_invoices", "institution_licenses", "institution_members", "institutions",
  "language_performance", "leads", "learning_simulations", "memory_scores",
  "meta_learning_strategies", "meta_template_submissions", "micro_concepts", "ml_events",
  "ml_training_logs", "model_metrics", "model_predictions", "model_recalibration_logs",
  "model_selections", "moderation_actions", "moderation_rules", "neural_discipline_scores",
  "notification_ab_tests", "notification_analytics", "notification_bundles",
  "notification_delivery_log", "notification_escalations", "notification_history",
  "notification_segments", "omnichannel_rules", "opponent_simulation_config",
  "pattern_evolution_logs", "plan_feature_gates", "plan_quality_logs", "plan_sessions",
  "post_bookmarks", "post_comments", "post_reactions", "post_votes", "practice_progress",
  "practice_set_submissions", "precision_scores", "predicted_questions",
  "prediction_confidence_bands", "profiles", "push_notification_logs",
  "push_notification_queue", "push_notification_templates", "push_notification_triggers",
  "push_subscriptions", "question_bank", "question_bank_tags",
  "rank_predictions", "role_permissions", "seo_config",
  "streak_freezes", "study_logs", "study_plans", "subjects",
  "subscription_plans", "sureshot_questions", "topics",
  "user_roles", "user_settings", "user_subscriptions",
] as const;

type BackupStatus = "idle" | "fetching" | "packaging" | "done" | "error";

export default function AdminBackup() {
  const { toast } = useToast();
  const [status, setStatus] = useState<BackupStatus>("idle");
  const [progress, setProgress] = useState({ current: 0, total: ALL_TABLES.length, currentTable: "" });
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [errorTables, setErrorTables] = useState<string[]>([]);

  const downloadFullBackup = async () => {
    setStatus("fetching");
    setErrorTables([]);
    const backup: Record<string, any> = {};
    const errors: string[] = [];

    for (let i = 0; i < ALL_TABLES.length; i++) {
      const table = ALL_TABLES[i];
      setProgress({ current: i + 1, total: ALL_TABLES.length, currentTable: table });

      try {
        // Fetch in pages of 1000 to handle large tables
        let allRows: any[] = [];
        let page = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await (supabase.from(table as any).select("*") as any)
            .range(page * 1000, (page + 1) * 1000 - 1);
          if (error) throw error;
          if (data && data.length > 0) {
            allRows = [...allRows, ...data];
            hasMore = data.length === 1000;
            page++;
          } else {
            hasMore = false;
          }
        }

        backup[table] = { count: allRows.length, data: allRows };
      } catch (e: any) {
        errors.push(table);
        backup[table] = { count: 0, data: [], error: e.message };
      }
    }

    setStatus("packaging");
    setErrorTables(errors);

    const now = new Date();
    const fullBackup = {
      _meta: {
        exportedAt: now.toISOString(),
        version: "2.0",
        type: "full_database_backup",
        totalTables: ALL_TABLES.length,
        successfulTables: ALL_TABLES.length - errors.length,
        failedTables: errors,
      },
      tables: backup,
    };

    const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `acry-full-backup-${format(now, "yyyy-MM-dd-HHmm")}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setStatus("done");
    setLastBackup(format(now, "yyyy-MM-dd HH:mm"));
    toast({
      title: "✅ Full Backup Downloaded",
      description: `${ALL_TABLES.length - errors.length}/${ALL_TABLES.length} tables exported successfully.`,
    });
  };

  const progressPct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="space-y-5 mt-4">
      {/* Header */}
      <div className="glass rounded-2xl neural-border p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <HardDrive className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Full System Backup</h3>
            <p className="text-xs text-muted-foreground">Download complete database as a single JSON file</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-secondary/30 rounded-xl p-3 text-center">
            <Database className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{ALL_TABLES.length}</p>
            <p className="text-[10px] text-muted-foreground">Total Tables</p>
          </div>
          <div className="bg-secondary/30 rounded-xl p-3 text-center">
            <FileJson className="w-4 h-4 text-accent mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">JSON</p>
            <p className="text-[10px] text-muted-foreground">Export Format</p>
          </div>
          <div className="bg-secondary/30 rounded-xl p-3 text-center">
            <Download className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{lastBackup ? "✓" : "—"}</p>
            <p className="text-[10px] text-muted-foreground">{lastBackup || "No backup yet"}</p>
          </div>
        </div>

        {/* Progress bar */}
        {(status === "fetching" || status === "packaging") && (
          <div className="mb-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate max-w-[60%]">
                {status === "packaging" ? "Packaging backup..." : `Fetching: ${progress.currentTable}`}
              </span>
              <span>{progressPct}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-secondary/50 overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}

        {/* Download button */}
        <button
          onClick={downloadFullBackup}
          disabled={status === "fetching" || status === "packaging"}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-xl bg-primary/10 hover:bg-primary/20 neural-border transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === "fetching" || status === "packaging" ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          ) : status === "done" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <Download className="w-5 h-5 text-primary" />
          )}
          <span className="text-sm font-semibold text-foreground">
            {status === "fetching"
              ? `Exporting... (${progress.current}/${progress.total})`
              : status === "packaging"
              ? "Packaging backup..."
              : status === "done"
              ? "Download Again"
              : "Download Complete Database Backup"}
          </span>
        </button>

        {/* Error tables */}
        {errorTables.length > 0 && (
          <div className="mt-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
              <span className="text-xs font-medium text-destructive">{errorTables.length} tables had access errors (RLS restricted)</span>
            </div>
            <p className="text-[10px] text-muted-foreground">{errorTables.join(", ")}</p>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground text-center mt-3">
          Backup includes all {ALL_TABLES.length} public tables. Large tables are fetched in pages of 1000 rows.
        </p>
      </div>
    </div>
  );
}
