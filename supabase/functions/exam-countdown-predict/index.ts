import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch user profile for exam date
    const { data: profile } = await adminClient
      .from("profiles")
      .select("exam_date, display_name")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.exam_date) {
      return new Response(JSON.stringify({ phase: "no_exam", message: "No exam date set" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const examDate = new Date(profile.exam_date);
    const daysRemaining = Math.ceil((examDate.getTime() - Date.now()) / 86400000);

    if (daysRemaining < 0) {
      return new Response(JSON.stringify({ phase: "no_exam", message: "Exam has passed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gather user performance data for AI analysis
    const [topicsRes, sessionsRes, twinRes] = await Promise.all([
      adminClient.from("topics").select("id, name, memory_strength, last_reviewed_at, review_count")
        .eq("user_id", user.id).eq("deleted", false),
      adminClient.from("study_sessions").select("mode, duration_minutes, created_at, confidence_after")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
      adminClient.from("cognitive_twins").select("*")
        .eq("user_id", user.id).order("computed_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const topics = topicsRes.data || [];
    const sessions = sessionsRes.data || [];
    const twin = twinRes.data;

    const avgMemory = topics.length > 0
      ? topics.reduce((s: number, t: any) => s + (t.memory_strength || 0), 0) / topics.length
      : 0;

    const weakTopicCount = topics.filter((t: any) => (t.memory_strength || 0) < 0.4).length;
    const criticalTopicCount = topics.filter((t: any) => (t.memory_strength || 0) < 0.2).length;
    const recentSessionCount = sessions.length;
    const avgConfidence = sessions.length > 0
      ? sessions.reduce((s: number, se: any) => s + (se.confidence_after || 0), 0) / sessions.length
      : 0;
    const brainEvolution = twin?.brain_evolution_score || 0;
    const learningEfficiency = twin?.learning_efficiency_score || 0;

    // Call AI to predict optimal phase thresholds
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiPrompt = `You are an intelligent exam preparation advisor. Based on the student's data, predict the optimal exam countdown phase configuration.

Student Data:
- Days until exam: ${daysRemaining}
- Total topics: ${topics.length}
- Average memory strength: ${(avgMemory * 100).toFixed(1)}%
- Weak topics (< 40%): ${weakTopicCount}
- Critical topics (< 20%): ${criticalTopicCount}
- Recent study sessions (last 30): ${recentSessionCount}
- Average confidence: ${(avgConfidence * 100).toFixed(1)}%
- Brain evolution score: ${(brainEvolution * 100).toFixed(1)}%
- Learning efficiency: ${(learningEfficiency * 100).toFixed(1)}%

Rules:
- acceleration_days: When to enter Acceleration phase (lock some modes). Range: 10-45 days before exam.
- lockdown_days: When to enter Lockdown phase (strict mode locks). Range: 3-20 days before exam.
- If student has many weak topics or low efficiency, they need EARLIER phase transitions (more days).
- If student is well-prepared, phase transitions can be LATER (fewer days).
- locked_modes_acceleration: Which modes to lock during acceleration. Options: focus, revision, mock, emergency.
- locked_modes_lockdown: Which modes to lock during lockdown. Options: focus, revision, mock, emergency.
- During acceleration, typically lock "revision" to push toward mock/focus.
- During lockdown, typically lock "revision" and sometimes "focus" to push emergency + mock.
- HARD RULE: "emergency" mode must NEVER be in any locked list. Emergency Rescue Mode must always remain accessible, especially within 7 days of the exam.
- recommended_mode_acceleration: Best mode during acceleration (usually "mock" or "focus").
- recommended_mode_lockdown: Best mode during lockdown (usually "emergency" or "mock").

Respond using the tool provided.`;

    const { aiFetch } = await import("../_shared/aiFetch.ts");
    const aiResponse = await aiFetch({
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: aiPrompt }],
        tools: [{
          type: "function",
          function: {
            name: "set_exam_phases",
            description: "Set the predicted exam countdown phase configuration for this student",
            parameters: {
              type: "object",
              properties: {
                acceleration_days: { type: "integer", description: "Days before exam to enter acceleration phase" },
                lockdown_days: { type: "integer", description: "Days before exam to enter lockdown phase" },
                locked_modes_acceleration: { type: "array", items: { type: "string" }, description: "Modes to lock during acceleration" },
                locked_modes_lockdown: { type: "array", items: { type: "string" }, description: "Modes to lock during lockdown" },
                recommended_mode_acceleration: { type: "string", description: "Recommended mode during acceleration" },
                recommended_mode_lockdown: { type: "string", description: "Recommended mode during lockdown" },
                reasoning: { type: "string", description: "Brief explanation of why these thresholds were chosen (2-3 sentences)" },
                confidence: { type: "number", description: "Confidence score 0-1 in this prediction" },
              },
              required: ["acceleration_days", "lockdown_days", "locked_modes_acceleration", "locked_modes_lockdown", "recommended_mode_acceleration", "recommended_mode_lockdown", "reasoning", "confidence"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "set_exam_phases" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      // Fallback to heuristic
      return fallbackPrediction(adminClient, user.id, profile.exam_date, daysRemaining, avgMemory, weakTopicCount, corsHeaders);
    }

    const aiResult = await aiResponse.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      return fallbackPrediction(adminClient, user.id, profile.exam_date, daysRemaining, avgMemory, weakTopicCount, corsHeaders);
    }

    const prediction = JSON.parse(toolCall.function.arguments);

    // Clamp values
    const accDays = Math.max(5, Math.min(60, prediction.acceleration_days));
    const lockDays = Math.max(2, Math.min(accDays - 1, prediction.lockdown_days));

    // HARD CONSTRAINT: Emergency mode must never be locked
    const sanitizeModes = (modes: string[]) => (modes || []).filter((m: string) => m !== "emergency");
    prediction.locked_modes_acceleration = sanitizeModes(prediction.locked_modes_acceleration);
    prediction.locked_modes_lockdown = sanitizeModes(prediction.locked_modes_lockdown);

    // Upsert prediction
    const record = {
      user_id: user.id,
      exam_date: profile.exam_date,
      predicted_acceleration_days: accDays,
      predicted_lockdown_days: lockDays,
      locked_modes_acceleration: prediction.locked_modes_acceleration || [],
      locked_modes_lockdown: prediction.locked_modes_lockdown || [],
      recommended_mode_acceleration: prediction.recommended_mode_acceleration || "mock",
      recommended_mode_lockdown: prediction.recommended_mode_lockdown || "emergency",
      acceleration_message: `AI recommends Acceleration mode. ${prediction.reasoning || ""}`.slice(0, 500),
      lockdown_message: `AI has activated Lockdown mode. Focus on ${prediction.recommended_mode_lockdown || "emergency"} sessions.`,
      ai_reasoning: prediction.reasoning || "",
      confidence_score: Math.max(0, Math.min(1, prediction.confidence || 0.5)),
      factors: {
        avg_memory: avgMemory,
        weak_topics: weakTopicCount,
        critical_topics: criticalTopicCount,
        recent_sessions: recentSessionCount,
        avg_confidence: avgConfidence,
        brain_evolution: brainEvolution,
        learning_efficiency: learningEfficiency,
      },
      computed_at: new Date().toISOString(),
    };

    await adminClient.from("exam_countdown_predictions").upsert(record, { onConflict: "user_id" });

    // Determine current phase
    let phase = "normal";
    if (daysRemaining <= lockDays) phase = "lockdown";
    else if (daysRemaining <= accDays) phase = "acceleration";

    return new Response(JSON.stringify({
      phase,
      daysRemaining,
      examDate: profile.exam_date,
      prediction: record,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("exam-countdown-predict error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function fallbackPrediction(adminClient: any, userId: string, examDate: string, daysRemaining: number, avgMemory: number, weakTopicCount: number, corsHeaders: Record<string, string>) {
  // Heuristic fallback
  let accDays = 25;
  let lockDays = 10;
  
  if (avgMemory < 0.3 || weakTopicCount > 10) {
    accDays = 35;
    lockDays = 15;
  } else if (avgMemory > 0.7 && weakTopicCount < 3) {
    accDays = 15;
    lockDays = 5;
  }

  const record = {
    user_id: userId,
    exam_date: examDate,
    predicted_acceleration_days: accDays,
    predicted_lockdown_days: lockDays,
    locked_modes_acceleration: ["revision"],
    locked_modes_lockdown: ["revision"],
    recommended_mode_acceleration: "mock",
    recommended_mode_lockdown: "emergency",
    acceleration_message: "Your exam is approaching. AI recommends focusing on mock practice.",
    lockdown_message: "Exam imminent. AI has locked non-essential modes for emergency preparation.",
    ai_reasoning: "Fallback heuristic based on memory strength and weak topic count.",
    confidence_score: 0.3,
    factors: { avg_memory: avgMemory, weak_topics: weakTopicCount, fallback: true },
    computed_at: new Date().toISOString(),
  };

  await adminClient.from("exam_countdown_predictions").upsert(record, { onConflict: "user_id" });

  let phase = "normal";
  if (daysRemaining <= lockDays) phase = "lockdown";
  else if (daysRemaining <= accDays) phase = "acceleration";

  return new Response(JSON.stringify({ phase, daysRemaining, examDate, prediction: record }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
