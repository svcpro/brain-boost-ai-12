// Dynamic Open Graph image renderer for ACRY AI shares.
// Renders a personalized 1200x630 PNG from query params:
//   ?exam=SSC+CGL+2026&name=Rahul&rank=412&level=7&streak=28&variant=myrank
// Variants: "myrank" | "sureshot" | "default"
// Cached aggressively at the CDN edge.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { Resvg, initWasm } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";

let wasmReady: Promise<void> | null = null;
async function ensureWasm() {
  if (!wasmReady) {
    wasmReady = (async () => {
      const wasm = await fetch(
        "https://esm.sh/@resvg/resvg-wasm@2.6.2/index_bg.wasm"
      ).then((r) => r.arrayBuffer());
      await initWasm(wasm);
    })();
  }
  return wasmReady;
}

const escapeXml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const truncate = (s: string, n: number) =>
  s.length > n ? s.slice(0, n - 1) + "…" : s;

interface OGParams {
  exam: string;
  name: string;
  rank: string;
  level: string;
  streak: string;
  variant: "myrank" | "sureshot" | "default";
}

function buildSvg(p: OGParams): string {
  const W = 1200;
  const H = 630;

  // Variant-specific accent + headline
  const palette =
    p.variant === "myrank"
      ? { from: "#7C4DFF", to: "#00E5FF", chip: "Predicted Rank" }
      : p.variant === "sureshot"
      ? { from: "#FF3D71", to: "#FFB020", chip: "SureShot Zone" }
      : { from: "#00E5FF", to: "#7C4DFF", chip: "AI Second Brain" };

  const headline =
    p.variant === "myrank" && p.rank
      ? `Predicted Rank #${escapeXml(p.rank)}`
      : p.variant === "sureshot"
      ? "I'm in the Topper Zone"
      : "India's #1 AI Second Brain";

  const subline = p.exam
    ? `for ${escapeXml(truncate(p.exam, 40))}`
    : "for exam prep";

  const greeting = p.name
    ? `${escapeXml(truncate(p.name, 24))} is preparing with ACRY AI`
    : "Predicts what you'll forget. Builds your perfect plan.";

  // Bottom stats chips
  const chips: { label: string; value: string }[] = [];
  if (p.level) chips.push({ label: "Brain Level", value: p.level });
  if (p.streak) chips.push({ label: "Day Streak", value: p.streak });
  if (p.rank && p.variant !== "myrank")
    chips.push({ label: "Predicted Rank", value: `#${p.rank}` });

  const chipSvg = chips
    .map((c, i) => {
      const x = 80 + i * 280;
      return `
        <g transform="translate(${x}, 500)">
          <rect width="250" height="80" rx="20" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
          <text x="20" y="34" font-family="Inter, system-ui, sans-serif" font-size="18" fill="rgba(255,255,255,0.55)" font-weight="500">${escapeXml(c.label)}</text>
          <text x="20" y="66" font-family="Inter, system-ui, sans-serif" font-size="28" fill="#FFFFFF" font-weight="700">${escapeXml(c.value)}</text>
        </g>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="g1" cx="20%" cy="25%" r="70%">
      <stop offset="0%" stop-color="${palette.from}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#0B0F1A" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g2" cx="85%" cy="80%" r="65%">
      <stop offset="0%" stop-color="${palette.to}" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#0B0F1A" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="headlineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${palette.from}"/>
      <stop offset="100%" stop-color="${palette.to}"/>
    </linearGradient>
    <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00E5FF"/>
      <stop offset="100%" stop-color="#7C4DFF"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="#0B0F1A"/>
  <rect width="${W}" height="${H}" fill="url(#g1)"/>
  <rect width="${W}" height="${H}" fill="url(#g2)"/>

  <!-- Subtle grid -->
  <g opacity="0.04" stroke="#FFFFFF" stroke-width="1">
    ${Array.from({ length: 12 }, (_, i) => `<line x1="${(i + 1) * 100}" y1="0" x2="${(i + 1) * 100}" y2="${H}"/>`).join("")}
    ${Array.from({ length: 6 }, (_, i) => `<line x1="0" y1="${(i + 1) * 100}" x2="${W}" y2="${(i + 1) * 100}"/>`).join("")}
  </g>

  <!-- Brand row -->
  <g transform="translate(80, 80)">
    <polygon points="0,40 22,0 44,40" fill="url(#logoGrad)"/>
    <text x="60" y="32" font-family="Inter, system-ui, sans-serif" font-size="28" fill="#FFFFFF" font-weight="800" letter-spacing="2">ACRY AI</text>
  </g>

  <!-- Variant chip -->
  <g transform="translate(80, 170)">
    <rect width="280" height="44" rx="22" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.16)" stroke-width="1"/>
    <circle cx="22" cy="22" r="5" fill="${palette.to}"/>
    <text x="40" y="29" font-family="Inter, system-ui, sans-serif" font-size="16" fill="rgba(255,255,255,0.85)" font-weight="600" letter-spacing="1">${escapeXml(palette.chip.toUpperCase())}</text>
  </g>

  <!-- Headline -->
  <text x="80" y="300" font-family="Inter, system-ui, sans-serif" font-size="78" font-weight="900" fill="url(#headlineGrad)" letter-spacing="-2">${escapeXml(headline)}</text>
  <text x="80" y="370" font-family="Inter, system-ui, sans-serif" font-size="44" font-weight="700" fill="#FFFFFF" letter-spacing="-1">${subline}</text>

  <!-- Greeting / hook -->
  <text x="80" y="430" font-family="Inter, system-ui, sans-serif" font-size="24" font-weight="500" fill="rgba(255,255,255,0.65)">${greeting}</text>

  <!-- Bottom chips -->
  ${chipSvg}

  <!-- Footer URL -->
  <text x="${W - 80}" y="${H - 40}" text-anchor="end" font-family="Inter, system-ui, sans-serif" font-size="22" font-weight="600" fill="rgba(255,255,255,0.55)">acry.ai</text>
</svg>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const q = url.searchParams;
    const variantRaw = (q.get("variant") || "default").toLowerCase();
    const variant: OGParams["variant"] =
      variantRaw === "myrank" || variantRaw === "sureshot"
        ? variantRaw
        : "default";

    const params: OGParams = {
      exam: (q.get("exam") || "").slice(0, 60),
      name: (q.get("name") || "").slice(0, 40),
      rank: (q.get("rank") || "").replace(/[^\d,]/g, "").slice(0, 10),
      level: (q.get("level") || "").replace(/[^\d]/g, "").slice(0, 3),
      streak: (q.get("streak") || "").replace(/[^\d]/g, "").slice(0, 4),
      variant,
    };

    const svg = buildSvg(params);

    // Allow returning raw SVG for debugging via ?format=svg
    if (q.get("format") === "svg") {
      return new Response(svg, {
        headers: {
          ...corsHeaders,
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "public, max-age=3600, s-maxage=86400, immutable",
        },
      });
    }

    await ensureWasm();
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: 1200 },
      font: { loadSystemFonts: false },
    });
    const png = resvg.render().asPng();

    return new Response(png, {
      headers: {
        ...corsHeaders,
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, s-maxage=86400, immutable",
        "CDN-Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e) {
    console.error("[og-image] error", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message ?? "render failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
