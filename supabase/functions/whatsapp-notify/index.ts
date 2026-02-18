import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sanitizeMessage } from "../_shared/variableResolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// All supported WhatsApp notification event types and their default messages
const EVENT_TEMPLATES: Record<string, { title: string; buildMessage: (data: Record<string, any>) => string }> = {
  // ── Auth & Onboarding ──
  signup: {
    title: "🎉 Welcome to ACRY!",
    buildMessage: (d) => `🎉 Welcome${d.name ? ` ${d.name}` : ""}! Your AI Second Brain is ready. Start studying smarter today! 🧠`,
  },
  user_signup: {
    title: "🎉 Welcome to ACRY!",
    buildMessage: (d) => `🎉 Welcome${d.name ? ` ${d.name}` : ""}! Your AI Second Brain is ready. Start studying smarter today! 🧠`,
  },
  profile_completed: {
    title: "✅ Profile Set Up!",
    buildMessage: (d) => `✅ Profile configured${d.name ? ` ${d.name}` : ""}! Your brain is mapped and ready. Let's start learning! 🚀`,
  },
  exam_setup: {
    title: "🎯 Exam Target Set!",
    buildMessage: (d) => `🎯 Exam target locked${d.exam_type ? `: ${d.exam_type}` : ""}! Your AI study plan is ready. Let's crush it! 💪`,
  },
  // ── Study & Memory ──
  daily_goal_completed: {
    title: "🎯 Daily Goal Completed!",
    buildMessage: (d) => `🎯 You crushed your daily goal! ${d.minutes || 0} minutes studied today. Keep the momentum going! 🔥`,
  },
  streak_milestone: {
    title: "🔥 Streak Milestone!",
    buildMessage: (d) => `🔥 ${d.days}-day streak! You're on fire! Every day counts — don't break the chain! 💪`,
  },
  streak_broken: {
    title: "💔 Streak Broken",
    buildMessage: (d) => `💔 Your ${d.previous_days || 0}-day streak ended. No worries — start fresh today and bounce back stronger! 🚀`,
  },
  streak_freeze_used: {
    title: "🧊 Streak Freeze Used",
    buildMessage: (d) => `🧊 A streak freeze saved your ${d.days}-day streak yesterday! You have ${d.remaining || 0} freezes left. Study today to keep going!`,
  },
  memory_strength_drop: {
    title: "⚠️ Memory Alert",
    buildMessage: (d) => `⚠️ "${d.topic_name}" dropped to ${d.strength}% memory strength. A quick 10-min review can save it! 📚`,
  },
  study_reminder: {
    title: "📖 Time to Study!",
    buildMessage: (d) => `📖 Hey! ${d.message || "It's time for your scheduled study session. Open the app and start learning!"} 💡`,
  },
  weak_topic_alert: {
    title: "🧠 Weak Topic Alert",
    buildMessage: (d) => `🧠 "${d.topic_name}" needs attention — it's one of your weakest topics. A focused session can make a big difference! 📝`,
  },

  // ── AI & Brain ──
  risk_digest: {
    title: "🔴 Daily Risk Digest",
    buildMessage: (d) => d.digest_text || `🔴 ${d.at_risk_count || 0} topics are at risk today. Open the app for your personalized study plan!`,
  },
  brain_mission_assigned: {
    title: "🎯 New Brain Mission!",
    buildMessage: (d) => `🎯 New mission: "${d.mission_title}". ${d.description || "Complete it to level up your brain!"} 🧠`,
  },
  brain_mission_completed: {
    title: "✅ Mission Complete!",
    buildMessage: (d) => `✅ Mission "${d.mission_title}" completed! ${d.reward || "Great work — check for your next challenge!"} 🏆`,
  },
  weekly_report: {
    title: "📊 Weekly Report",
    buildMessage: (d) => `📊 Your weekly report is ready! ${d.summary || "See how you performed this week."} Check the app for details! 📈`,
  },
  ai_recommendation: {
    title: "💡 AI Recommendation",
    buildMessage: (d) => `💡 AI Tip: ${d.recommendation || "We have a new personalized recommendation for you!"} Open the app to see details.`,
  },
  brain_update: {
    title: "🧠 Brain Update",
    buildMessage: (d) => `🧠 Your cognitive model just updated! ${d.summary || "New insights about your learning patterns are available."} 📊`,
  },

  // ── Engagement ──
  comeback_nudge: {
    title: "👋 We Miss You!",
    buildMessage: (d) => `👋 Hey${d.name ? ` ${d.name}` : ""}! You've been away for ${d.days_inactive || "a few"} days. Your topics are fading — a quick session can bring them back! 🚀`,
  },
  badge_earned: {
    title: "🏅 Badge Earned!",
    buildMessage: (d) => `🏅 You earned the "${d.badge_name}" badge! ${d.description || "Keep up the amazing work!"} 🎉`,
  },
  leaderboard_rank_change: {
    title: "📈 Rank Update",
    buildMessage: (d) => `📈 Your rank ${d.direction === "up" ? "improved" : "changed"} to #${d.new_rank}${d.direction === "up" ? "! Keep climbing! 🚀" : ". Study more to climb back up! 💪"}`,
  },
  exam_result: {
    title: "📝 Exam Result",
    buildMessage: (d) => `📝 You scored ${d.score}/${d.total} (${d.percentage || Math.round((d.score / d.total) * 100)}%) on your ${d.difficulty || ""} exam. ${(d.score / d.total) >= 0.8 ? "Excellent work! 🌟" : "Review weak areas to improve! 📖"}`,
  },
  exam_countdown: {
    title: "⏰ Exam Countdown",
    buildMessage: (d) => `⏰ ${d.days_left} days until your ${d.exam_type || "exam"}! Stay focused and follow your study plan. You got this! 💪`,
  },
  focus_session_completed: {
    title: "✅ Focus Session Done",
    buildMessage: (d) => `✅ Great focus session! ${d.minutes || 25} minutes on "${d.topic_name || "your topics"}". ${d.streak_bonus ? "Streak bonus applied! " : ""}Keep it up! 🎯`,
  },
  community_reply: {
    title: "💬 New Reply",
    buildMessage: (d) => `💬 Someone replied to your post "${d.post_title || ""}". Check the community to continue the discussion! 🗣️`,
  },
  subscription_expiry: {
    title: "⚡ Subscription Alert",
    buildMessage: (d) => `⚡ Your ${d.plan || "Pro"} plan expires in ${d.days_left} days. Renew now to keep your premium features! ✨`,
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { event_type, user_id, user_ids, data = {} } = body;

    if (!event_type) {
      return new Response(JSON.stringify({ error: "event_type is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin-level global WhatsApp kill switch
    const { data: flag } = await supabase
      .from("feature_flags")
      .select("enabled")
      .eq("flag_key", "notif_whatsapp_global")
      .maybeSingle();

    if (flag && flag.enabled === false) {
      return new Response(JSON.stringify({ sent: 0, skipped: 0, reason: "whatsapp_disabled_by_admin" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const template = EVENT_TEMPLATES[event_type];
    if (!template) {
      return new Response(JSON.stringify({ error: `Unknown event_type: ${event_type}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve target user IDs
    const targetIds: string[] = user_ids || (user_id ? [user_id] : []);
    if (targetIds.length === 0) {
      return new Response(JSON.stringify({ error: "user_id or user_ids required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if this event has a Meta template mapping
    let metaTemplateBody: string | null = null;
    const { data: mappingsFlag } = await supabase
      .from("feature_flags")
      .select("label")
      .eq("flag_key", "whatsapp_event_meta_mappings")
      .maybeSingle();

    if (mappingsFlag?.label) {
      try {
        const mappings = JSON.parse(mappingsFlag.label);
        const mapping = mappings[event_type];
        if (mapping?.metaTemplateId && mapping?.enabled !== false) {
          // Fetch the Meta template body
          const { data: metaTmpl } = await supabase
            .from("meta_template_submissions")
            .select("body_text, template_name")
            .eq("id", mapping.metaTemplateId)
            .eq("meta_status", "approved")
            .maybeSingle();
          if (metaTmpl) {
            metaTemplateBody = metaTmpl.body_text;
            console.log(`Using Meta template "${metaTmpl.template_name}" for event "${event_type}"`);
          }
        }
      } catch (e) {
        console.warn("Failed to parse event-meta mappings:", e);
      }
    }

    // Fetch opted-in users with WhatsApp numbers
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, whatsapp_number, whatsapp_opted_in")
      .in("id", targetIds)
      .eq("whatsapp_opted_in", true);

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ sent: 0, skipped: targetIds.length, reason: "no_opted_in_users" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build messages — use Meta template if mapped, otherwise default
    const messages: { to: string; message: string; user_id: string; category: string }[] = [];

    for (const p of profiles) {
      if (!p.whatsapp_number) continue;

      let messageText: string;

      if (metaTemplateBody) {
        // Resolve variables via resolve-whatsapp-variables edge function
        try {
          const resolveResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/resolve-whatsapp-variables`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ user_id: p.id, template: metaTemplateBody }),
          });
          const resolveData = await resolveResp.json();
          messageText = resolveData.resolved || metaTemplateBody;
        } catch (e) {
          console.warn(`Variable resolution failed for ${p.id}, using default:`, e);
          messageText = template.buildMessage({ ...data, name: p.display_name });
        }
      } else {
        messageText = template.buildMessage({ ...data, name: p.display_name });
      }

      // ── UVR Sanitization Gate ──
      const { cleaned, issues, hasBlank } = sanitizeMessage(messageText);
      if (hasBlank && cleaned.length < 5) {
        console.warn(`[UVR] Blocked blank WhatsApp message for user ${p.id}, event ${event_type}:`, issues);
        continue;
      }
      if (issues.length > 0) {
        console.warn(`[UVR] WhatsApp variable warnings for ${p.id}:`, issues);
      }

      // Normalize phone number: strip spaces
      const normalizedNumber = p.whatsapp_number!.replace(/\s+/g, "");

      messages.push({
        to: normalizedNumber,
        message: cleaned,
        user_id: p.id,
        category: event_type,
      });
    }

    if (messages.length === 0) {
      return new Response(JSON.stringify({ sent: 0, skipped: targetIds.length, reason: "no_whatsapp_numbers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call the existing send-whatsapp function
    const sendResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-whatsapp`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const result = await sendResp.json();

    return new Response(JSON.stringify({
      event_type,
      targeted: targetIds.length,
      eligible: messages.length,
      meta_template_used: !!metaTemplateBody,
      ...result,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("whatsapp-notify error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
