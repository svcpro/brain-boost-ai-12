import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    // --- ONBOARDING STATUS ---
    if (action === "status") {
      const queryAuthorization = String(url.searchParams.get("Authorization") || url.searchParams.get("authorization") || "").trim();
      const queryApiKey = String(url.searchParams.get("apikey") || url.searchParams.get("apiKey") || "").trim();
      const bodyAuthorization = String(requestBody.Authorization || requestBody.authorization || "").trim();
      const bodyApiKey = String(requestBody.apikey || requestBody.apiKey || "").trim();
      const headerAuthorization = String(req.headers.get("Authorization") || "").trim();
      const headerApiKey = String(req.headers.get("apikey") || "").trim();

      const authSources = [headerAuthorization, queryAuthorization, bodyAuthorization].filter(Boolean);
      const apiKeySources = [headerApiKey, queryApiKey, bodyApiKey].filter(Boolean);

      if (authSources.length === 0 && apiKeySources.length === 0) {
        console.log("[onboarding/status] Missing auth inputs", {
          hasAuthHeader: !!headerAuthorization,
          hasApikeyHeader: !!headerApiKey,
          hasQueryAuthorization: !!queryAuthorization,
          hasQueryApikey: !!queryApiKey,
          hasBodyAuthorization: !!bodyAuthorization,
          hasBodyApikey: !!bodyApiKey,
        });
        return json({ error: "Unauthorized" }, 401);
      }

      const bearerTokens = authSources
        .map((value) => value.startsWith("Bearer ") ? value.replace("Bearer ", "").trim() : value)
        .filter(Boolean);
      const primaryAuthHeader = authSources[0] || "";
      const primaryToken = bearerTokens[0] || "";

      // Service role client for lookups
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      let userId: string | null = null;

      // Try 1: JWT-based auth via getClaims
      for (let i = 0; i < authSources.length && !userId; i++) {
        const authSource = authSources[i];
        const sourceToken = bearerTokens[i] || "";
        if (!(authSource.startsWith("Bearer ") && sourceToken.split(".").length === 3)) continue;

        const jwtClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authSource } } }
        );
        const { data: claims, error: claimsErr } = await jwtClient.auth.getClaims(sourceToken);
        if (!claimsErr && claims?.claims?.sub) {
          userId = claims.claims.sub as string;
        }
      }

      // Try 2: API key-based auth fallback (support raw API keys from any source)
      if (!userId) {
        const apiKeyCandidates = [...apiKeySources, ...bearerTokens]
          .map((value) => value.trim())
          .filter(Boolean);

        for (const candidate of apiKeyCandidates) {
          const normalizedCandidate = candidate.startsWith("Bearer ")
            ? candidate.replace("Bearer ", "").trim()
            : candidate;
          const extractedApiKey = normalizedCandidate.match(/acry_[A-Za-z0-9]+/)?.[0] || "";
          if (!extractedApiKey) continue;

          const storedPrefix = `${extractedApiKey.substring(0, 10)}...`;
          const { data: keyRow } = await adminClient
            .from("api_keys")
            .select("created_by")
            .eq("key_prefix", storedPrefix)
            .eq("is_active", true)
            .maybeSingle();

          if (keyRow?.created_by) {
            userId = keyRow.created_by;
            break;
          }
        }

        // Legacy direct hash match fallback
        if (!userId) {
          for (const candidate of bearerTokens) {
            const { data: keyRow } = await adminClient
              .from("api_keys")
              .select("created_by")
              .eq("key_hash", candidate)
              .eq("is_active", true)
              .maybeSingle();
            if (keyRow?.created_by) {
              userId = keyRow.created_by;
              break;
            }
          }
        }
      }

      // Try 3: getUser with service role as last resort
      if (!userId) {
        for (const candidate of bearerTokens) {
          const { data: userData } = await adminClient.auth.getUser(candidate);
          if (userData?.user?.id) {
            userId = userData.user.id;
            break;
          }
        }
      }

      if (!userId) {
        console.log("[onboarding/status] Auth resolution failed", {
          authSourcePrefixes: authSources.map((value) => value.slice(0, 18)),
          apiKeySourcePrefixes: apiKeySources.map((value) => value.slice(0, 18)),
          primaryAuthLooksLikeJwt: primaryToken.split(".").length === 3,
          primaryApiKeyExtracted: !!apiKeySources.map((value) => value.match(/acry_[A-Za-z0-9]+/)?.[0] || "").find(Boolean),
          primaryAuthHeaderPrefix: primaryAuthHeader.slice(0, 18),
        });
        return json({ error: "Unauthorized" }, 401);
      }

      const { data: prefs } = await adminClient
        .from("user_preferences")
        .select("onboarded, exam_type, target_exam_date, study_mode")
        .eq("user_id", userId)
        .maybeSingle();

      return json({
        success: true,
        onboarded: prefs?.onboarded || false,
        current_step: prefs?.onboarded ? 6 : 0,
        exam_type: prefs?.exam_type,
        target_exam_date: prefs?.target_exam_date,
        study_mode: prefs?.study_mode,
      });
    }

    // --- SUGGESTED SUBJECTS for exam type ---
    if (action === "suggested-subjects" || action === "suggested_subjects") {
      const examType = requestBody.exam_type || url.searchParams.get("exam_type");
      
      // Return common subjects based on exam type category
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

      const subjects = subjectMap[examType || ""] || ["General Studies", "Aptitude", "Reasoning"];
      return json({ success: true, subjects: subjects.map(s => ({ name: s })) });
    }

    return json({ error: "Invalid action. Supported: exam-types, status, suggested-subjects" }, 400);
  } catch (e) {
    console.error("onboarding error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
