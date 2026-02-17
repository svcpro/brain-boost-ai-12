import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildDailyEmail(params: {
  userName: string;
  userId: string;
  streakDays: number;
  dueTopicsCount: number;
  dueTopicNames: string[];
  memoryStrength: number;
  brainScore: number;
  studyMinutesToday: number;
  rank: number | null;
  tip: string;
  greeting: string;
}) {
  const { userName, userId, streakDays, dueTopicsCount, dueTopicNames, memoryStrength, brainScore, studyMinutesToday, rank, tip, greeting } = params;
  const year = new Date().getFullYear();
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const streakEmoji = streakDays >= 30 ? "🏆" : streakDays >= 14 ? "🔥" : streakDays >= 7 ? "⚡" : streakDays >= 3 ? "✨" : "💪";
  const memoryColor = memoryStrength >= 70 ? "#34d399" : memoryStrength >= 40 ? "#fbbf24" : "#f87171";
  const brainColor = brainScore >= 70 ? "#34d399" : brainScore >= 40 ? "#fbbf24" : "#f87171";

  const topicList = dueTopicNames.slice(0, 5).map(t =>
    `<tr><td style="padding:10px 14px;font-size:14px;color:#e2e8f0;border-bottom:1px solid rgba(45,212,191,0.08);">📌 ${t}</td><td style="padding:10px 14px;text-align:right;border-bottom:1px solid rgba(45,212,191,0.08);"><a href="https://acry.ai/app" style="color:#2dd4bf;font-size:12px;font-weight:600;text-decoration:none;">Review →</a></td></tr>`
  ).join("");

  const actionCards = [
    { emoji: "📚", title: "Quick Study", desc: "5-min revision", url: "https://acry.ai/app?action=quick-study", color: "#818cf8" },
    { emoji: "🧠", title: "Brain Check", desc: "View brain health", url: "https://acry.ai/app?tab=brain", color: "#2dd4bf" },
    { emoji: "📊", title: "Progress", desc: "See your growth", url: "https://acry.ai/app?tab=progress", color: "#fbbf24" },
    { emoji: "🏆", title: "Leaderboard", desc: "Check your rank", url: "https://acry.ai/app?tab=home", color: "#a78bfa" },
  ].map(a =>
    `<td style="width:25%;padding:4px;">
      <a href="${a.url}" style="text-decoration:none;display:block;background:rgba(45,212,191,0.04);border-radius:12px;padding:14px 6px;text-align:center;border:1px solid rgba(45,212,191,0.1);">
        <div style="font-size:22px;margin-bottom:4px;">${a.emoji}</div>
        <div style="font-size:11px;font-weight:700;color:${a.color};margin-bottom:2px;">${a.title}</div>
        <div style="font-size:10px;color:#64748b;">${a.desc}</div>
      </a>
    </td>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Your Daily ACRY Briefing</title></head>
<body style="margin:0;padding:0;background:#0a1628;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a1628;padding:40px 12px;">
<tr><td align="center">
<table role="presentation" width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#111b2e;border-radius:20px;overflow:hidden;border:1px solid rgba(45,212,191,0.15);box-shadow:0 8px 40px rgba(0,0,0,0.4),0 0 80px rgba(13,148,136,0.08);">

<!-- Header -->
<tr><td style="background:linear-gradient(135deg,#0d9488 0%,#065f46 50%,#064e3b 100%);padding:40px 32px;text-align:center;">
  <div style="width:56px;height:56px;background:rgba(255,255,255,0.15);border:2px solid rgba(255,255,255,0.2);border-radius:16px;display:inline-block;line-height:56px;font-size:28px;font-weight:900;color:#fff;margin-bottom:12px;">A</div>
  <h1 style="color:#fff;margin:0 0 4px;font-size:30px;font-weight:800;letter-spacing:-0.5px;">ACRY</h1>
  <p style="color:#a7f3d0;margin:0 0 14px;font-size:11px;text-transform:uppercase;letter-spacing:3px;font-weight:600;">AI Second Brain</p>
  <p style="color:#d1fae5;margin:0;font-size:14px;">${today}</p>
</td></tr>

<!-- Greeting -->
<tr><td style="padding:32px 32px 12px;">
  <p style="color:#f1f5f9;font-size:18px;font-weight:700;margin:0 0 4px;">${greeting}, <span style="color:#2dd4bf;">${userName}</span>! ${streakEmoji}</p>
  <p style="color:#94a3b8;font-size:14px;margin:0;line-height:1.6;">Here's your personalized daily briefing from your AI Second Brain.</p>
</td></tr>

<!-- Divider -->
<tr><td style="padding:0 32px;"><div style="height:1px;background:linear-gradient(90deg,transparent,rgba(45,212,191,0.2),transparent);margin:8px 0;"></div></td></tr>

<!-- Stats Row -->
<tr><td style="padding:16px 32px 20px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="width:33%;text-align:center;padding:8px 4px;">
        <div style="background:rgba(45,212,191,0.06);border:1px solid rgba(45,212,191,0.1);border-radius:14px;padding:16px 8px;">
          <div style="font-size:26px;font-weight:800;color:${memoryColor};">${memoryStrength}%</div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;font-weight:500;">Memory</div>
        </div>
      </td>
      <td style="width:33%;text-align:center;padding:8px 4px;">
        <div style="background:rgba(45,212,191,0.06);border:1px solid rgba(45,212,191,0.1);border-radius:14px;padding:16px 8px;">
          <div style="font-size:26px;font-weight:800;color:${brainColor};">${brainScore}%</div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;font-weight:500;">Brain Score</div>
        </div>
      </td>
      <td style="width:33%;text-align:center;padding:8px 4px;">
        <div style="background:rgba(45,212,191,0.06);border:1px solid rgba(45,212,191,0.1);border-radius:14px;padding:16px 8px;">
          <div style="font-size:26px;font-weight:800;color:#2dd4bf;">${streakDays}</div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;font-weight:500;">Day Streak</div>
        </div>
      </td>
    </tr>
  </table>
</td></tr>

<!-- Due Topics -->
${dueTopicsCount > 0 ? `
<tr><td style="padding:0 32px 20px;">
  <div style="background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.15);border-radius:14px;padding:18px;">
    <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#fbbf24;">⚠️ ${dueTopicsCount} Topic${dueTopicsCount > 1 ? "s" : ""} Need Revision Today</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(0,0,0,0.2);border-radius:10px;overflow:hidden;">
      ${topicList}
      ${dueTopicsCount > 5 ? `<tr><td colspan="2" style="padding:10px 14px;font-size:12px;color:#64748b;text-align:center;">...and ${dueTopicsCount - 5} more topics</td></tr>` : ""}
    </table>
  </div>
</td></tr>
` : `
<tr><td style="padding:0 32px 20px;">
  <div style="background:rgba(52,211,153,0.06);border:1px solid rgba(52,211,153,0.15);border-radius:14px;padding:18px;text-align:center;">
    <p style="margin:0;font-size:14px;font-weight:600;color:#34d399;">✅ All caught up! No topics due for revision.</p>
  </div>
</td></tr>
`}

<!-- Quick Actions -->
<tr><td style="padding:0 32px 20px;">
  <p style="font-size:13px;font-weight:700;color:#e2e8f0;margin:0 0 10px;">⚡ Quick Actions</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>${actionCards}</tr>
  </table>
</td></tr>

<!-- CTA Button -->
<tr><td style="padding:0 32px 28px;text-align:center;">
  <a href="https://acry.ai/app" style="background:linear-gradient(135deg,#0d9488,#0f766e);color:#fff;padding:16px 48px;border-radius:14px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;box-shadow:0 4px 20px rgba(13,148,136,0.4),0 0 40px rgba(13,148,136,0.15);letter-spacing:0.3px;border:1px solid rgba(167,243,208,0.2);">Open ACRY & Start Studying →</a>
</td></tr>

<!-- Daily Tip -->
<tr><td style="padding:0 32px 28px;">
  <div style="background:rgba(129,140,248,0.06);border-radius:14px;padding:18px;border:1px solid rgba(129,140,248,0.12);">
    <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#818cf8;">💡 AI Tip of the Day</p>
    <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">${tip}</p>
  </div>
</td></tr>

${rank ? `
<tr><td style="padding:0 32px 24px;text-align:center;">
  <p style="font-size:13px;color:#64748b;margin:0;">Your current rank: <strong style="color:#818cf8;">#${rank}</strong> — keep studying to climb higher!</p>
</td></tr>
` : ""}

<!-- Footer -->
<tr><td style="background:rgba(10,22,40,0.6);padding:24px 32px;text-align:center;border-top:1px solid rgba(45,212,191,0.1);">
  <p style="color:#475569;font-size:12px;margin:0 0 10px;font-weight:500;">© ${year} ACRY · AI Second Brain for All Exams</p>
  <p style="margin:0;">
    <a href="https://acry.ai" style="color:#0d9488;font-size:11px;text-decoration:none;font-weight:600;margin:0 10px;">Website</a>
    <a href="https://acry.ai/support" style="color:#0d9488;font-size:11px;text-decoration:none;font-weight:600;margin:0 10px;">Support</a>
    <a href="https://yvxrsujwgmzdjzsjyqfb.supabase.co/functions/v1/email-unsubscribe?uid=${userId}&type=daily_brand" style="color:#475569;font-size:11px;text-decoration:underline;margin:0 10px;">Unsubscribe</a>
  </p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

const DAILY_TIPS = [
  "Studying for just 10 minutes a day can improve long-term retention by 40%. Consistency beats intensity!",
  "Your brain consolidates memories during sleep. Review tough topics before bed for better recall.",
  "The forgetting curve shows you lose 70% within 24 hours without review. ACRY tracks this for you automatically.",
  "Active recall (testing yourself) is 3x more effective than passive reading. Use ACRY's exam simulator!",
  "Spaced repetition is proven to be the most efficient learning method. Trust your ACRY schedule!",
  "Take a 5-minute break every 25 minutes to maintain peak cognitive performance.",
  "Teaching someone else what you learned reinforces your memory. Share insights in the ACRY community!",
  "Your brain processes visual information 60,000x faster than text. Use diagrams and mind maps alongside studying.",
  "Exercise before studying increases BDNF, a protein that improves memory and learning.",
  "Interleaving different topics in one session improves your ability to distinguish and apply concepts.",
  "The testing effect: simply taking a quiz strengthens your memory more than re-reading the material.",
  "Your memory is strongest in the morning. Schedule your hardest topics during peak hours.",
  "Elaborative interrogation — asking 'why?' and 'how?' — deepens understanding by 50%.",
  "Chunking information into groups of 3-5 items makes it easier to remember complex material.",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if daily_brand trigger is enabled
    const { data: trigger } = await adminClient
      .from("email_triggers")
      .select("is_enabled")
      .eq("trigger_key", "daily_brand_reminder")
      .maybeSingle();

    if (trigger && !trigger.is_enabled) {
      return new Response(JSON.stringify({ skipped: true, reason: "daily_brand_reminder trigger disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all users with profiles
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, display_name, email_notifications, email_study_reminders")
      .limit(5000);

    if (!profiles?.length) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const hour = now.getUTCHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    const tip = DAILY_TIPS[Math.floor(Math.random() * DAILY_TIPS.length)];

    let sent = 0;
    let skipped = 0;

    for (const profile of profiles) {
      // Skip if notifications disabled
      if (profile.email_notifications === false || profile.email_study_reminders === false) {
        skipped++;
        continue;
      }

      // Check cooldown — skip if already sent today
      const { data: recentLog } = await adminClient
        .from("email_logs")
        .select("id")
        .eq("user_id", profile.id)
        .eq("trigger_key", "daily_brand_reminder")
        .gte("created_at", todayStr)
        .limit(1)
        .maybeSingle();

      if (recentLog) { skipped++; continue; }

      // Get user email
      const { data: { user } } = await adminClient.auth.admin.getUserById(profile.id);
      if (!user?.email) { skipped++; continue; }

      // Gather user data
      const [topicsRes, streakRes, studyRes, rankRes] = await Promise.all([
        adminClient.from("topics").select("name, next_predicted_drop_date, memory_strength")
          .eq("user_id", profile.id).lte("next_predicted_drop_date", now.toISOString()).gt("memory_strength", 0),
        adminClient.from("study_streaks").select("current_streak").eq("user_id", profile.id).maybeSingle(),
        adminClient.from("study_logs").select("duration_minutes").eq("user_id", profile.id).gte("created_at", todayStr),
        adminClient.from("leaderboard_entries").select("rank").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      const dueTopics = topicsRes.data || [];
      const streakDays = streakRes.data?.current_streak || 0;
      const studyMinutesToday = (studyRes.data || []).reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0);

      // Compute average memory strength
      const { data: allTopics } = await adminClient.from("topics").select("memory_strength").eq("user_id", profile.id);
      const memoryStrength = allTopics?.length
        ? Math.round(allTopics.reduce((s: number, t: any) => s + (t.memory_strength || 0), 0) / allTopics.length)
        : 50;

      // Brain score (from cognitive twin)
      const { data: twin } = await adminClient.from("cognitive_twins").select("brain_evolution_score")
        .eq("user_id", profile.id).order("computed_at", { ascending: false }).limit(1).maybeSingle();
      const brainScore = Math.round(twin?.brain_evolution_score || 50);

      const userName = profile.display_name || user.email.split("@")[0];
      const subject = dueTopics.length > 0
        ? `📚 ${userName}, ${dueTopics.length} topic${dueTopics.length > 1 ? "s" : ""} need you today!`
        : `☀️ Good ${hour < 12 ? "morning" : "day"}, ${userName}! Your ACRY daily briefing`;

      const html = buildDailyEmail({
        userName,
        userId: profile.id,
        streakDays,
        dueTopicsCount: dueTopics.length,
        dueTopicNames: dueTopics.map((t: any) => t.name),
        memoryStrength,
        brainScore,
        studyMinutesToday,
        rank: rankRes.data?.rank || null,
        tip,
        greeting,
      });

      // Send via Resend
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "ACRY <onboarding@resend.dev>",
          to: [user.email],
          subject,
          html,
        }),
      });

      if (res.ok) {
        sent++;
        // Log
        await adminClient.from("email_logs").insert({
          user_id: profile.id,
          trigger_key: "daily_brand_reminder",
          to_email: user.email,
          subject,
          status: "sent",
          metadata: { streak: streakDays, due_topics: dueTopics.length, memory: memoryStrength },
        });
        // Track Resend usage
        adminClient.rpc("increment_api_usage", { p_service_name: "resend" }).then(() => {}).catch(() => {});
      } else {
        const errText = await res.text();
        console.error(`Daily email failed for ${user.email}:`, errText);
        await adminClient.from("email_logs").insert({
          user_id: profile.id,
          trigger_key: "daily_brand_reminder",
          to_email: user.email,
          subject,
          status: "failed",
          error_message: errText,
        });
      }
    }

    console.log(`Daily brand emails: ${sent} sent, ${skipped} skipped`);
    return new Response(JSON.stringify({ success: true, sent, skipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("daily-brand-email error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
