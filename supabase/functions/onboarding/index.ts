import { createClient } from "npm:@supabase/supabase-js@2";

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
      if (data.study_mode) updates.study_preferences = { study_mode: data.study_mode };
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
      const updates: Record<string, unknown> = {};
      if (requestBody.display_name) updates.display_name = requestBody.display_name;
      if (requestBody.exam_type) updates.exam_type = requestBody.exam_type;
      if (requestBody.exam_date) updates.exam_date = requestBody.exam_date;
      if (requestBody.study_mode) updates.study_preferences = { study_mode: requestBody.study_mode };
      if (Object.keys(updates).length > 0) {
        await adminClient.from("profiles").update(updates).eq("id", userId);
      }

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

      // Mark onboarding as completed
      await adminClient.from("profiles").update({ onboarding_completed: true }).eq("id", userId);

      return json({ success: true, redirect_to: "/app", profile_updated: true, subjects_created: subjectsCreated, topics_created: topicsCreated });
    }

    // --- SKIP onboarding ---
    if (action === "skip") {
      const userId = await resolveUserId();
      if (!userId) return json({ error: "Unauthorized" }, 401);
      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await adminClient.from("profiles").update({ onboarding_completed: true }).eq("id", userId);
      return json({ success: true, redirect_to: "/app" });
    }

    return json({ error: "Invalid action. Supported: exam-types, status, suggested-subjects, suggested-topics, step1-name, step2-exam, step3-date, step4-subjects, step5-topics, step6-mode, save-step, complete, skip" }, 400);
  } catch (e) {
    console.error("onboarding error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
