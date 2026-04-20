/**
 * One-click image-card share for ACRY MyRank.
 * Generates a 1080x1080 share-ready PNG on a hidden canvas,
 * then attempts native file-share (WhatsApp/Instagram pick it up automatically),
 * falling back to image download + opening the channel URL with the caption pre-filled.
 */

export interface BadgeData {
  rank: number;
  percentile: number;
  category: string;
  aiTag: string;
  userName?: string;
}

const tierGradients: Record<string, [string, string, string]> = {
  legendary: ["#fbbf24", "#f97316", "#ef4444"],
  elite: ["#a855f7", "#ec4899", "#ef4444"],
  great: ["#3b82f6", "#06b6d4", "#0ea5e9"],
  good: ["#22c55e", "#10b981", "#059669"],
};

function pickTier(p: number) {
  return p >= 99 ? "legendary" : p >= 90 ? "elite" : p >= 70 ? "great" : "good";
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Render the badge to an offscreen canvas and return a PNG Blob. */
export async function renderBadgeBlob(d: BadgeData): Promise<Blob> {
  const W = 1080, H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-2d-unavailable");

  const tier = pickTier(d.percentile);
  const [c1, c2, c3] = tierGradients[tier];

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, c1);
  bg.addColorStop(0.5, c2);
  bg.addColorStop(1, c3);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Decorative rings
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 4;
  [200, 320, 440].forEach(r => {
    ctx.beginPath();
    ctx.arc(W / 2, 480, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Brand
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "bold 38px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("ACRY MyRank", W / 2, 100);

  ctx.font = "26px system-ui";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText(`${d.category} · AI Rank Test`, W / 2, 145);

  // Trophy/crown
  ctx.font = "120px sans-serif";
  ctx.fillText(d.percentile >= 95 ? "👑" : "🏆", W / 2, 320);

  // RANK label
  ctx.fillStyle = "#fff";
  ctx.font = "bold 56px system-ui";
  ctx.fillText("RANK", W / 2, 410);

  // Big number
  ctx.font = "bold 200px system-ui";
  ctx.fillText(`#${d.rank.toLocaleString("en-IN")}`, W / 2, 580);

  // Name
  ctx.font = "bold 48px system-ui";
  ctx.fillText(d.userName || "Champion", W / 2, 670);

  // AI tag pill
  const pillText = d.aiTag;
  ctx.font = "bold 36px system-ui";
  const pillW = ctx.measureText(pillText).width + 80;
  const pillH = 70;
  const pillX = (W - pillW) / 2;
  const pillY = 720;
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  roundRect(ctx, pillX, pillY, pillW, pillH, 35);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(pillText, W / 2, pillY + 48);

  // Percentile line
  ctx.font = "bold 64px system-ui";
  ctx.fillText(`Top ${(100 - d.percentile).toFixed(1)}%`, W / 2, 880);
  ctx.font = "32px system-ui";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText("of all test-takers in India", W / 2, 925);

  // CTA
  ctx.font = "bold 32px system-ui";
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillText("Beat me → acry.ai/myrank", W / 2, 1020);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new Error("blob-failed"))),
      "image/png",
      0.95,
    );
  });
}

export interface OneClickShareOpts {
  badge: BadgeData;
  caption: string;
  shareUrl: string;
  channel: "whatsapp" | "instagram" | "telegram" | "native";
  fileName?: string;
  /**
   * Pre-opened window from a synchronous click handler. Required on desktop
   * to avoid popup blockers eating the share window after async work.
   * Pass `null` if user is on mobile (native share takes priority there).
   */
  preOpenedWindow?: Window | null;
}

/** Open a placeholder popup synchronously inside a user gesture. */
export function openSharePlaceholder(): Window | null {
  if (typeof window === "undefined") return null;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) return null; // mobile uses navigator.share or location.href
  try {
    return window.open("about:blank", "_blank", "noopener,noreferrer,width=720,height=720");
  } catch {
    return null;
  }
}

export interface ShareResult {
  ok: boolean;
  /** What actually happened so the UI can show the right toast. */
  mode: "native-files" | "native-text" | "channel-url" | "downloaded" | "cancelled" | "error";
  message?: string;
}

/**
 * One-click share that ALWAYS succeeds in some form:
 * 1. Try `navigator.share({ files })` → WhatsApp/IG show the image natively
 * 2. Else open the channel's share URL with the caption (image is downloaded too)
 * 3. Always copy caption to clipboard as a safety net
 */
export async function shareBadgeOneClick(opts: OneClickShareOpts): Promise<ShareResult> {
  const { badge, caption, shareUrl, channel, preOpenedWindow } = opts;
  const fileName = opts.fileName || `acry-rank-${badge.rank}.png`;

  // Always copy caption — guarantees user can paste even on cold fallback
  try { await navigator.clipboard?.writeText(caption); } catch { /* non-fatal */ }

  let blob: Blob | null = null;
  try {
    blob = await renderBadgeBlob(badge);
  } catch {
    // No image → just open channel URL with text
    openChannelUrl(channel, caption, shareUrl, preOpenedWindow);
    return { ok: true, mode: "channel-url", message: "Caption copied. Paste it after the link." };
  }

  const file = new File([blob], fileName, { type: "image/png" });

  // 1. Best path (mobile): native file share — WhatsApp/IG accept files
  const canShareFiles =
    typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });

  if (canShareFiles && typeof navigator.share === "function") {
    try {
      await navigator.share({
        files: [file],
        title: "My ACRY Rank",
        text: caption,
      });
      // Native share took over — close the placeholder if any
      try { preOpenedWindow?.close(); } catch {}
      return { ok: true, mode: "native-files" };
    } catch (err: any) {
      if (err?.name === "AbortError") {
        try { preOpenedWindow?.close(); } catch {}
        return { ok: false, mode: "cancelled" };
      }
      // fall through to fallback
    }
  }

  // 2. Fallback (desktop): redirect the pre-opened window to the share URL,
  //    then download the image so user can attach it manually.
  openChannelUrl(channel, caption, shareUrl, preOpenedWindow);

  setTimeout(() => {
    try { triggerDownload(blob!, fileName); } catch { /* non-fatal */ }
  }, 250);

  return {
    ok: true,
    mode: "downloaded",
    message: "WhatsApp opened with your caption. Image saved — attach it in chat 🎉",
  };
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1500);
}

function openChannelUrl(
  channel: OneClickShareOpts["channel"],
  caption: string,
  url: string,
  preOpenedWindow?: Window | null,
) {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const encoded = encodeURIComponent(caption);
  let target = "";
  switch (channel) {
    case "whatsapp":
    case "native":
    default:
      target = `https://wa.me/?text=${encoded}`;
      break;
    case "telegram":
      target = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encoded}`;
      break;
    case "instagram":
      target = "https://www.instagram.com/";
      break;
  }
  // Mobile: same-tab deep-link (works inside user gesture).
  if (isMobile) {
    window.location.href = target;
    return;
  }
  // Desktop: prefer redirecting the pre-opened window (gesture preserved).
  if (preOpenedWindow && !preOpenedWindow.closed) {
    try {
      preOpenedWindow.location.href = target;
      return;
    } catch { /* cross-origin or blocked — fall through */ }
  }
  const w = window.open(target, "_blank", "noopener,noreferrer");
  if (!w) window.location.href = target;
}

/**
 * Build the share URL for a given channel + caption — synchronously.
 * Useful when you want to redirect a pre-opened window IMMEDIATELY (preserving
 * the user gesture) before doing any async work.
 */
export function buildChannelShareUrl(
  channel: OneClickShareOpts["channel"],
  caption: string,
  url: string,
): string {
  const encoded = encodeURIComponent(caption);
  switch (channel) {
    case "telegram":
      return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encoded}`;
    case "instagram":
      return "https://www.instagram.com/direct/inbox/";
    case "whatsapp":
    case "native":
    default:
      return `https://wa.me/?text=${encoded}`;
  }
}

/**
 * Redirect a pre-opened window to the channel share URL synchronously.
 * Returns true if the window was redirected, false otherwise.
 */
export function redirectToChannel(
  win: Window | null | undefined,
  channel: OneClickShareOpts["channel"],
  caption: string,
  url: string,
): boolean {
  if (!win || win.closed) return false;
  try {
    win.location.href = buildChannelShareUrl(channel, caption, url);
    return true;
  } catch {
    return false;
  }
}

// Re-export for completeness so the only export surface stays stable.
export { openChannelUrl as _openChannelUrlInternal };
