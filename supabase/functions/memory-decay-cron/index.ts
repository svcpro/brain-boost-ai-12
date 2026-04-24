import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Ebbinghaus forgetting curve: R = e^(-t/S)
function calculateRetention(hoursSinceReview: number, stability: number): number {
  return Math.exp(-hoursSinceReview / Math.max(stability, 1));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // This is a cron job — authenticate via service role key
    const authHeader = req.headers.get("Authorization");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Allow service-role or anon key (for cron)
    const token = authHeader?.replace("Bearer ", "") || "";
    if (token !== serviceKey && token !== anonKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey
    );

    // Fetch all non-deleted topics with memory_strength > 0
    const { data: topics, error: topicsErr } = await supabase
      .from("topics")
      .select("id, user_id, memory_strength, last_revision_date, revision_count, created_at")
      .is("deleted_at", null)
      .gt("memory_strength", 0);

    if (topicsErr) throw topicsErr;
    if (!topics || topics.length === 0) {
      return new Response(JSON.stringify({ message: "No topics to decay", updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    let updatedCount = 0;
    const batchUpdates: { id: string; newStrength: number }[] = [];

    for (const topic of topics) {
      const lastReview = topic.last_revision_date || topic.created_at;
      const hoursSince = (now.getTime() - new Date(lastReview).getTime()) / (1000 * 60 * 60);

      // Skip if reviewed within last 6 hours (no meaningful decay)
      if (hoursSince < 6) continue;

      // Stability increases with more reviews (base 24h, +12h per review, cap at 720h / 30 days)
      const reviewCount = topic.revision_count || 0;
      const stability = Math.min(720, 24 + reviewCount * 12);

      // Calculate current retention
      const retention = calculateRetention(hoursSince, stability);

      // New memory strength = retention * original strength at time of last review
      // We approximate: current strength should decay toward retention percentage
      const currentStrength = topic.memory_strength || 50;
      const decayedStrength = Math.max(5, Math.round(currentStrength * retention));

      // Only update if there's meaningful decay (at least 1 point)
      if (decayedStrength < currentStrength) {
        batchUpdates.push({ id: topic.id, newStrength: decayedStrength });
      }
    }

    // Apply updates in batches of 50
    for (let i = 0; i < batchUpdates.length; i += 50) {
      const batch = batchUpdates.slice(i, i + 50);
      const promises = batch.map(({ id, newStrength }) =>
        supabase
          .from("topics")
          .update({ memory_strength: newStrength })
          .eq("id", id)
      );
      await Promise.all(promises);
      updatedCount += batch.length;
    }

    console.log(`Memory decay applied: ${updatedCount}/${topics.length} topics decayed`);

    return new Response(
      JSON.stringify({
        message: "Decay applied",
        total_topics: topics.length,
        decayed: updatedCount,
        timestamp: now.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Memory decay cron error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
