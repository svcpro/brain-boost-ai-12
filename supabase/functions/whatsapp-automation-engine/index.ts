import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action } = body;

    // ─── Action: Process Queue ───
    if (action === "process_queue") {
      const now = new Date().toISOString();
      const { data: pending } = await supabase
        .from("whatsapp_queue")
        .select("*")
        .eq("status", "pending")
        .lte("scheduled_at", now)
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(50);

      if (!pending || pending.length === 0) {
        return new Response(JSON.stringify({ processed: 0, message: "No pending messages" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let sent = 0, failed = 0;
      for (const msg of pending) {
        try {
          // Mark as processing
          await supabase.from("whatsapp_queue").update({ status: "processing" }).eq("id", msg.id);

          // Send via send-whatsapp function
          const sendResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-whatsapp`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: msg.to_number,
              message: msg.message_body,
              template_name: msg.template_name || undefined,
              template_params: msg.template_params || undefined,
              media_url: msg.media_url || undefined,
              user_id: msg.user_id || undefined,
              category: msg.category || "automation",
            }),
          });

          const result = await sendResp.json();
          if (result.sent > 0) {
            await supabase.from("whatsapp_queue").update({
              status: "sent", sent_at: new Date().toISOString(),
            }).eq("id", msg.id);
            sent++;

            // Update trigger stats
            if (msg.trigger_key) {
              await supabase.rpc("increment_trigger_sent", { p_trigger_key: msg.trigger_key }).catch(() => {});
            }

            // Update cost tracking
            await supabase.from("whatsapp_cost_tracking").upsert({
              date: new Date().toISOString().split("T")[0],
              provider: "meta",
              category: msg.category || "automation",
              messages_sent: 1,
              cost_per_message: 0.0523,
              total_cost: 0.0523,
            }, { onConflict: "date,provider,category" }).catch(() => {});
          } else {
            const retryCount = (msg.retry_count || 0) + 1;
            await supabase.from("whatsapp_queue").update({
              status: retryCount >= msg.max_retries ? "failed" : "pending",
              retry_count: retryCount,
              error_message: result.results?.[0]?.error || "Send failed",
            }).eq("id", msg.id);
            failed++;
          }
        } catch (err) {
          const retryCount = (msg.retry_count || 0) + 1;
          await supabase.from("whatsapp_queue").update({
            status: retryCount >= msg.max_retries ? "failed" : "pending",
            retry_count: retryCount,
            error_message: err instanceof Error ? err.message : "Unknown error",
          }).eq("id", msg.id);
          failed++;
        }

        // Rate limit
        await new Promise(r => setTimeout(r, 200));
      }

      return new Response(JSON.stringify({ processed: pending.length, sent, failed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Action: Trigger Event ───
    if (action === "trigger_event") {
      const { trigger_key, user_id, user_ids, data: eventData = {} } = body;

      if (!trigger_key) {
        return new Response(JSON.stringify({ error: "trigger_key required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if trigger is enabled
      const { data: trigger } = await supabase
        .from("whatsapp_triggers")
        .select("*")
        .eq("trigger_key", trigger_key)
        .eq("is_enabled", true)
        .maybeSingle();

      if (!trigger) {
        return new Response(JSON.stringify({ queued: 0, reason: "trigger_disabled_or_not_found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check cooldown
      if (trigger.cooldown_minutes > 0 && trigger.last_triggered_at) {
        const lastTriggered = new Date(trigger.last_triggered_at);
        const cooldownEnd = new Date(lastTriggered.getTime() + trigger.cooldown_minutes * 60000);
        if (new Date() < cooldownEnd) {
          return new Response(JSON.stringify({ queued: 0, reason: "cooldown_active", cooldown_ends: cooldownEnd.toISOString() }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Check global kill switch
      const { data: flag } = await supabase
        .from("feature_flags")
        .select("enabled")
        .eq("flag_key", "notif_whatsapp_global")
        .maybeSingle();

      if (flag && flag.enabled === false) {
        return new Response(JSON.stringify({ queued: 0, reason: "whatsapp_globally_disabled" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Forward to whatsapp-notify for actual sending
      const notifyBody: Record<string, any> = {
        event_type: trigger_key,
        data: eventData,
      };
      if (user_ids) notifyBody.user_ids = user_ids;
      else if (user_id) notifyBody.user_id = user_id;

      const notifyResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-notify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(notifyBody),
      });

      const result = await notifyResp.json();

      // Update trigger stats
      await supabase.from("whatsapp_triggers").update({
        last_triggered_at: new Date().toISOString(),
        total_sent: (trigger.total_sent || 0) + (result.sent || 0),
        total_delivered: (trigger.total_delivered || 0) + (result.delivered || 0),
        total_failed: (trigger.total_failed || 0) + (result.failed || 0),
      }).eq("id", trigger.id);

      return new Response(JSON.stringify({
        trigger_key,
        ...result,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Action: Queue Message ───
    if (action === "queue_message") {
      const { to_number, message_body, user_id, template_name, template_params, media_url, category, trigger_key, priority, scheduled_at } = body;

      if (!to_number || !message_body) {
        return new Response(JSON.stringify({ error: "to_number and message_body required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase.from("whatsapp_queue").insert({
        to_number, message_body, user_id, template_name, template_params,
        media_url, category: category || "manual", trigger_key,
        priority: priority || "normal",
        scheduled_at: scheduled_at || new Date().toISOString(),
        status: "pending",
      }).select().single();

      if (error) throw error;

      return new Response(JSON.stringify({ queued: true, id: data.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Action: Get Queue Stats ───
    if (action === "queue_stats") {
      const [pendingRes, processingRes, sentRes, failedRes] = await Promise.all([
        supabase.from("whatsapp_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("whatsapp_queue").select("id", { count: "exact", head: true }).eq("status", "processing"),
        supabase.from("whatsapp_queue").select("id", { count: "exact", head: true }).eq("status", "sent"),
        supabase.from("whatsapp_queue").select("id", { count: "exact", head: true }).eq("status", "failed"),
      ]);

      return new Response(JSON.stringify({
        pending: pendingRes.count || 0,
        processing: processingRes.count || 0,
        sent: sentRes.count || 0,
        failed: failedRes.count || 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use: process_queue, trigger_event, queue_message, queue_stats" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("whatsapp-automation-engine error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
