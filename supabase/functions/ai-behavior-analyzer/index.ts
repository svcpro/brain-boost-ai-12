import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

    // Get all active users who have topics
    const { data: activeUsers, error: usersErr } = await supabase
      .from("topics")
      .select("user_id")
      .is("deleted_at", null)
      .gt("memory_strength", 0);

    if (usersErr) throw usersErr;

    const uniqueUserIds = [...new Set((activeUsers || []).map(t => t.user_id))];
    let totalUpdated = 0;

    for (const userId of uniqueUserIds) {
      try {
        // Get user's study logs from last 24 hours
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { data: recentLogs } = await supabase
          .from("study_logs")
          .select("topic_id, duration_minutes, study_mode, created_at")
          .eq("user_id", userId)
          .gte("created_at", sixHoursAgo.toISOString());

        // Get user's topics that haven't been updated recently
        const { data: topics } = await supabase
          .from("topics")
          .select("id, name, memory_strength, last_revision_date, subject_id, subjects!inner(name)")
          .eq("user_id", userId)
          .is("deleted_at", null);

        if (!topics || topics.length === 0) continue;

        const loggedTopicIds = new Set((recentLogs || []).map(l => l.topic_id).filter(Boolean));
        const totalStudyMinutes = (recentLogs || []).reduce((sum, l) => sum + (l.duration_minutes || 0), 0);

        // AI analysis: If user has been active (has recent logs), boost related topics
        if (totalStudyMinutes > 0) {
          // Find topics in the same subjects as studied topics
          const studiedSubjectIds = new Set<string>();
          for (const log of (recentLogs || [])) {
            if (log.topic_id) {
              const topic = topics.find(t => t.id === log.topic_id);
              if (topic) studiedSubjectIds.add(topic.subject_id);
            }
          }

          // Cross-topic reinforcement: studying one topic in a subject slightly reinforces others
          for (const topic of topics) {
            if (studiedSubjectIds.has(topic.subject_id) && !loggedTopicIds.has(topic.id)) {
              const crossBoost = Math.min(2, Math.round(totalStudyMinutes / 30));
              if (crossBoost > 0) {
                const newStrength = Math.min(99, (topic.memory_strength || 50) + crossBoost);
                if (newStrength > (topic.memory_strength || 50)) {
                  await supabase
                    .from("topics")
                    .update({ memory_strength: newStrength })
                    .eq("id", topic.id);
                  totalUpdated++;
                }
              }
            }
          }
        }

        // If user has LOVABLE_API_KEY and enough topics, do AI-powered analysis
        if (LOVABLE_API_KEY && topics.length >= 3 && totalStudyMinutes >= 10) {
          try {
            const topicSummary = topics.slice(0, 20).map(t => ({
              name: t.name,
              subject: (t as any).subjects?.name,
              strength: t.memory_strength,
              lastRevised: t.last_revision_date,
              wasStudiedRecently: loggedTopicIds.has(t.id),
            }));

            const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash-lite",
                messages: [
                  {
                    role: "system",
                    content: `You are a memory analysis engine. Given a student's topic data and recent study activity, identify topics that likely received indirect study benefit (e.g., related concepts, prerequisites). Return ONLY a JSON array of objects with "topic_name" and "boost" (1-5) fields. No explanation.`
                  },
                  {
                    role: "user",
                    content: `Student studied for ${totalStudyMinutes} minutes today. Topics: ${JSON.stringify(topicSummary)}`
                  }
                ],
                temperature: 0.3,
              }),
            });

            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              const content = aiData.choices?.[0]?.message?.content || "";

              // Parse AI suggestions
              try {
                const jsonMatch = content.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                  const suggestions = JSON.parse(jsonMatch[0]);
                  for (const suggestion of suggestions) {
                    const matchedTopic = topics.find(t =>
                      t.name.toLowerCase() === suggestion.topic_name?.toLowerCase()
                    );
                    if (matchedTopic && suggestion.boost > 0) {
                      const boost = Math.min(5, Math.max(1, suggestion.boost));
                      const newStrength = Math.min(99, (matchedTopic.memory_strength || 50) + boost);
                      await supabase
                        .from("topics")
                        .update({ memory_strength: newStrength })
                        .eq("id", matchedTopic.id);
                      totalUpdated++;
                    }
                  }
                }
              } catch {
                // AI response parsing failed, skip
              }
            }
          } catch (aiErr) {
            console.error("AI analysis error for user:", userId, aiErr);
          }
        }
      } catch (userErr) {
        console.error("Error processing user:", userId, userErr);
      }
    }

    console.log(`AI behavior analyzer: processed ${uniqueUserIds.length} users, ${totalUpdated} topic boosts applied`);

    return new Response(
      JSON.stringify({
        message: "Analysis complete",
        users_processed: uniqueUserIds.length,
        topics_boosted: totalUpdated,
        timestamp: now.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI behavior analyzer error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
