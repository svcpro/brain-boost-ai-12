import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const authHeader = req.headers.get("Authorization");
    
    // Get user
    const { data: { user }, error: authError } = await createClient(
      supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader || "" } } }
    ).auth.getUser();
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const body = await req.json();
    const { action, exam_type, subject, topic, year, difficulty, mode, count } = body;

    if (action === "generate_predicted") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      // Get user's exam type
      const { data: profile } = await supabase
        .from("profiles")
        .select("exam_type")
        .eq("id", user.id)
        .maybeSingle();
      const targetExam = exam_type || profile?.exam_type || "competitive exam";
      const targetSubject = subject || "mixed subjects";

      // ── Analyze real PYQ patterns from question_bank ──
      const { data: pyqData } = await supabase
        .from("question_bank")
        .select("topic, subject, year, difficulty")
        .eq("exam_type", targetExam)
        .order("year", { ascending: false });

      // Build topic frequency & trend analysis
      const topicFrequency: Record<string, { count: number; years: Set<number>; difficulties: string[] }> = {};
      const subjectFrequency: Record<string, number> = {};
      
      for (const q of (pyqData || [])) {
        const key = q.topic || q.subject;
        if (!topicFrequency[key]) topicFrequency[key] = { count: 0, years: new Set(), difficulties: [] };
        topicFrequency[key].count++;
        if (q.year) topicFrequency[key].years.add(q.year);
        if (q.difficulty) topicFrequency[key].difficulties.push(q.difficulty);
        
        if (q.subject) subjectFrequency[q.subject] = (subjectFrequency[q.subject] || 0) + 1;
      }

      // Identify high-frequency and trending topics
      const totalPYQs = pyqData?.length || 0;
      const trendingTopics = Object.entries(topicFrequency)
        .map(([topic, data]) => ({
          topic,
          frequency: data.count,
          yearsAppeared: data.years.size,
          repeatRate: Math.round((data.years.size / 5) * 100),
          commonDifficulty: data.difficulties.sort((a, b) =>
            data.difficulties.filter(d => d === b).length - data.difficulties.filter(d => d === a).length
          )[0] || "medium",
        }))
        .sort((a, b) => b.yearsAppeared - a.yearsAppeared || b.frequency - a.frequency);

      const patternSummary = trendingTopics.slice(0, 15).map(t =>
        `${t.topic}: appeared in ${t.yearsAppeared}/5 years (${t.frequency} times, usually ${t.commonDifficulty})`
      ).join("\n");

      const subjectSummary = Object.entries(subjectFrequency)
        .sort(([,a], [,b]) => b - a)
        .map(([subj, cnt]) => `${subj}: ${cnt} questions (${Math.round((cnt / Math.max(totalPYQs, 1)) * 100)}% share)`)
        .join(", ");

      // Get user's weak topics for targeting
      const { data: userTopics } = await supabase
        .from("topics")
        .select("name, memory_strength, subjects(name)")
        .eq("user_id", user.id)
        .eq("deleted", false)
        .order("memory_strength", { ascending: true })
        .limit(20);

      const topicContext = userTopics?.map((t: any) => `${t.name} (strength: ${Math.round((t.memory_strength || 0) * 100)}%)`).join(", ") || "General topics";

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are an expert Indian competitive exam analyst specializing in ${targetExam}. You have analyzed the last 5 years of Previous Year Questions (PYQs) and must generate PREDICTED questions for the upcoming exam.

YOUR ANALYSIS OF ${totalPYQs} PYQs FROM LAST 5 YEARS:

TOPIC FREQUENCY PATTERNS:
${patternSummary || "No historical data available — use general exam patterns."}

SUBJECT WEIGHTAGE:
${subjectSummary || "Equal distribution assumed."}

PREDICTION RULES:
- probability_score must be based on REAL pattern frequency: topics appearing 5/5 years = 85-95%, 4/5 = 72-84%, 3/5 = 58-71%, 2/5 = 40-57%, 1/5 = 25-39%
- trend_reason must cite specific evidence like "Appeared in 4 out of 5 years (2020-2024)" or "Increasing trend: 1 question in 2021 → 3 in 2024"
- Questions must be exam-level authentic, not textbook definitions
- Each question must feel like it could genuinely appear in the next exam
- probability_level: "Very High" (80%+), "High" (60-79%), "Medium" (40-59%)

Generate exactly ${count || 10} questions.`
            },
            {
              role: "user",
              content: `Generate ${count || 10} predicted questions for ${targetExam}, subject: ${targetSubject}.
User's weak areas for targeting: ${topicContext}.
Focus on high-probability topics based on the 5-year pattern analysis above.`
            }
          ],
          tools: [{
            type: "function",
            function: {
              name: "return_questions",
              description: "Return predicted exam questions with pattern-based probability",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string" },
                        options: { type: "array", items: { type: "string" } },
                        correct_answer: { type: "integer" },
                        explanation: { type: "string" },
                        probability_level: { type: "string", enum: ["Very High", "High", "Medium"] },
                        probability_score: { type: "integer", minimum: 25, maximum: 95 },
                        trend_reason: { type: "string", description: "Evidence-based reason citing PYQ pattern, e.g. 'Appeared in 4/5 years, increasing weight'" },
                        topic: { type: "string" },
                        difficulty: { type: "string", enum: ["easy", "medium", "hard"] }
                      },
                      required: ["question", "options", "correct_answer", "explanation", "probability_level", "probability_score", "trend_reason", "topic", "difficulty"]
                    }
                  }
                },
                required: ["questions"]
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "return_questions" } }
        }),
      });

      if (!aiResponse.ok) {
        const status = aiResponse.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI error: ${status}`);
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      let questions = [];
      if (toolCall?.function?.arguments) {
        const parsed = JSON.parse(toolCall.function.arguments);
        questions = parsed.questions || [];
      }

      return new Response(JSON.stringify({
        questions,
        analysis: {
          totalPYQsAnalyzed: totalPYQs,
          topTrendingTopics: trendingTopics.slice(0, 5).map(t => t.topic),
          examType: targetExam,
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "get_user_exam") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("exam_type")
        .eq("id", user.id)
        .maybeSingle();
      return new Response(JSON.stringify({ exam_type: profile?.exam_type || "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "get_bank_questions") {
      // Fetch real questions from question_bank using pagination
      const batchSize = 1000;
      let allQuestions: any[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase.from("question_bank").select("*");
        if (exam_type) query = query.eq("exam_type", exam_type);
        if (subject) query = query.eq("subject", subject);
        if (topic) query = query.ilike("topic", `%${topic}%`);
        if (year) query = query.eq("year", year);
        if (difficulty) query = query.eq("difficulty", difficulty);
        query = query.range(offset, offset + batchSize - 1);

        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
          allQuestions = allQuestions.concat(data);
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      // If count specified, randomly pick that many; otherwise return all
      let result = allQuestions;
      if (count && count > 0 && allQuestions.length > count) {
        for (let i = allQuestions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
        }
        result = allQuestions.slice(0, count);
      }

      return new Response(JSON.stringify({ questions: result, totalAvailable: allQuestions.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "save_progress") {
      const { question_id, question_source, is_correct, selected_answer, time_taken_seconds } = body;
      const { error } = await supabase.from("practice_progress").insert({
        user_id: user.id,
        question_id,
        question_source,
        is_correct,
        selected_answer,
        time_taken_seconds,
      });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "get_progress_stats") {
      const { data, error } = await supabase
        .from("practice_progress")
        .select("is_correct, question_source")
        .eq("user_id", user.id);
      if (error) throw error;

      const total = data?.length || 0;
      const correct = data?.filter((d: any) => d.is_correct).length || 0;
      const bankCount = data?.filter((d: any) => d.question_source === "bank").length || 0;
      const predictedCount = data?.filter((d: any) => d.question_source === "predicted").length || 0;

      return new Response(JSON.stringify({ total, correct, accuracy: total > 0 ? Math.round((correct / total) * 100) : 0, bankCount, predictedCount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("confidence-practice error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
