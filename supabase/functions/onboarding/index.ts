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

const GENERAL_SUBJECT_SUGGESTIONS = ["General Studies", "Aptitude", "Reasoning"];

const SUGGESTED_SUBJECTS_BY_EXAM: Record<string, string[]> = {
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

const SUGGESTED_TOPICS_BY_SUBJECT: Record<string, string[]> = {
  "Physics": ["Mechanics", "Thermodynamics", "Optics", "Electromagnetism", "Modern Physics", "Waves"],
  "Chemistry": ["Organic Chemistry", "Inorganic Chemistry", "Physical Chemistry"],
  "Biology": ["Cell Biology", "Genetics", "Ecology", "Human Physiology", "Plant Biology", "Evolution"],
  "Mathematics": ["Algebra", "Calculus", "Trigonometry", "Coordinate Geometry", "Probability & Statistics"],
  "History": ["Ancient India", "Medieval India", "Modern India", "World History"],
  "Geography": ["Physical Geography", "Indian Geography", "World Geography", "Climatology"],
  "Polity": ["Constitution", "Governance", "Panchayati Raj", "Judiciary"],
  "Economy": ["Microeconomics", "Macroeconomics", "Indian Economy", "Banking & Finance"],
  "Anatomy": ["Gross Anatomy", "Neuroanatomy", "Embryology", "Histology"],
  "Physiology": ["Cardiovascular Physiology", "Respiratory Physiology", "Renal Physiology", "Neurophysiology"],
  "Biochemistry": ["Metabolism", "Enzymes", "Molecular Biology", "Clinical Biochemistry"],
  "Pathology": ["General Pathology", "Systemic Pathology", "Hematology", "Cytopathology"],
  "Pharmacology": ["General Pharmacology", "Autonomic Drugs", "CNS Drugs", "Chemotherapy"],
  "Microbiology": ["Bacteriology", "Virology", "Immunology", "Parasitology"],
};

const EXAM_ALIAS_MAP: Record<string, string> = {
  neet: "NEET UG",
  neetug: "NEET UG",
  neet_pg: "NEET PG",
  neetpg: "NEET PG",
  jee: "JEE Main",
  jeemain: "JEE Main",
  jee_advanced: "JEE Advanced",
  jeeadvanced: "JEE Advanced",
  upsc: "UPSC CSE",
  ssc: "SSC CGL",
};

// ─── EXTENDED PRESETS — covers Quick Preset button on onboarding ───
// Keyed by canonical exam name (after normalizeExamType)
const QUICK_PRESET_SUBJECTS: Record<string, string[]> = {
  // Civil Services
  "UPSC CSE": ["History", "Geography", "Polity", "Economy", "Science & Technology", "Environment", "Ethics", "Essay", "Current Affairs"],
  "UPSC IES": ["General Studies", "Engineering Discipline", "English"],
  "UPSC CMS": ["General Medicine", "Surgery", "Gynaecology", "Paediatrics", "Preventive Medicine"],
  "UPSC CAPF": ["General Ability", "Essay", "Comprehension", "Current Affairs"],
  "State PSC": ["General Studies", "CSAT", "Optional Subject", "History", "Geography", "Polity"],
  // Medical
  "NEET UG": ["Physics", "Chemistry", "Biology"],
  "NEET PG": ["Anatomy", "Physiology", "Biochemistry", "Pathology", "Pharmacology", "Microbiology"],
  // Engineering
  "JEE Main": ["Physics", "Chemistry", "Mathematics"],
  "JEE Advanced": ["Physics", "Chemistry", "Mathematics"],
  "GATE": ["Engineering Mathematics", "General Aptitude", "Core Subject"],
  "BITSAT": ["Physics", "Chemistry", "Mathematics", "English Proficiency", "Logical Reasoning"],
  // MBA
  "CAT": ["Quantitative Aptitude", "Verbal Ability", "Data Interpretation", "Logical Reasoning"],
  "XAT": ["Quantitative Aptitude", "Verbal Ability", "Decision Making", "General Knowledge"],
  "NMAT": ["Quantitative Skills", "Logical Reasoning", "Language Skills"],
  // Law
  "CLAT": ["English", "Current Affairs", "Legal Reasoning", "Logical Reasoning", "Quantitative Techniques"],
  "AILET": ["English", "General Knowledge", "Legal Reasoning", "Logical Reasoning", "Mathematics"],
  "LSAT": ["Reading Comprehension", "Logical Reasoning", "Analytical Reasoning"],
  // SSC
  "SSC CGL": ["Quantitative Aptitude", "English", "General Intelligence", "General Awareness"],
  "SSC CHSL": ["Quantitative Aptitude", "English", "General Intelligence", "General Awareness"],
  "SSC MTS": ["Numerical Aptitude", "English", "General Intelligence", "General Awareness"],
  // Banking
  "IBPS PO": ["Quantitative Aptitude", "Reasoning", "English", "General Awareness", "Computer Aptitude"],
  "IBPS Clerk": ["Quantitative Aptitude", "Reasoning", "English", "General Awareness", "Computer Aptitude"],
  "SBI PO": ["Quantitative Aptitude", "Reasoning", "English", "General Awareness", "Computer Aptitude"],
  "SBI Clerk": ["Quantitative Aptitude", "Reasoning", "English", "General Awareness", "Computer Aptitude"],
  "RBI Grade B": ["General Awareness", "English", "Quantitative Aptitude", "Reasoning", "Finance & Management"],
  // Railways
  "RRB NTPC": ["Mathematics", "General Intelligence", "General Awareness"],
  "RRB Group D": ["Mathematics", "General Intelligence", "General Science", "General Awareness"],
  // Defence
  "NDA": ["Mathematics", "General Ability Test", "English", "General Knowledge"],
  "CDS": ["English", "General Knowledge", "Mathematics"],
  "AFCAT": ["English", "General Awareness", "Numerical Ability", "Reasoning"],
  // International
  "GRE": ["Verbal Reasoning", "Quantitative Reasoning", "Analytical Writing"],
  "GMAT": ["Quantitative", "Verbal", "Integrated Reasoning", "Analytical Writing"],
  "SAT": ["Math", "Evidence-Based Reading", "Writing"],
  "TOEFL": ["Listening", "Reading", "Writing", "Speaking"],
  "IELTS": ["Listening", "Reading", "Writing", "Speaking"],
  // Teaching & Research / University / Research
  "UGC NET": ["General Paper", "Subject Paper"],
  "CSIR NET": ["General Aptitude", "Subject Paper"],
  "CTET": ["Child Development & Pedagogy", "Language I", "Language II", "Mathematics", "Environmental Studies"],
  "CUET": ["Language", "Domain Subject", "General Test"],
  "KVPY": ["Physics", "Chemistry", "Mathematics", "Biology"],
  // Finance certifications (commonly requested)
  "USMLE": ["Anatomy", "Physiology", "Biochemistry", "Pathology", "Pharmacology", "Microbiology"],
  "MCAT": ["Biology", "Chemistry", "Physics", "Psychology", "Critical Analysis"],
  "CFA": ["Ethics", "Quantitative Methods", "Economics", "Financial Reporting", "Corporate Finance", "Equity Investments"],
  "CPA": ["Auditing", "Financial Accounting", "Regulation", "Business Environment"],
  "ACCA": ["Financial Accounting", "Management Accounting", "Taxation", "Audit & Assurance", "Financial Reporting"],
};

// Generic category-based fallbacks for unknown / "other_*" exams
const QUICK_PRESET_GENERIC_BY_CATEGORY: Record<string, string[]> = {
  government: ["General Studies", "General Knowledge", "Quantitative Aptitude", "Reasoning", "English Language", "Current Affairs"],
  "Government Jobs": ["General Studies", "General Knowledge", "Quantitative Aptitude", "Reasoning", "English Language", "Current Affairs"],
  banking: ["Quantitative Aptitude", "Reasoning", "English", "General Awareness", "Computer Aptitude"],
  Banking: ["Quantitative Aptitude", "Reasoning", "English", "General Awareness", "Computer Aptitude"],
  railways: ["Mathematics", "General Intelligence", "General Science", "General Awareness"],
  Railways: ["Mathematics", "General Intelligence", "General Science", "General Awareness"],
  defence: ["Mathematics", "General Ability Test", "English", "General Knowledge"],
  Defence: ["Mathematics", "General Ability Test", "English", "General Knowledge"],
  entrance: ["Mathematics", "Physics", "Chemistry", "English", "Logical Reasoning"],
  Engineering: ["Mathematics", "Physics", "Chemistry", "English", "Logical Reasoning"],
  Medical: ["Physics", "Chemistry", "Biology"],
  MBA: ["Quantitative Aptitude", "Verbal Ability", "Data Interpretation", "Logical Reasoning"],
  Law: ["English", "Legal Reasoning", "Logical Reasoning", "Current Affairs"],
  global: ["English", "Quantitative Reasoning", "Verbal Reasoning", "Analytical Writing"],
  International: ["English", "Quantitative Reasoning", "Verbal Reasoning", "Analytical Writing"],
  "Teaching & Research": ["General Paper", "Subject Paper"],
  University: ["Language", "Domain Subject", "General Test"],
  Research: ["General Aptitude", "Subject Paper"],
  "Civil Services": ["General Studies", "CSAT", "History", "Geography", "Polity", "Economy", "Current Affairs"],
};

// Extended topic suggestions (adds rows the original map didn't cover)
const QUICK_PRESET_TOPICS: Record<string, string[]> = {
  // Reuse what's in SUGGESTED_TOPICS_BY_SUBJECT plus extras
  "Engineering Mathematics": ["Linear Algebra", "Calculus", "Differential Equations", "Probability", "Numerical Methods"],
  "General Aptitude": ["Verbal Ability", "Numerical Ability", "Reasoning"],
  "Core Subject": ["Fundamentals", "Advanced Topics", "Applications", "Problem Solving"],
  "Quantitative Aptitude": ["Arithmetic", "Algebra", "Geometry", "Number Systems", "Time & Work", "Percentages"],
  "Quantitative Skills": ["Arithmetic", "Algebra", "Geometry", "Data Interpretation"],
  "Quantitative Methods": ["Time Value of Money", "Probability", "Statistics", "Hypothesis Testing"],
  "Quantitative Techniques": ["Arithmetic", "Algebra", "Mensuration", "Data Interpretation"],
  "Quantitative Reasoning": ["Arithmetic", "Algebra", "Geometry", "Data Analysis"],
  "Quantitative": ["Problem Solving", "Data Sufficiency", "Arithmetic", "Algebra", "Geometry"],
  "Verbal Ability": ["Reading Comprehension", "Para Jumbles", "Sentence Correction", "Vocabulary"],
  "Verbal Reasoning": ["Reading Comprehension", "Text Completion", "Sentence Equivalence"],
  "Verbal": ["Reading Comprehension", "Critical Reasoning", "Sentence Correction"],
  "Data Interpretation": ["Tables", "Bar Graphs", "Pie Charts", "Caselets", "Line Graphs"],
  "Logical Reasoning": ["Arrangements", "Puzzles", "Syllogisms", "Blood Relations", "Coding-Decoding"],
  "Reasoning": ["Verbal Reasoning", "Non-Verbal Reasoning", "Puzzles", "Syllogisms", "Series"],
  "General Intelligence": ["Analogies", "Series", "Coding-Decoding", "Puzzles", "Mirror Images"],
  "Analytical Reasoning": ["Logic Games", "Sequencing", "Grouping", "Matching"],
  "Decision Making": ["Case Studies", "Logical Decisions", "Ethical Dilemmas"],
  "English": ["Grammar", "Vocabulary", "Reading Comprehension", "Sentence Correction"],
  "English Language": ["Grammar", "Vocabulary", "Reading Comprehension", "Cloze Test", "Para Jumbles"],
  "English Proficiency": ["Grammar", "Vocabulary", "Reading Comprehension"],
  "Writing": ["Essay", "Argument Analysis", "Grammar"],
  "Analytical Writing": ["Issue Essay", "Argument Essay"],
  "Evidence-Based Reading": ["Reading Comprehension", "Vocabulary in Context", "Inference"],
  "Reading": ["Skimming", "Scanning", "Inference", "Vocabulary"],
  "Reading Comprehension": ["Main Idea", "Inference", "Vocabulary", "Author's Tone"],
  "Listening": ["Note Taking", "Multiple Choice", "Form Completion"],
  "Speaking": ["Introduction", "Cue Card", "Discussion"],
  "Math": ["Algebra", "Geometry", "Trigonometry", "Statistics", "Word Problems"],
  "Numerical Ability": ["Arithmetic", "Number Series", "Simplification", "Data Interpretation"],
  "Numerical Aptitude": ["Arithmetic", "Algebra", "Geometry", "Mensuration"],
  "General Studies": ["History", "Geography", "Polity", "Economy", "Environment", "Science & Tech"],
  "General Knowledge": ["Current Affairs", "History", "Geography", "Polity", "Sports", "Awards"],
  "General Awareness": ["Current Affairs", "Banking Awareness", "Static GK", "Economy", "Sports"],
  "General Science": ["Physics Basics", "Chemistry Basics", "Biology Basics", "Everyday Science"],
  "General Ability": ["English", "General Knowledge", "Reasoning"],
  "General Ability Test": ["English", "General Knowledge", "Reasoning"],
  "General Paper": ["Teaching Aptitude", "Research Aptitude", "Reasoning", "Communication", "ICT"],
  "Subject Paper": ["Core Subject Theory", "Advanced Concepts", "Research Methodology"],
  "Optional Subject": ["Paper 1", "Paper 2", "Case Studies"],
  "Domain Subject": ["Core Concepts", "Applied Theory", "Practice Questions"],
  "Current Affairs": ["National", "International", "Economy", "Sports", "Awards", "Government Schemes"],
  "Computer Aptitude": ["Computer Basics", "MS Office", "Internet", "Networking", "Hardware/Software"],
  "Comprehension": ["Reading Comprehension", "Vocabulary", "Inference"],
  "Essay": ["Structure", "Argumentation", "Vocabulary", "Sample Topics"],
  "Ethics": ["Professional Standards", "Code of Conduct", "Case Studies"],
  "Environment": ["Ecology", "Biodiversity", "Climate Change", "Pollution", "Conservation"],
  "Science & Technology": ["Space Tech", "Defence Tech", "IT", "Biotech", "Recent Innovations"],
  "Polity": ["Constitution", "Governance", "Panchayati Raj", "Judiciary"],
  "Economy": ["Microeconomics", "Macroeconomics", "Indian Economy", "Banking & Finance"],
  "Economics": ["Microeconomics", "Macroeconomics", "Indian Economy", "Banking"],
  "Finance & Management": ["Financial Markets", "Risk Management", "Corporate Governance"],
  "Legal Reasoning": ["Constitutional Law", "Contract Law", "Tort Law", "Criminal Law"],
  "CSAT": ["Comprehension", "Logical Reasoning", "Basic Numeracy", "Decision Making"],
  "Child Development & Pedagogy": ["Theories of Learning", "Inclusive Education", "Assessment", "Cognitive Development"],
  "Language I": ["Grammar", "Comprehension", "Pedagogy of Language"],
  "Language II": ["Grammar", "Comprehension", "Pedagogy of Language"],
  "Environmental Studies": ["Family & Friends", "Food", "Shelter", "Water", "Travel"],
  "Engineering Discipline": ["Core Subject Theory", "Design", "Applications"],
  "General Medicine": ["Cardiology", "Respiratory", "Endocrinology", "Neurology"],
  "Surgery": ["General Surgery", "Trauma", "Pre/Post-op Care"],
  "Gynaecology": ["Obstetrics", "Gynaecology", "Family Planning"],
  "Paediatrics": ["Neonatology", "Common Childhood Illnesses", "Vaccinations"],
  "Preventive Medicine": ["Epidemiology", "Public Health", "Health Programs"],
};

const resolveQuickPresetSubjects = (
  examType: string,
  examId: string,
  examCategory: string,
): { subjects: string[]; source: "preset" | "generic" | "none" } => {
  const canonical = normalizeExamType(examType || examId);
  if (canonical && QUICK_PRESET_SUBJECTS[canonical]) {
    return { subjects: QUICK_PRESET_SUBJECTS[canonical], source: "preset" };
  }
  const cat = String(examCategory || "").trim();
  if (cat && QUICK_PRESET_GENERIC_BY_CATEGORY[cat]) {
    return { subjects: QUICK_PRESET_GENERIC_BY_CATEGORY[cat], source: "generic" };
  }
  // try lowercase category key
  const catLower = cat.toLowerCase();
  if (catLower && QUICK_PRESET_GENERIC_BY_CATEGORY[catLower]) {
    return { subjects: QUICK_PRESET_GENERIC_BY_CATEGORY[catLower], source: "generic" };
  }
  return { subjects: [], source: "none" };
};

const resolveQuickPresetTopics = (subjectName: string): string[] => {
  const name = String(subjectName || "").trim();
  if (!name) return [];
  return (
    QUICK_PRESET_TOPICS[name] ||
    SUGGESTED_TOPICS_BY_SUBJECT[name] ||
    ["Fundamentals", "Advanced Concepts", "Practice Problems"]
  );
};

// AI fallback — generates {subject: topics[]} for unknown exams
async function aiGenerateQuickPreset(
  examLabel: string,
  examCategory: string,
  maxSubjects = 6,
  topicsPerSubject = 6,
): Promise<Array<{ name: string; topics: string[] }>> {
  const prompt = `You are an expert exam-curriculum designer. Generate a concise study curriculum for the exam:
  - Exam: "${examLabel}"
  - Category: "${examCategory || "general"}"

Return ${maxSubjects} core subjects, each with ${topicsPerSubject} essential topics that a beginner-to-intermediate student should master.
Use SHORT canonical names (e.g., "Physics", "Mechanics"). No descriptions, no numbering.`;

  const result = await callAI({
    model: "google/gemini-3-flash-preview",
    temperature: 0.3,
    maxTokens: 1200,
    messages: [
      { role: "system", content: "You are an expert exam curriculum designer. Always respond using the provided tool." },
      { role: "user", content: prompt },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "return_curriculum",
          description: "Return a structured curriculum (subjects with topics).",
          parameters: {
            type: "object",
            properties: {
              subjects: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "Short subject name" },
                    topics: {
                      type: "array",
                      items: { type: "string" },
                      description: "Short topic names (no numbering, no descriptions)",
                    },
                  },
                  required: ["name", "topics"],
                  additionalProperties: false,
                },
              },
            },
            required: ["subjects"],
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "return_curriculum" } },
  });

  const args = getAIToolArgs(result);
  const subjects = Array.isArray(args?.subjects) ? args.subjects : [];
  return subjects
    .map((s: any) => ({
      name: String(s?.name || "").trim(),
      topics: Array.isArray(s?.topics) ? s.topics.map((t: any) => String(t || "").trim()).filter(Boolean) : [],
    }))
    .filter((s: any) => s.name);
}

async function aiGenerateTopicsForSubject(
  subject: string,
  examLabel: string,
  count = 6,
): Promise<string[]> {
  const result = await callAI({
    model: "google/gemini-3-flash-preview",
    temperature: 0.3,
    maxTokens: 400,
    messages: [
      { role: "system", content: "You generate concise exam topic lists. Always use the provided tool." },
      {
        role: "user",
        content: `List ${count} essential topics for the subject "${subject}" in the context of the "${examLabel || "general"}" exam. Use short canonical names.`,
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "return_topics",
          description: "Return short topic names.",
          parameters: {
            type: "object",
            properties: {
              topics: { type: "array", items: { type: "string" } },
            },
            required: ["topics"],
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "return_topics" } },
  });

  const args = getAIToolArgs(result);
  const topics = Array.isArray(args?.topics) ? args.topics : [];
  return topics.map((t: any) => String(t || "").trim()).filter(Boolean);
}

const SUGGESTED_SUBJECT_ID_PREFIX = "suggested-subject::";
const SUGGESTED_TOPIC_ID_PREFIX = "suggested-topic::";

const normalizeExamKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

const CANONICAL_EXAM_TYPE_MAP = new Map(
  EXAM_TYPES.map((exam) => [normalizeExamKey(exam.name), exam.name]),
);

const normalizeExamType = (value: unknown): string => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const normalizedKey = normalizeExamKey(raw);
  return CANONICAL_EXAM_TYPE_MAP.get(normalizedKey) || EXAM_ALIAS_MAP[normalizedKey] || raw;
};

const getSuggestedSubjectsForExam = (examType: unknown): string[] => {
  const canonicalExamType = normalizeExamType(examType);
  return SUGGESTED_SUBJECTS_BY_EXAM[canonicalExamType] || GENERAL_SUBJECT_SUGGESTIONS;
};

const getSuggestedTopicsForSubject = (subject: unknown): string[] => {
  const subjectName = String(subject || "").trim();
  return SUGGESTED_TOPICS_BY_SUBJECT[subjectName] || ["Fundamentals", "Advanced Concepts", "Practice Problems"];
};

const makeSuggestedSubjectId = (subjectName: string) =>
  `${SUGGESTED_SUBJECT_ID_PREFIX}${encodeURIComponent(subjectName)}`;

const parseSuggestedSubjectName = (subjectId: unknown): string => {
  const value = String(subjectId || "").trim();
  if (!value.startsWith(SUGGESTED_SUBJECT_ID_PREFIX)) return "";

  try {
    return decodeURIComponent(value.slice(SUGGESTED_SUBJECT_ID_PREFIX.length));
  } catch {
    return "";
  }
};

const buildSuggestedSubjectsWithTopics = (examType: unknown) =>
  getSuggestedSubjectsForExam(examType).map((subjectName) => {
    const subjectId = makeSuggestedSubjectId(subjectName);
    const topics = getSuggestedTopicsForSubject(subjectName).map((topicName) => ({
      id: `${SUGGESTED_TOPIC_ID_PREFIX}${encodeURIComponent(subjectName)}::${encodeURIComponent(topicName)}`,
      name: topicName,
      subject_id: subjectId,
      marks_impact_weight: null,
      created_at: null,
      is_suggested: true,
    }));

    return {
      id: subjectId,
      name: subjectName,
      created_at: null,
      topics,
      topic_count: topics.length,
      is_suggested: true,
    };
  });

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
      const examType = normalizeExamType(requestBody.exam_type);
      if (!examType) return json({ error: "exam_type is required" }, 400);

      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await adminClient.from("profiles").update({ exam_type: examType }).eq("id", userId);

      // Return suggested subjects
      const subjects = getSuggestedSubjectsForExam(examType);
      return json({ success: true, exam_type: examType, suggested_subjects: subjects, next_step: 3 });
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

    // --- LIST SUBJECTS (for current user, scoped to their selected exam) ---
    if (action === "list-subjects" || action === "list_subjects") {
      const userId = await resolveUserId();
      if (!userId) return json({ error: "Unauthorized" }, 401);
      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      // Pull profile so we can echo the selected exam alongside the subjects.
      const { data: profile } = await adminClient
        .from("profiles")
        .select("exam_type, exam_date")
        .eq("id", userId)
        .maybeSingle();

      const examType = normalizeExamType(profile?.exam_type);
      const savedSubjects = await fetchUserSubjectsWithTopics(adminClient, userId);
      const subjects = savedSubjects.length > 0
        ? savedSubjects
        : buildSuggestedSubjectsWithTopics(examType);

      return json({
        success: true,
        exam_type: examType || profile?.exam_type || null,
        exam_date: profile?.exam_date || null,
        subjects,
        total: subjects.length,
        source: savedSubjects.length > 0 ? "saved" : "suggested",
      });
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
      // never see an empty "Subject List", and echo the user's selected exam.
      const allSubjects = await fetchUserSubjectsWithTopics(adminClient, userId);
      const { data: profile } = await adminClient
        .from("profiles").select("exam_type").eq("id", userId).maybeSingle();
      return json({
        success: true,
        exam_type: profile?.exam_type || null,
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
      const subjectNameInput = String(requestBody.subject || url.searchParams.get("subject") || "").trim();

      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: profile } = await adminClient
        .from("profiles")
        .select("exam_type")
        .eq("id", userId)
        .maybeSingle();

      const examType = normalizeExamType(profile?.exam_type);
      const subjectNameFromSuggestion = parseSuggestedSubjectName(subjectId);
      const requestedSubjectName = subjectNameInput || subjectNameFromSuggestion;
      let resolvedSubjectId = subjectNameFromSuggestion ? "" : subjectId;
      let resolvedSubjectName = requestedSubjectName;

      if (!resolvedSubjectId && requestedSubjectName) {
        const { data: sub } = await adminClient
          .from("subjects")
          .select("id, name")
          .eq("user_id", userId)
          .eq("name", requestedSubjectName)
          .is("deleted_at", null)
          .maybeSingle();
        resolvedSubjectId = sub?.id || "";
        resolvedSubjectName = sub?.name || requestedSubjectName;
      } else if (resolvedSubjectId) {
        const { data: sub } = await adminClient
          .from("subjects")
          .select("id, name")
          .eq("user_id", userId)
          .eq("id", resolvedSubjectId)
          .is("deleted_at", null)
          .maybeSingle();
        if (sub) resolvedSubjectName = sub.name;
      }

      let q = adminClient
        .from("topics")
        .select("id, name, subject_id, marks_impact_weight, memory_strength, created_at")
        .eq("user_id", userId)
        .is("deleted_at", null);
      if (resolvedSubjectId) q = q.eq("subject_id", resolvedSubjectId);

      const { data: topics } = await q.order("created_at", { ascending: true });
      const savedTopics = topics || [];
      const fallbackTopics = savedTopics.length === 0 && resolvedSubjectName
        ? getSuggestedTopicsForSubject(resolvedSubjectName).map((topicName) => ({
            id: `${SUGGESTED_TOPIC_ID_PREFIX}${encodeURIComponent(resolvedSubjectName)}::${encodeURIComponent(topicName)}`,
            name: topicName,
            subject_id: resolvedSubjectId || makeSuggestedSubjectId(resolvedSubjectName),
            marks_impact_weight: null,
            memory_strength: null,
            created_at: null,
            is_suggested: true,
          }))
        : [];
      const finalTopics = savedTopics.length > 0 ? savedTopics : fallbackTopics;

      return json({
        success: true,
        exam_type: examType || profile?.exam_type || null,
        topics: finalTopics,
        total: finalTopics.length,
        subject_id: resolvedSubjectId || (resolvedSubjectName ? makeSuggestedSubjectId(resolvedSubjectName) : null),
        subject_name: resolvedSubjectName || null,
        source: savedTopics.length > 0 ? "saved" : (fallbackTopics.length > 0 ? "suggested" : "saved"),
      });
    }

    // --- ADD SINGLE TOPIC ---
    if (action === "add-topic" || action === "add_topic") {
      const userId = await resolveUserId();
      if (!userId) return json({ error: "Unauthorized" }, 401);
      const name = String(requestBody.name || requestBody.topic || "").trim();
      const subjectIdInput = String(requestBody.subject_id || "").trim();
      const subjectNameFromSuggestion = parseSuggestedSubjectName(subjectIdInput);
      const subjectName = String(requestBody.subject || subjectNameFromSuggestion || "").trim();
      const marksWeight = Number(requestBody.marks_impact_weight ?? 5);
      if (name.length < 1) return json({ error: "topic name is required" }, 400);
      if (name.length > 200) return json({ error: "topic name too long (max 200 chars)" }, 400);
      if (!subjectIdInput && !subjectName) return json({ error: "subject_id or subject name required" }, 400);

      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      // Resolve / auto-create subject
      let resolvedSubjectId = subjectNameFromSuggestion ? "" : subjectIdInput;
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

      let topicRow = existingTopic;
      let duplicate = !!existingTopic;

      if (!existingTopic) {
        const { data: created, error } = await adminClient
          .from("topics")
          .insert({ user_id: userId, subject_id: resolvedSubjectId, name, marks_impact_weight: marksWeight })
          .select("id, name, subject_id, marks_impact_weight, created_at")
          .single();
        if (error) return json({ error: error.message }, 500);
        topicRow = created;
      }

      // Always return the full updated subject + topic tree, plus exam context.
      const allSubjects = await fetchUserSubjectsWithTopics(adminClient, userId);
      const { data: profile } = await adminClient
        .from("profiles").select("exam_type").eq("id", userId).maybeSingle();
      return json({
        success: true,
        exam_type: profile?.exam_type || null,
        topic: topicRow,
        duplicate,
        subjects: allSubjects,
        total_subjects: allSubjects.length,
      });
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

      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      // Resolve exam type — fall back to user's profile, then a sensible default.
      let examType = normalizeExamType(requestBody.exam_type || url.searchParams.get("exam_type") || "");
      if (!examType) {
        const { data: profile } = await adminClient.from("profiles").select("exam_type").eq("id", userId).maybeSingle();
        examType = normalizeExamType(profile?.exam_type);
      }
      if (!examType) examType = "general competitive exam";
      const persist = requestBody.persist !== false;

      // Use shared AI client (Gemini direct → Lovable gateway fallback) so the
      // endpoint keeps working even when one provider is rate-limited / out of credits.
      const aiResult = await callAI({
        model: "google/gemini-2.5-flash-lite",
        temperature: 0.4,
        maxTokens: 4096,
        messages: [
          {
            role: "system",
            content: "You are an expert academic curriculum designer for Indian competitive exams. Generate a complete subject and topic structure. Each topic needs a marks_impact_weight (0-10). Cover the full syllabus concisely. Respond with valid JSON only.",
          },
          {
            role: "user",
            content: `Generate the complete subject and topic structure for: ${examType}. Include ALL important subjects (5-10) and 6-15 topics per subject with accurate marks_impact_weight (0-10) and priority (critical/high/medium/low). Return JSON of shape: { "exam_summary": string, "subjects": [{ "name": string, "topics": [{ "name": string, "marks_impact_weight": number, "priority": "critical"|"high"|"medium"|"low" }] }] }`,
          },
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
                            priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
                          },
                          required: ["name", "marks_impact_weight", "priority"],
                        },
                      },
                    },
                    required: ["name", "topics"],
                  },
                },
                exam_summary: { type: "string" },
              },
              required: ["subjects", "exam_summary"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_curriculum" } },
      });

      if (!aiResult.ok) {
        // Even on AI failure, return whatever the user already has so the
        // tester does not display a blank "subjects: []".
        const existingSubjects = await fetchUserSubjectsWithTopics(adminClient, userId);
        const status = aiResult.status === 429 ? 429 : aiResult.status === 402 ? 402 : 500;
        return json({
          success: false,
          error: aiResult.error || (status === 429 ? "Rate limited, please try again later" : status === 402 ? "AI credits exhausted" : "AI gateway error"),
          exam_type: examType,
          subjects: existingSubjects,
          subjects_created: 0,
          topics_created: 0,
        }, status);
      }

      // Try tool args first, fall back to parsing the message content as JSON
      // (the Gemini direct path returns JSON in `content` rather than `tool_calls`).
      let curriculum: any = getAIToolArgs(aiResult);
      if (!curriculum) {
        const text = aiResult.data?.choices?.[0]?.message?.content || "";
        try {
          const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
          const start = cleaned.search(/[{[]/);
          const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
          if (start !== -1 && end > start) {
            curriculum = JSON.parse(cleaned.slice(start, end + 1));
          }
        } catch { /* ignore */ }
      }
      if (!curriculum || !Array.isArray(curriculum.subjects)) {
        curriculum = { subjects: [], exam_summary: `${examType} curriculum` };
      }

      let subjectsCreated = 0, topicsCreated = 0;

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

          for (const t of sub.topics || []) {
            const tName = String(t.name || "").trim();
            if (!tName) continue;
            const { data: existingT } = await adminClient
              .from("topics").select("id").eq("user_id", userId).eq("subject_id", subjectId).eq("name", tName).is("deleted_at", null).maybeSingle();
            if (existingT) continue;
            const { error: tErr } = await adminClient
              .from("topics")
              .insert({ user_id: userId, subject_id: subjectId, name: tName, marks_impact_weight: Number(t.marks_impact_weight ?? 5) });
            if (!tErr) topicsCreated++;
          }
        }
      }

      // Always return the full updated subject/topic tree from the DB so the
      // API tester never sees an empty list when generation succeeds.
      const allSubjects = persist
        ? await fetchUserSubjectsWithTopics(adminClient, userId)
        : (curriculum.subjects || []);

      return json({
        success: true,
        exam_type: examType,
        exam_summary: curriculum.exam_summary,
        subjects: allSubjects,
        total: Array.isArray(allSubjects) ? allSubjects.length : 0,
        subjects_created: subjectsCreated,
        topics_created: topicsCreated,
        persisted: persist,
        ai_source: aiResult.source,
      });
    }

    // --- AI GENERATE TOPICS for a single subject ---
    if (action === "ai-generate-topics" || action === "ai_generate_topics") {
      const userId = await resolveUserId();
      if (!userId) return json({ error: "Unauthorized" }, 401);

      const subjectIdInput = String(requestBody.subject_id || "").trim();
      const subjectNameFromSuggestion = parseSuggestedSubjectName(subjectIdInput);
      const subjectName = String(requestBody.subject || requestBody.subject_name || subjectNameFromSuggestion || "").trim();
      if (!subjectName && !subjectIdInput) return json({ error: "subject or subject_id is required" }, 400);
      const persist = requestBody.persist !== false;

      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      // Resolve subject
      let resolvedSubjectId = subjectNameFromSuggestion ? "" : subjectIdInput;
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
      const examType = normalizeExamType(profile?.exam_type || "general") || "general";

      // Use shared AI client (Gemini → Lovable gateway fallback)
      const aiResult = await callAI({
        model: "google/gemini-2.5-flash-lite",
        temperature: 0.4,
        maxTokens: 2048,
        messages: [
          { role: "system", content: "You generate exam-relevant topics for a single subject. Each topic gets a marks_impact_weight (0-10) reflecting exam weightage. Respond with valid JSON only." },
          { role: "user", content: `Generate the complete topic list for subject "${resolvedSubjectName}" in exam "${examType}". Return JSON: { "topics": [{ "name": string, "marks_impact_weight": number }] }` },
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
                    properties: { name: { type: "string" }, marks_impact_weight: { type: "number" } },
                    required: ["name", "marks_impact_weight"],
                  },
                },
              },
              required: ["topics"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_topics" } },
      });

      if (!aiResult.ok) {
        const existingSubjects = await fetchUserSubjectsWithTopics(adminClient, userId);
        const status = aiResult.status === 429 ? 429 : aiResult.status === 402 ? 402 : 500;
        return json({
          success: false,
          error: aiResult.error || "AI gateway error",
          subject: resolvedSubjectName,
          subject_id: resolvedSubjectId || null,
          topics: [],
          subjects: existingSubjects,
        }, status);
      }

      let topicsRaw: any[] = [];
      const parsed = getAIToolArgs(aiResult);
      if (parsed?.topics) {
        topicsRaw = parsed.topics;
      } else {
        const text = aiResult.data?.choices?.[0]?.message?.content || "";
        try {
          const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
          const start = cleaned.search(/[{[]/);
          const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
          if (start !== -1 && end > start) {
            topicsRaw = JSON.parse(cleaned.slice(start, end + 1))?.topics || [];
          }
        } catch { /* ignore */ }
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

      // Always include the full subject tree so the API tester never sees an empty list.
      const allSubjects = persist ? await fetchUserSubjectsWithTopics(adminClient, userId) : [];

      return json({
        success: true,
        subject: resolvedSubjectName,
        subject_id: resolvedSubjectId || null,
        topics: persist ? persistedTopics : topicsRaw,
        topics_created: topicsCreated,
        subjects: allSubjects,
        persisted: persist,
        ai_source: aiResult.source,
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
      const examType = normalizeExamType(requestBody.exam_type || url.searchParams.get("exam_type") || "");
      const subjects = getSuggestedSubjectsForExam(examType);
      return json({ success: true, subjects, exam_type: examType || null });
    }

    // --- Suggested topics for a subject ---
    if (action === "suggested-topics" || action === "suggested_topics") {
      const subject = String(requestBody.subject || url.searchParams.get("subject") || parseSuggestedSubjectName(requestBody.subject_id) || "").trim();
      const topics = getSuggestedTopicsForSubject(subject);
      return json({ success: true, subject: subject || null, topics });
    }

    // ─── QUICK PRESET (combined) ───
    // POST { exam_type?, exam_id?, exam_category?, auto_save?, max_subjects?, topics_per_subject? }
    // → { success, source, exam, subjects: [{ name, topics: [...] }], saved? }
    if (action === "quick-preset" || action === "quick_preset") {
      const examType = String(requestBody.exam_type || url.searchParams.get("exam_type") || "").trim();
      const examId = String(requestBody.exam_id || url.searchParams.get("exam_id") || "").trim();
      const examCategory = String(requestBody.exam_category || url.searchParams.get("exam_category") || "").trim();
      const autoSave = requestBody.auto_save === true || url.searchParams.get("auto_save") === "true";
      const maxSubjects = Math.min(Math.max(Number(requestBody.max_subjects ?? url.searchParams.get("max_subjects") ?? 6) || 6, 3), 10);
      const topicsPerSubject = Math.min(Math.max(Number(requestBody.topics_per_subject ?? url.searchParams.get("topics_per_subject") ?? 6) || 6, 3), 10);

      if (!examType && !examId) {
        return json({ error: "exam_type or exam_id is required" }, 400);
      }

      const examLabel = normalizeExamType(examType || examId) || examType || examId;

      // Step 1 — preset lookup
      let { subjects: subjectNames, source } = resolveQuickPresetSubjects(examType, examId, examCategory);
      let usedAI = false;
      let subjectPayload: Array<{ name: string; topics: string[] }>;

      if (subjectNames.length > 0) {
        subjectPayload = subjectNames.slice(0, maxSubjects).map((name) => ({
          name,
          topics: resolveQuickPresetTopics(name).slice(0, topicsPerSubject),
        }));
      } else {
        // Step 2 — AI fallback
        try {
          const aiSubjects = await aiGenerateQuickPreset(examLabel, examCategory, maxSubjects, topicsPerSubject);
          if (aiSubjects.length > 0) {
            subjectPayload = aiSubjects.slice(0, maxSubjects).map((s) => ({
              name: s.name,
              topics: s.topics.slice(0, topicsPerSubject),
            }));
            source = "preset";
            usedAI = true;
          } else {
            subjectPayload = [];
          }
        } catch (e) {
          console.error("[quick-preset] AI fallback failed:", e);
          subjectPayload = [];
        }
      }

      if (subjectPayload.length === 0) {
        return json({
          success: false,
          error: "No preset available and AI fallback failed.",
          exam: { type: examLabel, id: examId, category: examCategory },
          subjects: [],
        }, 200);
      }

      let saved: any = null;
      if (autoSave) {
        const { userId, reason, debug } = await resolveAuthenticatedUserId();
        if (!userId) {
          return json({
            success: false,
            error: reason === "missing_bearer"
              ? "auto_save=true requires a user JWT. Pass it as the 'Authorization: Bearer <USER_JWT>' header in Postman."
              : "auto_save=true received an invalid or expired user JWT. Re-login in the app, copy a fresh access_token, and retry.",
            hint: "In Postman: open your app, copy the access_token from the browser (Application → Local Storage → sb-...-auth-token → access_token), and set 'Authorization: Bearer <that token>'. The 'apikey' header alone is NOT a user JWT.",
            auth_debug: debug,
            source: usedAI ? "ai" : source,
            used_ai: usedAI,
            exam: { type: examLabel, id: examId, category: examCategory },
            subjects: subjectPayload,
            saved: null,
          }, 401);
        }

        const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        let subjectsInserted = 0;
        let topicsInserted = 0;

        for (const sub of subjectPayload) {
          await adminClient
            .from("subjects")
            .upsert({ user_id: userId, name: sub.name }, { onConflict: "user_id,name", ignoreDuplicates: true });

          const { data: subjectRow } = await adminClient
            .from("subjects")
            .select("id")
            .eq("user_id", userId)
            .eq("name", sub.name)
            .is("deleted_at", null)
            .maybeSingle();

          if (!subjectRow?.id) continue;
          subjectsInserted++;

          for (const topicName of sub.topics) {
            const trimmed = String(topicName || "").trim();
            if (!trimmed) continue;
            await adminClient
              .from("topics")
              .upsert(
                { user_id: userId, subject_id: subjectRow.id, name: trimmed },
                { onConflict: "user_id,subject_id,name", ignoreDuplicates: true },
              );
            topicsInserted++;
          }
        }

        const fullList = await fetchUserSubjectsWithTopics(adminClient, userId);
        saved = {
          subjects_added: subjectsInserted,
          topics_added: topicsInserted,
          subjects_in_db: fullList,
        };
      }

      return json({
        success: true,
        source: usedAI ? "ai" : source,
        used_ai: usedAI,
        exam: { type: examLabel, id: examId, category: examCategory },
        subject_count: subjectPayload.length,
        topic_count: subjectPayload.reduce((acc, s) => acc + s.topics.length, 0),
        subjects: subjectPayload,
        saved,
      });
    }

    // ─── QUICK PRESET (per-subject) ───
    // POST { subject, exam_type?, count?, auto_save? }
    // → { success, subject, source, topics: [...], saved? }
    if (action === "quick-preset-subject" || action === "quick_preset_subject") {
      const subject = String(requestBody.subject || url.searchParams.get("subject") || "").trim();
      const examType = String(requestBody.exam_type || url.searchParams.get("exam_type") || "").trim();
      const autoSave = requestBody.auto_save === true || url.searchParams.get("auto_save") === "true";
      const count = Math.min(Math.max(Number(requestBody.count ?? url.searchParams.get("count") ?? 6) || 6, 3), 12);

      if (!subject) return json({ error: "subject is required" }, 400);

      const examLabel = normalizeExamType(examType) || examType;

      let topics = resolveQuickPresetTopics(subject).slice(0, count);
      let usedAI = false;
      let source: "preset" | "ai" | "fallback" =
        QUICK_PRESET_TOPICS[subject] || SUGGESTED_TOPICS_BY_SUBJECT[subject] ? "preset" : "fallback";

      if (source === "fallback") {
        try {
          const aiTopics = await aiGenerateTopicsForSubject(subject, examLabel, count);
          if (aiTopics.length > 0) {
            topics = aiTopics.slice(0, count);
            source = "ai";
            usedAI = true;
          }
        } catch (e) {
          console.error("[quick-preset-subject] AI fallback failed:", e);
        }
      }

      let saved: any = null;
      if (autoSave) {
        const { userId, reason, debug } = await resolveAuthenticatedUserId();
        if (!userId) {
          return json({
            success: false,
            error: reason === "missing_bearer"
              ? "auto_save=true requires a user JWT. Pass it as the 'Authorization: Bearer <USER_JWT>' header in Postman."
              : "auto_save=true received an invalid or expired user JWT. Re-login in the app, copy a fresh access_token, and retry.",
            hint: "In Postman: open your app, copy the access_token from the browser (Application → Local Storage → sb-...-auth-token → access_token), and set 'Authorization: Bearer <that token>'. The 'apikey' header alone is NOT a user JWT.",
            auth_debug: debug,
            subject,
            source,
            used_ai: usedAI,
            topics,
            saved: null,
          }, 401);
        }

        const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

        await adminClient
          .from("subjects")
          .upsert({ user_id: userId, name: subject }, { onConflict: "user_id,name", ignoreDuplicates: true });

        const { data: subjectRow } = await adminClient
          .from("subjects")
          .select("id")
          .eq("user_id", userId)
          .eq("name", subject)
          .is("deleted_at", null)
          .maybeSingle();

        let topicsInserted = 0;
        if (subjectRow?.id) {
          for (const t of topics) {
            const trimmed = String(t || "").trim();
            if (!trimmed) continue;
            await adminClient
              .from("topics")
              .upsert(
                { user_id: userId, subject_id: subjectRow.id, name: trimmed },
                { onConflict: "user_id,subject_id,name", ignoreDuplicates: true },
              );
            topicsInserted++;
          }
        }

        saved = { subject_id: subjectRow?.id || null, topics_added: topicsInserted };
      }

      return json({
        success: true,
        subject,
        exam_type: examLabel || null,
        source,
        used_ai: usedAI,
        topic_count: topics.length,
        topics,
        saved,
      });
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
      if (data.exam_type) updates.exam_type = normalizeExamType(data.exam_type);
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
      if (requestBody.exam_type) updates.exam_type = normalizeExamType(requestBody.exam_type);
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

    return json({ error: "Invalid action. Supported: exam-types, status, suggested-subjects, suggested-topics, quick-preset, quick-preset-subject, list-subjects, add-subject, delete-subject, list-topics, add-topic, delete-topic, ai-generate-curriculum, ai-generate-topics, step1-name, step2-exam, step3-date, step4-subjects, step5-topics, step6-mode, save-step, complete, skip" }, 400);
  } catch (e) {
    console.error("onboarding error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
