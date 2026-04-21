import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all users with study data
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, display_name, daily_study_goal_minutes, exam_date, exam_type, push_notification_prefs");

    if (!profiles?.length) {
      return new Response(JSON.stringify({ success: true, users_notified: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    let usersNotified = 0;

    for (const profile of profiles) {
      try {
        // Check if user has opted out of weekly insights
        const prefs = (profile as any).push_notification_prefs;
        if (prefs && typeof prefs === "object" && prefs.weeklyInsights === false) continue;

        // Fetch topics sorted by weakest
        const { data: topics } = await adminClient
          .from("topics")
          .select("name, memory_strength, last_revision_date, next_predicted_drop_date, subject_id")
          .eq("user_id", profile.id)
          .is("deleted_at", null)
          .order("memory_strength", { ascending: true })
          .limit(15);

        if (!topics?.length) continue;

        // Fetch subjects
        const { data: subjects } = await adminClient
          .from("subjects")
          .select("id, name")
          .eq("user_id", profile.id)
          .is("deleted_at", null);

        const subjectMap = new Map((subjects || []).map(s => [s.id, s.name]));

        // Recent study volume (7 days)
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentLogs } = await adminClient
          .from("study_logs")
          .select("duration_minutes, created_at")
          .eq("user_id", profile.id)
          .gte("created_at", weekAgo);

        const totalMinutes7d = (recentLogs || []).reduce((s, l) => s + (l.duration_minutes || 0), 0);
        const daysToExam = profile.exam_date
          ? Math.ceil((new Date(profile.exam_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null;

        const topicSummaries = topics.map(t => ({
          name: t.name,
          subject: subjectMap.get(t.subject_id) || "Unknown",
          memoryStrength: Math.round(t.memory_strength * 100) / 100,
          lastRevised: t.last_revision_date || "never",
          predictedDrop: t.next_predicted_drop_date || null,
        }));

        const prompt = `You are a concise study coach. Based on this student's data, provide exactly 3 top study recommendations for the coming week.

STUDENT DATA:
- Daily goal: ${profile.daily_study_goal_minutes || 60} min
- Exam: ${profile.exam_type || "Not set"} in ${daysToExam !== null ? daysToExam + " days" : "no date"}
- Study volume (last 7 days): ${totalMinutes7d} minutes across ${(recentLogs || []).length} sessions

WEAKEST TOPICS:
${topicSummaries.slice(0, 10).map(t => `- ${t.name} (${t.subject}): strength=${t.memoryStrength}, last=${t.lastRevised}, drop=${t.predictedDrop || "?"}`).join("\n")}

Respond with a JSON object with a single key "recommendations" containing an array of exactly 3 objects, each with:
- "title": short headline (max 6 words)
- "body": 1 sentence actionable advice referencing specific topic names
Keep it specific, actionable, and motivating.`;

        const { aiFetch } = await import("../_shared/aiFetch.ts");
        const aiResp = await aiFetch({
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: prompt }],
            tools: [{
              type: "function",
              function: {
                name: "weekly_recommendations",
                description: "Return 3 weekly study recommendations",
                parameters: {
                  type: "object",
                  properties: {
                    recommendations: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          body: { type: "string" },
                        },
                        required: ["title", "body"],
                      },
                    },
                  },
                  required: ["recommendations"],
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "weekly_recommendations" } },
          }),
        });

        if (!aiResp.ok) {
          console.error(`AI error for user ${profile.id}: ${aiResp.status}`);
          continue;
        }

        const aiData = await aiResp.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        let recommendations: { title: string; body: string }[] = [];

        if (toolCall?.function?.arguments) {
          const parsed = JSON.parse(toolCall.function.arguments);
          recommendations = (parsed.recommendations || []).slice(0, 3);
        }

        if (recommendations.length === 0) continue;

        // Format as a single notification body
        const body = recommendations
          .map((r, i) => `${i + 1}. ${r.title}: ${r.body}`)
          .join("\n");

        // Insert into notification_history
        await adminClient.from("notification_history").insert({
          user_id: profile.id,
          title: "📋 Weekly Study Recommendations",
          body,
          type: "weekly_insight",
          read: false,
        });

        usersNotified++;
      } catch (userErr) {
        console.error(`Error for user ${profile.id}:`, userErr);
      }
    }

    console.log(`Weekly insights summary sent to ${usersNotified} users`);
    return new Response(JSON.stringify({ success: true, users_notified: usersNotified }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("weekly-insights-summary error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
