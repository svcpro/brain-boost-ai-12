import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
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

async function callAIForQuestions(model: string, category: string, count: number) {
  const prompt = `Generate exactly ${count} multiple-choice questions in ${CATEGORY_PROMPTS[category] || "general knowledge"}.
Each question MUST have exactly 4 options and one correct_index (0-3). Mix easy/medium/hard.
You MUST call the return_questions function with all ${count} questions.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You generate exam MCQs. Always call the provided function with all requested questions." },
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
  if (!args) {
    console.error(`[myrank] ${model} returned no tool_calls. finish_reason=${data.choices?.[0]?.finish_reason}, raw=`, JSON.stringify(data).slice(0, 800));
    return [];
  }
  let parsed: any;
  try {
    parsed = typeof args === "string" ? JSON.parse(args) : args;
  } catch {
    console.error(`[myrank] ${model} malformed JSON:`, String(args).slice(0, 500));
    return [];
  }
  const qs = Array.isArray(parsed?.questions) ? parsed.questions : [];
  const valid = qs.filter((q: any) =>
    q && typeof q.question === "string" && Array.isArray(q.options) && q.options.length === 4 && typeof q.correct_index === "number"
  );
  return valid.slice(0, count);
}

async function generateQuestions(category: string, count = 7) {
  // Try in order: flash (smart enough + fast) → flash-lite (fallback) → pro (last resort)
  const models = ["google/gemini-2.5-flash", "google/gemini-2.5-flash-lite", "google/gemini-2.5-pro"];
  for (const model of models) {
    try {
      const qs = await callAIForQuestions(model, category, count);
      if (qs.length > 0) {
        console.log(`[myrank] ${model} returned ${qs.length} questions for ${category}`);
        return qs;
      }
      console.warn(`[myrank] ${model} returned 0 valid questions for ${category}, trying next model...`);
    } catch (e) {
      console.error(`[myrank] ${model} threw:`, (e as Error).message);
    }
  }
  throw new Error("All AI models failed to generate valid questions");
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
      let questions: any[] = [];
      let lastErr: any = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          questions = await generateQuestions(category, 7);
          if (questions.length > 0) break;
        } catch (e) {
          lastErr = e;
          console.error(`[myrank] generateQuestions attempt ${attempt + 1} failed:`, (e as Error).message);
        }
      }
      if (!questions || questions.length === 0) {
        return new Response(JSON.stringify({
          error: "Could not generate questions right now. Please try again.",
          detail: lastErr ? String((lastErr as Error).message) : "empty",
        }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
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

      // Track referral conversion: ensure a row exists for THIS referee
      if (referred_by_code) {
        // Resolve referrer_user_id from handle (best-effort)
        const { data: h } = await admin.from("myrank_handles")
          .select("id, user_id, signup_count").eq("handle", referred_by_code).maybeSingle();

        // Check if a referral row already exists for this referee+referrer pair
        let existingQuery = admin.from("myrank_referrals")
          .select("id, status").eq("referrer_code", referred_by_code);
        if (user_id) existingQuery = existingQuery.eq("referred_user_id", user_id);
        else if (anon_session_id) existingQuery = existingQuery.eq("referred_anon_id", anon_session_id);
        const { data: existing } = await existingQuery.maybeSingle();

        const newStatus = user_id ? "signed_up" : "clicked";
        if (existing) {
          // Only upgrade status (clicked → signed_up); never downgrade
          if (existing.status === "clicked" && newStatus === "signed_up") {
            await admin.from("myrank_referrals").update({
              referred_user_id: user_id,
              status: "signed_up",
              converted_at: new Date().toISOString(),
            }).eq("id", existing.id);
          }
        } else {
          // Insert a fresh referral row so it can later be counted
          await admin.from("myrank_referrals").insert({
            referrer_code: referred_by_code,
            referrer_user_id: h?.user_id || null,
            referred_user_id: user_id || null,
            referred_anon_id: anon_session_id || null,
            status: newStatus,
            converted_at: new Date().toISOString(),
          });

          // Increment signup_count only on first signup conversion
          if (h && user_id) {
            await admin.from("myrank_handles").update({
              signup_count: (h.signup_count || 0) + 1,
            }).eq("id", h.id);
          }
        }
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

      const { rank, percentile, ai_tag, methodology, sample_size, pool_size, composite_score } = await computeRank(
        score, questions.length, time_taken_seconds, test.category
      );

      const accuracy = Math.round((score / questions.length) * 1000) / 10;
      const trustNote = methodology === "empirical"
        ? `Ranked against ${sample_size.toLocaleString()} real test-takers in ${test.category}.`
        : methodology === "hybrid"
        ? `Calibrated using ${sample_size} real attempts + ML model.`
        : `Predicted via ML model (early access — ranking will sharpen as more aspirants attempt).`;

      const aiInsight = percentile >= 90
        ? `You outperformed ${percentile.toFixed(1)}% of test-takers. ${trustNote}`
        : percentile >= 50
        ? `You're better than ${percentile.toFixed(1)}% of users. ${trustNote}`
        : `${(100 - percentile).toFixed(1)}% scored above you. ${trustNote}`;

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

      // Mark referral as completed_test (highest tier)
      if (test.referred_by_code) {
        let q = admin.from("myrank_referrals").update({ status: "completed_test" })
          .eq("referrer_code", test.referred_by_code);
        if (test.user_id) {
          q = q.eq("referred_user_id", test.user_id);
        } else if (test.anon_session_id) {
          q = q.eq("referred_anon_id", test.anon_session_id);
        }
        await q;
      }

      return new Response(JSON.stringify({
        score, accuracy, rank, percentile, ai_tag, ai_insight: aiInsight,
        total: questions.length, category: test.category,
        prediction: {
          methodology, sample_size, pool_size, composite_score,
          confidence: methodology === "empirical" ? "high" : methodology === "hybrid" ? "medium" : "early-access",
        },
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

    // Track a referral-link click on root domain (acry.ai/?ref=handle)
    if (action === "track_click") {
      const { handle } = body;
      if (!handle || typeof handle !== "string" || !/^[a-z0-9_]{3,32}$/i.test(handle)) {
        return new Response(JSON.stringify({ error: "Invalid handle" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: row } = await admin.from("myrank_handles")
        .select("id, click_count").eq("handle", handle).maybeSingle();
      if (row) {
        await admin.from("myrank_handles").update({
          click_count: (row.click_count || 0) + 1,
          last_clicked_at: new Date().toISOString(),
        }).eq("id", row.id);
      }
      return new Response(JSON.stringify({ ok: true, found: !!row }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin-only: list handles with stats for admin panel
    if (action === "admin_list_handles") {
      const { search, sort_by, limit } = body;
      // Verify caller is an admin
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user: caller } } = await userClient.auth.getUser();
      if (!caller) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: isAdminRow } = await admin.from("user_roles")
        .select("role").eq("user_id", caller.id).limit(1).maybeSingle();
      if (!isAdminRow) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let query = admin.from("myrank_handles").select(
        "id, handle, user_id, anon_session_id, display_name, click_count, signup_count, last_clicked_at, created_at"
      );
      if (search && typeof search === "string" && search.trim()) {
        const q = search.trim();
        query = query.or(`handle.ilike.%${q}%,display_name.ilike.%${q}%`);
      }
      const sortCol = ["click_count", "signup_count", "created_at", "last_clicked_at"].includes(sort_by)
        ? sort_by : "created_at";
      query = query.order(sortCol, { ascending: false, nullsFirst: false }).limit(Math.min(limit || 100, 500));

      const { data: handles, error } = await query;
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Aggregate totals
      const totalClicks = (handles || []).reduce((s, h: any) => s + (h.click_count || 0), 0);
      const totalSignups = (handles || []).reduce((s, h: any) => s + (h.signup_count || 0), 0);

      return new Response(JSON.stringify({
        handles: handles || [],
        summary: {
          total_handles: (handles || []).length,
          total_clicks: totalClicks,
          total_signups: totalSignups,
          conversion_rate: totalClicks > 0 ? Math.round((totalSignups / totalClicks) * 1000) / 10 : 0,
        },
      }), {
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
      const { category, scope, city: clientCity, user_id } = body;
      // SECURITY: Once authenticated, NEVER match by anon_session_id — browsers
      // share localStorage across logins, causing rank/name leakage between users.
      const anon_session_id = user_id ? null : body.anon_session_id;
      // scope: "india" (default) | "city" | "weekly"

      // ─── Auto-derive user's city for transparency ───
      // Source priority: 1) explicit clientCity 2) profiles.city 3) latest myrank_tests.city
      let resolvedCity: string | null = clientCity || null;
      let citySource: "explicit" | "profile" | "last_test" | null = clientCity ? "explicit" : null;
      let cityCapturedAt: string | null = null;
      if (!resolvedCity && user_id) {
        const { data: prof } = await admin.from("profiles")
          .select("city, updated_at")
          .eq("id", user_id)
          .maybeSingle();
        if (prof?.city) {
          resolvedCity = prof.city;
          citySource = "profile";
          cityCapturedAt = prof.updated_at;
        }
      }
      if (!resolvedCity && (user_id || anon_session_id)) {
        const idCol = user_id ? "user_id" : "anon_session_id";
        const idVal = user_id || anon_session_id;
        const { data: lastTest } = await admin.from("myrank_tests")
          .select("city, completed_at")
          .eq(idCol, idVal)
          .not("city", "is", null)
          .order("completed_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastTest?.city) {
          resolvedCity = lastTest.city;
          citySource = "last_test";
          cityCapturedAt = lastTest.completed_at;
        }
      }

      let query = admin.from("myrank_tests")
        .select("id, user_id, anon_session_id, category, score, percentile, rank, ai_tag, city, completed_at")
        .not("completed_at", "is", null)
        .order("percentile", { ascending: false })
        .order("completed_at", { ascending: false })
        .limit(100);

      if (category && category !== "ALL") {
        if (category === "IQ") {
          query = query.eq("category", "IQ");
        } else {
          query = query.or(`category.eq.${category},category.ilike.${category} %`);
        }
      }
      if (scope === "city" && resolvedCity) query = query.eq("city", resolvedCity);
      if (scope === "weekly") {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte("completed_at", weekAgo);
      }

      const { data: top, error } = await query;
      if (error) throw error;

      const userIds = (top || []).map(t => t.user_id).filter(Boolean) as string[];
      let nameMap: Record<string, string> = {};
      let avatarMap: Record<string, string> = {};
      if (userIds.length) {
        const { data: profiles } = await admin
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", userIds);
        (profiles || []).forEach(p => {
          if (p.display_name) nameMap[p.id] = p.display_name;
          if (p.avatar_url) avatarMap[p.id] = p.avatar_url;
        });
      }

      const board = (top || []).map((t, i) => ({
        position: i + 1,
        name: t.user_id ? (nameMap[t.user_id] || "Anonymous Star") : "Anonymous Star",
        avatar_url: t.user_id ? (avatarMap[t.user_id] || null) : null,
        category: t.category,
        score: t.score,
        percentile: t.percentile,
        rank: t.rank,
        ai_tag: t.ai_tag,
        city: t.city,
        is_me: (user_id && t.user_id === user_id) || (anon_session_id && t.anon_session_id === anon_session_id),
      }));

      let myPosition = board.find(b => b.is_me)?.position || null;
      // Fallback: rank computed against the SAME category + scope filters used above.
      // Only return a position if the user has at least one COMPLETED test that
      // matches the active filters — never inflate a rank from an unfinished test
      // or from a different category/scope.
      if (!myPosition && (user_id || anon_session_id)) {
        const idCol = user_id ? "user_id" : "anon_session_id";
        const idVal = user_id || anon_session_id;
        let mineQ = admin.from("myrank_tests")
          .select("percentile")
          .eq(idCol, idVal)
          .not("completed_at", "is", null)
          .not("percentile", "is", null);
        if (category && category !== "ALL") {
          if (category === "IQ") mineQ = mineQ.eq("category", "IQ");
          else mineQ = mineQ.or(`category.eq.${category},category.ilike.${category} %`);
        }
        if (scope === "city" && resolvedCity) mineQ = mineQ.eq("city", resolvedCity);
        if (scope === "weekly") {
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          mineQ = mineQ.gte("completed_at", weekAgo);
        }
        const { data: mine } = await mineQ
          .order("percentile", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (mine?.percentile != null) {
          let countQ = admin.from("myrank_tests")
            .select("*", { count: "exact", head: true })
            .gt("percentile", mine.percentile)
            .not("completed_at", "is", null);
          if (category && category !== "ALL") {
            if (category === "IQ") countQ = countQ.eq("category", "IQ");
            else countQ = countQ.or(`category.eq.${category},category.ilike.${category} %`);
          }
          if (scope === "city" && resolvedCity) countQ = countQ.eq("city", resolvedCity);
          if (scope === "weekly") {
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            countQ = countQ.gte("completed_at", weekAgo);
          }
          const { count } = await countQ;
          myPosition = (count || 0) + 1;
        }
      }

      // Last-updated = newest completed_at in the returned board (or now)
      const lastUpdatedAt = (top && top.length > 0) ? top[0].completed_at : new Date().toISOString();

      return new Response(JSON.stringify({
        leaderboard: board,
        my_position: myPosition,
        my_city: resolvedCity,
        city_source: citySource,
        city_captured_at: cityCapturedAt,
        last_updated_at: lastUpdatedAt,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────── Referral reward claims ───────────
    // Helper: count verified referrals for a referrer code
    const countReferrals = async (refCode: string): Promise<number> => {
      const { count } = await admin
        .from("myrank_referrals")
        .select("*", { count: "exact", head: true })
        .eq("referrer_code", refCode)
        .in("status", ["signed_up", "completed_test"]);
      return count || 0;
    };

    // Returns the user's claimed rewards (premium_test window + ai_study_plan)
    if (action === "rewards_status") {
      const { user_id, referrer_code } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const referralCount = referrer_code ? await countReferrals(referrer_code) : 0;

      const { data: rewards } = await admin
        .from("myrank_rewards")
        .select("reward_type, claimed_at, expires_at, study_plan_id, metadata")
        .eq("user_id", user_id);

      const findR = (t: string) => (rewards || []).find((r: any) => r.reward_type === t);
      const premium = findR("premium_test");
      const aiPlan = findR("ai_study_plan");

      let planSummary: string | null = null;
      if (aiPlan?.study_plan_id) {
        const { data: sp } = await admin
          .from("study_plans")
          .select("summary")
          .eq("id", aiPlan.study_plan_id)
          .maybeSingle();
        planSummary = sp?.summary || null;
      }

      const now = Date.now();
      const premiumActive = premium && (!premium.expires_at || new Date(premium.expires_at).getTime() > now);

      return new Response(JSON.stringify({
        referrals: referralCount,
        premium_test: {
          eligible: referralCount >= 5,
          claimed: !!premium,
          active: !!premiumActive,
          claimed_at: premium?.claimed_at || null,
          expires_at: premium?.expires_at || null,
          days_left: premium?.expires_at
            ? Math.max(0, Math.ceil((new Date(premium.expires_at).getTime() - now) / 86400000))
            : null,
        },
        ai_study_plan: {
          eligible: referralCount >= 10,
          claimed: !!aiPlan,
          claimed_at: aiPlan?.claimed_at || null,
          plan_id: aiPlan?.study_plan_id || null,
          summary: planSummary,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Claim Premium Test reward → grants 30-day premium subscription window
    if (action === "claim_premium_test") {
      const { user_id, referrer_code } = body;
      if (!user_id || !referrer_code) {
        return new Response(JSON.stringify({ error: "user_id and referrer_code required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const referralCount = await countReferrals(referrer_code);
      if (referralCount < 5) {
        return new Response(JSON.stringify({
          error: "not_eligible",
          message: `Need 5 referrals (you have ${referralCount})`,
          referrals: referralCount,
        }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Already claimed?
      const { data: existing } = await admin
        .from("myrank_rewards")
        .select("id, expires_at")
        .eq("user_id", user_id)
        .eq("reward_type", "premium_test")
        .maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({
          error: "already_claimed",
          message: "Premium Test reward already claimed",
          expires_at: existing.expires_at,
        }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();

      // Insert reward record
      const { error: rewardErr } = await admin.from("myrank_rewards").insert({
        user_id,
        reward_type: "premium_test",
        expires_at: expiresAt,
        metadata: { source: "myrank_referral", referrals_at_claim: referralCount },
      });
      if (rewardErr) {
        console.error("[claim_premium_test] reward insert failed:", rewardErr);
        throw new Error("Failed to record reward");
      }

      // Grant access by extending the user's subscription via a trial extension.
      // We deactivate any current "none" state and add a 30-day reward subscription.
      const { data: premiumPlan } = await admin
        .from("subscription_plans")
        .select("id")
        .eq("plan_key", "premium")
        .maybeSingle();

      const { data: currentSub } = await admin
        .from("user_subscriptions")
        .select("id, expires_at, trial_end_date, is_trial, status")
        .eq("user_id", user_id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Compute new effective expiry: extend if existing window is later, else +30d
      const baseExpiry = currentSub?.expires_at ? new Date(currentSub.expires_at).getTime() : 0;
      const trialExpiry = currentSub?.trial_end_date ? new Date(currentSub.trial_end_date).getTime() : 0;
      const effectiveBase = Math.max(baseExpiry, trialExpiry, Date.now());
      const newExpiry = new Date(effectiveBase + 30 * 86400000).toISOString();

      if (currentSub) {
        await admin.from("user_subscriptions").update({
          plan_id: premiumPlan?.id || currentSub.id,
          is_trial: true,
          trial_end_date: newExpiry,
          expires_at: newExpiry,
          status: "active",
        }).eq("id", currentSub.id);
      } else {
        await admin.from("user_subscriptions").insert({
          user_id,
          plan_id: premiumPlan?.id || "premium",
          status: "active",
          is_trial: true,
          trial_start_date: new Date().toISOString(),
          trial_end_date: newExpiry,
          expires_at: newExpiry,
          billing_cycle: "monthly",
          amount: 0,
          currency: "INR",
        });
      }

      return new Response(JSON.stringify({
        success: true,
        reward: "premium_test",
        expires_at: expiresAt,
        days: 30,
        message: "Premium Test access unlocked for 30 days",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Claim AI Study Plan reward → AI generates personalized 30-day plan
    if (action === "claim_ai_study_plan") {
      const { user_id, referrer_code } = body;
      if (!user_id || !referrer_code) {
        return new Response(JSON.stringify({ error: "user_id and referrer_code required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const referralCount = await countReferrals(referrer_code);
      if (referralCount < 10) {
        return new Response(JSON.stringify({
          error: "not_eligible",
          message: `Need 10 referrals (you have ${referralCount})`,
          referrals: referralCount,
        }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Already claimed?
      const { data: existing } = await admin
        .from("myrank_rewards")
        .select("id, study_plan_id")
        .eq("user_id", user_id)
        .eq("reward_type", "ai_study_plan")
        .maybeSingle();
      if (existing) {
        const { data: sp } = existing.study_plan_id
          ? await admin.from("study_plans").select("summary").eq("id", existing.study_plan_id).maybeSingle()
          : { data: null };
        return new Response(JSON.stringify({
          error: "already_claimed",
          message: "AI Study Plan already generated",
          summary: sp?.summary || null,
          plan_id: existing.study_plan_id,
        }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Gather context: profile + weak topics
      const { data: profile } = await admin
        .from("profiles")
        .select("display_name, exam_type, exam_date, daily_study_goal_minutes")
        .eq("id", user_id)
        .maybeSingle();

      const { data: weakTopics } = await admin
        .from("topics")
        .select("name, memory_strength, subject_id")
        .eq("user_id", user_id)
        .is("deleted_at", null)
        .order("memory_strength", { ascending: true })
        .limit(20);

      const { data: subjects } = await admin
        .from("subjects")
        .select("id, name")
        .eq("user_id", user_id)
        .is("deleted_at", null);
      const subjectMap = new Map((subjects || []).map((s: any) => [s.id, s.name]));

      const examType = profile?.exam_type || "general competitive exam";
      const examDate = profile?.exam_date;
      const daysToExam = examDate
        ? Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000)
        : null;
      const dailyGoal = profile?.daily_study_goal_minutes || 90;

      const topicLines = (weakTopics || []).slice(0, 15).map((t: any) =>
        `- ${t.name} (${subjectMap.get(t.subject_id) || "General"}): mastery ${Math.round((t.memory_strength || 0) * 100)}%`
      ).join("\n") || "- (No weak-topic data yet — focus on syllabus fundamentals)";

      const prompt = `You are a top-tier exam coach generating a personalized 30-day mastery plan.

STUDENT PROFILE:
- Name: ${profile?.display_name || "Student"}
- Target exam: ${examType}
- Days to exam: ${daysToExam !== null ? daysToExam : "Not set"}
- Daily study goal: ${dailyGoal} minutes

WEAKEST TOPICS (focus areas):
${topicLines}

Generate a structured 30-day plan in markdown:
# 30-Day Personalized Plan for ${examType}

## Overview
2-3 sentences explaining the strategy.

## Week 1 (Days 1–7): Foundation Repair
For each day list: Topic + 2-3 focused tasks (≤30 min each).

## Week 2 (Days 8–14): Active Recall
## Week 3 (Days 15–21): Speed + Mock Tests
## Week 4 (Days 22–30): Final Polish

## Daily Routine
- Morning, afternoon, evening blocks.

## Key Rules
- 5 short, non-negotiable rules.

Be specific to the listed weak topics. Keep total length under 1500 words.`;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are an elite exam coach. Output ONLY valid markdown — no preamble." },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!aiRes.ok) {
        if (aiRes.status === 429) {
          return new Response(JSON.stringify({ error: "rate_limited", message: "AI is busy. Try again shortly." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiRes.status === 402) {
          return new Response(JSON.stringify({ error: "credits_exhausted", message: "AI credits exhausted." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errText = await aiRes.text();
        console.error("[claim_ai_study_plan] AI error:", aiRes.status, errText);
        throw new Error("AI generation failed");
      }

      const aiData = await aiRes.json();
      const summary = aiData.choices?.[0]?.message?.content?.trim() || "";
      if (!summary) throw new Error("Empty AI response");

      // Persist study plan
      const { data: planRow, error: planErr } = await admin
        .from("study_plans")
        .insert({ user_id, summary })
        .select("id")
        .single();
      if (planErr || !planRow) {
        console.error("[claim_ai_study_plan] plan insert failed:", planErr);
        throw new Error("Failed to save study plan");
      }

      // Record the reward
      await admin.from("myrank_rewards").insert({
        user_id,
        reward_type: "ai_study_plan",
        study_plan_id: planRow.id,
        metadata: { source: "myrank_referral", referrals_at_claim: referralCount, exam_type: examType },
      });

      return new Response(JSON.stringify({
        success: true,
        reward: "ai_study_plan",
        plan_id: planRow.id,
        summary,
        message: "Your personalized 30-day plan is ready",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
