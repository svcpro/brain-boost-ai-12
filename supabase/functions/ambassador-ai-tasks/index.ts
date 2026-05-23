// AI-powered ambassador weekly task generator
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function getWeekKey(d = new Date()): string {
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

const FALLBACK_TASKS = [
  { title: "Invite 5 new students", description: "Share your referral link with 5 classmates this week.", category: "referral", priority: "high", reward_points: 50, requires_proof: false, estimated_minutes: 15, ai_reasoning: "Referrals drive your rank — this is the highest-impact action." },
  { title: "Share workshop poster on Instagram story", description: "Post the latest workshop poster to your Instagram story and tag @acry.ai.", category: "social", priority: "medium", reward_points: 30, requires_proof: true, estimated_minutes: 5, ai_reasoning: "Social proof from your story converts your followers fastest." },
  { title: "Join the weekly ambassador huddle", description: "Attend Saturday's 30-min ambassador call for tips & wins.", category: "community", priority: "medium", reward_points: 25, requires_proof: false, estimated_minutes: 30, ai_reasoning: "Top ambassadors attend every huddle — knowledge compounds." },
];

async function generateAITasks(profile: any, stats: any) {
  const prompt = `You are an elite growth strategist for ACRY AI's campus ambassador program. Generate exactly 3 hyper-personalized weekly tasks for this ambassador. Tasks must feel fresh, doable in a week, and drive measurable growth.

Ambassador profile:
- Name: ${profile?.full_name ?? "Ambassador"}
- College: ${profile?.college ?? "unknown"}
- City: ${profile?.city ?? "unknown"}
- Level: ${profile?.ai_level ?? "Bronze"}
- Total XP: ${profile?.xp ?? 0}
- Weekly XP: ${profile?.weekly_xp ?? 0}

Recent stats:
- Total referrals: ${stats?.total ?? 0}
- Active referrals: ${stats?.active ?? 0}
- Paid referrals: ${stats?.paid ?? 0}

Rules:
- Exactly 3 tasks. Mix categories: at least one referral, one social/content, one community/learning.
- Difficulty must match level (Bronze=easy, Silver=medium, Gold/Platinum=advanced).
- Titles must be specific & action-led (e.g. "DM 10 1st-year students your link", not "engage students").
- One task should require a screenshot proof (requires_proof: true).
- reward_points 20-80 based on effort.
- ai_reasoning: ONE crisp sentence explaining WHY this task matters for THIS ambassador now.`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You return only structured tool calls." },
        { role: "user", content: prompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "emit_tasks",
          description: "Emit 3 personalized weekly ambassador tasks",
          parameters: {
            type: "object",
            properties: {
              tasks: {
                type: "array",
                minItems: 3,
                maxItems: 3,
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    category: { type: "string", enum: ["referral", "social", "community", "content", "learning"] },
                    priority: { type: "string", enum: ["low", "medium", "high"] },
                    reward_points: { type: "integer", minimum: 10, maximum: 100 },
                    requires_proof: { type: "boolean" },
                    estimated_minutes: { type: "integer", minimum: 3, maximum: 120 },
                    ai_reasoning: { type: "string" },
                  },
                  required: ["title", "description", "category", "priority", "reward_points", "requires_proof", "estimated_minutes", "ai_reasoning"],
                  additionalProperties: false,
                },
              },
            },
            required: ["tasks"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "emit_tasks" } },
    }),
  });

  if (!resp.ok) {
    console.error("AI gateway error", resp.status, await resp.text());
    return FALLBACK_TASKS;
  }
  const data = await resp.json();
  try {
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = typeof args === "string" ? JSON.parse(args) : args;
    if (parsed?.tasks?.length === 3) return parsed.tasks;
  } catch (e) {
    console.error("Parse error", e);
  }
  return FALLBACK_TASKS;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "list";
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const weekKey = getWeekKey();

    // === CRON: auto-generate tasks for every ambassador ===
    if (action === "cron_generate_all") {
      const cronSecret = req.headers.get("x-cron-secret");
      if (cronSecret !== SERVICE_ROLE) {
        return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: ambs } = await admin
        .from("ambassador_profiles")
        .select("user_id, full_name, college, city, ai_level, xp, weekly_xp")
        .in("status", ["active", "approved"]);

      let generated = 0;
      for (const amb of ambs ?? []) {
        const { count } = await admin
          .from("ambassador_tasks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", amb.user_id)
          .eq("week_key", weekKey);
        if ((count ?? 0) >= 3) continue;

        const { data: refs } = await admin
          .from("ambassador_referrals")
          .select("status")
          .eq("ambassador_user_id", amb.user_id);
        const stats = {
          total: refs?.length ?? 0,
          active: refs?.filter((r: any) => r.status === "active").length ?? 0,
          paid: refs?.filter((r: any) => r.status === "paid").length ?? 0,
        };
        const aiTasks = await generateAITasks(amb, stats);
        await admin.from("ambassador_tasks").insert(
          aiTasks.map((t: any) => ({
            user_id: amb.user_id, week_key: weekKey,
            title: t.title, description: t.description, category: t.category,
            priority: t.priority, reward_points: t.reward_points,
            requires_proof: t.requires_proof, estimated_minutes: t.estimated_minutes,
            ai_reasoning: t.ai_reasoning,
          }))
        );
        generated++;
      }
      return new Response(JSON.stringify({ ok: true, generated, week_key: weekKey }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });




    if (action === "list" || action === "generate") {
      const { data: existing } = await admin
        .from("ambassador_tasks")
        .select("*")
        .eq("user_id", user.id)
        .eq("week_key", weekKey)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true });

      if ((existing?.length ?? 0) >= 3 && action !== "generate") {
        return new Response(JSON.stringify({ tasks: existing, week_key: weekKey }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "generate" && existing && existing.length > 0) {
        // Regenerating: archive old pending tasks for this week
        await admin
          .from("ambassador_tasks")
          .delete()
          .eq("user_id", user.id)
          .eq("week_key", weekKey)
          .eq("status", "pending");
      }

      const { data: profile } = await admin
        .from("ambassador_profiles")
        .select("full_name, college, city, ai_level, xp, weekly_xp")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: refs } = await admin
        .from("ambassador_referrals")
        .select("status")
        .eq("ambassador_user_id", user.id);

      const stats = {
        total: refs?.length ?? 0,
        active: refs?.filter((r: any) => r.status === "active").length ?? 0,
        paid: refs?.filter((r: any) => r.status === "paid").length ?? 0,
      };

      const aiTasks = await generateAITasks(profile, stats);
      const rows = aiTasks.map((t: any) => ({
        user_id: user.id,
        week_key: weekKey,
        title: t.title,
        description: t.description,
        category: t.category,
        priority: t.priority,
        reward_points: t.reward_points,
        requires_proof: t.requires_proof,
        estimated_minutes: t.estimated_minutes,
        ai_reasoning: t.ai_reasoning,
      }));

      const { data: inserted, error: insErr } = await admin
        .from("ambassador_tasks")
        .insert(rows)
        .select("*");

      if (insErr) {
        console.error("insert err", insErr);
        return new Response(JSON.stringify({ error: insErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ tasks: inserted, week_key: weekKey, generated: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "complete") {
      const { task_id, proof_url } = body;
      if (!task_id) return new Response(JSON.stringify({ error: "task_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data: updated, error } = await admin
        .from("ambassador_tasks")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          proof_url: proof_url ?? null,
          proof_uploaded_at: proof_url ? new Date().toISOString() : null,
        })
        .eq("id", task_id)
        .eq("user_id", user.id)
        .select("*")
        .single();

      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ task: updated }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "uncomplete") {
      const { task_id } = body;
      const { data: updated, error } = await admin
        .from("ambassador_tasks")
        .update({ status: "pending", completed_at: null })
        .eq("id", task_id)
        .eq("user_id", user.id)
        .select("*")
        .single();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ task: updated }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("fn error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
