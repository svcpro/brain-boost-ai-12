import { createClient } from "npm:@supabase/supabase-js@2";
import { callAI, getAIToolArgs } from "../_shared/aiClient.ts";

// Helper: fetch the full subject list (with topic counts) for a user.
// Used to ensure every mutating endpoint returns a non-empty subjects list
// when the user already has data, so API testers never see "Subject List Empty"
// after a successful add/AI-generate call.
async function fetchUserSubjectsWithTopics(adminClient: any, userId: string) {
  const { data: subjects } = await adminClient
    .from("subjects")
    .select("id, name, created_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (!subjects || subjects.length === 0) return [];

  const { data: topics } = await adminClient
    .from("topics")
    .select("id, name, subject_id, marks_impact_weight")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const byId = new Map<string, any[]>();
  for (const t of topics || []) {
    const arr = byId.get(t.subject_id) || [];
    arr.push(t);
    byId.set(t.subject_id, arr);
  }

  return subjects.map((s: any) => ({
    ...s,
    topics: byId.get(s.id) || [],
    topic_count: (byId.get(s.id) || []).length,
  }));
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-access-token, access-token, x-api-key, api-key, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXAM_TYPES = [
  { name: "UPSC CSE", category: "Civil Services", emoji: "🏛️" },
  { name: "UPSC IES", category: "Civil Services", emoji: "🏛️" },
  { name: "UPSC CMS", category: "Civil Services", emoji: "🏛️" },
  { name: "UPSC CAPF", category: "Civil Services", emoji: "🏛️" },
  { name: "State PSC", category: "Civil Services", emoji: "🏛️" },
  { name: "NEET UG", category: "Medical", emoji: "🩺" },
  { name: "NEET PG", category: "Medical", emoji: "🩺" },
  { name: "JEE Main", category: "Engineering", emoji: "⚙️" },
  { name: "JEE Advanced", category: "Engineering", emoji: "⚙️" },
  { name: "GATE", category: "Engineering", emoji: "⚙️" },
  { name: "BITSAT", category: "Engineering", emoji: "⚙️" },
  { name: "CAT", category: "MBA", emoji: "📊" },
  { name: "XAT", category: "MBA", emoji: "📊" },
  { name: "CLAT", category: "Law", emoji: "⚖️" },
  { name: "AILET", category: "Law", emoji: "⚖️" },
  { name: "LSAT", category: "Law", emoji: "⚖️" },
  { name: "NMAT", category: "MBA", emoji: "📊" },
  { name: "SSC CGL", category: "Government Jobs", emoji: "🏢" },
  { name: "SSC CHSL", category: "Government Jobs", emoji: "🏢" },
  { name: "SSC MTS", category: "Government Jobs", emoji: "🏢" },
  { name: "IBPS PO", category: "Banking", emoji: "🏦" },
  { name: "IBPS Clerk", category: "Banking", emoji: "🏦" },
  { name: "SBI PO", category: "Banking", emoji: "🏦" },
  { name: "SBI Clerk", category: "Banking", emoji: "🏦" },
  { name: "RBI Grade B", category: "Banking", emoji: "🏦" },
  { name: "RRB NTPC", category: "Railways", emoji: "🚂" },
  { name: "RRB Group D", category: "Railways", emoji: "🚂" },
  { name: "NDA", category: "Defence", emoji: "🎖️" },
  { name: "CDS", category: "Defence", emoji: "🎖️" },
  { name: "AFCAT", category: "Defence", emoji: "🎖️" },
  { name: "GRE", category: "International", emoji: "🌍" },
  { name: "GMAT", category: "International", emoji: "🌍" },
  { name: "SAT", category: "International", emoji: "🌍" },
  { name: "TOEFL", category: "International", emoji: "🌍" },
  { name: "IELTS", category: "International", emoji: "🌍" },
  { name: "UGC NET", category: "Teaching & Research", emoji: "📖" },
  { name: "CSIR NET", category: "Teaching & Research", emoji: "📖" },
  { name: "CTET", category: "Teaching & Research", emoji: "📖" },
  { name: "CUET", category: "University", emoji: "🎓" },
  { name: "KVPY", category: "Research", emoji: "🔬" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const requestBody = ["POST", "PUT", "PATCH"].includes(req.method)
      ? await req.clone().json().catch(() => ({}))
      : {};
    // The function name "onboarding" is the base, so action comes from query or body
    const action = url.searchParams.get("action") ||
      requestBody.action ||
      pathParts[pathParts.length - 1]; // fallback: last path segment

    const json = (data: any, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // --- EXAM TYPES ---
    if (action === "exam-types" || action === "exam_types") {
      const categories = [...new Set(EXAM_TYPES.map(e => e.category))];
      return json({
        success: true,
        exam_types: EXAM_TYPES,
        categories,
        total: EXAM_TYPES.length,
      });
    }

    // --- Helper: resolve end-user strictly from Bearer JWT ---
    const normalizeJwtToken = (value: unknown): string => {
      if (typeof value !== "string") return "";
      const trimmed = value.trim();
      if (!trimmed) return "";

      const token = trimmed.startsWith("Bearer ")
        ? trimmed.slice(7).trim()
        : trimmed;

      return token.split(".").length === 3 ? token : "";
    };

    const resolveAuthenticatedUserId = async (): Promise<{
      userId: string | null;
      reason: "missing_bearer" | "invalid_bearer" | null;
      debug: {
        hasAuthHeader: boolean;
        hasHeaderAccessToken: boolean;
        hasApiKeyHeader: boolean;
        hasQueryAuthorization: boolean;
        hasQueryAccessToken: boolean;
        hasQueryApikey: boolean;
        hasBodyAuthorization: boolean;
        hasBodyAccessToken: boolean;
        hasBodyApikey: boolean;
        jwtSources: number;
      };
    }> => {
      const queryAuthorization = String(url.searchParams.get("Authorization") || url.searchParams.get("authorization") || "").trim();
      const queryAccessToken = String(url.searchParams.get("access_token") || url.searchParams.get("accessToken") || url.searchParams.get("token") || "").trim();
      const queryApiKey = String(url.searchParams.get("apikey") || url.searchParams.get("apiKey") || url.searchParams.get("x-api-key") || "").trim();
      const bodyAuthorization = String(requestBody.Authorization || requestBody.authorization || "").trim();
      const bodyAccessToken = String(requestBody.access_token || requestBody.accessToken || requestBody.token || "").trim();
      const bodyApiKey = String(requestBody.apikey || requestBody.apiKey || requestBody["x-api-key"] || requestBody["api-key"] || "").trim();
      const headerAuthorization = String(req.headers.get("Authorization") || "").trim();
      const headerAccessTokenCandidates = [
        req.headers.get("x-access-token"),
        req.headers.get("access-token"),
      ].map((value) => String(value || "").trim()).filter(Boolean);
      const headerApiKeyCandidates = [
        req.headers.get("x-api-key"),
        req.headers.get("api-key"),
        req.headers.get("x-api-token"),
        req.headers.get("apikey"),
      ].map((value) => String(value || "").trim()).filter(Boolean);

      const jwtSources = [
        headerAuthorization,
        queryAuthorization,
        bodyAuthorization,
        queryAccessToken,
        bodyAccessToken,
        ...headerAccessTokenCandidates,
      ].filter(Boolean);
      const debug = {
        hasAuthHeader: !!headerAuthorization,
        hasHeaderAccessToken: headerAccessTokenCandidates.length > 0,
        hasApiKeyHeader: headerApiKeyCandidates.length > 0,
        hasQueryAuthorization: !!queryAuthorization,
        hasQueryAccessToken: !!queryAccessToken,
        hasQueryApikey: !!queryApiKey,
        hasBodyAuthorization: !!bodyAuthorization,
        hasBodyAccessToken: !!bodyAccessToken,
        hasBodyApikey: !!bodyApiKey,
        jwtSources: jwtSources.length,
      };

      const tokenCandidates = Array.from(new Set(jwtSources.map(normalizeJwtToken).filter(Boolean)));

      if (tokenCandidates.length === 0) {
        return { userId: null, reason: "missing_bearer", debug };
      }

      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      for (const token of tokenCandidates) {
        const { data: userData, error: userError } = await adminClient.auth.getUser(token);
        if (!userError && userData?.user?.id) {
          return { userId: userData.user.id, reason: null, debug };
        }
      }

      return { userId: null, reason: "invalid_bearer", debug };
    };

    // --- ONBOARDING STATUS ---
    if (action === "status") {
      const { userId, reason, debug } = await resolveAuthenticatedUserId();
      if (!userId) {
        console.log("[onboarding/status] Bearer auth required", debug);
        return json({
          error: reason === "missing_bearer"
            ? "Authorization Bearer token required"
            : "Invalid or expired bearer token",
        }, 401);
      }

      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: profile } = await adminClient
        .from("profiles")
        .select("display_name, exam_type, exam_date, study_preferences, onboarding_completed")
        .eq("id", userId)
        .maybeSingle();

      // Determine current step based on what data exists
      // Auto-generated names like "User1234", pure numbers, or very short names should NOT count
      const nameVal = (profile?.display_name || "").trim();
      const hasRealName = nameVal.length >= 2 &&
        !/^User\d{3,6}$/i.test(nameVal) &&
        !/^\d+$/.test(nameVal) &&
        !nameVal.endsWith("@phone.acry.ai");

      let currentStep = 0;
      if (hasRealName) currentStep = 1;
      if (currentStep >= 1 && profile?.exam_type) currentStep = 2;
      if (currentStep >= 2 && profile?.exam_date) currentStep = 3;

      const { count: subjectCount } = await adminClient
        .from("subjects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if (currentStep >= 3 && (subjectCount || 0) > 0) currentStep = 4;

      const { count: topicCount } = await adminClient
        .from("topics")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if (currentStep >= 4 && (topicCount || 0) > 0) currentStep = 5;

      const studyMode = (profile?.study_preferences as any)?.study_mode;
      if (currentStep >= 5 && studyMode) currentStep = 6;

      const onboarded = profile?.onboarding_completed === true && currentStep >= 6;

      return json({
        success: true,
        onboarded,
        current_step: currentStep,
        display_name: profile?.display_name,
        exam_type: profile?.exam_type,
        exam_date: profile?.exam_date,
        study_mode: studyMode,
        subjects_count: subjectCount || 0,
        topics_count: topicCount || 0,
      });
    }

    // --- Helper: resolve userId from request ---
    const resolveUserId = async (): Promise<string | null> => {
      const { userId } = await resolveAuthenticatedUserId();
      return userId;
    };

    // --- STEP 1: Save display name ---
    if (action === "step1-name" || action === "step1_name") {
      const userId = await resolveUserId();
      if (!userId) return json({ error: "Unauthorized" }, 401);
      const displayName = String(requestBody.display_name || url.searchParams.get("display_name") || "").trim();
      if (displayName.length < 2) return json({ error: "Display name must be at least 2 characters" }, 400);

      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await adminClient.from("profiles").update({ display_name: displayName }).eq("id", userId);
      return json({ success: true, next_step: 2 });
    }

    // --- STEP 2: Save exam type ---
    if (action === "step2-exam" || action === "step2_exam") {
      const userId = await resolveUserId();
      if (!userId) return json({ error: "Unauthorized" }, 401);
      const examType = String(requestBody.exam_type || "").trim();
      if (!examType) return json({ error: "exam_type is required" }, 400);

      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await adminClient.from("profiles").update({ exam_type: examType }).eq("id", userId);

      // Return suggested subjects
      const subjectMap: Record<string, string[]> = {
        "NEET UG": ["Physics", "Chemistry", "Biology"],
        "NEET PG": ["Anatomy", "Physiology", "Biochemistry", "Pathology", "Pharmacology", "Microbiology"],
        "JEE Main": ["Physics", "Chemistry", "Mathematics"],
        "JEE Advanced": ["Physics", "Chemistry", "Mathematics"],
        "GATE": ["Engineering Mathematics", "General Aptitude", "Core Subject"],
        "UPSC CSE": ["History", "Geography", "Polity", "Economy", "Science & Technology", "Environment", "Ethics", "Essay"],
        "SSC CGL": ["Quantitative Aptitude", "English", "General Intelligence", "General Awareness"],
        "CAT": ["Quantitative Aptitude", "Verbal Ability", "Data Interpretation", "Logical Reasoning"],
        "CLAT": ["English", "Current Affairs", "Legal Reasoning", "Logical Reasoning", "Quantitative Techniques"],
      };
      const subjects = subjectMap[examType] || ["General Studies", "Aptitude", "Reasoning"];
      return json({ success: true, suggested_subjects: subjects, next_step: 3 });
    }

    // --- STEP 3: Save exam date ---
    if (action === "step3-date" || action === "step3_date") {
      const userId = await resolveUserId();
      if (!userId) return json({ error: "Unauthorized" }, 401);
      const examDate = String(requestBody.exam_date || "").trim();
      if (!examDate) return json({ error: "exam_date is required" }, 400);

      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await adminClient.from("profiles").update({ exam_date: examDate }).eq("id", userId);
      const daysUntil = Math.max(0, Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000));
      return json({ success: true, days_until_exam: daysUntil, next_step: 4 });
    }

    // --- LIST SUBJECTS (for current user) ---
    if (action === "list-subjects" || action === "list_subjects") {
      const userId = await resolveUserId();
      if (!userId) return json({ error: "Unauthorized" }, 401);
      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: subjects } = await adminClient
        .from("subjects")
        .select("id, name, created_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      return json({ success: true, subjects: subjects || [], total: (subjects || []).length });
    }

    // --- ADD SINGLE SUBJECT ---
    if (action === "add-subject" || action === "add_subject") {
      const userId = await resolveUserId();
      if (!userId) return json({ error: "Unauthorized" }, 401);
      const name = String(requestBody.name || requestBody.subject || "").trim();
      if (name.length < 1) return json({ error: "subject name is required" }, 400);
      if (name.length > 100) return json({ error: "subject name too long (max 100 chars)" }, 400);

      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      // Check for duplicate
      const { data: existing } = await adminClient
        .from("subjects")
        .select("id, name")
        .eq("user_id", userId)
        .eq("name", name)
        .is("deleted_at", null)
        .maybeSingle();

      let subjectRow = existing;
      let duplicate = !!existing;

      if (!existing) {
        const { data: created, error } = await adminClient
          .from("subjects")
          .insert({ user_id: userId, name })
          .select("id, name, created_at")
          .single();
        if (error) return json({ error: error.message }, 500);
        subjectRow = created;
      }

      // Always return the full updated subjects list so API testers
      // never see an empty "Subject List".
      const allSubjects = await fetchUserSubjectsWithTopics(adminClient, userId);
      return json({
        success: true,
        subject: subjectRow,
        duplicate,
        subjects: allSubjects,
        total: allSubjects.length,
      });
    }

    // --- DELETE SUBJECT ---
    if (action === "delete-subject" || action === "delete_subject") {
      const userId = await resolveUserId();
      if (!userId) return json({ error: "Unauthorized" }, 401);
      const subjectId = String(requestBody.subject_id || requestBody.id || "").trim();
      const subjectName = String(requestBody.name || "").trim();
      if (!subjectId && !subjectName) return json({ error: "subject_id or name required" }, 400);

      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const query = adminClient.from("subjects").update({ deleted_at: new Date().toISOString() }).eq("user_id", userId);
      const { error } = subjectId ? await query.eq("id", subjectId) : await query.eq("name", subjectName);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    // --- LIST TOPICS (optionally filtered by subject) ---
    if (action === "list-topics" || action === "list_topics") {
      const userId = await resolveUserId();
      if (!userId) return json({ error: "Unauthorized" }, 401);
      const subjectId = String(requestBody.subject_id || url.searchParams.get("subject_id") || "").trim();
      const subjectName = String(requestBody.subject || url.searchParams.get("subject") || "").trim();

      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      let resolvedSubjectId = subjectId;
      if (!resolvedSubjectId && subjectName) {
        const { data: sub } = await adminClient
          .from("subjects")
          .select("id")
          .eq("user_id", userId)
          .eq("name", subjectName)
          .is("deleted_at", null)
          .maybeSingle();
        resolvedSubjectId = sub?.id || "";
      }

      let q = adminClient
        .from("topics")
        .select("id, name, subject_id, marks_impact_weight, memory_strength, created_at")
        .eq("user_id", userId)
        .is("deleted_at", null);
      if (resolvedSubjectId) q = q.eq("subject_id", resolvedSubjectId);

      const { data: topics } = await q.order("created_at", { ascending: true });
      return json({ success: true, topics: topics || [], total: (topics || []).length, subject_id: resolvedSubjectId || null });
    }

    // --- ADD SINGLE TOPIC ---
    if (action === "add-topic" || action === "add_topic") {
      const userId = await resolveUserId();
      if (!userId) return json({ error: "Unauthorized" }, 401);
      const name = String(requestBody.name || requestBody.topic || "").trim();
      const subjectId = String(requestBody.subject_id || "").trim();
      const subjectName = String(requestBody.subject || "").trim();
      const marksWeight = Number(requestBody.marks_impact_weight ?? 5);
      if (name.length < 1) return json({ error: "topic name is required" }, 400);
      if (name.length > 200) return json({ error: "topic name too long (max 200 chars)" }, 400);
      if (!subjectId && !subjectName) return json({ error: "subject_id or subject name required" }, 400);

      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      // Resolve / auto-create subject
      let resolvedSubjectId = subjectId;
      if (!resolvedSubjectId) {
        const { data: existingSub } = await adminClient
          .from("subjects")
          .select("id")
          .eq("user_id", userId)
          .eq("name", subjectName)
          .is("deleted_at", null)
          .maybeSingle();
        if (existingSub) {
          resolvedSubjectId = existingSub.id;
        } else {
          const { data: newSub, error: subErr } = await adminClient
            .from("subjects")
            .insert({ user_id: userId, name: subjectName })
            .select("id")
            .single();
          if (subErr) return json({ error: subErr.message }, 500);
          resolvedSubjectId = newSub.id;
        }
      }

      // Check duplicate topic
      const { data: existingTopic } = await adminClient
        .from("topics")
        .select("id, name, subject_id, marks_impact_weight")
        .eq("user_id", userId)
        .eq("subject_id", resolvedSubjectId)
        .eq("name", name)
        .is("deleted_at", null)
        .maybeSingle();

      if (existingTopic) {
        return json({ success: true, topic: existingTopic, duplicate: true });
      }

      const { data: created, error } = await adminClient
        .from("topics")
        .insert({ user_id: userId, subject_id: resolvedSubjectId, name, marks_impact_weight: marksWeight })
        .select("id, name, subject_id, marks_impact_weight, created_at")
        .single();

      if (error) return json({ error: error.message }, 500);
      return json({ success: true, topic: created, duplicate: false });
    }

    // --- DELETE TOPIC ---
    if (action === "delete-topic" || action === "delete_topic") {
      const userId = await resolveUserId();
      if (!userId) return json({ error: "Unauthorized" }, 401);
      const topicId = String(requestBody.topic_id || requestBody.id || "").trim();
      if (!topicId) return json({ error: "topic_id required" }, 400);
      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { error } = await adminClient.from("topics").update({ deleted_at: new Date().toISOString() }).eq("id", topicId).eq("user_id", userId);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    // --- AI GENERATE SUBJECTS & TOPICS (full curriculum) ---
    if (action === "ai-generate-curriculum" || action === "ai_generate_curriculum" ||
        action === "ai-generate-subjects-topics" || action === "ai_generate_subjects_topics") {
      const userId = await resolveUserId();
      if (!userId) return json({ error: "Unauthorized" }, 401);
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) return json({ error: "AI gateway not configured" }, 500);

      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      // Resolve exam type
      let examType = String(requestBody.exam_type || url.searchParams.get("exam_type") || "").trim();
      if (!examType) {
        const { data: profile } = await adminClient.from("profiles").select("exam_type").eq("id", userId).maybeSingle();
        examType = String(profile?.exam_type || "general").trim();
      }
      const persist = requestBody.persist !== false; // default: save to DB

      // Call AI gateway with structured tool-calling
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content: "You are an expert academic curriculum designer for Indian competitive exams. Generate a complete subject and topic structure. Each topic needs a marks_impact_weight (0-10). Cover the full syllabus concisely."
            },
            {
              role: "user",
              content: `Generate the complete subject and topic structure for: ${examType}. Include ALL important topics per subject with accurate marks impact weights based on exam patterns.`
            }
          ],
          tools: [{
            type: "function",
            function: {
              name: "generate_curriculum",
              description: "Generate complete exam curriculum with subjects and topics",
              parameters: {
                type: "object",
                properties: {
                  subjects: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        topics: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              name: { type: "string" },
                              marks_impact_weight: { type: "number" },
                              priority: { type: "string", enum: ["critical", "high", "medium", "low"] }
                            },
                            required: ["name", "marks_impact_weight", "priority"]
                          }
                        }
                      },
                      required: ["name", "topics"]
                    }
                  },
                  exam_summary: { type: "string" }
                },
                required: ["subjects", "exam_summary"]
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "generate_curriculum" } },
        }),
      });

      if (!aiResp.ok) {
        if (aiResp.status === 429) return json({ error: "Rate limited, please try again later" }, 429);
        if (aiResp.status === 402) return json({ error: "AI credits exhausted" }, 402);
        return json({ error: "AI gateway error" }, 500);
      }

      const aiData = await aiResp.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      let curriculum: any = { subjects: [], exam_summary: `${examType} curriculum` };
      if (toolCall?.function?.arguments) {
        try { curriculum = JSON.parse(toolCall.function.arguments); } catch { /* ignore */ }
      }

      let subjectsCreated = 0, topicsCreated = 0;
      const persistedSubjects: any[] = [];

      if (persist) {
        for (const sub of curriculum.subjects || []) {
          const subName = String(sub.name || "").trim();
          if (!subName) continue;

          let subjectId: string;
          const { data: existingSub } = await adminClient
            .from("subjects").select("id").eq("user_id", userId).eq("name", subName).is("deleted_at", null).maybeSingle();
          if (existingSub) {
            subjectId = existingSub.id;
          } else {
            const { data: newSub, error: subErr } = await adminClient
              .from("subjects").insert({ user_id: userId, name: subName }).select("id").single();
            if (subErr) continue;
            subjectId = newSub.id;
            subjectsCreated++;
          }

          const persistedTopics: any[] = [];
          for (const t of sub.topics || []) {
            const tName = String(t.name || "").trim();
            if (!tName) continue;
            const { data: existingT } = await adminClient
              .from("topics").select("id").eq("user_id", userId).eq("subject_id", subjectId).eq("name", tName).is("deleted_at", null).maybeSingle();
            if (existingT) {
              persistedTopics.push({ id: existingT.id, name: tName, marks_impact_weight: t.marks_impact_weight ?? 5 });
              continue;
            }
            const { data: newT, error: tErr } = await adminClient
              .from("topics")
              .insert({ user_id: userId, subject_id: subjectId, name: tName, marks_impact_weight: Number(t.marks_impact_weight ?? 5) })
              .select("id, name, marks_impact_weight").single();
            if (tErr) continue;
            persistedTopics.push(newT);
            topicsCreated++;
          }
          persistedSubjects.push({ id: subjectId, name: subName, topics: persistedTopics });
        }
      }

      return json({
        success: true,
        exam_type: examType,
        exam_summary: curriculum.exam_summary,
        subjects: persist ? persistedSubjects : (curriculum.subjects || []),
        subjects_created: subjectsCreated,
        topics_created: topicsCreated,
        persisted: persist,
      });
    }

    // --- AI GENERATE TOPICS for a single subject ---
    if (action === "ai-generate-topics" || action === "ai_generate_topics") {
      const userId = await resolveUserId();
      if (!userId) return json({ error: "Unauthorized" }, 401);
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) return json({ error: "AI gateway not configured" }, 500);

      const subjectName = String(requestBody.subject || requestBody.subject_name || "").trim();
      const subjectIdInput = String(requestBody.subject_id || "").trim();
      if (!subjectName && !subjectIdInput) return json({ error: "subject or subject_id is required" }, 400);
      const persist = requestBody.persist !== false;

      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      // Resolve subject
      let resolvedSubjectId = subjectIdInput;
      let resolvedSubjectName = subjectName;
      if (!resolvedSubjectId && subjectName) {
        const { data: sub } = await adminClient
          .from("subjects").select("id, name").eq("user_id", userId).eq("name", subjectName).is("deleted_at", null).maybeSingle();
        if (sub) { resolvedSubjectId = sub.id; resolvedSubjectName = sub.name; }
      } else if (resolvedSubjectId) {
        const { data: sub } = await adminClient
          .from("subjects").select("id, name").eq("id", resolvedSubjectId).eq("user_id", userId).maybeSingle();
        if (sub) resolvedSubjectName = sub.name;
      }

      const { data: profile } = await adminClient.from("profiles").select("exam_type").eq("id", userId).maybeSingle();
      const examType = String(profile?.exam_type || "general").trim();

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: "You generate exam-relevant topics for a single subject. Each topic gets a marks_impact_weight (0-10) reflecting exam weightage." },
            { role: "user", content: `Generate the complete topic list for subject "${resolvedSubjectName}" in exam "${examType}". Return all important topics.` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "generate_topics",
              parameters: {
                type: "object",
                properties: {
                  topics: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        marks_impact_weight: { type: "number" },
                      },
                      required: ["name", "marks_impact_weight"],
                    },
                  },
                },
                required: ["topics"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "generate_topics" } },
        }),
      });

      if (!aiResp.ok) {
        if (aiResp.status === 429) return json({ error: "Rate limited, please try again later" }, 429);
        if (aiResp.status === 402) return json({ error: "AI credits exhausted" }, 402);
        return json({ error: "AI gateway error" }, 500);
      }

      const aiData = await aiResp.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      let topicsRaw: any[] = [];
      if (toolCall?.function?.arguments) {
        try { topicsRaw = JSON.parse(toolCall.function.arguments)?.topics || []; } catch { /* ignore */ }
      }

      // Auto-create subject if needed (when persisting)
      let topicsCreated = 0;
      const persistedTopics: any[] = [];
      if (persist) {
        if (!resolvedSubjectId && resolvedSubjectName) {
          const { data: newSub } = await adminClient.from("subjects")
            .insert({ user_id: userId, name: resolvedSubjectName }).select("id").single();
          resolvedSubjectId = newSub?.id || "";
        }
        if (resolvedSubjectId) {
          for (const t of topicsRaw) {
            const tName = String(t.name || "").trim();
            if (!tName) continue;
            const { data: existing } = await adminClient
              .from("topics").select("id, name, marks_impact_weight").eq("user_id", userId).eq("subject_id", resolvedSubjectId).eq("name", tName).is("deleted_at", null).maybeSingle();
            if (existing) { persistedTopics.push(existing); continue; }
            const { data: newT } = await adminClient.from("topics")
              .insert({ user_id: userId, subject_id: resolvedSubjectId, name: tName, marks_impact_weight: Number(t.marks_impact_weight ?? 5) })
              .select("id, name, marks_impact_weight").single();
            if (newT) { persistedTopics.push(newT); topicsCreated++; }
          }
        }
      }

      return json({
        success: true,
        subject: resolvedSubjectName,
        subject_id: resolvedSubjectId || null,
        topics: persist ? persistedTopics : topicsRaw,
        topics_created: topicsCreated,
        persisted: persist,
      });
    }

    // --- STEP 4: Save subjects ---
    if (action === "step4-subjects" || action === "step4_subjects") {
      const userId = await resolveUserId();
      if (!userId) return json({ error: "Unauthorized" }, 401);
      const subjects: string[] = requestBody.subjects || [];
      if (!Array.isArray(subjects) || subjects.length === 0) return json({ error: "subjects array is required" }, 400);

      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      for (const name of subjects) {
        await adminClient.from("subjects").upsert({ user_id: userId, name: String(name).trim() }, { onConflict: "user_id,name", ignoreDuplicates: true });
      }
      return json({ success: true, next_step: 5 });
    }

    // --- Suggested subjects for an exam type ---
    if (action === "suggested-subjects" || action === "suggested_subjects") {
      const examType = String(requestBody.exam_type || url.searchParams.get("exam_type") || "").trim();
      const subjectMap: Record<string, string[]> = {
        "NEET UG": ["Physics", "Chemistry", "Biology"],
        "NEET PG": ["Anatomy", "Physiology", "Biochemistry", "Pathology", "Pharmacology", "Microbiology"],
        "JEE Main": ["Physics", "Chemistry", "Mathematics"],
        "JEE Advanced": ["Physics", "Chemistry", "Mathematics"],
        "GATE": ["Engineering Mathematics", "General Aptitude", "Core Subject"],
        "UPSC CSE": ["History", "Geography", "Polity", "Economy", "Science & Technology", "Environment", "Ethics", "Essay"],
        "SSC CGL": ["Quantitative Aptitude", "English", "General Intelligence", "General Awareness"],
        "CAT": ["Quantitative Aptitude", "Verbal Ability", "Data Interpretation", "Logical Reasoning"],
        "CLAT": ["English", "Current Affairs", "Legal Reasoning", "Logical Reasoning", "Quantitative Techniques"],
      };
      const subjects = subjectMap[examType] || ["General Studies", "Aptitude", "Reasoning"];
      return json({ success: true, subjects, exam_type: examType });
    }

    // --- Suggested topics for a subject ---
    if (action === "suggested-topics" || action === "suggested_topics") {
      const subject = requestBody.subject || url.searchParams.get("subject") || "";
      const topicMap: Record<string, string[]> = {
        "Physics": ["Mechanics", "Thermodynamics", "Optics", "Electromagnetism", "Modern Physics", "Waves"],
        "Chemistry": ["Organic Chemistry", "Inorganic Chemistry", "Physical Chemistry"],
        "Biology": ["Cell Biology", "Genetics", "Ecology", "Human Physiology", "Plant Biology", "Evolution"],
        "Mathematics": ["Algebra", "Calculus", "Trigonometry", "Coordinate Geometry", "Probability & Statistics"],
        "History": ["Ancient India", "Medieval India", "Modern India", "World History"],
        "Geography": ["Physical Geography", "Indian Geography", "World Geography", "Climatology"],
        "Polity": ["Constitution", "Governance", "Panchayati Raj", "Judiciary"],
        "Economy": ["Microeconomics", "Macroeconomics", "Indian Economy", "Banking & Finance"],
      };
      const topics = topicMap[subject] || ["Fundamentals", "Advanced Concepts", "Practice Problems"];
      return json({ success: true, topics });
    }

    // --- STEP 5: Save topics ---
    if (action === "step5-topics" || action === "step5_topics") {
      const userId = await resolveUserId();
      if (!userId) return json({ error: "Unauthorized" }, 401);
      const topicsBySubject: Record<string, string[]> = requestBody.topics_by_subject || {};
      if (Object.keys(topicsBySubject).length === 0) return json({ error: "topics_by_subject is required" }, 400);

      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      let totalTopics = 0;
      for (const [subjectName, topics] of Object.entries(topicsBySubject)) {
        const { data: subjectRow } = await adminClient.from("subjects").select("id").eq("user_id", userId).eq("name", subjectName).maybeSingle();
        const subjectId = subjectRow?.id;
        if (!subjectId) continue;
        for (const topicName of (topics as string[])) {
          await adminClient.from("topics").upsert({ user_id: userId, subject_id: subjectId, name: String(topicName).trim() }, { onConflict: "user_id,subject_id,name", ignoreDuplicates: true });
          totalTopics++;
        }
      }
      return json({ success: true, total_topics: totalTopics, next_step: 6 });
    }

    // --- STEP 6: Save study mode ---
    if (action === "step6-mode" || action === "step6_mode") {
      const userId = await resolveUserId();
      if (!userId) return json({ error: "Unauthorized" }, 401);
      const studyMode = String(requestBody.study_mode || "focus").trim();

      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      // Merge into existing study_preferences instead of overwriting
      const { data: existing } = await adminClient.from("profiles").select("study_preferences").eq("id", userId).maybeSingle();
      const merged = { ...(typeof existing?.study_preferences === "object" && existing.study_preferences ? existing.study_preferences : {}), study_mode: studyMode };
      await adminClient.from("profiles").update({ study_preferences: merged }).eq("id", userId);
      return json({ success: true });
    }

    // --- SAVE STEP (generic) ---
    if (action === "save-step" || action === "save_step") {
      const userId = await resolveUserId();
      if (!userId) return json({ error: "Unauthorized" }, 401);
      const step = requestBody.step;
      const data = requestBody.data || {};
      if (!step) return json({ error: "step is required" }, 400);

      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const updates: Record<string, unknown> = {};
      if (data.display_name) updates.display_name = data.display_name;
      if (data.exam_type) updates.exam_type = data.exam_type;
      if (data.exam_date) updates.exam_date = data.exam_date;
      if (data.study_mode) {
        const { data: existing } = await adminClient.from("profiles").select("study_preferences").eq("id", userId).maybeSingle();
        const merged = { ...(typeof existing?.study_preferences === "object" && existing.study_preferences ? existing.study_preferences : {}), study_mode: data.study_mode };
        updates.study_preferences = merged;
      }
      if (Object.keys(updates).length > 0) {
        await adminClient.from("profiles").update(updates).eq("id", userId);
      }
      return json({ success: true, next_step: step + 1 });
    }

    // --- COMPLETE onboarding ---
    if (action === "complete") {
      const userId = await resolveUserId();
      if (!userId) return json({ error: "Unauthorized" }, 401);

      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      // Fetch existing profile to merge study_preferences
      const { data: existingProfile } = await adminClient.from("profiles").select("study_preferences").eq("id", userId).maybeSingle();
      const existingPrefs = typeof existingProfile?.study_preferences === "object" && existingProfile.study_preferences ? existingProfile.study_preferences : {};

      const updates: Record<string, unknown> = {};
      if (requestBody.display_name) updates.display_name = requestBody.display_name;
      if (requestBody.exam_type) updates.exam_type = requestBody.exam_type;
      if (requestBody.exam_date) updates.exam_date = requestBody.exam_date;

      // Merge study_preferences: keep existing, add study_mode if provided, set onboarded=true
      const mergedPrefs: Record<string, unknown> = { ...existingPrefs as Record<string, unknown> };
      if (requestBody.study_mode) mergedPrefs.study_mode = requestBody.study_mode;
      mergedPrefs.onboarded = true;
      updates.study_preferences = mergedPrefs;
      updates.onboarding_completed = true;

      await adminClient.from("profiles").update(updates).eq("id", userId);

      let subjectsCreated = 0, topicsCreated = 0;
      if (requestBody.subjects && Array.isArray(requestBody.subjects)) {
        for (const name of requestBody.subjects) {
          await adminClient.from("subjects").upsert({ user_id: userId, name: String(name).trim() }, { onConflict: "user_id,name", ignoreDuplicates: true });
          subjectsCreated++;
        }
      }
      if (requestBody.topics_by_subject && typeof requestBody.topics_by_subject === "object") {
        for (const [subjectName, topics] of Object.entries(requestBody.topics_by_subject)) {
          const { data: subjectRow } = await adminClient.from("subjects").select("id").eq("user_id", userId).eq("name", subjectName).maybeSingle();
          if (!subjectRow?.id) continue;
          for (const topicName of (topics as string[])) {
            await adminClient.from("topics").upsert({ user_id: userId, subject_id: subjectRow.id, name: String(topicName).trim() }, { onConflict: "user_id,subject_id,name", ignoreDuplicates: true });
            topicsCreated++;
          }
        }
      }

      return json({ success: true, redirect_to: "/app", profile_updated: true, subjects_created: subjectsCreated, topics_created: topicsCreated });
    }

    // --- SKIP onboarding ---
    if (action === "skip") {
      const userId = await resolveUserId();
      if (!userId) return json({ error: "Unauthorized" }, 401);
      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: existing } = await adminClient.from("profiles").select("study_preferences").eq("id", userId).maybeSingle();
      const merged = { ...(typeof existing?.study_preferences === "object" && existing.study_preferences ? existing.study_preferences : {}), onboarded: true };
      await adminClient.from("profiles").update({ onboarding_completed: true, study_preferences: merged }).eq("id", userId);
      return json({ success: true, redirect_to: "/app" });
    }

    return json({ error: "Invalid action. Supported: exam-types, status, suggested-subjects, suggested-topics, list-subjects, add-subject, delete-subject, list-topics, add-topic, delete-topic, ai-generate-curriculum, ai-generate-topics, step1-name, step2-exam, step3-date, step4-subjects, step5-topics, step6-mode, save-step, complete, skip" }, 400);
  } catch (e) {
    console.error("onboarding error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
