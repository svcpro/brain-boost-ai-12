import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const META_GRAPH_URL = "https://graph.facebook.com/v21.0";

function buildMetaComponents(template: any) {
  const components: any[] = [];

  // Header
  if (template.header_type && template.header_type !== "NONE") {
    const header: any = { type: "HEADER", format: template.header_type };
    if (template.header_type === "TEXT") {
      header.text = template.header_content || "";
      const headerVars = header.text.match(/\{\{\d+\}\}/g);
      if (headerVars) {
        header.example = { header_text: headerVars.map(() => "Sample") };
      }
    } else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(template.header_type)) {
      header.example = { header_handle: [template.header_content || ""] };
    }
    components.push(header);
  }

  // Body
  const body: any = { type: "BODY", text: template.body_text };
  const bodyVars = template.body_text.match(/\{\{\d+\}\}/g);
  if (bodyVars) {
    const samples = template.sample_values || {};
    const exampleTexts = bodyVars.map((_: string, i: number) => {
      const key = `{{${i + 1}}}`;
      return samples[key] || `sample_${i + 1}`;
    });
    body.example = { body_text: [exampleTexts] };
  }
  components.push(body);

  // Footer
  if (template.footer_text) {
    components.push({ type: "FOOTER", text: template.footer_text });
  }

  // Buttons
  if (template.buttons && template.buttons.length > 0) {
    const buttons = template.buttons.map((btn: any) => {
      if (btn.type === "QUICK_REPLY") {
        return { type: "QUICK_REPLY", text: btn.text };
      } else if (btn.type === "URL" || btn.type === "CALL_TO_ACTION") {
        if (btn.phone) {
          return { type: "PHONE_NUMBER", text: btn.text, phone_number: btn.phone };
        }
        return { type: "URL", text: btn.text, url: btn.url || "https://example.com" };
      }
      return { type: "QUICK_REPLY", text: btn.text };
    });
    components.push({ type: "BUTTONS", buttons });
  }

  return components;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const WABA_ID = Deno.env.get("META_WHATSAPP_BUSINESS_ACCOUNT_ID");
    const ACCESS_TOKEN = Deno.env.get("META_WHATSAPP_ACCESS_TOKEN");
    if (!WABA_ID || !ACCESS_TOKEN) {
      throw new Error("META_WHATSAPP_BUSINESS_ACCOUNT_ID or META_WHATSAPP_ACCESS_TOKEN not configured");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, template_id, template_data } = await req.json();

    // ─── CREATE TEMPLATE ───
    if (action === "create_template") {
      const template = template_data;
      const components = buildMetaComponents(template);

      const metaPayload = {
        name: template.template_name,
        language: template.language || "en",
        category: template.category || "UTILITY",
        components,
      };

      console.log("Submitting to META:", JSON.stringify(metaPayload, null, 2));

      const metaRes = await fetch(`${META_GRAPH_URL}/${WABA_ID}/message_templates`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metaPayload),
      });

      const metaData = await metaRes.json();
      console.log("META response:", JSON.stringify(metaData));

      if (!metaRes.ok) {
        const errMsg = metaData.error?.message || metaData.error?.error_user_msg || JSON.stringify(metaData);
        // Update DB with rejection
        if (template_id) {
          await supabaseAdmin.from("meta_template_submissions").update({
            meta_status: "rejected",
            rejection_reason: errMsg,
            rejected_at: new Date().toISOString(),
          }).eq("id", template_id);
        }
        throw new Error(`META API Error: ${errMsg}`);
      }

      // Update DB with success
      if (template_id) {
        await supabaseAdmin.from("meta_template_submissions").update({
          meta_status: metaData.status || "submitted",
          meta_template_id: metaData.id,
          submitted_at: new Date().toISOString(),
          rejection_reason: null,
          last_synced_at: new Date().toISOString(),
        }).eq("id", template_id);
      }

      return new Response(JSON.stringify({
        success: true,
        meta_template_id: metaData.id,
        status: metaData.status,
        category: metaData.category,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── GET ALL TEMPLATES ───
    if (action === "get_templates") {
      const metaRes = await fetch(
        `${META_GRAPH_URL}/${WABA_ID}/message_templates?limit=100&fields=name,status,category,language,components,quality_score,id`,
        { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }
      );
      const metaData = await metaRes.json();
      if (!metaRes.ok) {
        throw new Error(`META API Error: ${metaData.error?.message || JSON.stringify(metaData)}`);
      }

      return new Response(JSON.stringify({
        success: true,
        templates: metaData.data || [],
        paging: metaData.paging,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── GET SINGLE TEMPLATE ───
    if (action === "get_template") {
      const { meta_template_id } = await req.json().catch(() => ({ meta_template_id: template_id }));
      const tid = meta_template_id || template_id;
      const metaRes = await fetch(
        `${META_GRAPH_URL}/${tid}?fields=name,status,category,language,components,quality_score`,
        { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }
      );
      const metaData = await metaRes.json();
      if (!metaRes.ok) {
        throw new Error(`META API Error: ${metaData.error?.message || JSON.stringify(metaData)}`);
      }

      return new Response(JSON.stringify({ success: true, template: metaData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── DELETE TEMPLATE ───
    if (action === "delete_template") {
      const { template_name } = template_data || {};
      if (!template_name) throw new Error("template_name required for deletion");

      const metaRes = await fetch(
        `${META_GRAPH_URL}/${WABA_ID}/message_templates?name=${encodeURIComponent(template_name)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
        }
      );
      const metaData = await metaRes.json();

      if (!metaRes.ok) {
        throw new Error(`META API Error: ${metaData.error?.message || JSON.stringify(metaData)}`);
      }

      // Update local DB
      if (template_id) {
        await supabaseAdmin.from("meta_template_submissions").update({
          meta_status: "disabled",
          last_synced_at: new Date().toISOString(),
        }).eq("id", template_id);
      }

      return new Response(JSON.stringify({ success: true, deleted: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── SYNC STATUS ───
    if (action === "sync_status") {
      // Fetch all templates from Meta
      const metaRes = await fetch(
        `${META_GRAPH_URL}/${WABA_ID}/message_templates?limit=250&fields=name,status,category,language,quality_score,id`,
        { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }
      );
      const metaData = await metaRes.json();
      if (!metaRes.ok) {
        throw new Error(`META API Error: ${metaData.error?.message || JSON.stringify(metaData)}`);
      }

      const metaTemplates = metaData.data || [];
      const { data: localTemplates } = await supabaseAdmin
        .from("meta_template_submissions")
        .select("id, template_name, meta_template_id, meta_status");

      let synced = 0;
      for (const local of (localTemplates || [])) {
        const metaMatch = metaTemplates.find((m: any) =>
          m.id === local.meta_template_id || m.name === local.template_name
        );

        if (metaMatch) {
          const statusMap: Record<string, string> = {
            APPROVED: "approved",
            PENDING: "submitted",
            REJECTED: "rejected",
            PAUSED: "paused",
            DISABLED: "disabled",
            IN_APPEAL: "in_appeal",
          };
          const newStatus = statusMap[metaMatch.status] || metaMatch.status.toLowerCase();
          const updates: any = {
            meta_status: newStatus,
            meta_template_id: metaMatch.id,
            quality_score: metaMatch.quality_score?.score || null,
            last_synced_at: new Date().toISOString(),
          };
          if (newStatus === "approved" && local.meta_status !== "approved") {
            updates.approved_at = new Date().toISOString();
          }
          if (newStatus === "rejected" && local.meta_status !== "rejected") {
            updates.rejected_at = new Date().toISOString();
          }

          await supabaseAdmin.from("meta_template_submissions")
            .update(updates).eq("id", local.id);
          synced++;
        }
      }

      return new Response(JSON.stringify({
        success: true,
        synced,
        meta_total: metaTemplates.length,
        local_total: localTemplates?.length || 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── EDIT/UPDATE TEMPLATE ───
    if (action === "edit_template") {
      // Meta doesn't allow editing — must delete and recreate
      const template = template_data;
      
      // Step 1: Delete existing
      const delRes = await fetch(
        `${META_GRAPH_URL}/${WABA_ID}/message_templates?name=${encodeURIComponent(template.template_name)}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }
      );
      if (!delRes.ok) {
        const delData = await delRes.json();
        console.warn("Delete before edit failed:", delData);
      }

      // Step 2: Recreate
      const components = buildMetaComponents(template);
      const metaPayload = {
        name: template.template_name,
        language: template.language || "en",
        category: template.category || "UTILITY",
        components,
      };

      const createRes = await fetch(`${META_GRAPH_URL}/${WABA_ID}/message_templates`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metaPayload),
      });
      const createData = await createRes.json();

      if (!createRes.ok) {
        throw new Error(`META API Error: ${createData.error?.message || JSON.stringify(createData)}`);
      }

      if (template_id) {
        await supabaseAdmin.from("meta_template_submissions").update({
          meta_status: createData.status || "submitted",
          meta_template_id: createData.id,
          submitted_at: new Date().toISOString(),
          rejection_reason: null,
          last_synced_at: new Date().toISOString(),
        }).eq("id", template_id);
      }

      return new Response(JSON.stringify({
        success: true,
        meta_template_id: createData.id,
        status: createData.status,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error("Invalid action. Use: create_template, get_templates, get_template, delete_template, sync_status, edit_template");
  } catch (e) {
    console.error("meta-whatsapp-templates error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
