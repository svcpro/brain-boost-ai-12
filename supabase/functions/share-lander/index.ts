// Dynamic share lander: returns HTML with personalized Open Graph meta tags
// pointing to the og-image edge function, then redirects users to the app.
//
// URL: /functions/v1/share-lander?variant=myrank&exam=SSC+CGL+2026&name=Rahul&rank=412
// All query params forwarded to og-image render + used to craft personalized
// title/description for crawlers (WhatsApp, X, LinkedIn, Facebook, Telegram).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE = "https://acry.ai";
const PROJECT_REF = Deno.env.get("SUPABASE_URL")?.match(/https?:\/\/([^.]+)\./)?.[1] ?? "yvxrsujwgmzdjzsjyqfb";
const OG_BASE = `https://${PROJECT_REF}.supabase.co/functions/v1/og-image`;

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const truncate = (s: string, n: number) =>
  s.length > n ? s.slice(0, n - 1) + "…" : s;

interface Meta {
  title: string;
  description: string;
  ogImage: string;
  redirect: string;
}

function buildMeta(params: URLSearchParams): Meta {
  const variant = (params.get("variant") || "default").toLowerCase();
  const exam = (params.get("exam") || "").trim();
  const name = (params.get("name") || "").trim();
  const rank = (params.get("rank") || "").trim();

  // Forward all relevant params to the OG image renderer
  const og = new URL(OG_BASE);
  ["variant", "exam", "name", "rank", "level", "streak"].forEach((k) => {
    const v = params.get(k);
    if (v) og.searchParams.set(k, v);
  });

  // Personalized title/description
  let title: string;
  let description: string;

  if (variant === "myrank" && rank) {
    title = `${name ? name + " is" : "I'm"} predicted Rank #${rank}${exam ? ` in ${exam}` : ""} | ACRY AI`;
    description = `Get your AI-powered exam rank prediction in 60 seconds. ACRY's neural engine analyses your prep and tells you exactly where you'll stand.`;
  } else if (variant === "sureshot") {
    title = `${name ? name + " entered" : "I entered"} the SureShot Topper Zone${exam ? ` for ${exam}` : ""} | ACRY AI`;
    description = `ACRY's SureShot engine pinpoints the exact questions most likely to appear in your exam — and tracks your topper-zone status in real time.`;
  } else if (exam) {
    title = `${name ? name + " is" : "Crack"} ${exam} with ACRY AI — India's #1 AI Second Brain`;
    description = `ACRY predicts what you'll forget and builds your perfect study plan for ${exam}. 14-day free trial. No credit card.`;
  } else {
    title = "ACRY AI — India's #1 AI Second Brain for exam prep";
    description = "Predicts what you'll forget. Builds your perfect study plan. Trusted by lakhs of aspirants. Start free.";
  }

  // Where the human visitor should land (preserve UTMs)
  const redirect = new URL(params.get("to") || `${SITE}/`);
  ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((k) => {
    const v = params.get(k);
    if (v && !redirect.searchParams.has(k)) redirect.searchParams.set(k, v);
  });

  return {
    title: truncate(title, 140),
    description: truncate(description, 200),
    ogImage: og.toString(),
    redirect: redirect.toString(),
  };
}

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const meta = buildMeta(url.searchParams);

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(meta.title)}</title>
  <meta name="description" content="${escapeHtml(meta.description)}" />
  <link rel="canonical" href="${escapeHtml(meta.redirect)}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="ACRY AI" />
  <meta property="og:title" content="${escapeHtml(meta.title)}" />
  <meta property="og:description" content="${escapeHtml(meta.description)}" />
  <meta property="og:url" content="${escapeHtml(meta.redirect)}" />
  <meta property="og:image" content="${escapeHtml(meta.ogImage)}" />
  <meta property="og:image:secure_url" content="${escapeHtml(meta.ogImage)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:alt" content="${escapeHtml(meta.title)}" />

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@acaborns" />
  <meta name="twitter:title" content="${escapeHtml(meta.title)}" />
  <meta name="twitter:description" content="${escapeHtml(meta.description)}" />
  <meta name="twitter:image" content="${escapeHtml(meta.ogImage)}" />

  <!-- WhatsApp prefers larger image when these are present -->
  <meta property="og:locale" content="en_IN" />

  <meta http-equiv="refresh" content="0; url=${escapeHtml(meta.redirect)}" />
  <script>window.location.replace(${JSON.stringify(meta.redirect)});</script>
  <style>
    body{font-family:system-ui,sans-serif;background:#0B0F1A;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
    a{color:#00E5FF;text-decoration:none}
  </style>
</head>
<body>
  <p>Opening ACRY AI… <a href="${escapeHtml(meta.redirect)}">Tap here</a> if not redirected.</p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
});
