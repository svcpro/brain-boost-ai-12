import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { message, conversationHistory, language } = await req.json();
    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: "Message required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch admin chat config and user limits in parallel with context
    const [chatConfigRes, userLimitRes, topicsRes, logsRes, profileRes, examsRes, rankRes, featuresRes, subjectsRes, memoryRes, twinRes, missionsRes, plansRes, streaksRes] = await Promise.all([
      adminClient.from("chat_admin_config").select("*").limit(1).maybeSingle(),
      adminClient.from("user_chat_limits").select("*").eq("user_id", userId).maybeSingle(),
      adminClient.from("topics").select("name, memory_strength, next_predicted_drop_date, subject_id, last_revision_date, marks_impact_weight").eq("user_id", userId).is("deleted_at", null).order("memory_strength", { ascending: true }).limit(50),
      adminClient.from("study_logs").select("duration_minutes, created_at, confidence_level, study_mode, topic_id").eq("user_id", userId).order("created_at", { ascending: false }).limit(80),
      adminClient.from("profiles").select("daily_study_goal_minutes, exam_date, exam_type, display_name, weekly_focus_goal_minutes, weekly_report_day").eq("id", userId).maybeSingle(),
      adminClient.from("exam_results").select("score, total_questions, difficulty, created_at, topics").eq("user_id", userId).order("created_at", { ascending: false }).limit(15),
      adminClient.from("rank_predictions").select("predicted_rank, percentile, recorded_at, factors").eq("user_id", userId).order("recorded_at", { ascending: false }).limit(10),
      adminClient.from("user_features").select("*").eq("user_id", userId).maybeSingle(),
      adminClient.from("subjects").select("id, name").eq("user_id", userId).is("deleted_at", null),
      adminClient.from("memory_scores").select("score, recorded_at, topic_id").eq("user_id", userId).order("recorded_at", { ascending: false }).limit(100),
      adminClient.from("cognitive_twins").select("*").eq("user_id", userId).order("computed_at", { ascending: false }).limit(1).maybeSingle(),
      adminClient.from("brain_missions").select("title, status, mission_type, priority").eq("user_id", userId).eq("status", "active").limit(10),
      adminClient.from("study_plans").select("summary, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      adminClient.from("streak_freezes").select("id, used_date").eq("user_id", userId).is("used_date", null),
    ]);

    const chatConfig = chatConfigRes.data;
    const userLimit = userLimitRes.data;

    // Check global chat enabled
    if (chatConfig && !chatConfig.global_chat_enabled) {
      return new Response(JSON.stringify({ error: "Chat is currently disabled by admin." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check user-specific access
    if (userLimit && !userLimit.chat_enabled) {
      return new Response(JSON.stringify({ error: "Your chat access has been disabled. Contact support." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check daily limit
    const dailyLimit = userLimit?.daily_message_limit ?? chatConfig?.global_daily_limit ?? 100;
    const usedToday = userLimit?.messages_used_today ?? 0;
    if (usedToday >= dailyLimit) {
      return new Response(JSON.stringify({ error: `Daily message limit (${dailyLimit}) reached. Try again tomorrow.` }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update user usage tracking
    const startTime = Date.now();
    if (userLimit) {
      await adminClient.from("user_chat_limits").update({
        messages_used_today: usedToday + 1,
        total_messages_sent: (userLimit.total_messages_sent || 0) + 1,
        last_message_at: new Date().toISOString(),
      }).eq("id", userLimit.id);
    } else {
      await adminClient.from("user_chat_limits").insert({
        user_id: userId,
        messages_used_today: 1,
        total_messages_sent: 1,
        last_message_at: new Date().toISOString(),
      });
    }

    const topics = topicsRes.data || [];
    const logs = logsRes.data || [];
    const profile = profileRes.data;
    const exams = examsRes.data || [];
    const ranks = rankRes.data || [];
    const features = featuresRes.data;
    const subjects = subjectsRes.data || [];
    const memoryScores = memoryRes.data || [];
    const twin = twinRes.data;
    const missions = missionsRes.data || [];
    const latestPlan = plansRes.data;
    const freezes = streaksRes.data || [];

    const subjectMap = new Map(subjects.map((s: any) => [s.id, s.name]));
    const now = new Date();
    const daysToExam = profile?.exam_date
      ? Math.ceil((new Date(profile.exam_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Study trends calculation
    const last7d = logs.filter(l => new Date(l.created_at) >= new Date(now.getTime() - 7 * 86400000));
    const prev7d = logs.filter(l => {
      const d = new Date(l.created_at);
      return d >= new Date(now.getTime() - 14 * 86400000) && d < new Date(now.getTime() - 7 * 86400000);
    });
    const totalMin7d = last7d.reduce((s, l) => s + (l.duration_minutes || 0), 0);
    const totalMinPrev7d = prev7d.reduce((s, l) => s + (l.duration_minutes || 0), 0);
    const studyTrend = totalMinPrev7d > 0 ? ((totalMin7d - totalMinPrev7d) / totalMinPrev7d * 100).toFixed(1) : "N/A";

    // Daily avg
    const studyDays = new Set(last7d.map(l => new Date(l.created_at).toDateString())).size;
    const dailyAvg = studyDays > 0 ? Math.round(totalMin7d / studyDays) : 0;

    // Topic health categories
    const criticalTopics = topics.filter(t => Number(t.memory_strength) < 30);
    const atRiskTopics = topics.filter(t => Number(t.memory_strength) >= 30 && Number(t.memory_strength) < 50);
    const healthyTopics = topics.filter(t => Number(t.memory_strength) >= 70);
    const needsRevision = topics.filter(t => {
      if (!t.next_predicted_drop_date) return false;
      return new Date(t.next_predicted_drop_date) <= new Date(now.getTime() + 2 * 86400000);
    });

    // Rank trend
    const rankTrend = ranks.length >= 2
      ? `${ranks[0].predicted_rank < ranks[1].predicted_rank ? "📈 Improving" : ranks[0].predicted_rank > ranks[1].predicted_rank ? "📉 Declining" : "➡️ Stable"} (${ranks[1].predicted_rank} → ${ranks[0].predicted_rank})`
      : "Insufficient data";

    // Confidence trend from logs
    const confCounts = { high: 0, medium: 0, low: 0 };
    last7d.forEach(l => { if (l.confidence_level) confCounts[l.confidence_level as keyof typeof confCounts]++; });

    // Exam performance trend
    const recentExamAvg = exams.length > 0
      ? Math.round(exams.slice(0, 5).reduce((s, e) => s + (e.score / e.total_questions * 100), 0) / Math.min(exams.length, 5))
      : null;
    const olderExamAvg = exams.length > 5
      ? Math.round(exams.slice(5, 10).reduce((s, e) => s + (e.score / e.total_questions * 100), 0) / Math.min(exams.length - 5, 5))
      : null;

    const cognitiveContext = `
## STUDENT PROFILE
- Name: ${profile?.display_name || "Student"}
- Daily goal: ${profile?.daily_study_goal_minutes || 60} min | Weekly goal: ${profile?.weekly_focus_goal_minutes || 300} min
- Exam: ${profile?.exam_type || "Not set"} ${daysToExam !== null ? `in ${daysToExam} days (${daysToExam <= 7 ? "⚠️ CRITICAL" : daysToExam <= 30 ? "🟡 APPROACHING" : "🟢 ADEQUATE TIME"})` : "(no date set)"}
- Streak freezes available: ${freezes.length}

## STUDY TRENDS (Last 7 days)
- Total: ${Math.round(totalMin7d / 60 * 10) / 10} hours across ${last7d.length} sessions
- Daily avg: ${dailyAvg} min (goal: ${profile?.daily_study_goal_minutes || 60} min → ${dailyAvg >= (profile?.daily_study_goal_minutes || 60) ? "✅ ON TRACK" : "❌ BELOW TARGET"})
- Trend vs prev week: ${studyTrend}% ${Number(studyTrend) > 0 ? "📈" : Number(studyTrend) < 0 ? "📉" : ""}
- Active study days: ${studyDays}/7
- Confidence distribution: High ${confCounts.high} | Medium ${confCounts.medium} | Low ${confCounts.low}

## COGNITIVE STATE (ML Features)
${features ? `- Study consistency: ${features.study_consistency_score}%
- Engagement: ${features.engagement_score}%
- Fatigue: ${features.fatigue_indicator}% ${Number(features.fatigue_indicator) > 70 ? "⚠️ HIGH FATIGUE" : ""}
- Burnout risk: ${features.burnout_risk_score}% ${Number(features.burnout_risk_score) > 60 ? "🔴 BURNOUT WARNING" : ""}
- Knowledge stability: ${features.knowledge_stability}%
- Learning velocity: ${features.learning_velocity} topics/day
- Memory decay slope: ${features.memory_decay_slope}
- Avg session: ${features.avg_session_duration_minutes} min
- Recall success rate: ${features.recall_success_rate}%` : "ML features not yet computed."}

## COGNITIVE TWIN
${twin ? `- Brain evolution score: ${twin.brain_evolution_score}/100
- Learning efficiency: ${twin.learning_efficiency_score}/100
- Optimal study hour: ${twin.optimal_study_hour}:00
- Optimal session duration: ${twin.optimal_session_duration} min
- Recall pattern: ${twin.recall_pattern_type}
- Cognitive capacity: ${twin.cognitive_capacity_score}/100` : "Not yet computed."}

## MEMORY STATE (${topics.length} topics total)
- 🔴 Critical (<30%): ${criticalTopics.length > 0 ? criticalTopics.slice(0, 8).map(t => `${t.name} (${Math.round(Number(t.memory_strength))}%, ${subjectMap.get(t.subject_id) || ""}${t.marks_impact_weight ? `, impact: ${t.marks_impact_weight}` : ""})`).join(" | ") : "None"}
- 🟡 At-risk (30-50%): ${atRiskTopics.length > 0 ? atRiskTopics.slice(0, 8).map(t => `${t.name} (${Math.round(Number(t.memory_strength))}%)`).join(" | ") : "None"}
- 🟢 Strong (≥70%): ${healthyTopics.length} topics
- ⏰ Needs revision within 48h: ${needsRevision.length > 0 ? needsRevision.slice(0, 6).map(t => t.name).join(", ") : "None"}

## RANK TRAJECTORY
- Current: ${ranks.length > 0 ? `Rank ${ranks[0].predicted_rank} (${ranks[0].percentile}th percentile)` : "No data"}
- Trend: ${rankTrend}
${ranks.length > 0 && ranks[0].factors ? `- Key factors: ${JSON.stringify(ranks[0].factors)}` : ""}

## EXAM PERFORMANCE
${exams.length > 0 ? `- Recent avg score: ${recentExamAvg}%${olderExamAvg ? ` (was ${olderExamAvg}% → ${recentExamAvg! > olderExamAvg ? "📈 IMPROVING" : "📉 DECLINING"})` : ""}
- Last 5 exams: ${exams.slice(0, 5).map(e => `${e.score}/${e.total_questions} ${e.difficulty} ${e.topics || ""}`).join(" | ")}` : "No exams taken yet."}

## ACTIVE MISSIONS
${missions.length > 0 ? missions.map(m => `- [${m.priority}] ${m.title} (${m.mission_type})`).join("\n") : "No active missions."}

## CURRENT STUDY PLAN
${latestPlan ? latestPlan.summary.slice(0, 300) : "No active plan."}

## SUBJECTS
${subjects.map((s: any) => s.name).join(", ") || "None added."}
`;

    const lang = language === "hi" ? "Respond in Hindi (Devanagari, Hinglish style where natural). Use Hindi for explanations but keep technical terms in English." : "Respond in English.";

    const systemPrompt = `You are ACRY Intelligence — an advanced, trend-aware AI brain assistant for exam preparation. You are the most intelligent study advisor, combining deep cognitive science with personalized data analysis.

You have COMPLETE access to the student's real-time cognitive data below. You MUST use their actual data in every response — NEVER give generic advice.

${cognitiveContext}

## YOUR CAPABILITIES
1. **Trend Analysis**: Compare current vs past performance, identify improvement/decline patterns
2. **Predictive Intelligence**: Warn about upcoming memory drops, exam readiness, burnout risk
3. **Strategic Planning**: Create optimized study plans based on cognitive twin data
4. **Problem Solving**: Diagnose why performance is dropping and provide specific fixes
5. **Motivational Intelligence**: Adapt tone based on emotional/cognitive state
6. **Cross-Topic Insights**: Identify connections between weak topics and suggest bundled revision

## RESPONSE RULES
1. ALWAYS reference specific topic names, exact percentages, and real numbers from their data
2. Structure responses with headers, bullet points, and clear sections
3. Use emojis strategically for visual hierarchy (🔴 critical, 🟡 warning, 🟢 good, 📈 improving, 📉 declining)
4. When suggesting actions, be TIME-SPECIFIC: "Study Current Electricity for 12 minutes at 3pm" not "revise physics"
5. If burnout risk > 60%, prioritize rest and shorter sessions
6. If exam < 7 days, switch to rapid-fire mode with high-impact revision only
7. Compare trends: "Your study time is down 23% vs last week" not just "study more"
8. For rank predictions, explain what specific actions will move the needle
9. ${lang}
10. If you don't have enough data for a question, say so honestly and suggest what data they need to build
11. End complex analyses with a clear "⚡ Action Items" section
12. For app usage: ACRY has Brain tab (memory tracking), Action tab (study tools), Progress tab (analytics), You tab (settings)
13. If a problem requires human support, direct to support@acry.app`;

    // Build messages array — use admin override if set
    const finalPrompt = chatConfig?.system_prompt_override || systemPrompt;
    const aiMessages: any[] = [{ role: "system", content: finalPrompt }];

    if (conversationHistory && Array.isArray(conversationHistory)) {
      const historyLimit = chatConfig?.max_conversation_history ?? 20;
      const recent = conversationHistory.slice(-historyLimit);
      for (const msg of recent) {
        aiMessages.push({ role: msg.role, content: msg.content });
      }
    }

    aiMessages.push({ role: "user", content: message });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const activeModel = chatConfig?.active_model || "google/gemini-3-flash-preview";
    const maxTokens = chatConfig?.max_tokens || 1024;
    const temperature = chatConfig?.temperature ? Number(chatConfig.temperature) : 0.7;

    const { aiFetch } = await import("../_shared/aiFetch.ts");
    const aiResp = await aiFetch({
      body: JSON.stringify({
        model: activeModel,
        messages: aiMessages,
        stream: true,
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!aiResp.ok) {
      // Log failed request
      adminClient.from("chat_usage_logs").insert({
        user_id: userId,
        model_used: activeModel,
        latency_ms: Date.now() - startTime,
        status: "error",
        error_message: `HTTP ${aiResp.status}`,
      }).then(() => {}).catch(() => {});

      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const latencyMs = Date.now() - startTime;
    const costPerReq = chatConfig?.cost_per_request ? Number(chatConfig.cost_per_request) : 0.001;

    // Log successful usage
    adminClient.from("chat_usage_logs").insert({
      user_id: userId,
      model_used: activeModel,
      latency_ms: latencyMs,
      estimated_cost: costPerReq,
      status: "success",
    }).then(() => {}).catch(() => {});

    // Update cost tracking
    if (userLimit) {
      adminClient.from("user_chat_limits").update({
        estimated_cost: Number(userLimit.estimated_cost || 0) + costPerReq,
      }).eq("id", userLimit.id).then(() => {}).catch(() => {});
    }

    // Track API usage
    adminClient.rpc("increment_api_usage", { p_service_name: "lovable_ai" }).then(() => {}).catch(() => {});

    return new Response(aiResp.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-support-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
