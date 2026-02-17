import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TWILIO_CONTENT_URL = "https://content.twilio.com/v1/Content";

function buildTwilioContentTypes(template: any) {
  const body = template.body_text || "";
  const variables: Record<string, string> = {};
  const varMatches = body.match(/\{\{(\d+)\}\}/g) || [];
  const samples = template.sample_values || {};
  varMatches.forEach((v: string, i: number) => {
    variables[String(i + 1)] = samples[v] || `sample_${i + 1}`;
  });

  // Build the appropriate twilio content type
  const hasButtons = template.buttons && template.buttons.length > 0;
  const buttonType = template.button_type;

  if (buttonType === "CALL_TO_ACTION" && hasButtons) {
    // Use twilio/call-to-action type
    const actions = template.buttons.map((btn: any) => {
      if (btn.phone) {
        return { type: "PHONE_NUMBER", title: btn.text, phone: btn.phone };
      }
      return { type: "URL", title: btn.text, url: btn.url || "https://example.com" };
    });
    return {
      types: {
        "twilio/call-to-action": {
          body,
          actions,
        },
      },
      variables: Object.keys(variables).length > 0 ? variables : undefined,
    };
  }

  if (buttonType === "QUICK_REPLY" && hasButtons) {
    const actions = template.buttons.map((btn: any) => ({
      type: "QUICK_REPLY",
      title: btn.text,
      id: btn.text.toLowerCase().replace(/\s+/g, "_"),
    }));
    return {
      types: {
        "twilio/quick-reply": {
          body,
          actions,
        },
      },
      variables: Object.keys(variables).length > 0 ? variables : undefined,
    };
  }

  // Default: text-only
  return {
    types: {
      "twilio/text": { body },
    },
    variables: Object.keys(variables).length > 0 ? variables : undefined,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (!ACCOUNT_SID || !AUTH_TOKEN) {
      throw new Error("TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not configured");
    }

    const authHeader = `Basic ${btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`)}`;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, template_id, template_data } = await req.json();

    // ─── CREATE TEMPLATE ───
    if (action === "create_template") {
      const template = template_data;
      const contentPayload = buildTwilioContentTypes(template);

      const twilioPayload = {
        friendly_name: template.display_name || template.template_name,
        language: template.language || "en",
        ...contentPayload,
      };

      console.log("Submitting to Twilio Content API:", JSON.stringify(twilioPayload, null, 2));

      const res = await fetch(TWILIO_CONTENT_URL, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(twilioPayload),
      });

      const data = await res.json();
      console.log("Twilio Content API response:", JSON.stringify(data));

      if (!res.ok) {
        const errMsg = data.message || data.detail || JSON.stringify(data);
        if (template_id) {
          await supabaseAdmin.from("meta_template_submissions").update({
            meta_status: "rejected",
            rejection_reason: `Twilio Error: ${errMsg}`,
            rejected_at: new Date().toISOString(),
          }).eq("id", template_id);
        }
        throw new Error(`Twilio API Error: ${errMsg}`);
      }

      const contentSid = data.sid;

      // Update DB with content SID
      if (template_id) {
        await supabaseAdmin.from("meta_template_submissions").update({
          meta_status: "draft",
          meta_template_id: contentSid,
          last_synced_at: new Date().toISOString(),
        }).eq("id", template_id);
      }

      return new Response(JSON.stringify({
        success: true,
        content_sid: contentSid,
        status: "created",
        message: "Template created in Twilio. Use 'submit_for_approval' to submit for WhatsApp approval.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── SUBMIT FOR WHATSAPP APPROVAL ───
    if (action === "submit_for_approval") {
      const contentSid = template_data?.content_sid || template_id;
      if (!contentSid) throw new Error("content_sid required for approval submission");

      const template = template_data || {};
      const category = template.category || "UTILITY";

      // Map our categories to Twilio's approval categories
      const categoryMap: Record<string, string> = {
        UTILITY: "UTILITY",
        MARKETING: "MARKETING",
        AUTHENTICATION: "AUTHENTICATION",
      };

      const approvalPayload = {
        name: template.template_name || `template_${Date.now()}`,
        category: categoryMap[category] || "UTILITY",
      };

      console.log("Submitting for WhatsApp approval:", JSON.stringify(approvalPayload));

      const res = await fetch(`${TWILIO_CONTENT_URL}/${contentSid}/ApprovalRequests/whatsapp`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(approvalPayload),
      });

      const data = await res.json();
      console.log("Twilio Approval response:", JSON.stringify(data));

      if (!res.ok) {
        const errMsg = data.message || data.detail || JSON.stringify(data);
        if (template_id) {
          await supabaseAdmin.from("meta_template_submissions").update({
            meta_status: "rejected",
            rejection_reason: `Twilio Approval Error: ${errMsg}`,
            rejected_at: new Date().toISOString(),
          }).eq("id", template_id);
        }
        throw new Error(`Twilio Approval Error: ${errMsg}`);
      }

      // Update DB with submitted status
      if (template_id) {
        await supabaseAdmin.from("meta_template_submissions").update({
          meta_status: "submitted",
          submitted_at: new Date().toISOString(),
          rejection_reason: null,
          last_synced_at: new Date().toISOString(),
        }).eq("id", template_id);
      }

      return new Response(JSON.stringify({
        success: true,
        status: data.whatsapp?.status || "pending",
        rejection_reason: data.whatsapp?.rejection_reason || null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── CREATE AND SUBMIT (combined) ───
    if (action === "create_and_submit") {
      const template = template_data;
      const contentPayload = buildTwilioContentTypes(template);

      // Step 1: Create content
      const createRes = await fetch(TWILIO_CONTENT_URL, {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          friendly_name: template.display_name || template.template_name,
          language: template.language || "en",
          ...contentPayload,
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        const errMsg = createData.message || createData.detail || JSON.stringify(createData);
        if (template_id) {
          await supabaseAdmin.from("meta_template_submissions").update({
            meta_status: "rejected", rejection_reason: `Twilio Create Error: ${errMsg}`,
            rejected_at: new Date().toISOString(),
          }).eq("id", template_id);
        }
        throw new Error(`Twilio Create Error: ${errMsg}`);
      }

      const contentSid = createData.sid;

      // Step 2: Submit for approval
      const categoryMap: Record<string, string> = { UTILITY: "UTILITY", MARKETING: "MARKETING", AUTHENTICATION: "AUTHENTICATION" };
      const approvalRes = await fetch(`${TWILIO_CONTENT_URL}/${contentSid}/ApprovalRequests/whatsapp`, {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: template.template_name || `template_${Date.now()}`,
          category: categoryMap[template.category] || "UTILITY",
        }),
      });

      const approvalData = await approvalRes.json();
      const finalStatus = approvalRes.ok ? "submitted" : "draft";

      if (template_id) {
        await supabaseAdmin.from("meta_template_submissions").update({
          meta_status: finalStatus,
          meta_template_id: contentSid,
          submitted_at: approvalRes.ok ? new Date().toISOString() : null,
          rejection_reason: !approvalRes.ok ? (approvalData.message || "Approval submission failed") : null,
          last_synced_at: new Date().toISOString(),
        }).eq("id", template_id);
      }

      return new Response(JSON.stringify({
        success: true,
        content_sid: contentSid,
        status: approvalRes.ok ? (approvalData.whatsapp?.status || "pending") : "created_not_submitted",
        approval_error: !approvalRes.ok ? (approvalData.message || "Approval failed") : null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── GET ALL TEMPLATES ───
    if (action === "get_templates") {
      const res = await fetch(TWILIO_CONTENT_URL, {
        headers: { Authorization: authHeader },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`Twilio API Error: ${data.message || JSON.stringify(data)}`);

      return new Response(JSON.stringify({
        success: true,
        templates: data.contents || [],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── CHECK APPROVAL STATUS ───
    if (action === "check_approval") {
      const contentSid = template_data?.content_sid || template_id;
      if (!contentSid) throw new Error("content_sid required");

      const res = await fetch(`${TWILIO_CONTENT_URL}/${contentSid}/ApprovalRequests`, {
        headers: { Authorization: authHeader },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`Twilio API Error: ${data.message || JSON.stringify(data)}`);

      return new Response(JSON.stringify({
        success: true,
        approval: data,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── SYNC STATUS ───
    if (action === "sync_status") {
      const { data: localTemplates } = await supabaseAdmin
        .from("meta_template_submissions")
        .select("id, template_name, meta_template_id, meta_status");

      let synced = 0;
      for (const local of (localTemplates || [])) {
        if (!local.meta_template_id) continue;

        try {
          const res = await fetch(`${TWILIO_CONTENT_URL}/${local.meta_template_id}/ApprovalRequests`, {
            headers: { Authorization: authHeader },
          });

          if (!res.ok) continue;
          const data = await res.json();
          const whatsappStatus = data.whatsapp?.status;

          if (whatsappStatus) {
            const statusMap: Record<string, string> = {
              approved: "approved",
              pending: "submitted",
              rejected: "rejected",
              unsubmitted: "draft",
            };
            const newStatus = statusMap[whatsappStatus] || whatsappStatus;
            const updates: any = {
              meta_status: newStatus,
              last_synced_at: new Date().toISOString(),
            };
            if (newStatus === "approved" && local.meta_status !== "approved") {
              updates.approved_at = new Date().toISOString();
            }
            if (newStatus === "rejected" && local.meta_status !== "rejected") {
              updates.rejected_at = new Date().toISOString();
              updates.rejection_reason = data.whatsapp?.rejection_reason || null;
            }

            await supabaseAdmin.from("meta_template_submissions").update(updates).eq("id", local.id);
            synced++;
          }
        } catch (e) {
          console.warn(`Failed to sync ${local.template_name}:`, e);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        synced,
        local_total: localTemplates?.length || 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── DELETE TEMPLATE ───
    if (action === "delete_template") {
      const contentSid = template_data?.content_sid || template_id;
      if (!contentSid) throw new Error("content_sid required");

      const res = await fetch(`${TWILIO_CONTENT_URL}/${contentSid}`, {
        method: "DELETE",
        headers: { Authorization: authHeader },
      });

      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => ({}));
        throw new Error(`Twilio Delete Error: ${data.message || res.statusText}`);
      }

      if (template_id) {
        await supabaseAdmin.from("meta_template_submissions").update({
          meta_status: "disabled",
          last_synced_at: new Date().toISOString(),
        }).eq("id", template_id);
      }

      return new Response(JSON.stringify({ success: true, deleted: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error("Invalid action. Use: create_template, submit_for_approval, create_and_submit, get_templates, check_approval, sync_status, delete_template");
  } catch (e) {
    console.error("twilio-whatsapp-templates error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
