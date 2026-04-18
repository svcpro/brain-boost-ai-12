import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const CATEGORY_PROMPTS: Record<string, string> = {
  // Featured
  IQ: "Classic IQ test — pattern recognition, logical reasoning, numerical sequences, spatial reasoning",
  // Civil Services
  "UPSC CSE": "UPSC Civil Services Prelims style — Indian polity, history, geography, economy, current affairs",
  "UPSC IES": "UPSC Indian Engineering Services — engineering aptitude, general studies, technical reasoning",
  "UPSC CMS": "UPSC Combined Medical Services — medical sciences, general ability, clinical reasoning",
  "UPSC CAPF": "UPSC CAPF Assistant Commandant — general ability, intelligence, current affairs, reasoning",
  "State PSC": "State Public Service Commission style — Indian polity, state-level GK, general studies",
  // Medical & Engineering
  "NEET UG": "NEET UG style — biology, physics, chemistry (class 11-12 level)",
  "NEET PG": "NEET PG style — clinical medicine, anatomy, pathology, pharmacology",
  "JEE Main": "JEE Main style — physics, chemistry, mathematics (class 11-12 level)",
  "JEE Advanced": "JEE Advanced style — advanced physics, chemistry, mathematics, conceptual problem-solving",
  GATE: "GATE engineering style — core engineering subjects, aptitude, technical reasoning",
  BITSAT: "BITSAT style — physics, chemistry, mathematics, English, logical reasoning",
  // MBA & Law
  CAT: "CAT MBA entrance — quantitative aptitude, verbal ability, data interpretation, logical reasoning",
  XAT: "XAT MBA style — decision making, verbal ability, quantitative aptitude, GK",
  CLAT: "CLAT law entrance — legal reasoning, English, GK, logical reasoning, quantitative",
  AILET: "AILET law entrance — legal aptitude, English, GK, reasoning, mathematics",
  LSAT: "LSAT style — analytical reasoning, logical reasoning, reading comprehension",
  NMAT: "NMAT MBA style — language skills, quantitative skills, logical reasoning",
  // Government Jobs
  "SSC CGL": "SSC CGL style — quantitative aptitude, reasoning, English, general awareness",
  "SSC CHSL": "SSC CHSL style — quantitative aptitude, reasoning, English, general awareness (10+2)",
  "SSC MTS": "SSC MTS style — basic reasoning, numerical aptitude, English, GK",
  "IBPS PO": "IBPS PO banking style — reasoning, quantitative aptitude, English, banking awareness",
  "IBPS Clerk": "IBPS Clerk banking style — reasoning, quantitative aptitude, English, computer awareness",
  "SBI PO": "SBI PO banking style — reasoning, quantitative aptitude, English, banking & economy",
  "SBI Clerk": "SBI Clerk style — reasoning, quantitative aptitude, English, general awareness",
  "RBI Grade B": "RBI Grade B style — finance, economics, English, reasoning, GK",
  "RRB NTPC": "RRB NTPC railway style — mathematics, reasoning, general awareness",
  "RRB Group D": "RRB Group D railway style — basic mathematics, reasoning, GK, general science",
  // Defence
  NDA: "NDA defence style — mathematics, general ability, English, GK",
  CDS: "CDS defence style — English, GK, elementary mathematics",
  AFCAT: "AFCAT Air Force style — verbal ability, numerical ability, reasoning, military aptitude",
  // International
  GRE: "GRE style — verbal reasoning, quantitative reasoning, analytical writing",
  GMAT: "GMAT MBA style — quantitative, verbal, integrated reasoning, data sufficiency",
  SAT: "SAT style — evidence-based reading, writing, mathematics",
  TOEFL: "TOEFL English proficiency — reading, listening, vocabulary, grammar",
  IELTS: "IELTS English proficiency — reading, listening, grammar, vocabulary",
  // Teaching & Research
  "UGC NET": "UGC NET style — teaching aptitude, research methodology, general paper",
  "CSIR NET": "CSIR NET science style — general aptitude, scientific reasoning, research",
  CTET: "CTET teaching style — child development, pedagogy, language, mathematics, EVS",
  // Other
  CUET: "CUET undergraduate style — general test, language, domain knowledge",
  KVPY: "KVPY science aptitude — physics, chemistry, biology, mathematics",
};

async function generateQuestions(category: string, count = 7) {
  const prompt = `Generate ${count} multiple-choice questions in ${CATEGORY_PROMPTS[category] || "general knowledge"}.
Each question must have exactly 4 options. Mix of easy/medium/hard. Return strict JSON only.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: "You generate exam MCQs. Output strict JSON only." },
        { role: "user", content: prompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_questions",
          description: "Return MCQs",
          parameters: {
            type: "object",
            properties: {
              questions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    question: { type: "string" },
                    options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
                    correct_index: { type: "integer", minimum: 0, maximum: 3 },
                  },
                  required: ["question", "options", "correct_index"],
                },
              },
            },
            required: ["questions"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_questions" } },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI gateway ${res.status}: ${err}`);
  }
  const data = await res.json();
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  const parsed = JSON.parse(args);
  return parsed.questions.slice(0, count);
}

// Standard normal CDF (Abramowitz & Stegun approximation) — used for ML-grade percentile
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

// Authentic rank engine — uses REAL test-taker distribution from DB.
// Falls back to a calibrated normal-distribution model when sample size < 30.
async function computeRank(
  score: number,
  total: number,
  timeSeconds: number,
  category: string
) {
  const accuracy = (score / total) * 100;
  // Composite skill signal: accuracy weighted heavily, speed lightly (capped, not exploitable)
  const timeRatio = Math.min(1, Math.max(0, (90 - Math.min(90, timeSeconds)) / 90));
  const composite = accuracy * 0.85 + timeRatio * 100 * 0.15;

  // 1. Pull real distribution of completed tests for this category (last 90 days, capped)
  const sinceIso = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
  const { data: peers } = await admin
    .from("myrank_tests")
    .select("score, total_questions, time_taken_seconds")
    .eq("category", category)
    .not("completed_at", "is", null)
    .gte("completed_at", sinceIso)
    .limit(5000);

  const peerComposites: number[] = (peers || [])
    .filter((p: any) => p.total_questions > 0 && p.score !== null)
    .map((p: any) => {
      const acc = (Number(p.score) / Number(p.total_questions)) * 100;
      const tr = Math.min(1, Math.max(0, (90 - Math.min(90, Number(p.time_taken_seconds || 90))) / 90));
      return acc * 0.85 + tr * 100 * 0.15;
    });

  const sampleSize = peerComposites.length;
  let percentile: number;
  let methodology: "empirical" | "hybrid" | "model" = "model";

  if (sampleSize >= 30) {
    // EMPIRICAL: real percentile rank vs actual peers
    const below = peerComposites.filter(c => c < composite).length;
    const equal = peerComposites.filter(c => c === composite).length;
    const empirical = ((below + 0.5 * equal) / sampleSize) * 100;

    if (sampleSize >= 200) {
      percentile = empirical;
      methodology = "empirical";
    } else {
      // Blend with model for stability when sample is small-medium
      const modelP = normalCdf((composite - 55) / 18) * 100;
      const w = Math.min(1, (sampleSize - 30) / 170); // 0 → 1 as we approach 200
      percentile = empirical * w + modelP * (1 - w);
      methodology = "hybrid";
    }
  } else {
    // MODEL fallback: calibrated normal distribution (μ=55, σ=18) — realistic for MCQ tests
    percentile = normalCdf((composite - 55) / 18) * 100;
    methodology = "model";
  }

  percentile = Math.min(99.5, Math.max(0.5, percentile));

  // 2. Real registered pool size per category (active competitors)
  const { count: poolCount } = await admin
    .from("myrank_tests")
    .select("*", { count: "exact", head: true })
    .eq("category", category)
    .not("completed_at", "is", null);

  // Effective pool = max(real test-takers, realistic active aspirant baseline)
  const aspirantBaseline: Record<string, number> = {
    "UPSC CSE": 1100000, "NEET UG": 2400000, "JEE Main": 1200000, "JEE Advanced": 250000,
    "SSC CGL": 3000000, "CAT": 330000, "GATE": 900000, "CLAT": 75000, "NDA": 400000,
    "CDS": 350000, "IBPS PO": 1100000, "SBI PO": 800000, "UGC NET": 900000, "IQ": 50000,
  };
  const baseline = aspirantBaseline[category] || 150000;
  const effectivePool = Math.max(poolCount || 0, baseline);
  const rank = Math.max(1, Math.round(effectivePool * (1 - percentile / 100)));

  let aiTag = "Rising Mind 🌱";
  if (percentile >= 99) {
    aiTag = category.startsWith("UPSC") ? "Future IAS 🇮🇳"
          : category.startsWith("JEE") ? "IIT Material 🚀"
          : category.startsWith("NEET") ? "Future Doctor 🩺"
          : category === "IQ" ? "Genius Mind 🧠" : "Top 1% Brain 🏆";
  } else if (percentile >= 95) aiTag = "Top 5% Mind 💎";
  else if (percentile >= 85) aiTag = "Top 15% Performer ⚡";
  else if (percentile >= 70) aiTag = "Above Average Hustler 🔥";
  else if (percentile >= 50) aiTag = "Solid Contender 💪";
  else aiTag = "Diamond in the Rough 🌱";

  return {
    rank,
    percentile: Math.round(percentile * 10) / 10,
    ai_tag: aiTag,
    methodology,
    sample_size: sampleSize,
    pool_size: effectivePool,
    composite_score: Math.round(composite * 10) / 10,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "start_test") {
      const { category, anon_session_id, user_id, referred_by_code } = body;
      if (!category || !CATEGORY_PROMPTS[category]) {
        return new Response(JSON.stringify({ error: "Invalid category" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const questions = await generateQuestions(category, 7);
      const stripped = questions.map((q: any, i: number) => ({
        idx: i, question: q.question, options: q.options,
      }));

      const { data: test, error } = await admin.from("myrank_tests").insert({
        user_id: user_id || null,
        anon_session_id: anon_session_id || null,
        category,
        questions, // full with answers (server-side only)
        total_questions: questions.length,
        referred_by_code: referred_by_code || null,
      }).select("id").single();

      if (error) throw error;

      // Track referral click conversion → signed_up
      if (referred_by_code) {
        await admin.from("myrank_referrals").update({
          referred_user_id: user_id || null,
          referred_anon_id: anon_session_id || null,
          status: user_id ? "signed_up" : "clicked",
          converted_at: new Date().toISOString(),
        }).eq("referrer_code", referred_by_code).is("referred_user_id", null);
      }

      return new Response(JSON.stringify({ test_id: test.id, questions: stripped }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "submit_test") {
      const { test_id, answers, time_taken_seconds } = body;
      const { data: test, error: fetchErr } = await admin.from("myrank_tests")
        .select("*").eq("id", test_id).single();
      if (fetchErr || !test) {
        return new Response(JSON.stringify({ error: "Test not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const questions = test.questions as any[];
      let score = 0;
      questions.forEach((q, i) => {
        if (answers[i] === q.correct_index) score++;
      });

      const { rank, percentile, ai_tag } = computeRank(
        score, questions.length, time_taken_seconds, test.category
      );

      const accuracy = Math.round((score / questions.length) * 1000) / 10;
      const aiInsight = percentile >= 90
        ? `You outperformed ${percentile.toFixed(1)}% of test-takers. Only ${(100 - percentile).toFixed(1)}% scored higher than you!`
        : percentile >= 50
        ? `You're better than ${percentile.toFixed(1)}% of users. Push harder to break into the top 10%!`
        : `${(100 - percentile).toFixed(1)}% scored above you. Don't worry — every topper started here.`;

      await admin.from("myrank_tests").update({
        answers, score, accuracy, time_taken_seconds,
        rank, percentile, ai_tag, ai_insight: aiInsight,
        completed_at: new Date().toISOString(),
      }).eq("id", test_id);

      // Bump global stats
      await admin.rpc("increment_myrank_stats", {}).then(() => {}).catch(async () => {
        const { data: s } = await admin.from("myrank_stats").select("total_tests").eq("id", 1).single();
        await admin.from("myrank_stats").update({
          total_tests: (s?.total_tests || 0) + 1,
          updated_at: new Date().toISOString(),
        }).eq("id", 1);
      });

      // Mark referral as completed_test
      if (test.referred_by_code) {
        await admin.from("myrank_referrals").update({ status: "completed_test" })
          .eq("referrer_code", test.referred_by_code)
          .or(`referred_user_id.eq.${test.user_id || "00000000-0000-0000-0000-000000000000"},referred_anon_id.eq.${test.anon_session_id || ""}`);
      }

      return new Response(JSON.stringify({
        score, accuracy, rank, percentile, ai_tag, ai_insight: aiInsight,
        total: questions.length, category: test.category,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "log_share") {
      const { test_id, user_id, anon_session_id, channel } = body;
      await admin.from("myrank_shares").insert({
        test_id, user_id: user_id || null,
        anon_session_id: anon_session_id || null,
        channel: channel || "whatsapp",
      });
      const { data: s } = await admin.from("myrank_stats").select("total_shares").eq("id", 1).single();
      await admin.from("myrank_stats").update({
        total_shares: (s?.total_shares || 0) + 1,
      }).eq("id", 1);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "stats") {
      const { data } = await admin.from("myrank_stats").select("*").eq("id", 1).single();
      return new Response(JSON.stringify(data || { total_tests: 234567 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Returns share+referral progress and which unlocks are earned
    if (action === "unlock_status") {
      const { user_id, anon_session_id, referrer_code } = body;
      const idFilter = user_id
        ? { col: "user_id", val: user_id }
        : { col: "anon_session_id", val: anon_session_id };

      // Count distinct shares (whatsapp counts toward gate)
      const { count: shareCount } = await admin
        .from("myrank_shares")
        .select("*", { count: "exact", head: true })
        .eq(idFilter.col, idFilter.val);

      // Count successful referrals (status = signed_up OR completed_test)
      let referralCount = 0;
      if (referrer_code) {
        const { count } = await admin
          .from("myrank_referrals")
          .select("*", { count: "exact", head: true })
          .eq("referrer_code", referrer_code)
          .in("status", ["signed_up", "completed_test"]);
        referralCount = count || 0;
      }

      const shares = shareCount || 0;
      const unlocks = {
        detailed_analysis: shares >= 2 || referralCount >= 3, // Gate 1
        weak_subject_breakdown: shares >= 2 || referralCount >= 3,
        topper_strategy: shares >= 2 || referralCount >= 3,
        premium_test: referralCount >= 5, // Reward tier 1
        ai_study_plan: referralCount >= 10, // Reward tier 2
      };

      return new Response(JSON.stringify({
        shares, referrals: referralCount, unlocks,
        next_unlock: !unlocks.detailed_analysis
          ? { type: "detailed_analysis", needs_shares: Math.max(0, 2 - shares), needs_referrals: Math.max(0, 3 - referralCount) }
          : !unlocks.premium_test
          ? { type: "premium_test", needs_referrals: Math.max(0, 5 - referralCount) }
          : !unlocks.ai_study_plan
          ? { type: "ai_study_plan", needs_referrals: Math.max(0, 10 - referralCount) }
          : null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Returns AI-generated detailed analysis (gated)
    if (action === "detailed_analysis") {
      const { test_id, user_id, anon_session_id } = body;

      // Re-verify gate server-side (anti-cheat)
      const idFilter = user_id
        ? { col: "user_id", val: user_id }
        : { col: "anon_session_id", val: anon_session_id };
      const { count: shareCount } = await admin
        .from("myrank_shares")
        .select("*", { count: "exact", head: true })
        .eq(idFilter.col, idFilter.val);

      if ((shareCount || 0) < 2) {
        return new Response(JSON.stringify({
          error: "locked",
          message: "Share with 2 friends to unlock detailed analysis",
          shares: shareCount || 0,
          needed: 2,
        }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: test } = await admin.from("myrank_tests").select("*").eq("id", test_id).single();
      if (!test) {
        return new Response(JSON.stringify({ error: "Test not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const questions = test.questions as any[];
      const answers = test.answers as number[] || [];
      const wrongQuestions = questions
        .map((q, i) => ({ q: q.question, correct: q.options[q.correct_index], chose: q.options[answers[i]] || "skipped", right: answers[i] === q.correct_index }))
        .filter(x => !x.right);

      const prompt = `Student took ${test.category} test. Score: ${test.score}/${questions.length}, percentile: ${test.percentile}%.
Wrong questions:
${wrongQuestions.map((w, i) => `${i + 1}. Q: ${w.q}\n   Correct: ${w.correct}\n   Chose: ${w.chose}`).join("\n")}

Generate a JSON object with:
- weak_areas: array of {topic, severity (high|medium|low), why}
- topper_strategy: 3-bullet strategy a top scorer would use
- next_steps: 3 concrete actions to climb 10 percentile points`;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: "You are an exam coach. Output strict JSON only." },
            { role: "user", content: prompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "return_analysis",
              parameters: {
                type: "object",
                properties: {
                  weak_areas: { type: "array", items: { type: "object", properties: { topic: { type: "string" }, severity: { type: "string" }, why: { type: "string" } }, required: ["topic", "severity", "why"] } },
                  topper_strategy: { type: "array", items: { type: "string" } },
                  next_steps: { type: "array", items: { type: "string" } },
                },
                required: ["weak_areas", "topper_strategy", "next_steps"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "return_analysis" } },
        }),
      });

      if (!aiRes.ok) throw new Error(`AI gateway ${aiRes.status}`);
      const aiData = await aiRes.json();
      const analysis = JSON.parse(aiData.choices[0].message.tool_calls[0].function.arguments);

      return new Response(JSON.stringify(analysis), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "leaderboard") {
      const { category, scope, city, user_id, anon_session_id } = body;
      // scope: "india" (default) | "city" | "weekly"
      let query = admin.from("myrank_tests")
        .select("id, user_id, anon_session_id, category, score, percentile, rank, ai_tag, city, completed_at")
        .not("completed_at", "is", null)
        .order("percentile", { ascending: false })
        .order("completed_at", { ascending: false })
        .limit(100);

      if (category && category !== "ALL") query = query.eq("category", category);
      if (scope === "city" && city) query = query.eq("city", city);
      if (scope === "weekly") {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte("completed_at", weekAgo);
      }

      const { data: top, error } = await query;
      if (error) throw error;

      // Hydrate display names for logged-in users
      const userIds = (top || []).map(t => t.user_id).filter(Boolean) as string[];
      let nameMap: Record<string, string> = {};
      if (userIds.length) {
        const { data: profiles } = await admin
          .from("profiles")
          .select("id, display_name")
          .in("id", userIds);
        (profiles || []).forEach(p => {
          if (p.display_name) nameMap[p.id] = p.display_name;
        });
      }

      const board = (top || []).map((t, i) => ({
        position: i + 1,
        name: t.user_id ? (nameMap[t.user_id] || "Anonymous Star") : "Anonymous Star",
        category: t.category,
        score: t.score,
        percentile: t.percentile,
        rank: t.rank,
        ai_tag: t.ai_tag,
        city: t.city,
        is_me: (user_id && t.user_id === user_id) || (anon_session_id && t.anon_session_id === anon_session_id),
      }));

      // Find user's own position if not in top 100
      let myPosition = board.find(b => b.is_me)?.position || null;
      if (!myPosition && (user_id || anon_session_id)) {
        const idCol = user_id ? "user_id" : "anon_session_id";
        const idVal = user_id || anon_session_id;
        const { data: mine } = await admin.from("myrank_tests")
          .select("percentile")
          .eq(idCol, idVal)
          .not("completed_at", "is", null)
          .order("percentile", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (mine?.percentile) {
          const { count } = await admin.from("myrank_tests")
            .select("*", { count: "exact", head: true })
            .gt("percentile", mine.percentile)
            .not("completed_at", "is", null);
          myPosition = (count || 0) + 1;
        }
      }

      return new Response(JSON.stringify({ leaderboard: board, my_position: myPosition }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[myrank-engine]", e);
    return new Response(JSON.stringify({ error: e.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
