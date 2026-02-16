import { corsHeaders, securityHeaders, authenticateRequest, requireAdmin, jsonResponse, errorResponse, handleCors } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { userId } = await authenticateRequest(req);
    await requireAdmin(userId);

    const body = await req.json();
    const action = body.action || "optimize"; // optimize | audit | keywords | content-gap | auto-fix

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const callAI = async (systemPrompt: string, userPrompt: string) => {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: getToolsForAction(action),
          tool_choice: getToolChoiceForAction(action),
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) return { error: "Rate limited, try again later", status: 429 };
        if (status === 402) return { error: "Credits exhausted", status: 402 };
        const t = await response.text();
        console.error("AI error:", status, t);
        return { error: "AI gateway error", status: 500 };
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        try {
          return { result: JSON.parse(toolCall.function.arguments) };
        } catch {
          return { error: "Failed to parse AI response" };
        }
      }
      // Fallback to content
      const content = data.choices?.[0]?.message?.content || "";
      try {
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        return { result: JSON.parse(cleaned) };
      } catch {
        return { result: { raw: content } };
      }
    };

    // ========== ACTION: GENERATE-PAGE-SEO ==========
    if (action === "generate-page-seo") {
      const { page_url, page_type, platform_name } = body;
      if (!page_url) return errorResponse("page_url is required", 400);

      const systemPrompt = `You are an elite SEO expert specializing in ranking education platforms on Google India. Platform: ${platform_name || "ACRY – AI Second Brain for All Exams"} (Indian competitive exam prep: UPSC, SSC, Banking, JEE, NEET).

Generate ultra-optimized, production-ready SEO data. Use power words, emotional triggers, CTR-boosting techniques. All content must be highly relevant to the page URL and type.`;

      const userPrompt = `Generate complete SEO data for this page:
URL: ${page_url}
Page Type: ${page_type || "landing"}

Generate:
- meta_title: CTR-optimized, under 60 chars, power words, main keyword first
- meta_description: compelling, under 155 chars, include CTA, emotional trigger
- meta_keywords: 8-12 high-intent keywords relevant to this page
- canonical_url: proper canonical URL for this page
- og_title: optimized for social sharing, slightly different from meta_title
- og_description: engaging for social, under 200 chars
- twitter_title: optimized for Twitter/X sharing
- twitter_description: concise for Twitter, under 200 chars
- schema_type: recommended schema.org type (e.g. WebPage, Article, FAQPage, Organization)
- schema_markup: complete JSON-LD schema markup object for this page`;

      const tools = [{
        type: "function",
        function: {
          name: "generate_page_seo",
          description: "Return complete SEO data for a single page",
          parameters: {
            type: "object",
            properties: {
              meta_title: { type: "string" },
              meta_description: { type: "string" },
              meta_keywords: { type: "array", items: { type: "string" } },
              canonical_url: { type: "string" },
              og_title: { type: "string" },
              og_description: { type: "string" },
              twitter_title: { type: "string" },
              twitter_description: { type: "string" },
              schema_type: { type: "string" },
              schema_markup: { type: "object" },
            },
            required: ["meta_title", "meta_description", "meta_keywords", "canonical_url", "og_title", "og_description", "twitter_title", "twitter_description", "schema_type", "schema_markup"],
            additionalProperties: false,
          },
        },
      }];

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools,
          tool_choice: { type: "function", function: { name: "generate_page_seo" } },
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) return errorResponse("Rate limited, try again later", 429);
        if (status === 402) return errorResponse("Credits exhausted", 402);
        return errorResponse("AI gateway error", 500);
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        try {
          return jsonResponse(JSON.parse(toolCall.function.arguments));
        } catch {
          return errorResponse("Failed to parse AI response");
        }
      }
      return errorResponse("No AI response generated");
    }

    // ========== ACTION: OPTIMIZE ==========
    if (action === "optimize") {
      const { data: pages } = await adminClient.from("seo_pages").select("*");
      if (!pages || pages.length === 0) return jsonResponse({ count: 0, message: "No pages to optimize" });

      const needsOptimization = pages.filter(p =>
        (p.seo_score || 0) < 80 || !p.meta_title || !p.meta_description || !p.og_title
      );

      if (needsOptimization.length === 0) return jsonResponse({ count: 0, message: "All pages well optimized" });

      const systemPrompt = `You are an elite SEO expert specializing in ranking education platforms on Google India. You optimize for E-E-A-T signals, search intent, CTR optimization, and semantic SEO. Platform: ACRY – AI Second Brain for All Exams (Indian competitive exam prep). Always use power words, emotional triggers, and CTR-boosting techniques in titles. Descriptions must include calls-to-action.`;

      const userPrompt = `Analyze these pages and generate ultra-optimized SEO suggestions for each:

${needsOptimization.slice(0, 15).map(p => `URL: ${p.page_url} | Type: ${p.page_type} | Title: ${p.meta_title || 'MISSING'} | Desc: ${p.meta_description || 'MISSING'} | Keywords: ${(p.meta_keywords || []).join(', ') || 'NONE'}`).join('\n')}

For each page generate:
- CTR-optimized meta title (under 60 chars, include power words)
- Compelling meta description (under 160 chars, include CTA)
- 5-8 high-intent keywords
- OG title optimized for social sharing
- OG description for social engagement
- Recommended schema type`;

      const aiResult = await callAI(systemPrompt, userPrompt);
      if (aiResult.error) return errorResponse(aiResult.error, aiResult.status);

      const suggestions = aiResult.result?.suggestions || [];
      const insertRows = suggestions.map((s: any) => {
        const matchingPage = pages.find(p => p.page_url === s.page_url);
        return {
          page_id: matchingPage?.id || null,
          page_url: s.page_url,
          suggested_meta_title: s.meta_title,
          suggested_meta_description: s.meta_description,
          suggested_keywords: s.keywords || [],
          suggested_schema: s.schema ? { "@type": s.schema } : null,
          status: "pending",
        };
      });

      if (insertRows.length > 0) {
        await adminClient.from("seo_ai_suggestions").insert(insertRows);
      }

      return jsonResponse({ count: insertRows.length, message: `Generated ${insertRows.length} AI suggestions` });
    }

    // ========== ACTION: AUDIT ==========
    if (action === "audit") {
      const { data: pages } = await adminClient.from("seo_pages").select("*");
      const { data: keywords } = await adminClient.from("seo_keywords").select("*");
      const { data: redirects } = await adminClient.from("seo_redirects").select("*");
      const { data: sitemap } = await adminClient.from("seo_sitemap").select("*");

      const systemPrompt = `You are an elite technical SEO auditor. Analyze the full SEO configuration and identify critical issues, warnings, and opportunities. Score overall health 0-100. Platform: ACRY – AI Second Brain for exam preparation.`;

      const userPrompt = `Full SEO Audit Data:
- Total Pages: ${(pages || []).length}
- Pages missing titles: ${(pages || []).filter(p => !p.meta_title).length}
- Pages missing descriptions: ${(pages || []).filter(p => !p.meta_description).length}
- Pages missing OG data: ${(pages || []).filter(p => !p.og_title || !p.og_image).length}
- Pages missing canonical: ${(pages || []).filter(p => !p.canonical_url).length}
- Pages with schema: ${(pages || []).filter(p => p.schema_markup_json && Object.keys(p.schema_markup_json).length > 0).length}
- Noindex pages: ${(pages || []).filter(p => !p.robots_index).length}
- Total keywords: ${(keywords || []).length}
- Keywords mapped to URLs: ${(keywords || []).filter(k => k.target_url).length}
- Total redirects: ${(redirects || []).length}
- Active redirects: ${(redirects || []).filter(r => r.is_active).length}
- Sitemap entries: ${(sitemap || []).length}
- Low score pages (<50): ${(pages || []).filter(p => (p.seo_score || 0) < 50).length}

Provide a comprehensive audit with issues categorized as critical/warning/info.`;

      const aiResult = await callAI(systemPrompt, userPrompt);
      if (aiResult.error) return errorResponse(aiResult.error, aiResult.status);
      return jsonResponse(aiResult.result);
    }

    // ========== ACTION: KEYWORDS ==========
    if (action === "keywords") {
      const targetUrl = body.target_url || "/";
      const topic = body.topic || "exam preparation";

      const systemPrompt = `You are an expert keyword researcher specializing in Indian education market. Generate high-intent, low-competition keywords that can rank quickly on Google India.`;

      const userPrompt = `Research keywords for:
URL: ${targetUrl}
Topic: ${topic}
Platform: ACRY – AI-powered exam preparation for Indian competitive exams (UPSC, SSC, Banking, JEE, NEET, etc.)

Generate 15-20 keywords with:
- Search intent (informational/transactional/navigational)
- Estimated difficulty (easy/medium/hard)
- Priority (high/medium/low)
- Suggested URL to target`;

      const aiResult = await callAI(systemPrompt, userPrompt);
      if (aiResult.error) return errorResponse(aiResult.error, aiResult.status);
      return jsonResponse(aiResult.result);
    }

    // ========== ACTION: CONTENT-GAP ==========
    if (action === "content-gap") {
      const { data: pages } = await adminClient.from("seo_pages").select("page_url, page_type, meta_keywords");
      const { data: keywords } = await adminClient.from("seo_keywords").select("keyword, target_url");

      const systemPrompt = `You are a content strategy expert. Analyze the current page coverage and keyword mapping to identify content gaps – topics and pages that should exist but don't, and keywords that aren't properly targeted.`;

      const userPrompt = `Current Pages: ${(pages || []).map(p => p.page_url).join(', ')}
Current Keywords: ${(keywords || []).map(k => k.keyword).join(', ')}
Platform: ACRY – AI exam prep for Indian competitive exams

Identify:
1. Missing pages that should exist for SEO
2. Keywords without target pages
3. Topic clusters that need more content
4. Quick-win opportunities`;

      const aiResult = await callAI(systemPrompt, userPrompt);
      if (aiResult.error) return errorResponse(aiResult.error, aiResult.status);
      return jsonResponse(aiResult.result);
    }

    // ========== ACTION: AUTO-FIX ==========
    if (action === "auto-fix") {
      const { data: pages } = await adminClient.from("seo_pages").select("*");
      if (!pages) return jsonResponse({ fixed: 0 });

      const broken = pages.filter(p => !p.meta_title || !p.meta_description || !p.og_title || !p.canonical_url);
      if (broken.length === 0) return jsonResponse({ fixed: 0, message: "Nothing to fix" });

      const systemPrompt = `You are an SEO automation expert. Generate optimized SEO data for pages with missing fields. Each fix must be production-ready. Platform: ACRY – AI Second Brain for Indian exam preparation.`;

      const userPrompt = `Auto-fix these ${broken.length} pages with missing SEO data:

${broken.slice(0, 20).map(p => `URL: ${p.page_url} | Type: ${p.page_type} | Has Title: ${!!p.meta_title} | Has Desc: ${!!p.meta_description} | Has OG: ${!!p.og_title} | Has Canonical: ${!!p.canonical_url}`).join('\n')}

For each page, generate ALL missing fields with optimized values.`;

      const aiResult = await callAI(systemPrompt, userPrompt);
      if (aiResult.error) return errorResponse(aiResult.error, aiResult.status);

      const fixes = aiResult.result?.fixes || [];
      let fixedCount = 0;

      for (const fix of fixes) {
        const page = pages.find(p => p.page_url === fix.page_url);
        if (!page) continue;

        const update: any = {};
        if (!page.meta_title && fix.meta_title) update.meta_title = fix.meta_title;
        if (!page.meta_description && fix.meta_description) update.meta_description = fix.meta_description;
        if (!page.og_title && fix.og_title) update.og_title = fix.og_title || fix.meta_title;
        if (!page.og_description && fix.og_description) update.og_description = fix.og_description || fix.meta_description;
        if (!page.canonical_url && fix.canonical_url) update.canonical_url = fix.canonical_url;
        if (!page.twitter_title) update.twitter_title = fix.meta_title;
        if (!page.twitter_description) update.twitter_description = fix.meta_description;

        if (Object.keys(update).length > 0) {
          // Recalculate score
          const merged = { ...page, ...update };
          let score = 0;
          if (merged.meta_title) score += 15;
          if (merged.meta_description) score += 15;
          if (merged.canonical_url) score += 10;
          if (merged.og_title && merged.og_image) score += 15;
          if (merged.twitter_title) score += 10;
          if (merged.meta_keywords?.length > 0) score += 10;
          if (merged.schema_markup_json && Object.keys(merged.schema_markup_json).length > 0) score += 10;
          if (merged.robots_index) score += 5;
          if (merged.robots_follow) score += 5;
          if (merged.og_description) score += 5;
          update.seo_score = score;

          await adminClient.from("seo_pages").update(update).eq("id", page.id);
          fixedCount++;
        }
      }

      return jsonResponse({ fixed: fixedCount, message: `Auto-fixed ${fixedCount} pages` });
    }

    return errorResponse("Unknown action", 400);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("seo-ai-optimize error:", e);
    return errorResponse(e.message || "Internal error");
  }
});

function getToolsForAction(action: string) {
  if (action === "optimize") {
    return [{
      type: "function",
      function: {
        name: "seo_suggestions",
        description: "Return optimized SEO suggestions for pages",
        parameters: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  page_url: { type: "string" },
                  meta_title: { type: "string" },
                  meta_description: { type: "string" },
                  keywords: { type: "array", items: { type: "string" } },
                  og_title: { type: "string" },
                  og_description: { type: "string" },
                  schema: { type: "string" },
                },
                required: ["page_url", "meta_title", "meta_description", "keywords"],
                additionalProperties: false,
              },
            },
          },
          required: ["suggestions"],
          additionalProperties: false,
        },
      },
    }];
  }

  if (action === "audit") {
    return [{
      type: "function",
      function: {
        name: "seo_audit",
        description: "Return comprehensive SEO audit results",
        parameters: {
          type: "object",
          properties: {
            overall_score: { type: "number" },
            grade: { type: "string" },
            critical_issues: { type: "array", items: { type: "object", properties: { issue: { type: "string" }, impact: { type: "string" }, fix: { type: "string" } }, required: ["issue", "impact", "fix"], additionalProperties: false } },
            warnings: { type: "array", items: { type: "object", properties: { issue: { type: "string" }, suggestion: { type: "string" } }, required: ["issue", "suggestion"], additionalProperties: false } },
            opportunities: { type: "array", items: { type: "object", properties: { opportunity: { type: "string" }, potential_impact: { type: "string" } }, required: ["opportunity", "potential_impact"], additionalProperties: false } },
            quick_wins: { type: "array", items: { type: "string" } },
          },
          required: ["overall_score", "grade", "critical_issues", "warnings", "opportunities", "quick_wins"],
          additionalProperties: false,
        },
      },
    }];
  }

  if (action === "keywords") {
    return [{
      type: "function",
      function: {
        name: "keyword_research",
        description: "Return researched keywords with metadata",
        parameters: {
          type: "object",
          properties: {
            keywords: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  keyword: { type: "string" },
                  intent: { type: "string" },
                  difficulty: { type: "string" },
                  priority: { type: "string" },
                  suggested_url: { type: "string" },
                },
                required: ["keyword", "intent", "difficulty", "priority"],
                additionalProperties: false,
              },
            },
          },
          required: ["keywords"],
          additionalProperties: false,
        },
      },
    }];
  }

  if (action === "content-gap") {
    return [{
      type: "function",
      function: {
        name: "content_gap_analysis",
        description: "Return content gap analysis results",
        parameters: {
          type: "object",
          properties: {
            missing_pages: { type: "array", items: { type: "object", properties: { url: { type: "string" }, title: { type: "string" }, reason: { type: "string" } }, required: ["url", "title", "reason"], additionalProperties: false } },
            unmapped_keywords: { type: "array", items: { type: "string" } },
            topic_clusters: { type: "array", items: { type: "object", properties: { cluster: { type: "string" }, pages_needed: { type: "number" }, priority: { type: "string" } }, required: ["cluster", "pages_needed", "priority"], additionalProperties: false } },
            quick_wins: { type: "array", items: { type: "object", properties: { action: { type: "string" }, impact: { type: "string" } }, required: ["action", "impact"], additionalProperties: false } },
          },
          required: ["missing_pages", "unmapped_keywords", "topic_clusters", "quick_wins"],
          additionalProperties: false,
        },
      },
    }];
  }

  if (action === "auto-fix") {
    return [{
      type: "function",
      function: {
        name: "auto_fix_seo",
        description: "Return auto-generated SEO data for pages with missing fields",
        parameters: {
          type: "object",
          properties: {
            fixes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  page_url: { type: "string" },
                  meta_title: { type: "string" },
                  meta_description: { type: "string" },
                  og_title: { type: "string" },
                  og_description: { type: "string" },
                  canonical_url: { type: "string" },
                },
                required: ["page_url"],
                additionalProperties: false,
              },
            },
          },
          required: ["fixes"],
          additionalProperties: false,
        },
      },
    }];
  }

  return undefined;
}

function getToolChoiceForAction(action: string) {
  const nameMap: Record<string, string> = {
    optimize: "seo_suggestions",
    audit: "seo_audit",
    keywords: "keyword_research",
    "content-gap": "content_gap_analysis",
    "auto-fix": "auto_fix_seo",
  };
  const name = nameMap[action];
  return name ? { type: "function", function: { name } } : undefined;
}
