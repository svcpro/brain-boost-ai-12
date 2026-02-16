import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TRIGGER_TEMPLATES = [
  { key: "study_reminder", label: "Study Reminder", channels: ["email", "push", "voice"], context: "Topics due for revision based on forgetting curve" },
  { key: "forget_risk", label: "Forget Risk Alert", channels: ["push", "voice"], context: "Memory score dropping below threshold" },
  { key: "risk_digest", label: "Daily Risk Digest", channels: ["push", "email"], context: "Daily at-risk topics summary" },
  { key: "streak_milestone", label: "Streak Milestone", channels: ["push", "voice"], context: "Celebrate 7/14/30-day study streaks" },
  { key: "streak_break_warning", label: "Streak Break Warning", channels: ["push", "voice"], context: "Streak about to break" },
  { key: "brain_update_reminder", label: "Brain Update Nudge", channels: ["push", "voice"], context: "No brain update in 24h" },
  { key: "daily_briefing", label: "Daily Morning Briefing", channels: ["push", "email"], context: "AI cognitive summary every morning" },
  { key: "brain_missions", label: "Brain Missions", channels: ["push"], context: "New AI-generated learning missions" },
  { key: "cognitive_twin_update", label: "Cognitive Twin Update", channels: ["push"], context: "Cognitive model recomputed" },
  { key: "weekly_insights", label: "Weekly AI Insights", channels: ["push", "email", "voice"], context: "AI study recommendations every Monday" },
  { key: "weekly_report", label: "Weekly Email Report", channels: ["email"], context: "Detailed weekly performance report" },
  { key: "weekly_brain_digest", label: "Weekly Brain Digest", channels: ["push", "email"], context: "Weekly brain evolution summary" },
  { key: "exam_countdown", label: "Exam Countdown", channels: ["push", "email", "voice"], context: "Exam date approaching alerts" },
  { key: "daily_goal_complete", label: "Daily Goal Complete", channels: ["push"], context: "Daily study goal achieved" },
  { key: "weekly_goal_complete", label: "Weekly Goal Complete", channels: ["push", "voice"], context: "Weekly focus goal hit" },
  { key: "burnout_detection", label: "Burnout Alert", channels: ["push", "voice"], context: "High fatigue score detected" },
  { key: "study_break_reminder", label: "Study Break Reminder", channels: ["push", "voice"], context: "Prolonged study session" },
  { key: "subscription_expiry", label: "Subscription Expiry", channels: ["push", "email"], context: "Subscription expiring soon" },
  { key: "new_user_welcome", label: "Welcome Message", channels: ["push", "email"], context: "New user onboarding" },
  { key: "inactivity_nudge", label: "Inactivity Nudge", channels: ["push", "email", "voice"], context: "3+ days of no activity" },
  { key: "leaderboard_rank_up", label: "Leaderboard Rank Up", channels: ["push"], context: "User climbed the leaderboard" },
  { key: "rank_prediction_change", label: "Rank Prediction Change", channels: ["push", "voice"], context: "Predicted rank improved/dropped" },
  { key: "study_plan_ready", label: "Study Plan Ready", channels: ["push", "email"], context: "AI study plan generated" },
  { key: "feature_announcement", label: "Feature Announcement", channels: ["push", "email"], context: "New feature rollout" },
  { key: "promo_seasonal", label: "Seasonal Promotion", channels: ["email", "push"], context: "Seasonal promotional offer (New Year, Back to School, etc.)" },
  { key: "promo_upgrade", label: "Upgrade Promotion", channels: ["email", "push", "voice"], context: "Encourage free users to upgrade to Pro/Ultra" },
  { key: "promo_referral", label: "Referral Promotion", channels: ["email", "push"], context: "Encourage users to invite friends" },
  { key: "promo_milestone_reward", label: "Milestone Reward Promo", channels: ["email", "push"], context: "Reward users for achieving milestones with special offers" },
  { key: "promo_reengagement", label: "Re-engagement Promo", channels: ["email", "push", "voice"], context: "Win back churned/inactive users with special incentive" },
];

serve(async (req) => {
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
      const batches: { key: string; label: string; ch: string; context: string }[] = [];

      for (const t of TRIGGER_TEMPLATES) {
        for (const ch of t.channels) {
          batches.push({ key: t.key, label: t.label, ch, context: t.context });
        }
      }

      // Process in batches of 5 to avoid rate limits
      for (let i = 0; i < batches.length; i += 5) {
        const batch = batches.slice(i, i + 5);
        const promises = batch.map(async (b) => {
          try {
            const content = await generateTemplateContent(LOVABLE_API_KEY, b.key, b.label, b.ch, b.context);
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

      const content = await generateTemplateContent(LOVABLE_API_KEY, trigger_key, label, ch, context);

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

      const content = await generateTemplateContent(LOVABLE_API_KEY, campaign_type || trigger_key, label, ch, context);

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

async function generateTemplateContent(apiKey: string, triggerKey: string, label: string, channel: string, context: string) {
  const channelInstructions: Record<string, string> = {
    email: `Generate an HTML email template. Include:
- A compelling subject line (max 60 chars)
- Full HTML email body with inline CSS, modern design, teal/emerald accent colors (#0d9488), responsive layout
- Use variables like {{name}}, {{streak}}, {{topic}}, {{score}}, {{exam_date}}, {{days_left}} where relevant
- Include a CTA button linking to {{app_url}}
- Professional footer with unsubscribe link {{unsubscribe_url}}`,
    push: `Generate a push notification. Include:
- A short punchy title (max 50 chars, use emoji)
- A concise body (max 100 chars, actionable)
- Use variables like {{name}}, {{streak}}, {{topic}}, {{score}} where relevant`,
    voice: `Generate a voice notification script. Include:
- A natural, conversational spoken text (1-3 sentences)
- Write for text-to-speech: spell out numbers, avoid abbreviations
- Warm and encouraging tone
- Use variables like {{name}}, {{topic}}, {{score}} where relevant`,
  };

  const prompt = `You are an expert marketing and notification copywriter for ACRY Brain, an AI-powered study app for competitive exam preparation (NEET, JEE, etc.).

Trigger: ${label}
Context: ${context}
Channel: ${channel.toUpperCase()}

${channelInstructions[channel] || channelInstructions.email}

Return ONLY a valid JSON object with these fields:
- "subject": the subject/title line
- "html_body": the full content (HTML for email, short text for push, spoken script for voice)
- "variables": array of variable names used (e.g. ["name", "streak", "topic"])

No markdown fences, no explanation, just the JSON.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
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
