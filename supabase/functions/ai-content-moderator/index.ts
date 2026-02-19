import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { action, content_type, content_id, content_text, user_id, post_ids } = await req.json();

    // Action: analyze single content
    if (action === "analyze") {
      if (!content_text || !content_type || !content_id || !user_id) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch moderation rules
      const { data: rules } = await supabase.from("moderation_rules").select("*").eq("is_active", true);
      const blockedWordsRule = rules?.find((r: any) => r.rule_key === "blocked_word_list");
      const blockedWords: string[] = blockedWordsRule?.rule_value?.words || [];
      const warningThreshold = rules?.find((r: any) => r.rule_key === "abuse_score_warning")?.rule_value?.threshold || 40;
      const autoHideThreshold = rules?.find((r: any) => r.rule_key === "abuse_score_auto_hide")?.rule_value?.threshold || 80;
      const warningsBeforeRestrict = rules?.find((r: any) => r.rule_key === "warnings_before_restrict")?.rule_value?.count || 3;

      // Check blocked words first
      const lowerText = content_text.toLowerCase();
      const foundBlocked = blockedWords.filter((w: string) => lowerText.includes(w.toLowerCase()));

      // AI analysis
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are a content moderation AI. Analyze the given text and return a JSON assessment.
You must detect: abusive language, hate speech, harassment, spam, inappropriate content, threats.
Return ONLY valid JSON with this structure:
{
  "abuse_score": <number 0-100>,
  "risk_level": "low" | "medium" | "high",
  "categories": [<detected categories as strings>],
  "reasoning": "<brief explanation>"
}
Score guide: 0-20=clean, 21-40=mild, 41-60=moderate concern, 61-80=serious, 81-100=severe abuse.`
            },
            { role: "user", content: `Analyze this ${content_type} content:\n\n${content_text}` }
          ],
          tools: [{
            type: "function",
            function: {
              name: "report_abuse_analysis",
              description: "Report the abuse analysis results",
              parameters: {
                type: "object",
                properties: {
                  abuse_score: { type: "number", description: "Abuse score 0-100" },
                  risk_level: { type: "string", enum: ["low", "medium", "high"] },
                  categories: { type: "array", items: { type: "string" } },
                  reasoning: { type: "string" }
                },
                required: ["abuse_score", "risk_level", "categories", "reasoning"],
                additionalProperties: false
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "report_abuse_analysis" } }
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited, try again later" }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI gateway error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      let analysis = { abuse_score: 0, risk_level: "low", categories: [] as string[], reasoning: "Clean content" };

      try {
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
          analysis = JSON.parse(toolCall.function.arguments);
        }
      } catch {
        console.error("Failed to parse AI response, using defaults");
      }

      // Boost score if blocked words found
      if (foundBlocked.length > 0) {
        analysis.abuse_score = Math.min(100, analysis.abuse_score + foundBlocked.length * 15);
        analysis.categories = [...new Set([...analysis.categories, "blocked_words"])];
        analysis.reasoning += ` Found blocked words: ${foundBlocked.join(", ")}`;
        if (analysis.abuse_score > 60) analysis.risk_level = "high";
        else if (analysis.abuse_score > 30) analysis.risk_level = "medium";
      }

      const autoHidden = analysis.abuse_score >= autoHideThreshold;

      // Insert flag
      await supabase.from("content_flags").insert({
        content_type,
        content_id,
        user_id,
        abuse_score: analysis.abuse_score,
        risk_level: analysis.risk_level,
        categories: analysis.categories,
        ai_reasoning: analysis.reasoning,
        auto_hidden: autoHidden,
        status: autoHidden ? "actioned" : "pending",
      });

      // Auto-hide if threshold exceeded
      if (autoHidden) {
        if (content_type === "post") {
          await supabase.from("community_posts").update({ is_deleted: true }).eq("id", content_id);
        } else {
          await supabase.from("post_comments").update({ is_deleted: true }).eq("id", content_id);
        }
      }

      // Update user moderation profile
      const { data: existingProfile } = await supabase
        .from("user_moderation_profiles")
        .select("*")
        .eq("user_id", user_id)
        .maybeSingle();

      if (existingProfile) {
        const newFlags = existingProfile.total_flags + 1;
        const newViolations = analysis.abuse_score >= warningThreshold ? existingProfile.total_violations + 1 : existingProfile.total_violations;
        await supabase.from("user_moderation_profiles").update({
          total_flags: newFlags,
          total_violations: newViolations,
          last_violation_at: analysis.abuse_score >= warningThreshold ? new Date().toISOString() : existingProfile.last_violation_at,
          updated_at: new Date().toISOString(),
        }).eq("user_id", user_id);
      } else {
        await supabase.from("user_moderation_profiles").insert({
          user_id,
          total_flags: 1,
          total_violations: analysis.abuse_score >= warningThreshold ? 1 : 0,
          last_violation_at: analysis.abuse_score >= warningThreshold ? new Date().toISOString() : null,
        });
      }

      // Auto-warning if above threshold
      if (analysis.abuse_score >= warningThreshold) {
        // Send warning notification
        await supabase.from("notification_history").insert({
          user_id,
          title: "⚠️ Content Warning",
          body: "Your content violates community guidelines. Please avoid abusive or inappropriate language. Repeated violations may result in account restriction.",
          type: "moderation_warning",
        });

        // Log warning action
        await supabase.from("moderation_actions").insert({
          user_id,
          action_type: "warning",
          reason: `AI detected: ${analysis.categories.join(", ")}. Score: ${analysis.abuse_score}`,
          is_automatic: true,
        });

        // Update warning count
        const { data: profile } = await supabase
          .from("user_moderation_profiles")
          .select("total_warnings")
          .eq("user_id", user_id)
          .maybeSingle();

        const newWarnings = (profile?.total_warnings || 0) + 1;
        await supabase.from("user_moderation_profiles").update({
          total_warnings: newWarnings,
          is_restricted: newWarnings >= warningsBeforeRestrict,
          current_penalty: newWarnings >= warningsBeforeRestrict ? "post_restriction" : "warning",
        }).eq("user_id", user_id);

        // Auto-restrict if too many warnings
        if (newWarnings >= warningsBeforeRestrict) {
          await supabase.from("moderation_actions").insert({
            user_id,
            action_type: "post_restriction",
            reason: `Exceeded ${warningsBeforeRestrict} warnings. Auto-restricted.`,
            is_automatic: true,
          });
          await supabase.from("notification_history").insert({
            user_id,
            title: "🚫 Posting Restricted",
            body: "Your posting ability has been restricted due to repeated community guideline violations. Contact support if you believe this is an error.",
            type: "moderation_penalty",
          });
        }
      }

      return new Response(JSON.stringify({
        abuse_score: analysis.abuse_score,
        risk_level: analysis.risk_level,
        categories: analysis.categories,
        reasoning: analysis.reasoning,
        auto_hidden: autoHidden,
        warning_sent: analysis.abuse_score >= warningThreshold,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: batch analyze multiple posts
    if (action === "batch_analyze") {
      if (!post_ids || !Array.isArray(post_ids)) {
        return new Response(JSON.stringify({ error: "post_ids required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: posts } = await supabase
        .from("community_posts")
        .select("id, content, title, user_id")
        .in("id", post_ids)
        .eq("is_deleted", false);

      const results = [];
      for (const post of (posts || [])) {
        // Re-invoke self for each post
        const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-content-moderator`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "analyze",
            content_type: "post",
            content_id: post.id,
            content_text: `${post.title}\n\n${post.content}`,
            user_id: post.user_id,
          }),
        });
        const data = await res.json();
        results.push({ post_id: post.id, ...data });
      }

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Moderation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
