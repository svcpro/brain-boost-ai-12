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

    const { action, exam_type, subject, topic, year, difficulty, mode, count } = await req.json();

    if (action === "generate_predicted") {
      // Use AI to generate predicted questions
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      // Get user's topics for context
      const { data: userTopics } = await supabase
        .from("topics")
        .select("name, memory_strength, subjects(name)")
        .eq("user_id", user.id)
        .eq("deleted", false)
        .order("memory_strength", { ascending: true })
        .limit(20);

      const topicContext = userTopics?.map((t: any) => `${t.name} (${t.subjects?.name || 'General'}, strength: ${Math.round((t.memory_strength || 0) * 100)}%)`).join(", ") || "General topics";
      const targetExam = exam_type || "competitive exam";
      const targetSubject = subject || "mixed subjects";

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
              content: `You are an expert exam question predictor for Indian competitive exams. Generate high-probability predicted questions based on pattern analysis of last 5 years. Each question must be realistic, exam-level difficulty, and include 4 options with correct answer index (0-3).

Return a JSON array of questions. Each question object:
{
  "question": "question text",
  "options": ["A", "B", "C", "D"],
  "correct_answer": 0,
  "explanation": "brief explanation",
  "probability_level": "Very High" | "High" | "Medium",
  "probability_score": 70-98,
  "topic": "topic name",
  "difficulty": "easy" | "medium" | "hard"
}

Generate exactly ${count || 10} questions.`
            },
            {
              role: "user",
              content: `Generate ${count || 10} predicted questions for ${targetExam} exam, subject: ${targetSubject}. User's weak areas: ${topicContext}. Focus on high-probability topics that are likely to appear based on recent trends.`
            }
          ],
          tools: [{
            type: "function",
            function: {
              name: "return_questions",
              description: "Return predicted exam questions",
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
                        probability_score: { type: "integer" },
                        topic: { type: "string" },
                        difficulty: { type: "string", enum: ["easy", "medium", "hard"] }
                      },
                      required: ["question", "options", "correct_answer", "explanation", "probability_level", "probability_score", "topic", "difficulty"]
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

      return new Response(JSON.stringify({ questions }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "get_bank_questions") {
      // AI-generate previous year style questions based on user's exam selection
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const targetExam = exam_type || "competitive exam";
      const targetSubject = subject || "mixed subjects";
      const targetYear = year || "last 5 years (2020-2024)";
      const targetDifficulty = difficulty || "mixed";
      const targetTopic = topic || "all topics";
      const qCount = count || 20;

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
              content: `You are an expert exam paper setter for Indian competitive exams. Generate authentic previous year exam-style questions that closely match real ${targetExam} exam patterns.

Rules:
- Questions MUST feel like real previous year questions from ${targetExam}
- Each question should have a realistic "previous_year_tag" like "${targetExam} ${typeof targetYear === 'number' ? targetYear : '2023'}" 
- Include 4 options (A, B, C, D) with exactly one correct answer (index 0-3)
- Provide a brief, clear explanation for each answer
- Vary difficulty levels realistically
- Cover important topics that frequently appear in ${targetExam}
- If a specific year is given, style questions to match that year's paper pattern
- If a subject is given, all questions must be from that subject

Generate exactly ${qCount} questions.`
            },
            {
              role: "user",
              content: `Generate ${qCount} previous year style questions for:
- Exam: ${targetExam}
- Subject: ${targetSubject}
- Year style: ${targetYear}
- Difficulty: ${targetDifficulty}
- Topic focus: ${targetTopic}

Make them feel exactly like real ${targetExam} previous year papers.`
            }
          ],
          tools: [{
            type: "function",
            function: {
              name: "return_bank_questions",
              description: "Return previous year style exam questions",
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
                        topic: { type: "string" },
                        difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                        exam_type: { type: "string" },
                        subject: { type: "string" },
                        year: { type: "integer" },
                        previous_year_tag: { type: "string" }
                      },
                      required: ["question", "options", "correct_answer", "explanation", "topic", "difficulty", "exam_type", "subject", "year", "previous_year_tag"]
                    }
                  }
                },
                required: ["questions"]
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "return_bank_questions" } }
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

      return new Response(JSON.stringify({ questions, totalAvailable: questions.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "save_progress") {
      const { question_id, question_source, is_correct, selected_answer, time_taken_seconds } = await req.json();
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
