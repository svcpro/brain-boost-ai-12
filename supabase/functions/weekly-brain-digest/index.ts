import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!RESEND_KEY) throw new Error("RESEND_API_KEY not configured");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, email_weekly_reports, exam_date, exam_type, daily_study_goal_minutes");

    if (!profiles?.length) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;

    for (const profile of profiles) {
      if (profile.email_weekly_reports === false) continue;

      try {
        const userId = profile.id;

        // Fetch all needed data in parallel
        const [twinRes, reportsRes, topicsRes, logsRes, riskDigestsRes, userRes] = await Promise.all([
          supabase.from("cognitive_twins")
            .select("brain_evolution_score, learning_efficiency_score, cognitive_capacity_score, memory_growth_rate, avg_decay_rate, optimal_session_duration, computed_at")
            .eq("user_id", userId).maybeSingle(),
          supabase.from("brain_reports")
            .select("metrics, created_at")
            .eq("user_id", userId).eq("report_type", "cognitive_snapshot")
            .gte("created_at", twoWeeksAgo.toISOString())
            .order("created_at", { ascending: true }),
          supabase.from("topics")
            .select("name, memory_strength, next_predicted_drop_date, subject_id")
            .eq("user_id", userId).is("deleted_at", null)
            .order("memory_strength", { ascending: true }),
          supabase.from("study_logs")
            .select("duration_minutes, created_at")
            .eq("user_id", userId)
            .gte("created_at", weekAgo.toISOString()),
          supabase.from("notification_history")
            .select("body")
            .eq("user_id", userId).eq("type", "risk_digest")
            .order("created_at", { ascending: false }).limit(1),
          supabase.auth.admin.getUserById(userId),
        ]);

        const email = userRes.data?.user?.email;
        if (!email) continue;

        const twin = twinRes.data;
        const reports = reportsRes.data || [];
        const topics = topicsRes.data || [];
        const logs = logsRes.data || [];
        const latestRiskDigest = riskDigestsRes.data?.[0]?.body || "";

        // Compute weekly stats
        const totalMinutes = logs.reduce((s, l) => s + (l.duration_minutes || 0), 0);
        const sessions = logs.length;
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

        // Brain evolution change
        let evolutionChange: number | null = null;
        if (reports.length >= 2) {
          const oldMetrics = reports[0].metrics as Record<string, number> | null;
          const newMetrics = reports[reports.length - 1].metrics as Record<string, number> | null;
          if (oldMetrics?.brain_evolution_score != null && newMetrics?.brain_evolution_score != null) {
            evolutionChange = Math.round(newMetrics.brain_evolution_score - oldMetrics.brain_evolution_score);
          }
        }

        // At-risk topics
        const threeDaysOut = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        const atRisk = topics.filter(t => {
          const str = Number(t.memory_strength);
          const drop = t.next_predicted_drop_date ? new Date(t.next_predicted_drop_date) : null;
          return str < 50 || (drop && drop <= threeDaysOut);
        }).slice(0, 6);

        // Get subject names
        const subjectIds = [...new Set(atRisk.map(t => t.subject_id).filter(Boolean))];
        const { data: subjects } = subjectIds.length > 0
          ? await supabase.from("subjects").select("id, name").in("id", subjectIds)
          : { data: [] };
        const subjectMap: Record<string, string> = {};
        for (const s of subjects || []) subjectMap[s.id] = s.name;

        // Generate AI recommendations
        const contextStr = `Student: ${profile.display_name || "Student"}
Exam: ${profile.exam_type || "Not set"}${profile.exam_date ? `, ${Math.ceil((new Date(profile.exam_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} days away` : ""}
Weekly study: ${timeStr} across ${sessions} sessions (goal: ${profile.daily_study_goal_minutes || 60}m/day)
Brain evolution: ${twin?.brain_evolution_score != null ? `${Math.round(twin.brain_evolution_score)}/100` : "N/A"}${evolutionChange != null ? ` (${evolutionChange >= 0 ? "+" : ""}${evolutionChange} this week)` : ""}
Efficiency: ${twin?.learning_efficiency_score != null ? `${Math.round(twin.learning_efficiency_score)}%` : "N/A"}
Memory growth: ${twin?.memory_growth_rate != null ? `${twin.memory_growth_rate > 0 ? "+" : ""}${twin.memory_growth_rate.toFixed(1)}%` : "N/A"}
At-risk topics: ${atRisk.length > 0 ? atRisk.slice(0, 4).map(t => `${t.name} (${Math.round(Number(t.memory_strength))}%)`).join(", ") : "None"}
Total topics: ${topics.length}`;

        let recommendations = "";
        try {
          const { aiFetch } = await import("../_shared/aiFetch.ts");
          const aiResp = await aiFetch({
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                {
                  role: "system",
                  content: "You are ACRY, an AI study coach. Generate 3 specific, actionable study recommendations for this student's upcoming week. Each should be 1 sentence. Number them 1-3. Be specific about topic names and time durations. No greetings.",
                },
                { role: "user", content: contextStr },
              ],
            }),
          });
          if (aiResp.ok) {
            const aiData = await aiResp.json();
            recommendations = aiData.choices?.[0]?.message?.content || "";
          }
        } catch { /* fallback below */ }

        if (!recommendations) {
          recommendations = atRisk.length > 0
            ? `1. Priority review: ${atRisk[0].name} (${Math.round(Number(atRisk[0].memory_strength))}% strength) — 20 min session\n2. Consolidate your strongest topics to maintain momentum\n3. Aim for ${profile.daily_study_goal_minutes || 60} min daily to stay on track`
            : "1. Keep reviewing your existing topics to maintain high retention\n2. Consider adding new study material to expand coverage\n3. Use Focus Mode for deeper learning sessions";
        }

        // Build email HTML
        const evolutionColor = (evolutionChange ?? 0) >= 0 ? "#10b981" : "#ef4444";
        const evolutionArrow = (evolutionChange ?? 0) >= 0 ? "↑" : "↓";

        const html = `
<div style="font-family:'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;background:#f8fffe;border-radius:16px;overflow:hidden;border:1px solid #e0f2f1;">
  <div style="background:linear-gradient(135deg,#0d9488,#065f46);padding:32px 24px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:28px;font-weight:800;">🧠 ACRY</h1>
    <p style="color:#a7f3d0;margin:6px 0 0;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;">Weekly Brain Evolution Digest</p>
  </div>

  <div style="padding:28px;">
    <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 20px;">Hi ${profile.display_name || "there"}, here's how your brain evolved this week:</p>

    <!-- Brain Evolution Scores -->
    <div style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:20px;">
      <div style="padding:16px 20px;background:linear-gradient(90deg,#f0fdf4,#ecfdf5);border-bottom:1px solid #e2e8f0;">
        <span style="font-size:16px;font-weight:700;color:#0f172a;">Cognitive Scores</span>
      </div>
      ${twin ? `
      <div style="padding:14px 20px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;">
        <span style="color:#64748b;font-size:14px;">🧬 Evolution Score</span>
        <span style="font-weight:700;font-size:14px;color:#0f172a;">${Math.round(twin.brain_evolution_score)}/100 ${evolutionChange != null ? `<span style="color:${evolutionColor};font-size:12px;">${evolutionArrow}${Math.abs(evolutionChange)}</span>` : ""}</span>
      </div>
      <div style="padding:14px 20px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;">
        <span style="color:#64748b;font-size:14px;">⚡ Learning Efficiency</span>
        <span style="font-weight:700;font-size:14px;color:#0f172a;">${Math.round(twin.learning_efficiency_score)}%</span>
      </div>
      <div style="padding:14px 20px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;">
        <span style="color:#64748b;font-size:14px;">📈 Memory Growth</span>
        <span style="font-weight:700;font-size:14px;color:${(twin.memory_growth_rate || 0) >= 0 ? "#10b981" : "#ef4444"};">${(twin.memory_growth_rate || 0) > 0 ? "+" : ""}${(twin.memory_growth_rate || 0).toFixed(1)}%</span>
      </div>
      <div style="padding:14px 20px;display:flex;justify-content:space-between;">
        <span style="color:#64748b;font-size:14px;">⏱️ Study Time</span>
        <span style="font-weight:700;font-size:14px;color:#0f172a;">${timeStr} (${sessions} sessions)</span>
      </div>
      ` : `<div style="padding:20px;text-align:center;color:#94a3b8;font-size:14px;">Build your Digital Twin to see cognitive scores</div>`}
    </div>

    <!-- At-Risk Topics -->
    ${atRisk.length > 0 ? `
    <div style="background:#fff;border-radius:12px;border:1px solid #fecaca;overflow:hidden;margin-bottom:20px;">
      <div style="padding:14px 20px;background:#fef2f2;border-bottom:1px solid #fecaca;">
        <span style="font-size:15px;font-weight:700;color:#991b1b;">🔴 ${atRisk.length} Topic${atRisk.length > 1 ? "s" : ""} at Risk</span>
      </div>
      ${atRisk.map((t, i) => {
        const str = Math.round(Number(t.memory_strength));
        const barColor = str < 30 ? "#ef4444" : str < 50 ? "#f97316" : "#eab308";
        const subj = subjectMap[t.subject_id] || "";
        return `<div style="padding:12px 20px;${i < atRisk.length - 1 ? "border-bottom:1px solid #fee2e2;" : ""}">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="color:#0f172a;font-size:13px;font-weight:600;">${t.name}${subj ? ` <span style="color:#94a3b8;font-weight:400;">(${subj})</span>` : ""}</span>
            <span style="color:${barColor};font-size:13px;font-weight:700;">${str}%</span>
          </div>
          <div style="background:#f1f5f9;border-radius:4px;height:6px;overflow:hidden;">
            <div style="background:${barColor};height:100%;width:${str}%;border-radius:4px;"></div>
          </div>
        </div>`;
      }).join("")}
    </div>
    ` : `
    <div style="background:#ecfdf5;border-radius:12px;border:1px solid #a7f3d0;padding:16px 20px;margin-bottom:20px;text-align:center;">
      <p style="margin:0;color:#065f46;font-size:14px;font-weight:600;">✅ No topics at risk this week!</p>
    </div>
    `}

    <!-- AI Recommendations -->
    <div style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:24px;">
      <div style="padding:14px 20px;background:linear-gradient(90deg,#eff6ff,#eef2ff);border-bottom:1px solid #e2e8f0;">
        <span style="font-size:15px;font-weight:700;color:#0f172a;">🤖 AI Recommendations</span>
      </div>
      <div style="padding:16px 20px;">
        <p style="margin:0;color:#334155;font-size:13px;line-height:1.8;white-space:pre-line;">${recommendations}</p>
      </div>
    </div>

    <div style="text-align:center;margin:24px 0;">
      <a href="https://acry.ai/app" style="background:linear-gradient(135deg,#0d9488,#065f46);color:white;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;box-shadow:0 4px 14px rgba(13,148,136,0.3);">Open ACRY →</a>
    </div>
  </div>

  <div style="background:#f1f5f9;padding:20px 28px;text-align:center;border-top:1px solid #e2e8f0;">
    <p style="color:#94a3b8;font-size:12px;margin:0 0 8px;">© ${now.getFullYear()} ACRY · Smart Study Companion</p>
    <a href="${Deno.env.get("SUPABASE_URL")}/functions/v1/email-unsubscribe?uid=${userId}&type=reports" style="color:#94a3b8;font-size:11px;text-decoration:underline;">Unsubscribe from weekly emails</a>
  </div>
</div>`;

        // Send email
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "ACRY <notifications@acry.ai>",
            to: [email],
            subject: `🧠 Brain Evolution Digest — ${twin ? `Score: ${Math.round(twin.brain_evolution_score)}/100` : timeStr + " studied"}${evolutionChange != null ? ` (${evolutionChange >= 0 ? "+" : ""}${evolutionChange})` : ""}`,
            html,
          }),
        });

        if (emailRes.ok) {
          await emailRes.text();
          sent++;
        } else {
          console.error(`Email failed for ${email}: ${await emailRes.text()}`);
        }

        await new Promise(r => setTimeout(r, 400));
      } catch (userErr) {
        console.error(`Error for user ${profile.id}:`, userErr);
      }
    }

    return new Response(JSON.stringify({ processed: profiles.length, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("weekly-brain-digest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
