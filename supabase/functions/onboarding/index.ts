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
    // The function name "onboarding" is the base, so action comes from query or body
    const action = url.searchParams.get("action") || 
      (req.method === "POST" ? (await req.clone().json().catch(() => ({}))).action : null) ||
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
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return json({ error: "Unauthorized" }, 401);

      const token = authHeader.replace("Bearer ", "").trim();
      
      // Service role client for lookups
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      let userId: string | null = null;

      // Try 1: JWT-based auth via getClaims
      const jwtClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: claims, error: claimsErr } = await jwtClient.auth.getClaims(token);
      if (!claimsErr && claims?.claims?.sub) {
        userId = claims.claims.sub as string;
      }

      // Try 2: API key-based auth fallback (support raw API keys in either apikey or bearer token)
      if (!userId) {
        const apiKeyCandidates = [
          req.headers.get("apikey") || "",
          token,
        ].map((value) => value.trim()).filter(Boolean);

        for (const candidate of apiKeyCandidates) {
          if (!candidate.startsWith("acry_")) continue;

          // api_keys.key_prefix is stored as rawKey.substring(0, 10) + "..."
          const storedPrefix = `${candidate.substring(0, 10)}...`;
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
          const { data: keyRow } = await adminClient
            .from("api_keys")
            .select("created_by")
            .eq("key_hash", token)
            .eq("is_active", true)
            .maybeSingle();
          if (keyRow?.created_by) {
            userId = keyRow.created_by;
          }
        }
      }

      // Try 3: getUser with service role as last resort
      if (!userId) {
        const { data: userData } = await adminClient.auth.getUser(token);
        if (userData?.user?.id) {
          userId = userData.user.id;
        }
      }

      if (!userId) return json({ error: "Unauthorized" }, 401);

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
      const body = req.method === "POST" ? await req.json() : {};
      const examType = body.exam_type || url.searchParams.get("exam_type");
      
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
