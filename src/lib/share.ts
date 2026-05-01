/**
 * Universal share helper for ACRY AI.
 *
 * Auto-appends platform-tuned UTM parameters to every shared URL so
 * signups can be attributed in analytics (utm_source / utm_medium / utm_campaign).
 *
 * Usage:
 *   import { buildShareUrl, shareTo, nativeShare } from "@/lib/share";
 *
 *   // Build a tagged URL
 *   const url = buildShareUrl("https://acry.ai/myrank", "whatsapp", { campaign: "myrank_result" });
 *
 *   // Open a platform share dialog (auto-tagged)
 *   shareTo("twitter", "https://acry.ai", "Crack any exam with ACRY AI 🧠⚡");
 *
 *   // Native OS share sheet (auto-tagged with source=native)
 *   await nativeShare({ url: "https://acry.ai", text: "...", title: "ACRY AI" });
 */

export type SharePlatform =
  | "whatsapp"
  | "twitter"
  | "x"
  | "linkedin"
  | "facebook"
  | "telegram"
  | "instagram"
  | "email"
  | "sms"
  | "copy"
  | "native"
  | "qr"
  | "other";

interface UtmOptions {
  /** Campaign tag, e.g. "myrank_result", "streak_share", "weekly_digest" */
  campaign?: string;
  /** Optional content variant tag (A/B test, button position, etc.) */
  content?: string;
  /** Optional term tag */
  term?: string;
  /** Override the medium (defaults to "social" for social platforms, "messaging" for chat apps, etc.) */
  medium?: string;
}

/** Personalization fields for the dynamic Open Graph image. */
export interface OgPersonalization {
  /** Visual variant — controls palette + headline. */
  variant?: "myrank" | "sureshot" | "default";
  /** Exam name, e.g. "SSC CGL 2026" */
  exam?: string;
  /** User display name */
  name?: string;
  /** Predicted rank (digits only) */
  rank?: number | string;
  /** Brain Level (digits only) */
  level?: number | string;
  /** Day streak count */
  streak?: number | string;
}

const SUPABASE_PROJECT_REF =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_SUPABASE_PROJECT_ID) ||
  "yvxrsujwgmzdjzsjyqfb";

const FUNCTIONS_BASE = `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1`;

/**
 * Build the dynamic OG image URL (1200x630 PNG) for a personalized share card.
 * Returns a URL safe to drop into <meta property="og:image">.
 */
export function buildOgImageUrl(p: OgPersonalization = {}): string {
  const u = new URL(`${FUNCTIONS_BASE}/og-image`);
  if (p.variant) u.searchParams.set("variant", p.variant);
  if (p.exam) u.searchParams.set("exam", String(p.exam));
  if (p.name) u.searchParams.set("name", String(p.name));
  if (p.rank != null && p.rank !== "") u.searchParams.set("rank", String(p.rank));
  if (p.level != null && p.level !== "") u.searchParams.set("level", String(p.level));
  if (p.streak != null && p.streak !== "") u.searchParams.set("streak", String(p.streak));
  return u.toString();
}

/**
 * Build a public share-lander URL — an HTML page hosted by our edge function
 * that emits personalized OG meta tags (so WhatsApp/X/LinkedIn previews show
 * the dynamic image + custom title) and immediately redirects the human visitor
 * to the real destination URL.
 *
 * Use this URL as the *shared link* (not the image itself).
 */
export function buildShareLanderUrl(
  destinationUrl: string,
  personalization: OgPersonalization = {},
  platform: SharePlatform = "other",
  utm: UtmOptions = {}
): string {
  // First tag the destination so it preserves attribution after redirect
  const tagged = buildShareUrl(destinationUrl, platform, utm);

  const u = new URL(`${FUNCTIONS_BASE}/share-lander`);
  u.searchParams.set("to", tagged);
  if (personalization.variant) u.searchParams.set("variant", personalization.variant);
  if (personalization.exam) u.searchParams.set("exam", String(personalization.exam));
  if (personalization.name) u.searchParams.set("name", String(personalization.name));
  if (personalization.rank != null && personalization.rank !== "")
    u.searchParams.set("rank", String(personalization.rank));
  if (personalization.level != null && personalization.level !== "")
    u.searchParams.set("level", String(personalization.level));
  if (personalization.streak != null && personalization.streak !== "")
    u.searchParams.set("streak", String(personalization.streak));

  // Mirror UTMs onto the lander itself for analytics dashboards that care
  const src = SOURCE_MAP[platform] ?? "other";
  const med = utm.medium ?? DEFAULT_MEDIUM[platform] ?? "share_link";
  if (!u.searchParams.has("utm_source")) u.searchParams.set("utm_source", src);
  if (!u.searchParams.has("utm_medium")) u.searchParams.set("utm_medium", med);
  if (utm.campaign) u.searchParams.set("utm_campaign", utm.campaign);

  return u.toString();
}

const DEFAULT_MEDIUM: Record<SharePlatform, string> = {
  whatsapp: "messaging",
  telegram: "messaging",
  sms: "messaging",
  email: "email",
  twitter: "social",
  x: "social",
  linkedin: "social",
  facebook: "social",
  instagram: "social",
  copy: "share_link",
  native: "share_link",
  qr: "qr",
  other: "share_link",
};

const SOURCE_MAP: Record<SharePlatform, string> = {
  whatsapp: "whatsapp",
  twitter: "twitter",
  x: "twitter",
  linkedin: "linkedin",
  facebook: "facebook",
  telegram: "telegram",
  instagram: "instagram",
  email: "email",
  sms: "sms",
  copy: "copy_link",
  native: "native_share",
  qr: "qr_code",
  other: "other",
};

/**
 * Append (or merge) UTM parameters onto a URL without clobbering existing query.
 */
export function buildShareUrl(
  rawUrl: string,
  platform: SharePlatform,
  opts: UtmOptions = {}
): string {
  let u: URL;
  try {
    // Allow relative URLs by anchoring to current origin
    u = new URL(rawUrl, typeof window !== "undefined" ? window.location.origin : "https://acry.ai");
  } catch {
    return rawUrl;
  }

  const source = SOURCE_MAP[platform] ?? "other";
  const medium = opts.medium ?? DEFAULT_MEDIUM[platform] ?? "share_link";

  // Don't clobber UTMs that the caller already set explicitly on the URL
  if (!u.searchParams.has("utm_source")) u.searchParams.set("utm_source", source);
  if (!u.searchParams.has("utm_medium")) u.searchParams.set("utm_medium", medium);
  if (opts.campaign && !u.searchParams.has("utm_campaign"))
    u.searchParams.set("utm_campaign", opts.campaign);
  if (opts.content && !u.searchParams.has("utm_content"))
    u.searchParams.set("utm_content", opts.content);
  if (opts.term && !u.searchParams.has("utm_term"))
    u.searchParams.set("utm_term", opts.term);

  return u.toString();
}

/**
 * Open a platform-specific share dialog. The shared URL is auto-tagged
 * with the platform's UTM source.
 */
export function shareTo(
  platform: SharePlatform,
  url: string,
  text: string = "",
  opts: UtmOptions & { og?: OgPersonalization } = {}
): void {
  // If personalization is provided, route through the share-lander so
  // crawlers see the dynamic OG image + personalized title.
  const tagged = opts.og
    ? buildShareLanderUrl(url, opts.og, platform, opts)
    : buildShareUrl(url, platform, opts);
  const body = text ? `${text} ${tagged}` : tagged;
  let target = "";

  switch (platform) {
    case "whatsapp":
      target = `https://wa.me/?text=${encodeURIComponent(body)}`;
      break;
    case "twitter":
    case "x":
      target = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(tagged)}`;
      break;
    case "linkedin":
      target = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(tagged)}`;
      break;
    case "facebook":
      target = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(tagged)}&quote=${encodeURIComponent(text)}`;
      break;
    case "telegram":
      target = `https://t.me/share/url?url=${encodeURIComponent(tagged)}&text=${encodeURIComponent(text)}`;
      break;
    case "email":
      target = `mailto:?subject=${encodeURIComponent(text || "ACRY AI")}&body=${encodeURIComponent(body)}`;
      break;
    case "sms":
      target = `sms:?body=${encodeURIComponent(body)}`;
      break;
    case "copy":
      void navigator.clipboard?.writeText(tagged);
      return;
    default:
      target = tagged;
  }

  if (typeof window !== "undefined") {
    window.open(target, "_blank", "noopener,noreferrer");
  }
}

/**
 * Trigger the native OS share sheet with auto-tagged URL (source=native_share).
 * Falls back to clipboard copy if the Web Share API is unavailable.
 *
 * If `opts.og` is provided, the shared URL will be a personalized share-lander
 * that emits dynamic Open Graph meta — every preview shows custom artwork.
 *
 * Returns true if the native sheet (or fallback) succeeded.
 */
export async function nativeShare(
  payload: { url: string; text?: string; title?: string; files?: File[] },
  opts: UtmOptions & { og?: OgPersonalization } = {}
): Promise<boolean> {
  const tagged = opts.og
    ? buildShareLanderUrl(payload.url, opts.og, "native", opts)
    : buildShareUrl(payload.url, "native", opts);
  // IMPORTANT: Many native share targets (WhatsApp, Instagram, Telegram on Android/iOS)
  // silently DROP the `url` field when `files` are present — only the image gets shared.
  // To guarantee the link always appears in the message, we inline the tagged URL into
  // the text body whenever files are attached, and also when text is provided alongside.
  const hasFiles = !!(payload.files && payload.files.length);
  const baseText = payload.text ?? "";
  const textWithUrl = baseText
    ? (baseText.includes(tagged) ? baseText : `${baseText}\n\n${tagged}`)
    : tagged;

  const data: ShareData = {
    // When files are present, omit `url` (it would be dropped) and rely on text.
    // When no files, keep `url` separate so platforms that prefer it (X, LinkedIn) get a clean link.
    ...(hasFiles ? {} : { url: tagged }),
    text: hasFiles ? textWithUrl : baseText || undefined,
    title: payload.title,
  };
  if (hasFiles) {
    (data as ShareData & { files: File[] }).files = payload.files!;
  }

  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      // canShare is optional; only check it when files are present
      if (hasFiles && navigator.canShare && !navigator.canShare(data)) {
        // Strip files and retry — text already contains the URL so link survives
        delete (data as { files?: File[] }).files;
      }
      await navigator.share(data);
      return true;
    }
  } catch (err) {
    // User cancelled or share failed — fall through to clipboard
    if ((err as DOMException)?.name === "AbortError") return false;
  }

  try {
    await navigator.clipboard?.writeText(`${payload.text ? payload.text + " " : ""}${tagged}`);
    return true;
  } catch {
    return false;
  }
}
