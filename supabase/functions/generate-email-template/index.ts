import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { purpose, category } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { aiFetch } = await import("../_shared/aiFetch.ts");
    const aiResp = await aiFetch({
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are an expert email template designer for ACRY, an AI-powered exam preparation platform. Generate professional, responsive HTML email templates.

Design rules:
- Use a dark navy background (#0a1628) with glass-style content containers (#111b2e with rgba borders)
- Primary accent: teal gradient (#0d9488 to #064e3b)
- CTA buttons: teal-to-emerald gradient with white text, rounded corners, padding 14px 32px
- Typography: clean sans-serif (system fonts), white text (#f1f5f9) for headings, muted (#94a3b8) for body
- Include the ACRY logo text "🧠 ACRY" at the top
- Footer with unsubscribe link placeholder and "Powered by ACRY AI"
- All HTML must be inline-styled for email client compatibility
- Use HTML tables for layout (not flexbox/grid)
- Include relevant emoji in subject lines
- Variables use {{variable_name}} syntax
- Make it visually stunning with subtle gradients, shadows, and spacing
- Include at least one prominent CTA button`
          },
          {
            role: "user",
            content: `Generate a complete email template for: "${purpose}" in the "${category}" category.`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "create_email_template",
            description: "Create a complete professional email template",
            parameters: {
              type: "object",
              properties: {
                name: { type: "string", description: "Template name, e.g. 'Welcome Onboarding Email'" },
                subject: { type: "string", description: "Email subject line with emoji" },
                html_body: { type: "string", description: "Complete responsive HTML email body with inline styles" },
                variables: {
                  type: "array",
                  items: { type: "string" },
                  description: "Template variables used, e.g. ['user_name', 'exam_date']"
                },
              },
              required: ["name", "subject", "html_body", "variables"],
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "create_email_template" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limited. Try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI gateway error");
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let template = {};
    if (toolCall?.function?.arguments) {
      template = JSON.parse(toolCall.function.arguments);
    }

    return new Response(JSON.stringify(template), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-email-template error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
