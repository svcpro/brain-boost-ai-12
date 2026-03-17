import { createClient } from "npm:@supabase/supabase-js@2";

export type AdminClient = ReturnType<typeof createClient>;

export function buildPhoneVariants(rawPhone: unknown): string[] {
  const phone = typeof rawPhone === "string" ? rawPhone.trim() : "";
  const digits = phone.replace(/\D/g, "");
  if (!digits) return [];

  const localMobile = digits.length > 10 ? digits.slice(-10) : digits;
  return [...new Set([phone, digits, localMobile, `+${digits}`].filter(Boolean))];
}

async function runBatch(
  operations: Array<{ label: string; promise: Promise<{ error: { message?: string } | null }> }>,
  errorPrefix: string,
) {
  if (operations.length === 0) return;

  const results = await Promise.allSettled(operations.map((operation) => operation.promise));
  const failures: string[] = [];

  results.forEach((result, index) => {
    const label = operations[index]?.label || `operation_${index}`;
    if (result.status === "rejected") {
      failures.push(`${label}: ${String(result.reason)}`);
      return;
    }
    if (result.value.error?.message) {
      failures.push(`${label}: ${result.value.error.message}`);
    }
  });

  if (failures.length > 0) {
    throw new Error(`${errorPrefix}: ${failures.join("; ")}`);
  }
}

export async function purgeUserGraph(adminClient: AdminClient, userIds: string[]) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueUserIds.length === 0) return;

  const [{ data: subjectRows, error: subjectLookupError }, { data: topicRows, error: topicLookupError }] = await Promise.all([
    adminClient.from("subjects").select("id").in("user_id", uniqueUserIds),
    adminClient.from("topics").select("id").in("user_id", uniqueUserIds),
  ]);

  if (subjectLookupError) {
    throw new Error(`Failed to resolve subjects for purge: ${subjectLookupError.message}`);
  }

  if (topicLookupError) {
    throw new Error(`Failed to resolve topics for purge: ${topicLookupError.message}`);
  }

  const subjectIds = [...new Set((subjectRows || []).map((row) => row.id).filter(Boolean))];
  const topicIds = [...new Set((topicRows || []).map((row) => row.id).filter(Boolean))];

  await runBatch([
    { label: "study_logs_by_user", promise: adminClient.from("study_logs").delete().in("user_id", uniqueUserIds) },
    { label: "brain_missions_by_user", promise: adminClient.from("brain_missions").delete().in("user_id", uniqueUserIds) },
    { label: "topic_decay_models_by_user", promise: adminClient.from("topic_decay_models").delete().in("user_id", uniqueUserIds) },
    { label: "weakness_predictions_by_user", promise: adminClient.from("weakness_predictions").delete().in("user_id", uniqueUserIds) },
    { label: "behavioral_micro_events_by_user", promise: adminClient.from("behavioral_micro_events").delete().in("user_id", uniqueUserIds) },
    { label: "autopilot_sessions_by_user", promise: adminClient.from("autopilot_sessions").delete().in("user_id", uniqueUserIds) },
    { label: "ai_recommendations_by_user", promise: adminClient.from("ai_recommendations").delete().in("user_id", uniqueUserIds) },
  ], "Failed to purge user-linked records");

  if (topicIds.length > 0) {
    await runBatch([
      { label: "brain_missions_by_topic", promise: adminClient.from("brain_missions").delete().in("target_topic_id", topicIds) },
      { label: "topic_decay_models_by_topic", promise: adminClient.from("topic_decay_models").delete().in("topic_id", topicIds) },
      { label: "weakness_predictions_by_topic", promise: adminClient.from("weakness_predictions").delete().in("topic_id", topicIds) },
      { label: "behavioral_micro_events_by_topic", promise: adminClient.from("behavioral_micro_events").delete().in("topic_id", topicIds) },
      { label: "autopilot_sessions_by_topic", promise: adminClient.from("autopilot_sessions").delete().in("emergency_topic_id", topicIds) },
      { label: "ai_recommendations_by_topic", promise: adminClient.from("ai_recommendations").delete().in("topic_id", topicIds) },
      { label: "exam_intel_topic_scores_by_topic", promise: adminClient.from("exam_intel_topic_scores").delete().in("topic_id", topicIds) },
      { label: "memory_scores_by_topic", promise: adminClient.from("memory_scores").delete().in("topic_id", topicIds) },
    ], "Failed to purge topic-linked records");
  }

  if (subjectIds.length > 0) {
    await runBatch([
      { label: "study_logs_by_subject", promise: adminClient.from("study_logs").delete().in("subject_id", subjectIds) },
    ], "Failed to purge subject-linked records");
  }

  await runBatch([
    { label: "topics", promise: adminClient.from("topics").delete().in("user_id", uniqueUserIds) },
    { label: "subjects", promise: adminClient.from("subjects").delete().in("user_id", uniqueUserIds) },
    { label: "api_keys", promise: adminClient.from("api_keys").delete().in("created_by", uniqueUserIds) },
    { label: "user_roles", promise: adminClient.from("user_roles").delete().in("user_id", uniqueUserIds) },
    { label: "user_settings", promise: adminClient.from("user_settings").delete().in("user_id", uniqueUserIds) },
    { label: "profiles", promise: adminClient.from("profiles").delete().in("id", uniqueUserIds) },
  ], "Failed to purge deleted user data");
}
