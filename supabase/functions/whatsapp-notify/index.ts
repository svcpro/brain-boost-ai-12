import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Event → Meta-approved template mapping ───
// Each entry maps a system event to the approved template_name in meta_template_submissions
// and defines how to map event data fields to positional variables {{1}}, {{2}}, etc.
interface TemplateMapping {
  metaTemplateName: string;
  // Maps positional index (1-based) to a data key or a resolver function
  variableMap: (data: Record<string, any>, profile: any) => Record<string, string>;
}

const EVENT_TO_TEMPLATE: Record<string, TemplateMapping> = {
  // ── Auth & Onboarding ──
  signup: {
    metaTemplateName: "new_user_welcome",
    variableMap: (d, p) => ({
      "1": p.display_name || d.name || "Student",
      "2": d.first_topic || "Your First Topic",
      "3": d.community_count || "10,000",
    }),
  },
  user_signup: {
    metaTemplateName: "new_user_welcome",
    variableMap: (d, p) => ({
      "1": p.display_name || d.name || "Student",
      "2": d.first_topic || "Your First Topic",
      "3": d.community_count || "10,000",
    }),
  },

  // ── Study & Memory ──
  study_reminder: {
    metaTemplateName: "study_reminder",
    variableMap: (d, p) => ({
      "1": p.display_name || d.name || "Student",
      "2": d.topic_name || "your topics",
      "3": String(d.memory_score ?? d.strength ?? "45"),
      "4": d.last_studied || "3 days",
    }),
  },
  memory_strength_drop: {
    metaTemplateName: "forget_risk_alert",
    variableMap: (d, p) => ({
      "1": p.display_name || d.name || "Student",
      "2": d.topic_name || "a topic",
      "3": String(d.strength ?? d.score ?? "32"),
      "4": d.predicted_forget_date || "soon",
    }),
  },
  weak_topic_alert: {
    metaTemplateName: "forget_risk_alert",
    variableMap: (d, p) => ({
      "1": p.display_name || d.name || "Student",
      "2": d.topic_name || "a topic",
      "3": String(d.strength ?? d.score ?? "30"),
      "4": d.predicted_forget_date || "soon",
    }),
  },
  risk_digest: {
    metaTemplateName: "daily_risk_digest",
    variableMap: (d, p) => ({
      "1": p.display_name || d.name || "Student",
      "2": String(d.at_risk_count ?? d.topics_at_risk ?? "5"),
      "3": d.weakest_topic || "a topic",
      "4": String(d.weakest_score ?? "28"),
      "5": String(d.average_score ?? "62"),
    }),
  },
  daily_goal_completed: {
    metaTemplateName: "daily_briefing",
    variableMap: (d, p) => ({
      "1": p.display_name || d.name || "Student",
      "2": String(d.topics_count ?? "6"),
      "3": String(d.brain_score ?? "78"),
      "4": String(d.streak_days ?? d.days ?? "1"),
      "5": d.focus_topic || "your topics",
    }),
  },

  // ── Streak ──
  streak_milestone: {
    metaTemplateName: "streak_milestone",
    variableMap: (d, p) => ({
      "1": p.display_name || d.name || "Student",
      "2": String(d.days ?? "7"),
      "3": String(d.total_sessions ?? "30"),
      "4": String(d.rank ?? "50"),
    }),
  },
  streak_broken: {
    metaTemplateName: "inactivity_nudge",
    variableMap: (d, p) => ({
      "1": p.display_name || d.name || "Student",
      "2": String(d.days_inactive ?? d.previous_days ?? "3"),
      "3": String(d.memory_drop ?? "18"),
      "4": String(d.decaying_topics ?? "5"),
      "5": String(d.friends_count ?? "10"),
    }),
  },
  comeback_nudge: {
    metaTemplateName: "inactivity_nudge",
    variableMap: (d, p) => ({
      "1": p.display_name || d.name || "Student",
      "2": String(d.days_inactive ?? "5"),
      "3": String(d.memory_drop ?? "18"),
      "4": String(d.decaying_topics ?? "7"),
      "5": String(d.friends_count ?? "12"),
    }),
  },

  // ── AI & Brain ──
  brain_mission_assigned: {
    metaTemplateName: "brain_missions",
    variableMap: (d, p) => ({
      "1": p.display_name || d.name || "Student",
      "2": d.mission_title || "New Mission",
      "3": d.mission_type || "Weekly",
      "4": d.reward || "50 XP",
      "5": d.deadline || "Sunday",
    }),
  },
  brain_mission_completed: {
    metaTemplateName: "brain_missions",
    variableMap: (d, p) => ({
      "1": p.display_name || d.name || "Student",
      "2": d.mission_title || "Mission Complete",
      "3": d.mission_type || "Achievement",
      "4": d.reward || "Completed!",
      "5": d.deadline || "Done",
    }),
  },
  brain_update: {
    metaTemplateName: "brain_update_reminder",
    variableMap: (d, p) => ({
      "1": p.display_name || d.name || "Student",
      "2": String(d.hours_since ?? "36"),
      "3": String(d.pending_topics ?? "8"),
      "4": String(d.brain_score ?? "71"),
    }),
  },

  // ── Engagement ──
  leaderboard_rank_change: {
    metaTemplateName: "leaderboard_rank_up",
    variableMap: (d, p) => ({
      "1": p.display_name || d.name || "Student",
      "2": String(d.old_rank ?? "25"),
      "3": String(d.new_rank ?? "18"),
      "4": String(d.rank_jump ?? Math.abs((d.old_rank || 25) - (d.new_rank || 18))),
      "5": String(d.top_percent ?? "10"),
    }),
  },
  exam_countdown: {
    metaTemplateName: "exam_countdown",
    variableMap: (d, p) => ({
      "1": p.display_name || d.name || "Student",
      "2": d.exam_type || "your exam",
      "3": String(d.days_left ?? "15"),
      "4": String(d.readiness ?? "68"),
      "5": String(d.topics_remaining ?? "12"),
      "6": String(d.daily_target ?? "3"),
    }),
  },
  subscription_expiry: {
    metaTemplateName: "subscription_expiry",
    variableMap: (d, p) => ({
      "1": p.display_name || d.name || "Student",
      "2": d.plan || "Pro",
      "3": String(d.days_left ?? "5"),
      "4": d.expiry_date || "soon",
      "5": d.renewal_price || "₹299/mo",
    }),
  },

  // ── Burnout ──
  burnout_alert: {
    metaTemplateName: "burnout_alert",
    variableMap: (d, p) => ({
      "1": p.display_name || d.name || "Student",
      "2": String(d.fatigue_score ?? "85"),
      "3": String(d.session_duration ?? "120"),
      "4": d.optimal_time || "6:00 PM",
    }),
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

    // Get the template mapping for this event
    const mapping = EVENT_TO_TEMPLATE[event_type];
    if (!mapping) {
      console.warn(`No approved template mapping for event: ${event_type}`);
      return new Response(JSON.stringify({ error: `No approved template mapping for event: ${event_type}` }), {
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

    // Look up the approved Meta template from DB to get Twilio Content SID
    const { data: metaTemplate } = await supabase
      .from("meta_template_submissions")
      .select("id, template_name, meta_template_id, meta_status, body_text")
      .eq("template_name", mapping.metaTemplateName)
      .eq("meta_status", "approved")
      .maybeSingle();

    if (!metaTemplate || !metaTemplate.meta_template_id) {
      console.error(`No approved Meta template found for: ${mapping.metaTemplateName}`);
      return new Response(JSON.stringify({
        error: `Template "${mapping.metaTemplateName}" not approved or missing`,
        event_type,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Event "${event_type}" → Template "${metaTemplate.template_name}"`);

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

    // Build messages with resolved body text from Meta-approved templates
    // Twilio auto-matches to approved templates on production numbers
    const messages: {
      to: string;
      user_id: string;
      category: string;
      message: string;
      template_name: string;
    }[] = [];

    for (const p of profiles) {
      if (!p.whatsapp_number) continue;

      const normalizedNumber = p.whatsapp_number.replace(/\s+/g, "");
      const contentVariables = mapping.variableMap(data, p);

      // Replace positional placeholders {{1}}, {{2}}, etc. with resolved values
      let messageBody = metaTemplate.body_text || "";
      for (const [key, value] of Object.entries(contentVariables)) {
        messageBody = messageBody.replace(`{{${key}}}`, value);
      }

      messages.push({
        to: normalizedNumber,
        user_id: p.id,
        category: event_type,
        message: messageBody,
        template_name: metaTemplate.template_name,
      });
    }

    if (messages.length === 0) {
      return new Response(JSON.stringify({ sent: 0, skipped: targetIds.length, reason: "no_whatsapp_numbers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call send-whatsapp with resolved template body text
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
      template_used: metaTemplate.template_name,
      targeted: targetIds.length,
      eligible: messages.length,
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
