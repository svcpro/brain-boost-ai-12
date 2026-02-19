import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXAM_CONFIGS: Record<string, { subjects: string[]; label: string }> = {
  NEET: { subjects: ["Physics", "Chemistry", "Biology"], label: "NEET UG Medical Entrance" },
  JEE: { subjects: ["Physics", "Chemistry", "Mathematics"], label: "JEE Main Engineering Entrance" },
  UPSC: { subjects: ["General Knowledge", "History", "Geography", "Polity", "Economy"], label: "UPSC Civil Services Prelims" },
  SSC: { subjects: ["General Knowledge", "Mathematics", "Reasoning", "English"], label: "SSC CGL/CHSL" },
  Banking: { subjects: ["Reasoning", "Mathematics", "English", "General Knowledge"], label: "IBPS/SBI Bank Exams" },
  "State PSC": { subjects: ["General Knowledge", "History", "Geography", "Reasoning", "English"], label: "State Public Service Commission" },
};

const YEARS = [2024, 2023, 2022, 2021, 2020];

async function generateBatch(
  apiKey: string,
  examType: string,
  examLabel: string,
  subject: string,
  year: number,
  count: number
): Promise<any[]> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: `You are an expert Indian competitive exam question database. Generate authentic Previous Year Questions (PYQs) that closely match real exam patterns, difficulty, and syllabus for ${examLabel}.

Each question must be realistic and exam-level. Return questions via the tool call.`,
        },
        {
          role: "user",
          content: `Generate exactly ${count} authentic PYQs for ${examLabel}, subject: ${subject}, year: ${year}.

Requirements:
- Questions must match the actual exam pattern and difficulty
- Include the exact topic within the subject
- Cover different topics within the subject
- Each question needs 4 options with exactly one correct answer (index 0-3)
- Include a clear explanation for the correct answer
- Tag difficulty as easy, medium, or hard
- Set previous_year_tag like "${examType} ${year}"`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "return_pyqs",
            description: "Return generated PYQ questions",
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
                      correct_answer: { type: "integer", minimum: 0, maximum: 3 },
                      explanation: { type: "string" },
                      topic: { type: "string" },
                      difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                      previous_year_tag: { type: "string" },
                    },
                    required: ["question", "options", "correct_answer", "explanation", "topic", "difficulty", "previous_year_tag"],
                  },
                },
              },
              required: ["questions"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "return_pyqs" } },
    }),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 429) throw new Error("RATE_LIMITED");
    if (status === 402) throw new Error("CREDITS_EXHAUSTED");
    throw new Error(`AI error: ${status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) return [];

  const parsed = JSON.parse(toolCall.function.arguments);
  return (parsed.questions || []).map((q: any) => ({
    exam_type: examType,
    subject,
    year,
    question: q.question,
    options: q.options,
    correct_answer: q.correct_answer,
    explanation: q.explanation || "",
    topic: q.topic || subject,
    difficulty: q.difficulty || "medium",
    previous_year_tag: q.previous_year_tag || `${examType} ${year}`,
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, serviceKey);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { exam_type, questions_per_subject_per_year = 5 } = body;

    // Determine which exams to process
    const examsToProcess = exam_type ? [exam_type] : Object.keys(EXAM_CONFIGS);
    const results: { exam: string; subject: string; year: number; inserted: number }[] = [];
    let totalInserted = 0;
    let rateLimited = false;

    for (const exam of examsToProcess) {
      const config = EXAM_CONFIGS[exam];
      if (!config) continue;

      for (const subject of config.subjects) {
        for (const year of YEARS) {
          if (rateLimited) break;

          // Check if we already have questions for this combo
          const { count } = await supabase
            .from("question_bank")
            .select("*", { count: "exact", head: true })
            .eq("exam_type", exam)
            .eq("subject", subject)
            .eq("year", year);

          if ((count || 0) >= questions_per_subject_per_year) {
            results.push({ exam, subject, year, inserted: 0 });
            continue;
          }

          const needed = questions_per_subject_per_year - (count || 0);

          try {
            // Small delay to avoid rate limits
            await new Promise((r) => setTimeout(r, 500));

            const questions = await generateBatch(apiKey, exam, config.label, subject, year, needed);

            if (questions.length > 0) {
              const { error: insertError } = await supabase.from("question_bank").insert(questions);
              if (insertError) {
                console.error(`Insert error for ${exam}/${subject}/${year}:`, insertError);
              } else {
                totalInserted += questions.length;
              }
            }

            results.push({ exam, subject, year, inserted: questions.length });
          } catch (e: any) {
            if (e.message === "RATE_LIMITED") {
              rateLimited = true;
              console.warn("Rate limited, stopping batch generation");
              break;
            }
            if (e.message === "CREDITS_EXHAUSTED") {
              return new Response(JSON.stringify({
                error: "AI credits exhausted",
                results,
                totalInserted,
              }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            console.error(`Error generating ${exam}/${subject}/${year}:`, e);
            results.push({ exam, subject, year, inserted: 0 });
          }
        }
        if (rateLimited) break;
      }
      if (rateLimited) break;
    }

    return new Response(JSON.stringify({
      success: true,
      totalInserted,
      rateLimited,
      results,
      message: rateLimited
        ? `Inserted ${totalInserted} questions before hitting rate limit. Run again to continue.`
        : `Successfully inserted ${totalInserted} questions across ${examsToProcess.length} exam(s).`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("fetch-pyqs error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
