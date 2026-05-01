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
  opts: UtmOptions = {}
): void {
  const tagged = buildShareUrl(url, platform, opts);
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
 * Returns true if the native sheet (or fallback) succeeded.
 */
export async function nativeShare(
  payload: { url: string; text?: string; title?: string; files?: File[] },
  opts: UtmOptions = {}
): Promise<boolean> {
  const tagged = buildShareUrl(payload.url, "native", opts);
  const data: ShareData = {
    url: tagged,
    text: payload.text,
    title: payload.title,
  };
  if (payload.files && payload.files.length) {
    (data as ShareData & { files: File[] }).files = payload.files;
  }

  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      // canShare is optional; only check it when files are present
      if (payload.files && navigator.canShare && !navigator.canShare(data)) {
        // Strip files and retry
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
