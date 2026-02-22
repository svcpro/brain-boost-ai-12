// Comprehensive exam types for all admin selectors
export const EXAM_TYPES = [
  // Civil Services
  "UPSC CSE", "UPSC IES", "UPSC CMS", "UPSC CAPF", "State PSC",
  // Medical & Engineering
  "NEET UG", "NEET PG", "JEE Main", "JEE Advanced", "GATE", "BITSAT",
  // MBA & Law
  "CAT", "XAT", "CLAT", "AILET", "LSAT", "NMAT",
  // Government Jobs
  "SSC CGL", "SSC CHSL", "SSC MTS", "IBPS PO", "IBPS Clerk", "SBI PO", "SBI Clerk",
  "RBI Grade B", "RRB NTPC", "RRB Group D",
  // Defence
  "NDA", "CDS", "AFCAT",
  // International
  "GRE", "GMAT", "SAT", "TOEFL", "IELTS",
  // Teaching & Research
  "UGC NET", "CSIR NET", "CTET",
  // Other
  "CUET", "KVPY",
] as const;

export type ExamType = typeof EXAM_TYPES[number];
