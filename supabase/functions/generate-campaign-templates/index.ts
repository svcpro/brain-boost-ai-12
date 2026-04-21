import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TRIGGER_TEMPLATES = [
  { key: "study_reminder", label: "Study Reminder", channels: ["email", "push", "voice"], context: "Topics due for revision based on forgetting curve", vars: ["name", "topic", "memory_score", "last_studied", "days_since_review", "revision_count"] },
  { key: "forget_risk", label: "Forget Risk Alert", channels: ["push", "voice"], context: "Memory score dropping below threshold", vars: ["name", "topic", "memory_score", "predicted_drop_date", "decay_rate", "urgency_level"] },
  { key: "risk_digest", label: "Daily Risk Digest", channels: ["push", "email"], context: "Daily at-risk topics summary", vars: ["name", "at_risk_count", "top_risk_topic", "weakest_score", "total_topics", "avg_score"] },
  { key: "streak_milestone", label: "Streak Milestone", channels: ["push", "voice"], context: "Celebrate 7/14/30-day study streaks", vars: ["name", "streak_days", "milestone", "total_sessions", "best_streak", "rank"] },
  { key: "streak_break_warning", label: "Streak Break Warning", channels: ["push", "voice"], context: "Streak about to break", vars: ["name", "streak_days", "hours_remaining", "last_study_time", "streak_freeze_count"] },
  { key: "brain_update_reminder", label: "Brain Update Nudge", channels: ["push", "voice"], context: "No brain update in 24h", vars: ["name", "hours_since_update", "pending_topics", "brain_score", "topics_due"] },
  { key: "daily_briefing", label: "Daily Morning Briefing", channels: ["push", "email"], context: "AI cognitive summary every morning", vars: ["name", "today_topics_count", "brain_score", "streak_days", "focus_topic", "predicted_rank"] },
  { key: "brain_missions", label: "Brain Missions", channels: ["push"], context: "New AI-generated learning missions", vars: ["name", "mission_title", "mission_type", "reward", "deadline", "difficulty"] },
  { key: "cognitive_twin_update", label: "Cognitive Twin Update", channels: ["push"], context: "Cognitive model recomputed", vars: ["name", "brain_evolution_score", "learning_efficiency", "optimal_study_hour"] },
  { key: "weekly_insights", label: "Weekly AI Insights", channels: ["push", "email", "voice"], context: "AI study recommendations every Monday", vars: ["name", "topics_studied", "hours_studied", "accuracy", "rank_change", "top_improvement", "weak_area"] },
  { key: "weekly_report", label: "Weekly Email Report", channels: ["email"], context: "Detailed weekly performance report", vars: ["name", "topics_studied", "hours_studied", "accuracy", "streak_days", "rank", "percentile"] },
  { key: "weekly_brain_digest", label: "Weekly Brain Digest", channels: ["push", "email"], context: "Weekly brain evolution summary", vars: ["name", "brain_score", "memory_growth_rate", "topics_mastered", "brain_evolution_score"] },
  { key: "exam_countdown", label: "Exam Countdown", channels: ["push", "email", "voice"], context: "Exam date approaching alerts", vars: ["name", "exam_name", "days_left", "readiness_score", "topics_remaining", "daily_target"] },
  { key: "daily_goal_complete", label: "Daily Goal Complete", channels: ["push"], context: "Daily study goal achieved", vars: ["name", "topics_completed", "streak_days", "total_study_time"] },
  { key: "weekly_goal_complete", label: "Weekly Goal Complete", channels: ["push", "voice"], context: "Weekly focus goal hit", vars: ["name", "weekly_topics", "weekly_hours", "accuracy", "rank_change"] },
  { key: "burnout_detection", label: "Burnout Alert", channels: ["push", "voice"], context: "High fatigue score detected", vars: ["name", "fatigue_score", "session_duration", "break_suggestion", "optimal_study_time"] },
  { key: "study_break_reminder", label: "Study Break Reminder", channels: ["push", "voice"], context: "Prolonged study session", vars: ["name", "session_duration", "break_suggestion", "topics_covered"] },
  { key: "subscription_expiry", label: "Subscription Expiry", channels: ["push", "email"], context: "Subscription expiring soon", vars: ["name", "plan_name", "days_remaining", "expiry_date", "renewal_price", "discount_code"] },
  { key: "new_user_welcome", label: "Welcome Message", channels: ["push", "email"], context: "New user onboarding", vars: ["name", "exam_type", "first_topic", "community_count"] },
  { key: "inactivity_nudge", label: "Inactivity Nudge", channels: ["push", "email", "voice"], context: "3+ days of no activity", vars: ["name", "inactive_days", "streak_lost", "topics_decaying", "memory_drop_pct", "friends_active"] },
  { key: "leaderboard_rank_up", label: "Leaderboard Rank Up", channels: ["push"], context: "User climbed the leaderboard", vars: ["name", "new_rank", "old_rank", "rank_change", "top_score", "percentile"] },
  { key: "rank_prediction_change", label: "Rank Prediction Change", channels: ["push", "voice"], context: "Predicted rank improved/dropped", vars: ["name", "predicted_rank", "previous_prediction", "confidence", "key_factor"] },
  { key: "study_plan_ready", label: "Study Plan Ready", channels: ["push", "email"], context: "AI study plan generated", vars: ["name", "plan_duration", "topics_count", "daily_target", "focus_area"] },
  { key: "feature_announcement", label: "Feature Announcement", channels: ["push", "email"], context: "New feature rollout", vars: ["name", "feature_name", "feature_description"] },
  { key: "promo_seasonal", label: "Seasonal Promotion", channels: ["email", "push"], context: "Seasonal promotional offer (New Year, Back to School, etc.)", vars: ["name", "offer_name", "discount_pct", "valid_until", "promo_code"] },
  { key: "promo_upgrade", label: "Upgrade Promotion", channels: ["email", "push", "voice"], context: "Encourage free users to upgrade to Pro/Ultra", vars: ["name", "current_plan", "upgrade_plan", "price", "savings_pct", "features_unlocked"] },
  { key: "promo_referral", label: "Referral Promotion", channels: ["email", "push"], context: "Encourage users to invite friends", vars: ["name", "referral_code", "reward_amount", "friends_joined", "referral_link"] },
  { key: "promo_milestone_reward", label: "Milestone Reward Promo", channels: ["email", "push"], context: "Reward users for achieving milestones with special offers", vars: ["name", "milestone", "reward", "promo_code", "valid_until"] },
  { key: "promo_reengagement", label: "Re-engagement Promo", channels: ["email", "push", "voice"], context: "Win back churned/inactive users with special incentive", vars: ["name", "inactive_days", "memory_drop_pct", "comeback_offer", "discount_code", "friends_active"] },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { action, trigger_key, channel, custom_context } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Action: generate_all — bulk generate templates for all triggers x channels
    if (action === "generate_all") {
      const results: any[] = [];
      const batches: { key: string; label: string; ch: string; context: string; vars: string[] }[] = [];

      for (const t of TRIGGER_TEMPLATES) {
        for (const ch of t.channels) {
          batches.push({ key: t.key, label: t.label, ch, context: t.context, vars: t.vars || [] });
        }
      }

      // Process in batches of 5 to avoid rate limits
      for (let i = 0; i < batches.length; i += 5) {
        const batch = batches.slice(i, i + 5);
        const promises = batch.map(async (b) => {
          try {
            const content = await generateTemplateContent(LOVABLE_API_KEY, b.key, b.label, b.ch, b.context, b.vars);
            // Save to email_templates table
            const { data } = await supabaseAdmin.from("email_templates").insert({
              name: `[AI] ${b.label} — ${b.ch.toUpperCase()}`,
              subject: content.subject,
              html_body: content.html_body,
              category: b.key.startsWith("promo_") ? "promotion" : "reminder",
              variables: content.variables,
              is_active: true,
              created_by: "ai-system",
            }).select().single();
            return { trigger: b.key, channel: b.ch, status: "created", id: data?.id };
          } catch (e: any) {
            return { trigger: b.key, channel: b.ch, status: "failed", error: e.message };
          }
        });
        const batchResults = await Promise.all(promises);
        results.push(...batchResults);
      }

      return new Response(JSON.stringify({ success: true, templates_created: results.filter(r => r.status === "created").length, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: generate_single — generate one template
    if (action === "generate_single") {
      const trigger = TRIGGER_TEMPLATES.find(t => t.key === trigger_key);
      const label = trigger?.label || trigger_key;
      const context = custom_context || trigger?.context || "";
      const ch = channel || "email";
      const vars = trigger?.vars || [];

      const content = await generateTemplateContent(LOVABLE_API_KEY, trigger_key, label, ch, context, vars);

      return new Response(JSON.stringify({ success: true, ...content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: generate_campaign — AI creates a full campaign (content + audience + send)
    if (action === "generate_campaign") {
      const { campaign_type, target_channel } = await req.json().catch(() => ({ campaign_type: trigger_key, target_channel: channel }));
      const trigger = TRIGGER_TEMPLATES.find(t => t.key === (campaign_type || trigger_key));
      const label = trigger?.label || "Campaign";
      const ch = target_channel || channel || "email";
      const context = trigger?.context || custom_context || "";
      const vars = trigger?.vars || [];

      const content = await generateTemplateContent(LOVABLE_API_KEY, campaign_type || trigger_key, label, ch, context, vars);

      return new Response(JSON.stringify({ success: true, ...content, channel: ch, trigger_key: campaign_type || trigger_key }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: list_triggers — return available triggers
    if (action === "list_triggers") {
      return new Response(JSON.stringify({ triggers: TRIGGER_TEMPLATES }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action. Use: generate_all, generate_single, generate_campaign, list_triggers");
  } catch (e) {
    console.error("generate-campaign-templates error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function generateTemplateContent(apiKey: string, triggerKey: string, label: string, channel: string, context: string, vars: string[] = []) {
  const varsStr = vars.length > 0 ? vars.map(v => `{{${v}}}`).join(", ") : "{{name}}, {{topic}}, {{score}}, {{streak}}";
  const varsInstruction = vars.length > 0 
    ? `\n\n⚠️ MANDATORY DYNAMIC VARIABLES — You MUST use ALL of these as {{variable}} placeholders:\n${varsStr}\nNever hardcode values. Every data point must be a {{variable}}.`
    : "";

  const channelInstructions: Record<string, string> = {
    email: `Generate an HTML email template. Include:
- A compelling subject line (max 60 chars)
- Full HTML email body with inline CSS, modern design, teal/emerald accent colors (#0d9488), responsive layout
- Use these dynamic variables as {{variable}} placeholders: ${varsStr}
- Include a CTA button linking to {{app_url}}
- Professional footer with unsubscribe link {{unsubscribe_url}}${varsInstruction}`,
    push: `Generate a push notification. Include:
- A short punchy title (max 50 chars, use emoji)
- A concise body (max 100 chars, actionable)
- Use these dynamic variables: ${varsStr}${varsInstruction}`,
    voice: `Generate a voice notification script. Include:
- A natural, conversational spoken text (1-3 sentences)
- Write for text-to-speech: spell out numbers, avoid abbreviations
- Warm and encouraging tone
- Use these dynamic variables: ${varsStr}${varsInstruction}`,
  };

  const prompt = `You are an expert marketing and notification copywriter for ACRY Brain, an AI-powered study app for competitive exam preparation (NEET, JEE, etc.).

Trigger: ${label}
Context: ${context}
Channel: ${channel.toUpperCase()}

${channelInstructions[channel] || channelInstructions.email}

Return ONLY a valid JSON object with these fields:
- "subject": the subject/title line
- "html_body": the full content (HTML for email, short text for push, spoken script for voice)
- "variables": array of ALL variable names used (e.g. ${JSON.stringify(vars.length > 0 ? vars : ["name", "topic", "score"])})

CRITICAL: Every data point in the message MUST be a {{variable_name}} placeholder from the provided list. Never use static/hardcoded sample data.

No markdown fences, no explanation, just the JSON.`;

  const { aiFetch } = await import("../_shared/aiFetch.ts");
  const response = await aiFetch({
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error("Rate limited, try again later");
    if (response.status === 402) throw new Error("AI credits exhausted");
    throw new Error(`AI gateway error: ${response.status}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || "";
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  
  try {
    return JSON.parse(cleaned);
  } catch {
    return {
      subject: `${label} Notification`,
      html_body: raw.slice(0, 500),
      variables: ["name"],
    };
  }
}
