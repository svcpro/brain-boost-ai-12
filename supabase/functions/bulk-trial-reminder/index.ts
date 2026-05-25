// bulk-trial-reminder — admin one-click bulk trial-end reminder
// Dispatches to both WhatsApp (via whatsapp-notify) and SMS (via sms-event-engine).
// Input: { user_ids: string[] }
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verify caller is an admin
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "unauthorized" }, 401);
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "unauthorized" }, 401);
    const { data: isAdmin } = await sb.rpc("is_admin", { _user_id: userData.user.id });
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const user_ids: string[] = Array.isArray(body.user_ids) ? body.user_ids : [];
    const channel: "whatsapp" | "sms" | "both" = body.channel === "whatsapp" || body.channel === "sms" ? body.channel : "both";
    if (user_ids.length === 0) return json({ error: "user_ids required" }, 400);

    const renewUrl = "https://acry.ai";

    // Fetch user profile + subscription info for personalization
    const [{ data: profiles }, { data: subs }] = await Promise.all([
      sb.from("profiles").select("id, display_name, email, phone, whatsapp_number").in("id", user_ids),
      sb
        .from("user_subscriptions")
        .select("user_id, trial_end_date, expires_at, plan_id, is_trial, status")
        .in("user_id", user_ids),
    ]);

    const subByUser = new Map<string, any>();
    for (const s of subs || []) subByUser.set(s.user_id, s);

    let waSent = 0,
      waFail = 0,
      smsSent = 0,
      smsFail = 0;

    await Promise.all(
      (profiles || []).map(async (p: any) => {
        const sub = subByUser.get(p.id);
        const end = sub?.trial_end_date || sub?.expires_at;
        const diffDays = end
          ? Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / 86400000))
          : 0;
        const name = (p.display_name?.split(" ")?.[0]) || "there";
        const expiryDate = end ? new Date(end).toISOString().slice(0, 10) : "";

        // WhatsApp: MSG91 Meta-approved `trial_end` template (direct)
        if (channel === "whatsapp" || channel === "both") {
          const waPhone = p.whatsapp_number || p.phone;
          const mobile = waPhone ? String(waPhone).replace(/\D/g, "") : "";
          const normalized = /^\d{10}$/.test(mobile)
            ? `91${mobile}`
            : /^91\d{10}$/.test(mobile)
              ? mobile
              : mobile && /^\d{11,15}$/.test(mobile)
                ? mobile
                : "";
          if (normalized && Deno.env.get("MSG91_AUTH_KEY")) {
            try {
              const payload = {
                integrated_number: "15558451483",
                content_type: "template",
                payload: {
                  messaging_product: "whatsapp",
                  type: "template",
                  template: {
                    name: "trial_end",
                    language: { code: "en", policy: "deterministic" },
                    namespace: "27d18aad_0bc9_491c_ab4e_90e36bbe4c99",
                    to_and_components: [
                      {
                        to: [normalized],
                        components: {
                          body_1: { type: "text", value: name },
                          body_2: { type: "text", value: String(diffDays) },
                        },
                      },
                    ],
                  },
                },
              };
              const r = await fetch(
                "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json", authkey: Deno.env.get("MSG91_AUTH_KEY")! },
                  body: JSON.stringify(payload),
                },
              );
              const txt = await r.text();
              let raw: any; try { raw = JSON.parse(txt); } catch { raw = { message: txt.slice(0, 500) }; }
              const ok = r.ok && raw?.type !== "error" && raw?.status !== "error";
              console.log(`[wa] to=${normalized} http=${r.status} ok=${ok} resp=${JSON.stringify(raw).slice(0, 400)}`);
              await sb.from("whatsapp_messages").insert({
                user_id: p.id,
                to_number: normalized,
                message_type: "template",
                template_name: "trial_end",
                template_params: { customer_name: name, days: diffDays },
                content: `Trial ending in ${diffDays} days`,
                status: ok ? "sent" : "failed",
                error_code: ok ? null : String(r.status),
                error_message: `[http ${r.status}] ${JSON.stringify(raw).slice(0, 800)}`,
                direction: "outbound",
                category: "critical",
              });
              if (ok) waSent++; else waFail++;
            } catch (err) {
              console.error("[wa] exception", err);
              waFail++;
            }
          } else {
            waFail++;
          }
        }

        // SMS: MSG91 DLT template via registry
        if (channel === "sms" || channel === "both") {
          try {
            const r = await fetch(`${SUPABASE_URL}/functions/v1/sms-event-engine`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${SERVICE_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                event_type: "trial_ending",
                user_id: p.id,
                source: "admin_bulk_trial_reminder",
                bypass_quota: true,
                data: {
                  name,
                  days: diffDays,
                  link: renewUrl,
                  url: renewUrl,
                },
              }),
            });
            if (r.ok) smsSent++;
            else smsFail++;
          } catch {
            smsFail++;
          }
        }
      }),
    );

    // Audit log
    await sb.from("admin_audit_logs").insert(
      user_ids.map((tid) => ({
        admin_id: userData.user.id,
        action: "bulk_trial_reminder_sent",
        target_type: "user",
        target_id: tid,
        details: { channel } as any,
      })),
    );

    return json({
      ok: true,
      total: user_ids.length,
      whatsapp: { sent: waSent, failed: waFail },
      sms: { sent: smsSent, failed: smsFail },
    });
  } catch (e) {
    console.error("bulk-trial-reminder error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
