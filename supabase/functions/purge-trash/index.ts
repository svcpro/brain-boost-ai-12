import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Delete topics in trashed subjects first (FK constraint)
  const { data: oldSubjects } = await supabase
    .from("subjects")
    .select("id")
    .lt("deleted_at", thirtyDaysAgo);

  if (oldSubjects?.length) {
    const subjectIds = oldSubjects.map((s) => s.id);
    await supabase.from("topics").delete().in("subject_id", subjectIds);
    await supabase.from("subjects").delete().in("id", subjectIds);
  }

  // Delete standalone trashed topics
  await supabase.from("topics").delete().lt("deleted_at", thirtyDaysAgo);

  return new Response(JSON.stringify({ purged: true, subjects: oldSubjects?.length ?? 0 }), {
    headers: { "Content-Type": "application/json" },
  });
});
