import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Beautiful email template builder
function buildEmailHtml(params: {
  userName: string;
  subject: string;
  heroTitle: string;
  heroSubtitle?: string;
  bodyContent: string;
  ctaText?: string;
  ctaUrl?: string;
  category: string;
  userId: string;
  footerNote?: string;
}) {
  const categoryColors: Record<string, { primary: string; gradient: string; accent: string }> = {
    user_lifecycle: { primary: "#6366f1", gradient: "linear-gradient(135deg, #6366f1, #8b5cf6)", accent: "#c4b5fd" },
    ai_brain: { primary: "#0d9488", gradient: "linear-gradient(135deg, #0d9488, #065f46)", accent: "#a7f3d0" },
    study_reminder: { primary: "#f59e0b", gradient: "linear-gradient(135deg, #f59e0b, #d97706)", accent: "#fde68a" },
    study_progress: { primary: "#10b981", gradient: "linear-gradient(135deg, #10b981, #059669)", accent: "#a7f3d0" },
    rank_performance: { primary: "#3b82f6", gradient: "linear-gradient(135deg, #3b82f6, #1d4ed8)", accent: "#bfdbfe" },
    community: { primary: "#8b5cf6", gradient: "linear-gradient(135deg, #8b5cf6, #6d28d9)", accent: "#ddd6fe" },
    billing: { primary: "#ec4899", gradient: "linear-gradient(135deg, #ec4899, #be185d)", accent: "#fbcfe8" },
    security: { primary: "#ef4444", gradient: "linear-gradient(135deg, #ef4444, #b91c1c)", accent: "#fecaca" },
    system: { primary: "#64748b", gradient: "linear-gradient(135deg, #64748b, #334155)", accent: "#cbd5e1" },
    general: { primary: "#0d9488", gradient: "linear-gradient(135deg, #0d9488, #065f46)", accent: "#a7f3d0" },
  };

  const colors = categoryColors[params.category] || categoryColors.general;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        
        <!-- Header -->
        <tr><td style="background:${colors.gradient};padding:40px 32px;text-align:center;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <div style="width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:12px;display:inline-block;line-height:48px;font-size:24px;font-weight:900;color:#fff;margin-bottom:12px;">A</div>
            </td></tr>
            <tr><td align="center">
              <h1 style="color:#ffffff;margin:0 0 4px;font-size:28px;font-weight:800;letter-spacing:-0.5px;">ACRY</h1>
              <p style="color:${colors.accent};margin:0;font-size:12px;text-transform:uppercase;letter-spacing:2px;font-weight:600;">AI Second Brain</p>
            </td></tr>
          </table>
        </td></tr>

        <!-- Hero -->
        <tr><td style="padding:32px 32px 0;text-align:center;">
          <h2 style="color:#1e293b;margin:0 0 8px;font-size:22px;font-weight:700;line-height:1.3;">${params.heroTitle}</h2>
          ${params.heroSubtitle ? `<p style="color:#64748b;margin:0;font-size:14px;line-height:1.5;">${params.heroSubtitle}</p>` : ''}
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:24px 32px;">
          <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 8px;">Hi ${params.userName},</p>
          <div style="color:#334155;font-size:15px;line-height:1.7;">${params.bodyContent}</div>
        </td></tr>

        <!-- CTA -->
        ${params.ctaText ? `
        <tr><td style="padding:8px 32px 32px;text-align:center;">
          <a href="${params.ctaUrl || 'https://acry.ai/app'}" style="background:${colors.gradient};color:#ffffff;padding:14px 40px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;box-shadow:0 4px 14px ${colors.primary}40;">${params.ctaText}</a>
        </td></tr>
        ` : ''}

        ${params.footerNote ? `
        <tr><td style="padding:0 32px 24px;">
          <div style="background:#f8fafc;border-radius:10px;padding:16px;border:1px solid #e2e8f0;">
            <p style="color:#64748b;font-size:13px;margin:0;line-height:1.6;">${params.footerNote}</p>
          </div>
        </td></tr>
        ` : ''}

        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:24px 32px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="color:#94a3b8;font-size:12px;margin:0 0 8px;">© ${year} ACRY · AI Second Brain for All Exams</p>
          <p style="margin:0;">
            <a href="https://acry.ai" style="color:#94a3b8;font-size:11px;text-decoration:underline;margin:0 8px;">Website</a>
            <a href="https://acry.ai/support" style="color:#94a3b8;font-size:11px;text-decoration:underline;margin:0 8px;">Support</a>
            <a href="https://yvxrsujwgmzdjzsjyqfb.supabase.co/functions/v1/email-unsubscribe?uid=${params.userId}&type=all" style="color:#94a3b8;font-size:11px;text-decoration:underline;margin:0 8px;">Unsubscribe</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// Generate email content based on trigger type
function generateEmailContent(triggerKey: string, variables: Record<string, unknown>, userName: string) {
  const v = variables;
  const templates: Record<string, { subject: string; heroTitle: string; heroSubtitle?: string; body: string; cta?: string; ctaUrl?: string; footerNote?: string }> = {
    user_signup: {
      subject: "🎉 Welcome to ACRY – Your AI Second Brain!",
      heroTitle: "Welcome to ACRY!",
      heroSubtitle: "Your journey to exam mastery starts now",
      body: `<p>We're thrilled to have you on board! ACRY uses AI to help you study smarter, not harder.</p>
        <p style="margin:16px 0;"><strong>Here's what you can do:</strong></p>
        <ul style="padding-left:20px;color:#334155;">
          <li style="padding:4px 0;">📚 Add your exam topics</li>
          <li style="padding:4px 0;">🧠 Let AI track your memory strength</li>
          <li style="padding:4px 0;">📊 Get personalized study plans</li>
          <li style="padding:4px 0;">🏆 Compete on leaderboards</li>
        </ul>`,
      cta: "Start Studying →",
      ctaUrl: "https://acry.ai/app",
    },
    profile_completed: {
      subject: "✅ Profile Complete – You're All Set!",
      heroTitle: "Profile Completed!",
      body: "<p>Great job setting up your profile! Your AI brain is now personalized and ready to help you ace your exams.</p>",
      cta: "Explore Dashboard →",
    },
    exam_setup_completed: {
      subject: "🎯 Exam Setup Done – Let's Begin!",
      heroTitle: "Exam Setup Complete!",
      body: `<p>Your exam <strong>${v.exam_name || 'preparation'}</strong> is now configured. ACRY will create a personalized study plan based on your target date and topics.</p>`,
      cta: "View Study Plan →",
    },
    memory_forget_risk: {
      subject: "⚠️ Memory Alert – Topics at Risk!",
      heroTitle: "Memory Forget Risk Detected",
      heroSubtitle: "Your AI brain detected topics that need attention",
      body: `<p>Our AI analysis shows that <strong>${v.topics_count || 'some'} topic(s)</strong> are at risk of being forgotten:</p>
        <div style="background:#fef2f2;border-radius:8px;padding:12px 16px;margin:12px 0;border-left:4px solid #ef4444;">
          <p style="margin:0;color:#991b1b;font-size:14px;">${v.topic_names || 'Review your dashboard for details'}</p>
        </div>
        <p>A quick revision session can prevent this memory loss!</p>`,
      cta: "Start Revision →",
      footerNote: "💡 Tip: Studying for just 10 minutes can significantly boost your retention.",
    },
    weak_topic_detected: {
      subject: "📉 Weak Topic Detected – Action Needed",
      heroTitle: "Weak Topic Alert",
      body: `<p>Your AI brain identified that <strong>${v.topic_name || 'a topic'}</strong> needs more practice. Your current mastery is at <strong>${v.mastery || 'low'}</strong>.</p>`,
      cta: "Practice Now →",
    },
    brain_performance_up: {
      subject: "🚀 Brain Performance Up! Great Progress!",
      heroTitle: "Your Brain is Getting Stronger!",
      heroSubtitle: "Keep up the amazing work!",
      body: `<p>Congratulations! Your overall brain performance has improved by <strong>${v.improvement || 'significantly'}</strong>. Your consistent study habits are paying off!</p>`,
      cta: "View Progress →",
    },
    brain_performance_down: {
      subject: "⚠️ Brain Performance Drop Detected",
      heroTitle: "Performance Alert",
      body: `<p>We've noticed a dip in your brain performance. This could be due to missed study sessions or topic decay. Let's get back on track!</p>`,
      cta: "Recovery Session →",
    },
    user_inactive_hours: {
      subject: "👋 We Miss You! Time to Study",
      heroTitle: "Time for a Quick Session?",
      body: `<p>It's been a while since your last study session. Even a 5-minute review can make a big difference for your memory retention!</p>`,
      cta: "Quick Study →",
    },
    user_inactive_days: {
      subject: "📚 Don't Let Your Progress Slip!",
      heroTitle: "We Haven't Seen You in a While",
      heroSubtitle: "Your topics are waiting for you",
      body: `<p>It's been <strong>${v.days || 'several'} days</strong> since you last studied. Your memory scores may be declining. Come back and protect your progress!</p>`,
      cta: "Resume Studying →",
      footerNote: "🔥 Your streak is at risk! Log in to save it.",
    },
    study_reminder: {
      subject: `📚 ${v.topics_count || 'Topics'} need revision today`,
      heroTitle: "Daily Study Reminder",
      body: `<p>You have <strong>${v.topics_count || 'some'} topic(s)</strong> due for revision based on your forgetting curve. A quick session will reinforce your memory!</p>`,
      cta: "Start Studying →",
    },
    revision_reminder: {
      subject: "🔄 Revision Time – Strengthen Your Memory",
      heroTitle: "Revision Reminder",
      body: `<p>Based on your learning patterns, now is the optimal time to revise <strong>${v.topic_name || 'your topics'}</strong>.</p>`,
      cta: "Start Revision →",
    },
    fix_session_completed: {
      subject: "✅ Fix Session Complete – Well Done!",
      heroTitle: "Fix Session Completed!",
      body: `<p>Great work completing your fix session! You've addressed <strong>${v.fixed_count || 'several'}</strong> weak areas. Your brain is getting stronger!</p>`,
      cta: "View Results →",
    },
    improvement_detected: {
      subject: "📈 Improvement Detected – Keep Going!",
      heroTitle: "You're Improving!",
      body: `<p>Your AI brain detected significant improvement in <strong>${v.area || 'your studies'}</strong>. Keep up the momentum!</p>`,
      cta: "Continue Studying →",
    },
    weak_topics_improved: {
      subject: "🎯 Weak Topics Improved – Great Progress!",
      heroTitle: "Weak Topics Conquered!",
      body: `<p>Topics that were previously weak have shown improvement: <strong>${v.topics || 'multiple topics'}</strong>. Your hard work is paying off!</p>`,
      cta: "View Progress →",
    },
    rank_prediction_updated: {
      subject: "📊 Your Rank Prediction Updated",
      heroTitle: "Rank Prediction Updated",
      body: `<p>Based on your recent activity, your predicted rank has been updated to <strong>${v.predicted_rank || 'a new position'}</strong>.</p>`,
      cta: "See Prediction →",
    },
    rank_improved: {
      subject: "🏆 Your Rank Improved! Congratulations!",
      heroTitle: "Rank Up! 🎉",
      heroSubtitle: "You're climbing the leaderboard!",
      body: `<p>Amazing! Your rank has improved to <strong>#${v.new_rank || '?'}</strong>. Keep studying to reach the top!</p>`,
      cta: "View Leaderboard →",
    },
    rank_dropped: {
      subject: "📉 Rank Alert – Your Position Changed",
      heroTitle: "Rank Update",
      body: `<p>Your rank has changed. Don't worry – with focused study, you can get back on top!</p>`,
      cta: "Boost Your Rank →",
    },
    exam_readiness_updated: {
      subject: "📋 Exam Readiness Score Updated",
      heroTitle: "Exam Readiness Update",
      body: `<p>Your exam readiness score is now <strong>${v.readiness_score || '?'}%</strong>. ${Number(v.readiness_score) >= 80 ? "You're well prepared!" : "Keep studying to improve your readiness!"}</p>`,
      cta: "View Details →",
    },
    community_reply: {
      subject: "💬 New Reply on Your Post",
      heroTitle: "Someone Replied!",
      body: `<p><strong>${v.replier_name || 'Someone'}</strong> replied to your post: "<em>${v.post_title || 'your discussion'}</em>"</p>`,
      cta: "View Reply →",
      ctaUrl: v.post_url as string || "https://acry.ai/community",
    },
    community_comment: {
      subject: "💬 New Comment on Your Post",
      heroTitle: "New Comment!",
      body: `<p>Your post received a new comment from <strong>${v.commenter_name || 'a community member'}</strong>.</p>`,
      cta: "View Comment →",
    },
    community_mention: {
      subject: "🔔 You Were Mentioned in a Discussion",
      heroTitle: "You Were Mentioned!",
      body: `<p><strong>${v.mentioner_name || 'Someone'}</strong> mentioned you in a discussion: "<em>${v.discussion_title || 'a discussion'}</em>"</p>`,
      cta: "View Discussion →",
    },
    ai_answered_question: {
      subject: "🤖 AI Answered Your Question!",
      heroTitle: "AI Answer Ready",
      body: `<p>The AI has answered your question: "<em>${v.question_title || 'your question'}</em>". Check out the detailed response!</p>`,
      cta: "View Answer →",
    },
    subscription_activated: {
      subject: "🎉 Subscription Activated – Welcome to Pro!",
      heroTitle: "Welcome to ACRY Pro!",
      heroSubtitle: "Unlock your full potential",
      body: `<p>Your <strong>${v.plan_name || 'Pro'}</strong> subscription is now active! Enjoy unlimited access to all premium features.</p>`,
      cta: "Explore Pro Features →",
    },
    subscription_expired: {
      subject: "⚠️ Your Subscription Has Expired",
      heroTitle: "Subscription Expired",
      body: `<p>Your <strong>${v.plan_name || 'Pro'}</strong> subscription has expired. Renew now to continue enjoying premium features!</p>`,
      cta: "Renew Subscription →",
      ctaUrl: "https://acry.ai/app?tab=you",
    },
    payment_successful: {
      subject: "✅ Payment Successful",
      heroTitle: "Payment Confirmed!",
      body: `<p>Your payment of <strong>₹${v.amount || '?'}</strong> has been processed successfully. Thank you for your support!</p>`,
      cta: "View Receipt →",
    },
    payment_failed: {
      subject: "❌ Payment Failed – Action Required",
      heroTitle: "Payment Failed",
      body: `<p>We couldn't process your payment. Please update your payment method and try again.</p>`,
      cta: "Retry Payment →",
      ctaUrl: "https://acry.ai/app?tab=you",
    },
    new_device_login: {
      subject: "🔐 New Login Detected",
      heroTitle: "New Device Login",
      body: `<p>A login was detected from a new device:</p>
        <div style="background:#fef2f2;border-radius:8px;padding:12px 16px;margin:12px 0;border-left:4px solid #ef4444;">
          <p style="margin:0;color:#991b1b;font-size:14px;">📍 ${v.location || 'Unknown location'}<br>🖥️ ${v.device || 'Unknown device'}<br>🕐 ${v.time || new Date().toISOString()}</p>
        </div>
        <p>If this wasn't you, please change your password immediately.</p>`,
      cta: "Secure My Account →",
    },
    password_changed: {
      subject: "🔑 Password Changed Successfully",
      heroTitle: "Password Updated",
      body: `<p>Your password has been changed successfully. If you didn't make this change, please contact support immediately.</p>`,
    },
    suspicious_activity: {
      subject: "🚨 Suspicious Activity Detected",
      heroTitle: "Security Alert",
      body: `<p>We detected suspicious activity on your account. Please review your recent activity and change your password if needed.</p>`,
      cta: "Review Activity →",
    },
    new_feature: {
      subject: `🆕 New Feature: ${v.feature_name || 'Check it out!'}`,
      heroTitle: v.feature_name as string || "New Feature Available!",
      body: `<p>${v.feature_description || 'We\'ve added exciting new features to help you study better!'}</p>`,
      cta: "Try It Now →",
    },
    system_announcement: {
      subject: `📢 ${v.announcement_title || 'Important Announcement'}`,
      heroTitle: v.announcement_title as string || "Announcement",
      body: `<p>${v.announcement_body || 'We have an important update for you.'}</p>`,
    },
    maintenance_notice: {
      subject: "🔧 Scheduled Maintenance Notice",
      heroTitle: "Scheduled Maintenance",
      body: `<p>We'll be performing maintenance on <strong>${v.maintenance_date || 'soon'}</strong>. The platform may be temporarily unavailable during this period.</p>`,
      footerNote: `⏰ Expected downtime: ${v.downtime || '~30 minutes'}`,
    },
    streak_milestone: {
      subject: `🔥 ${v.streak_days || '?'}-Day Streak! Amazing!`,
      heroTitle: `${v.streak_days || '?'}-Day Streak! 🔥`,
      heroSubtitle: "You're on fire!",
      body: `<p>Incredible consistency! You've maintained a <strong>${v.streak_days || '?'}-day study streak</strong>. Keep going to unlock more achievements!</p>`,
      cta: "Continue Streak →",
    },
    daily_goal_completed: {
      subject: "🎯 Daily Goal Completed!",
      heroTitle: "Goal Achieved! ✅",
      body: `<p>You've completed your daily study goal! Great job staying consistent with your learning.</p>`,
      cta: "View Progress →",
    },
    weekly_report: {
      subject: "📊 Your Weekly Study Report",
      heroTitle: "Weekly Report",
      heroSubtitle: "Here's how you did this week",
      body: `<p>This week you studied <strong>${v.study_hours || '0'} hours</strong> across <strong>${v.topics_studied || '0'} topics</strong>.</p>
        <p>Memory strength: <strong>${v.avg_memory || '?'}%</strong></p>`,
      cta: "Full Report →",
    },
  };

  const template = templates[triggerKey] || {
    subject: "ACRY Notification",
    heroTitle: "Notification",
    body: `<p>${v.message || 'You have a new notification from ACRY.'}</p>`,
    cta: "Open ACRY →",
  };

  return template;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { trigger_key, user_id, variables = {} } = await req.json();

    if (!trigger_key || !user_id) {
      return new Response(JSON.stringify({ error: "trigger_key and user_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if trigger is enabled
    const { data: trigger } = await adminClient
      .from("email_triggers")
      .select("*")
      .eq("trigger_key", trigger_key)
      .eq("is_enabled", true)
      .maybeSingle();

    if (!trigger) {
      return new Response(JSON.stringify({ skipped: true, reason: "Trigger disabled or not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check cooldown
    if (trigger.cooldown_hours > 0) {
      const cooldownDate = new Date(Date.now() - trigger.cooldown_hours * 3600000).toISOString();
      const { data: recentLog } = await adminClient
        .from("email_logs")
        .select("id")
        .eq("user_id", user_id)
        .eq("trigger_key", trigger_key)
        .gte("created_at", cooldownDate)
        .limit(1)
        .maybeSingle();

      if (recentLog) {
        return new Response(JSON.stringify({ skipped: true, reason: "Cooldown active" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get user info
    const { data: { user } } = await adminClient.auth.admin.getUserById(user_id);
    if (!user?.email) {
      return new Response(JSON.stringify({ error: "User email not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check email preferences
    const { data: profile } = await adminClient
      .from("profiles")
      .select("display_name, email_notifications, email_study_reminders")
      .eq("id", user_id)
      .maybeSingle();

    if (profile?.email_notifications === false) {
      return new Response(JSON.stringify({ skipped: true, reason: "Email notifications disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userName = profile?.display_name || user.email.split("@")[0];

    // Check if trigger has a custom template
    let htmlBody: string;
    let subject: string;

    if (trigger.template_id) {
      const { data: template } = await adminClient
        .from("email_templates")
        .select("html_body, subject")
        .eq("id", trigger.template_id)
        .maybeSingle();

      if (template) {
        // Replace variables in custom template
        subject = template.subject;
        htmlBody = template.html_body;
        for (const [key, value] of Object.entries({ ...variables, user_name: userName })) {
          const regex = new RegExp(`{{${key}}}`, "g");
          subject = subject.replace(regex, String(value));
          htmlBody = htmlBody.replace(regex, String(value));
        }
      } else {
        const content = generateEmailContent(trigger_key, variables, userName);
        subject = content.subject;
        htmlBody = buildEmailHtml({
          userName, subject, heroTitle: content.heroTitle,
          heroSubtitle: content.heroSubtitle, bodyContent: content.body,
          ctaText: content.cta, ctaUrl: content.ctaUrl || "https://acry.ai/app",
          category: trigger.category, userId: user_id, footerNote: content.footerNote,
        });
      }
    } else {
      const content = generateEmailContent(trigger_key, variables, userName);
      subject = content.subject;
      htmlBody = buildEmailHtml({
        userName, subject, heroTitle: content.heroTitle,
        heroSubtitle: content.heroSubtitle, bodyContent: content.body,
        ctaText: content.cta, ctaUrl: content.ctaUrl || "https://acry.ai/app",
        category: trigger.category, userId: user_id, footerNote: content.footerNote,
      });
    }

    // Queue the email
    const { data: queued, error: queueError } = await adminClient
      .from("email_queue")
      .insert({
        user_id,
        trigger_key,
        template_id: trigger.template_id,
        to_email: user.email,
        subject,
        html_body: htmlBody,
        variables,
        priority: trigger.priority,
        status: "pending",
      })
      .select("id")
      .single();

    if (queueError) throw queueError;

    // Send immediately for high priority, queue for normal
    if (trigger.priority === "high") {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "ACRY <onboarding@resend.dev>",
            to: [user.email],
            subject,
            html: htmlBody,
          }),
        });

        const sendStatus = res.ok ? "sent" : "failed";
        const errorMsg = !res.ok ? await res.text() : null;

        await adminClient.from("email_queue").update({
          status: sendStatus,
          sent_at: res.ok ? new Date().toISOString() : null,
          error_message: errorMsg,
        }).eq("id", queued.id);

        // Log
        await adminClient.from("email_logs").insert({
          user_id, trigger_key, template_id: trigger.template_id,
          to_email: user.email, subject, status: sendStatus,
          error_message: errorMsg, metadata: variables,
        });

        // Track usage
        adminClient.rpc("increment_api_usage", { p_service_name: "resend" }).then(() => {}).catch(() => {});

        if (!res.ok) console.error(`Email send failed for ${trigger_key}:`, errorMsg);
      }
    }

    return new Response(JSON.stringify({ success: true, queued_id: queued.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("trigger-email error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
