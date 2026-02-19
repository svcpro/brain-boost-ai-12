import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, trigger_key, user_id, context, template_id, voice_text, language, tone, voice_id, target_user_ids } = await req.json();

    // Action: fire_trigger — automated trigger dispatch
    if (action === "fire_trigger") {
      if (!trigger_key || !user_id) {
        return new Response(JSON.stringify({ error: "trigger_key and user_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if trigger is enabled
      const { data: trigger } = await adminClient
        .from("voice_notification_triggers")
        .select("*")
        .eq("trigger_key", trigger_key)
        .eq("is_enabled", true)
        .maybeSingle();

      if (!trigger) {
        return new Response(JSON.stringify({ skipped: true, reason: "trigger_disabled" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Cooldown check
      if (trigger.cooldown_minutes > 0) {
        const cooldownTime = new Date(Date.now() - trigger.cooldown_minutes * 60000).toISOString();
        const { count } = await adminClient
          .from("voice_notification_logs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user_id)
          .eq("trigger_key", trigger_key)
          .gte("created_at", cooldownTime);

        if ((count || 0) > 0) {
          return new Response(JSON.stringify({ skipped: true, reason: "cooldown_active" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Generate voice text
      let finalText = "";
      let aiGenerated = false;
      const finalLanguage = language || trigger.default_language || "en";
      const finalTone = tone || trigger.default_tone || "soft";

      if (trigger.use_ai_content) {
        // Use AI to generate personalized voice text
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (LOVABLE_API_KEY) {
          const userName = context?.userName || "";
          const nameClause = userName ? ` The student's name is "${userName}" — address them by name naturally.` : "";
          const lang = finalLanguage === "hi"
            ? "Hindi (Devanagari script with natural English loanwords)"
            : "English (clear, natural)";
          const toneDesc = finalTone === "energetic" ? "energetic and upbeat" :
                           finalTone === "calm" ? "calm and composed" : "soft and warm";

          const contextStr = Object.entries(context || {})
            .filter(([k]) => k !== "userName")
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ");

          const { aiFetch } = await import("../_shared/aiFetch.ts");
          const aiResponse = await aiFetch({
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                {
                  role: "system",
                  content: `You are ACRY, an AI Second Brain voice assistant. Output ONLY the spoken text — no quotes, no labels, no formatting. Keep it 1-2 sentences, natural and conversational. Language: ${lang}. Tone: ${toneDesc}. Avoid abbreviations and symbols.`
                },
                {
                  role: "user",
                  content: `Generate a ${toneDesc} voice notification for trigger "${trigger.display_name}".${nameClause} Context: ${contextStr || "general notification"}. Description: ${trigger.description || trigger.display_name}.`
                }
              ],
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            finalText = aiData.choices?.[0]?.message?.content?.trim() || "";
            aiGenerated = true;
          }
        }
      }

      // Fallback to template if AI didn't generate
      if (!finalText && trigger.template_id) {
        const { data: template } = await adminClient
          .from("voice_notification_templates")
          .select("voice_text, variables")
          .eq("id", trigger.template_id)
          .maybeSingle();

        if (template) {
          finalText = template.voice_text;
          // Replace variables
          for (const [key, val] of Object.entries(context || {})) {
            finalText = finalText.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(val));
          }
        }
      }

      // Final fallback
      if (!finalText) {
        finalText = `${trigger.display_name} notification.`;
      }

      // Log the notification
      await adminClient.from("voice_notification_logs").insert({
        user_id,
        trigger_key,
        template_id: trigger.template_id,
        voice_text: finalText,
        language: finalLanguage,
        tone: finalTone,
        voice_id: voice_id || trigger.conditions?.voice_id || "EXAVITQu4vr4xnSDxMaL",
        status: "sent",
        context: context || {},
        ai_generated: aiGenerated,
      });

      // Track usage
      adminClient.rpc("increment_api_usage", { p_service_name: "lovable_ai" }).catch(() => {});

      return new Response(JSON.stringify({
        success: true,
        voice_text: finalText,
        language: finalLanguage,
        tone: finalTone,
        ai_generated: aiGenerated,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: send_direct — admin direct voice notification
    if (action === "send_direct") {
      if (!voice_text) {
        return new Response(JSON.stringify({ error: "voice_text required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const targetIds = target_user_ids || (user_id ? [user_id] : []);
      if (targetIds.length === 0) {
        // Broadcast to all users
        const { data: allUsers } = await adminClient
          .from("profiles")
          .select("id")
          .limit(1000);
        
        if (allUsers) {
          for (const u of allUsers) {
            await adminClient.from("voice_notification_logs").insert({
              user_id: u.id,
              trigger_key: "admin_announcement",
              voice_text,
              language: language || "en",
              tone: tone || "soft",
              voice_id: voice_id || "EXAVITQu4vr4xnSDxMaL",
              status: "sent",
              context: context || {},
              ai_generated: false,
            });
          }
        }
      } else {
        for (const uid of targetIds) {
          await adminClient.from("voice_notification_logs").insert({
            user_id: uid,
            trigger_key: "admin_announcement",
            voice_text,
            language: language || "en",
            tone: tone || "soft",
            voice_id: voice_id || "EXAVITQu4vr4xnSDxMaL",
            status: "sent",
            context: context || {},
            ai_generated: false,
          });
        }
      }

      return new Response(JSON.stringify({ success: true, sent: targetIds.length || "broadcast" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: process_queue — process scheduled voice notifications
    if (action === "process_queue") {
      const now = new Date().toISOString();
      const { data: pending } = await adminClient
        .from("voice_notification_queue")
        .select("*")
        .eq("status", "pending")
        .lte("scheduled_at", now)
        .order("scheduled_at")
        .limit(50);

      let processed = 0;
      for (const item of (pending || [])) {
        try {
          await adminClient.from("voice_notification_queue")
            .update({ status: "processing" })
            .eq("id", item.id);

          // Fire the trigger
          const result = await fetch(Deno.env.get("SUPABASE_URL")! + "/functions/v1/voice-automation-engine", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            },
            body: JSON.stringify({
              action: "fire_trigger",
              trigger_key: item.trigger_key,
              user_id: item.user_id,
              context: item.context,
            }),
          });

          if (result.ok) {
            await adminClient.from("voice_notification_queue")
              .update({ status: "completed" })
              .eq("id", item.id);
            processed++;
          } else {
            throw new Error(`Status ${result.status}`);
          }
        } catch (e: any) {
          const retries = (item.retry_count || 0) + 1;
          await adminClient.from("voice_notification_queue")
            .update({
              status: retries >= item.max_retries ? "failed" : "pending",
              retry_count: retries,
              error_message: e.message,
            })
            .eq("id", item.id);
        }
      }

      return new Response(JSON.stringify({ processed, total: pending?.length || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: generate_template — AI-generate a voice template
    if (action === "generate_template") {
      const { purpose, category: templateCategory } = context || {};
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { aiFetch } = await import("../_shared/aiFetch.ts");
      const aiResponse = await aiFetch({
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          tools: [{
            type: "function",
            function: {
              name: "create_voice_template",
              description: "Create a voice notification template",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Template name" },
                  description: { type: "string", description: "Brief description" },
                  voice_text: { type: "string", description: "The spoken text with {{variable}} placeholders" },
                  variables: { type: "array", items: { type: "string" }, description: "List of variable names used" },
                  tone: { type: "string", enum: ["soft", "energetic", "calm"] },
                  category: { type: "string" },
                },
                required: ["name", "description", "voice_text", "variables", "tone", "category"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "create_voice_template" } },
          messages: [
            {
              role: "system",
              content: "You create ACRY AI Second Brain voice notification templates. Templates are spoken aloud by a TTS engine. Use {{variable_name}} for dynamic values. Keep voice_text to 1-3 natural, conversational sentences. Available variables: user_name, topic_name, subject_name, exam_name, memory_score, rank_prediction, streak_days, score, days_left."
            },
            {
              role: "user",
              content: `Create a voice template for purpose: "${purpose || "general"}". Category: ${templateCategory || "general"}.`
            }
          ],
        }),
      });

      if (!aiResponse.ok) {
        const status = aiResponse.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI error: ${status}`);
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) throw new Error("No tool call returned");

      const template = JSON.parse(toolCall.function.arguments);

      return new Response(JSON.stringify({ template }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use: fire_trigger, send_direct, process_queue, generate_template" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("voice-automation-engine error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
