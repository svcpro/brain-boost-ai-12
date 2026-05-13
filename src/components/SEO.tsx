import { Helmet } from "react-helmet-async";

const SITE_URL = "https://acry.ai";

interface SEOProps {
  title: string;
  description: string;
  path: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  ogType?: string;
}

export default function SEO({ title, description, path, jsonLd, ogType = "website" }: SEOProps) {
  const url = `${SITE_URL}${path}`;
  const desc = description.length > 160 ? description.slice(0, 157).trimEnd() + "…" : description;
  const ldArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={ogType} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={desc} />
      {ldArray.map((ld, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(ld)}</script>
      ))}
    </Helmet>
  );
}
