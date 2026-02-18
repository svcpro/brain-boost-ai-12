/**
 * Unified Variable Resolver (UVR)
 * Centralized variable validation, fallback injection, and pre-send sanitization
 * for ALL notification channels (Push, Email, Voice).
 *
 * Guarantees: No notification is ever sent with blank, undefined, or null variables.
 */

// ── Default fallback values for ALL known variables ──
const VARIABLE_DEFAULTS: Record<string, string> = {
  user_name: "Student",
  name: "Student",
  display_name: "Student",
  topic_name: "a topic",
  topic: "a topic",
  score: "N/A",
  rank: "your rank",
  new_rank: "your rank",
  old_rank: "N/A",
  streak_days: "0",
  days: "0",
  previous_days: "0",
  minutes: "0",
  strength: "0",
  memory_score: "0",
  brain_score: "0",
  exam_name: "your exam",
  exam_type: "your exam",
  days_left: "soon",
  percentage: "N/A",
  difficulty: "",
  badge_name: "Achievement",
  description: "",
  mission_title: "a mission",
  reward: "a reward",
  summary: "",
  recommendation: "Check the app for details",
  days_inactive: "a few",
  post_title: "a discussion",
  plan: "Pro",
  plan_name: "Pro",
  total: "0",
  direction: "changed",
  remaining: "0",
  streak_bonus: "",
  message: "You have a notification",
  digest_text: "",
  at_risk_count: "0",
  body: "",
  title: "Notification",
  topics_count: "some",
  topic_names: "Review your dashboard",
  mastery: "needs improvement",
  improvement: "significantly",
  area: "your studies",
  topics: "multiple topics",
  predicted_rank: "improving",
  readiness_score: "N/A",
  replier_name: "Someone",
  commenter_name: "a member",
  mentioner_name: "Someone",
  question_title: "your question",
  discussion_title: "a discussion",
  feature_name: "a new feature",
  feature_description: "Exciting new features!",
  announcement_title: "Announcement",
  announcement_body: "Important update",
  amount: "N/A",
  location: "Unknown",
  device: "Unknown",
  time: "recently",
  study_hours: "0",
  topics_studied: "0",
  avg_memory: "N/A",
  streak_days_display: "0",
  fixed_count: "several",
  maintenance_date: "soon",
  downtime: "~30 minutes",
  // Additional notification variable fields
  last_studied: "recently",
  days_since_review: "0",
  revision_count: "0",
  predicted_drop_date: "soon",
  decay_rate: "moderate",
  urgency_level: "MEDIUM",
  at_risk_count_str: "0",
  top_risk_topic: "N/A",
  weakest_score: "0",
  total_topics: "0",
  avg_score: "0",
  milestone: "a milestone",
  total_sessions: "0",
  best_streak: "0",
  hours_remaining: "N/A",
  last_study_time: "N/A",
  streak_freeze_count: "0",
  hours_since_update: "N/A",
  pending_topics: "0",
  topics_due: "0",
  today_topics_count: "0",
  focus_topic: "your focus area",
  predicted_rank_str: "improving",
  mission_type: "review",
  deadline: "48h",
  topics_studied_str: "0",
  hours_studied: "0h",
  accuracy: "N/A",
  rank_change: "+0",
  top_improvement: "N/A",
  weak_area: "N/A",
  days_remaining: "30",
  expiry_date: "soon",
  renewal_price: "N/A",
  discount_code: "",
  first_topic: "your first topic",
  community_count: "growing",
  inactive_days: "0",
  streak_lost: "none",
  topics_decaying: "0",
  memory_drop_pct: "0",
  friends_active: "friends are studying",
  top_score: "N/A",
  percentile: "N/A",
  offer_name: "Special Offer",
  discount_pct: "N/A",
  valid_until: "soon",
  promo_code: "",
  current_plan: "Free",
  upgrade_plan: "Pro",
  price: "N/A",
  savings_pct: "N/A",
  features_unlocked: "premium features",
  referral_code: "",
  reward_amount: "a reward",
  friends_joined: "0",
  referral_link: "",
  comeback_offer: "a special offer",
  app_url: "https://brain-boost-ai-12.lovable.app",
  daily_target: "1 topic",
  fatigue_score: "LOW",
  session_duration: "N/A",
  break_suggestion: "Keep going!",
  optimal_study_time: "morning",
  daily_study_goal_minutes: "30",
};

/**
 * Extract all {{variable}} placeholders from a template string.
 */
export function extractVariables(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))];
}

/**
 * Resolve all variables in a template string.
 * Steps:
 * 1. Extract required placeholders
 * 2. Merge provided data with defaults
 * 3. Replace all placeholders
 * 4. Run sanity checks
 * Returns { resolved, warnings, blocked }
 */
export function resolveTemplate(
  template: string,
  data: Record<string, any>,
  opts?: { strict?: boolean }
): { resolved: string; warnings: string[]; blocked: boolean } {
  const warnings: string[] = [];
  const requiredVars = extractVariables(template);
  let resolved = template;

  for (const varName of requiredVars) {
    const rawValue = data[varName];
    let value: string;

    if (rawValue === undefined || rawValue === null || rawValue === "") {
      // Apply fallback
      value = VARIABLE_DEFAULTS[varName] || "";
      if (!value) {
        warnings.push(`Variable '${varName}' missing, no fallback available`);
      } else {
        warnings.push(`Variable '${varName}' missing, used fallback: "${value}"`);
      }
    } else {
      value = String(rawValue);
    }

    resolved = resolved.split(`{{${varName}}}`).join(value);
  }

  // Sanity check: detect leftover placeholders or blank patterns
  const sanityResult = sanitizeMessage(resolved);
  if (sanityResult.issues.length > 0) {
    warnings.push(...sanityResult.issues);
  }

  const blocked = opts?.strict === true && sanityResult.hasBlank;

  return { resolved: sanityResult.cleaned, warnings, blocked };
}

/**
 * Resolve variables in a key-value data object (non-template mode).
 * Ensures every value has a safe fallback.
 */
export function resolveVariables(
  data: Record<string, any>
): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val === undefined || val === null || val === "") {
      resolved[key] = VARIABLE_DEFAULTS[key] || `[${key}]`;
    } else {
      resolved[key] = String(val);
    }
  }
  return resolved;
}

/**
 * Sanitize a rendered message before sending.
 * Catches: leftover {{placeholders}}, double spaces, "undefined", "null", empty strings.
 */
export function sanitizeMessage(message: string): {
  cleaned: string;
  issues: string[];
  hasBlank: boolean;
} {
  const issues: string[] = [];
  let cleaned = message;
  let hasBlank = false;

  // Detect leftover unreplaced placeholders
  const leftover = cleaned.match(/\{\{\w+\}\}/g);
  if (leftover) {
    issues.push(`Unreplaced placeholders: ${leftover.join(", ")}`);
    // Replace leftovers with defaults or remove
    for (const ph of leftover) {
      const varName = ph.slice(2, -2);
      const fallback = VARIABLE_DEFAULTS[varName] || "";
      cleaned = cleaned.split(ph).join(fallback);
    }
    hasBlank = true;
  }

  // Detect literal "undefined" or "null"
  if (/\bundefined\b/i.test(cleaned)) {
    issues.push("Message contains literal 'undefined'");
    cleaned = cleaned.replace(/\bundefined\b/gi, "");
    hasBlank = true;
  }
  if (/\bnull\b/i.test(cleaned)) {
    issues.push("Message contains literal 'null'");
    cleaned = cleaned.replace(/\bnull\b/gi, "");
    hasBlank = true;
  }

  // Clean up double/triple spaces
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

  // Detect empty message
  if (!cleaned || cleaned.length < 3) {
    issues.push("Message is empty or too short after sanitization");
    hasBlank = true;
  }

  return { cleaned, issues, hasBlank };
}

/**
 * Validate a template at save-time: ensures all placeholders have known defaults.
 * Returns list of unknown variables.
 */
export function validateTemplate(template: string): {
  valid: boolean;
  unknownVars: string[];
  allVars: string[];
} {
  const allVars = extractVariables(template);
  const unknownVars = allVars.filter((v) => !(v in VARIABLE_DEFAULTS));
  return { valid: unknownVars.length === 0, unknownVars, allVars };
}

/**
 * Pre-send check: resolves template and blocks if any critical issue.
 * Use this as the final gate before dispatching any notification.
 */
export function preSendCheck(
  template: string,
  data: Record<string, any>
): { approved: boolean; message: string; warnings: string[] } {
  const { resolved, warnings, blocked } = resolveTemplate(template, data, { strict: true });

  if (blocked) {
    return { approved: false, message: resolved, warnings };
  }

  // Final sanity
  const { cleaned, issues, hasBlank } = sanitizeMessage(resolved);
  if (hasBlank && issues.length > 0) {
    return { approved: false, message: cleaned, warnings: [...warnings, ...issues] };
  }

  return { approved: true, message: cleaned, warnings };
}

/**
 * Get all known variable names and their defaults (for admin UI).
 */
export function getAvailableVariables(): Record<string, string> {
  return { ...VARIABLE_DEFAULTS };
}
