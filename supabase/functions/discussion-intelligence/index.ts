import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI not configured");

    const { action, post_id } = await req.json();

    // ACTION: Analyze a single post (summarize, tag, score importance, extract insights)
    if (action === "analyze_post" && post_id) {
      const { data: post } = await adminClient.from("community_posts").select("*").eq("id", post_id).maybeSingle();
      if (!post) throw new Error("Post not found");

      // Fetch comments for context
      const { data: commentsList } = await adminClient.from("post_comments")
        .select("content, is_ai_answer").eq("post_id", post_id).eq("is_deleted", false)
        .order("created_at", { ascending: true }).limit(30);

      const commentsText = (commentsList || []).map((c: any, i: number) =>
        `${c.is_ai_answer ? "AI" : "User"} reply ${i + 1}: ${c.content}`
      ).join("\n");

      const prompt = `Analyze this community discussion for a competitive exam study platform.

Title: ${post.title}
Type: ${post.post_type}
Content: ${post.content}
Upvotes: ${post.upvote_count}
Comments: ${post.comment_count}

${commentsText ? `Replies:\n${commentsText}` : "No replies yet."}

Return a JSON object using this exact tool call.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You analyze educational discussions for competitive exams (JEE, NEET, UPSC, SSC). Extract structured intelligence." },
            { role: "user", content: prompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "save_discussion_analysis",
              description: "Save the structured analysis of a discussion post",
              parameters: {
                type: "object",
                properties: {
                  short_summary: { type: "string", description: "2-3 line summary of the discussion" },
                  detailed_summary: { type: "string", description: "5-10 line detailed summary" },
                  key_points: { type: "array", items: { type: "string" }, description: "List of key learning points" },
                  tags: { type: "array", items: { type: "string" }, description: "Topic tags like 'Ohm Law', 'Organic Chemistry'" },
                  importance_score: { type: "number", description: "0-100 importance score based on educational value, engagement, and exam relevance" },
                  importance_level: { type: "string", enum: ["normal", "medium", "high"], description: "Importance category" },
                  key_insights: { type: "array", items: { type: "object", properties: { type: { type: "string", enum: ["formula", "concept", "tip", "strategy"] }, content: { type: "string" } }, required: ["type", "content"] }, description: "Extracted formulas, concepts, exam tips" },
                },
                required: ["short_summary", "detailed_summary", "key_points", "tags", "importance_score", "importance_level", "key_insights"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "save_discussion_analysis" } },
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("AI error:", response.status, errText);
        throw new Error("AI analysis failed");
      }

      const aiData = await response.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) throw new Error("No tool call in response");

      const analysis = JSON.parse(toolCall.function.arguments);

      await adminClient.from("community_posts").update({
        ai_summary: analysis.short_summary,
        ai_detailed_summary: analysis.detailed_summary,
        ai_key_points: analysis.key_points,
        ai_tags: analysis.tags,
        importance_score: analysis.importance_score,
        importance_level: analysis.importance_level,
        ai_key_insights: analysis.key_insights,
        summary_updated_at: new Date().toISOString(),
      }).eq("id", post_id);

      return new Response(JSON.stringify({ success: true, analysis }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: Get personalized recommendations
    if (action === "get_recommendations") {
      // Get user's weak topics from memory_scores
      const { data: weakTopics } = await supabase.from("memory_scores")
        .select("topic_id, score, topics:topics(name, subject_id, subjects:subjects(name))")
        .eq("user_id", user.id)
        .lt("score", 60)
        .order("score", { ascending: true })
        .limit(20);

      const weakTopicNames = (weakTopics || []).map((t: any) => t.topics?.name).filter(Boolean);

      // Get recent important posts
      const { data: importantPosts } = await adminClient.from("community_posts")
        .select("id, title, ai_summary, ai_tags, importance_score, importance_level, upvote_count, comment_count, post_type, created_at, community_id")
        .eq("is_deleted", false)
        .gt("importance_score", 30)
        .order("importance_score", { ascending: false })
        .limit(50);

      if (!importantPosts?.length) {
        return new Response(JSON.stringify({ recommendations: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Score each post for relevance to this user
      const scored = importantPosts.map((post: any) => {
        let relevance = post.importance_score || 0;
        const postTags = post.ai_tags || [];

        // Boost if tags match weak topics
        for (const tag of postTags) {
          const tagLower = tag.toLowerCase();
          if (weakTopicNames.some((w: string) => w.toLowerCase().includes(tagLower) || tagLower.includes(w.toLowerCase()))) {
            relevance += 30;
          }
        }

        // Boost questions with answers
        if (post.post_type === "question" && post.comment_count > 0) relevance += 10;
        if (post.post_type === "solution") relevance += 15;

        return { ...post, relevance_score: Math.min(100, relevance) };
      });

      scored.sort((a: any, b: any) => b.relevance_score - a.relevance_score);
      const top = scored.slice(0, 10);

      return new Response(JSON.stringify({ recommendations: top, weak_topics: weakTopicNames }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: Get important discussions for a community
    if (action === "get_important") {
      const { community_id } = await req.json().catch(() => ({}));
      const query = adminClient.from("community_posts")
        .select("id, title, ai_summary, ai_tags, importance_score, importance_level, upvote_count, comment_count, post_type, created_at")
        .eq("is_deleted", false)
        .gt("importance_score", 40)
        .order("importance_score", { ascending: false })
        .limit(20);

      if (community_id) query.eq("community_id", community_id);

      const { data } = await query;
      return new Response(JSON.stringify({ posts: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (e) {
    console.error("discussion-intelligence error:", e);
    const status = (e instanceof Error && e.message === "Unauthorized") ? 401 : 400;
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
