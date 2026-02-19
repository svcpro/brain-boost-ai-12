import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const LABELS: Record<string, string> = {
  all: "all emails",
  reminders: "study reminder emails",
  reports: "weekly report emails",
  expiry: "subscription expiry emails",
};

serve(async (req) => {
  const url = new URL(req.url);
  const userId = url.searchParams.get("uid");
  const type = url.searchParams.get("type");
  const action = url.searchParams.get("action") || "unsubscribe";

  if (!userId || !type || !LABELS[type]) {
    return new Response(renderPage("Invalid Link", "This link is invalid or expired.", ""), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const isResub = action === "resubscribe";

  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const updates: Record<string, boolean> = {};
    const value = isResub;
    if (type === "all" || type === "expiry") updates.email_notifications_enabled = value;
    if (type === "all" || type === "reminders") updates.email_study_reminders = value;
    if (type === "all" || type === "reports") updates.email_weekly_reports = value;

    const { error } = await adminClient
      .from("profiles")
      .update(updates)
      .eq("id", userId);

    if (error) throw error;

    const baseUrl = url.origin + url.pathname;

    if (isResub) {
      const undoLink = `${baseUrl}?uid=${userId}&type=${type}&action=unsubscribe`;
      return new Response(
        renderPage(
          "Re-subscribed! ✅",
          `You're now receiving <strong>${LABELS[type]}</strong> again.`,
          `<a href="${undoLink}" class="link">Changed your mind? Unsubscribe again</a>`
        ),
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    } else {
      const resubLink = `${baseUrl}?uid=${userId}&type=${type}&action=resubscribe`;
      return new Response(
        renderPage(
          "Unsubscribed",
          `You've been unsubscribed from <strong>${LABELS[type]}</strong>.`,
          `<a href="${resubLink}" class="btn">Undo – Re-subscribe</a><p class="hint">You can also re-enable notifications from your ACRY app settings.</p>`
        ),
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }
  } catch (err) {
    console.error("Email preference error:", err);
    return new Response(renderPage("Error", "Something went wrong. Please try again or update your preferences in the app.", ""), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
});

function renderPage(title: string, message: string, extra: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} – ACRY</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Roboto, sans-serif; background: #f8fffe; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 16px; }
    .card { max-width: 440px; width: 100%; background: white; border-radius: 16px; border: 1px solid #e0f2f1; overflow: hidden; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
    .header { background: linear-gradient(135deg, #0d9488, #065f46); padding: 28px; }
    .header h1 { color: #fff; margin: 0; font-size: 26px; font-weight: 800; }
    .body { padding: 32px 28px; }
    .body h2 { color: #0f172a; margin: 0 0 12px; font-size: 20px; }
    .body p { color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
    .btn { display: inline-block; background: linear-gradient(135deg, #0d9488, #065f46); color: white !important; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px; margin-top: 8px; box-shadow: 0 4px 14px rgba(13,148,136,0.3); transition: transform 0.15s; }
    .btn:hover { transform: translateY(-1px); }
    .link { color: #0d9488; text-decoration: underline; font-size: 14px; }
    .hint { color: #94a3b8; font-size: 13px; margin-top: 16px !important; }
    .footer { background: #f1f5f9; padding: 16px; border-top: 1px solid #e2e8f0; }
    .footer p { color: #94a3b8; font-size: 12px; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header"><h1>ACRY</h1></div>
    <div class="body">
      <h2>${title}</h2>
      <p>${message}</p>
      ${extra}
    </div>
    <div class="footer"><p>© ${new Date().getFullYear()} ACRY · Smart Study Companion</p></div>
  </div>
</body>
</html>`;
}
