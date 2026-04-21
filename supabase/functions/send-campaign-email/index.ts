import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const { recipientIds, subject, htmlBody, campaignId } = await req.json();
    if (!recipientIds?.length || !subject) throw new Error("Missing required fields");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let sentCount = 0;
    let failedCount = 0;

    for (const userId of recipientIds) {
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(userId);
        const email = userData?.user?.email;
        if (!email) { failedCount++; continue; }

        // Fetch user profile for variable replacement
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, exam_type, exam_date, daily_study_goal_minutes")
          .eq("id", userId)
          .maybeSingle();

        // Fetch streak info
        const { data: streakLogs } = await supabase
          .from("study_logs")
          .select("created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(30);

        const streakDays = calculateStreak(streakLogs || []);

        // Fetch weakest topic
        const { data: weakTopic } = await supabase
          .from("topics")
          .select("name, memory_strength")
          .eq("user_id", userId)
          .order("memory_strength", { ascending: true })
          .limit(1)
          .maybeSingle();

        // Calculate days left to exam
        const examDate = profile?.exam_date;
        const daysLeft = examDate ? Math.max(0, Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000)) : null;

        // Replace template variables
        const vars: Record<string, string> = {
          "{{name}}": profile?.display_name || email.split("@")[0],
          "{{streak}}": String(streakDays),
          "{{topic}}": weakTopic?.name || "your weakest topic",
          "{{score}}": weakTopic ? String(Math.round(weakTopic.memory_strength * 100)) + "%" : "N/A",
          "{{exam_date}}": examDate ? new Date(examDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Not set",
          "{{days_left}}": daysLeft !== null ? String(daysLeft) : "N/A",
          "{{app_url}}": "https://acry.app",
          "{{unsubscribe_url}}": `${Deno.env.get("SUPABASE_URL")}/functions/v1/email-unsubscribe?uid=${userId}`,
        };

        let personalizedSubject = subject;
        let personalizedBody = htmlBody || "";
        for (const [key, val] of Object.entries(vars)) {
          personalizedSubject = personalizedSubject.replaceAll(key, val);
          personalizedBody = personalizedBody.replaceAll(key, val);
        }

        const baseUrl = Deno.env.get("SUPABASE_URL");
        const trackingPixel = `<img src="${baseUrl}/functions/v1/email-webhook?type=open&rid=${userId}&cid=${campaignId}" width="1" height="1" style="display:none" />`;

        const fullHtml = buildProfessionalEmail(personalizedSubject, personalizedBody, trackingPixel, vars["{{name}}"]);

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "ACRY <notifications@acry.ai>",
            to: [email],
            subject: personalizedSubject,
            html: fullHtml,
          }),
        });

        if (res.ok) {
          sentCount++;
          if (campaignId) {
            await supabase.from("campaign_recipients")
              .update({ status: "delivered", delivered_at: new Date().toISOString(), sent_at: new Date().toISOString() })
              .eq("campaign_id", campaignId)
              .eq("user_id", userId);
          }
        } else {
          const errText = await res.text();
          console.error(`Email failed for ${userId}:`, errText);
          failedCount++;
          if (campaignId) {
            await supabase.from("campaign_recipients")
              .update({ status: "failed", error_message: errText.slice(0, 200) })
              .eq("campaign_id", campaignId)
              .eq("user_id", userId);
          }
        }
      } catch (e) {
        console.error(`Error sending to ${userId}:`, e);
        failedCount++;
      }
    }

    if (campaignId) {
      await supabase.from("campaigns").update({
        delivered_count: sentCount,
        failed_count: failedCount,
      }).eq("id", campaignId);
    }

    return new Response(JSON.stringify({ sentCount, failedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-campaign-email error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function calculateStreak(logs: { created_at: string }[]): number {
  if (!logs.length) return 0;
  const dates = [...new Set(logs.map(l => l.created_at.slice(0, 10)))].sort().reverse();
  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  let expected = today;
  for (const d of dates) {
    if (d === expected || (streak === 0 && d === getPrevDay(today))) {
      streak++;
      expected = getPrevDay(d);
    } else break;
  }
  return streak;
}

function getPrevDay(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function buildProfessionalEmail(subject: string, bodyContent: string, trackingPixel: string, userName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f0fdf4;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0d9488 0%,#059669 50%,#047857 100%);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <div style="display:inline-block;background:rgba(255,255,255,0.2);border-radius:12px;padding:8px 16px;margin-bottom:16px;">
                <span style="font-size:28px;">🧠</span>
              </div>
            </td></tr>
            <tr><td align="center">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">ACRY Brain</h1>
              <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.8);font-weight:500;">AI-Powered Study Companion</p>
            </td></tr>
          </table>
        </td></tr>
        
        <!-- Greeting bar -->
        <tr><td style="background-color:#ffffff;padding:24px 40px 0;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
          <p style="margin:0;font-size:15px;color:#6b7280;">Hi <strong style="color:#0d9488;">${userName}</strong> 👋</p>
        </td></tr>

        <!-- Subject -->
        <tr><td style="background-color:#ffffff;padding:16px 40px 0;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
          <h2 style="margin:0;font-size:20px;font-weight:700;color:#111827;line-height:1.4;">${subject}</h2>
          <div style="width:48px;height:3px;background:linear-gradient(90deg,#0d9488,#10b981);border-radius:2px;margin-top:12px;"></div>
        </td></tr>

        <!-- Body content -->
        <tr><td style="background-color:#ffffff;padding:20px 40px 28px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
          <div style="font-size:15px;line-height:1.7;color:#374151;">
            ${bodyContent}
          </div>
        </td></tr>

        <!-- CTA -->
        <tr><td style="background-color:#ffffff;padding:0 40px 32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;text-align:center;">
          <a href="https://acry.app" style="display:inline-block;background:linear-gradient(135deg,#0d9488,#059669);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:10px;box-shadow:0 4px 14px rgba(13,148,136,0.35);">
            Open ACRY Brain →
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background-color:#f9fafb;border-radius:0 0 16px 16px;padding:24px 40px;border:1px solid #e5e7eb;border-top:none;text-align:center;">
          <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">
            🧠 ACRY Brain — Your AI Study Companion for NEET & JEE
          </p>
          <p style="margin:0;font-size:11px;color:#d1d5db;">
            You received this because you're an ACRY Brain user.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
  ${trackingPixel}
</body>
</html>`;
}
