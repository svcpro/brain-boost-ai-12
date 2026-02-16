import { corsHeaders, securityHeaders, authenticateRequest, requireAdmin, jsonResponse, errorResponse, handleCors } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { userId } = await authenticateRequest(req);
    await requireAdmin(userId);

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all SEO pages that need optimization
    const { data: pages } = await adminClient.from("seo_pages").select("*");
    if (!pages || pages.length === 0) {
      return jsonResponse({ count: 0, message: "No pages to optimize" });
    }

    // Filter pages with low SEO scores or missing data
    const needsOptimization = pages.filter(p =>
      (p.seo_score || 0) < 70 || !p.meta_title || !p.meta_description
    );

    if (needsOptimization.length === 0) {
      return jsonResponse({ count: 0, message: "All pages are well optimized" });
    }

    // Use Lovable AI to generate suggestions
    const prompt = `You are an SEO expert. For each page below, suggest an optimized meta title (under 60 chars), meta description (under 160 chars), and 3-5 relevant keywords. Return JSON array with objects having: page_url, meta_title, meta_description, keywords (array of strings).

Pages needing optimization:
${needsOptimization.slice(0, 10).map(p => `- URL: ${p.page_url}, Type: ${p.page_type}, Current Title: ${p.meta_title || 'none'}, Current Desc: ${p.meta_description || 'none'}`).join('\n')}

Platform context: ACRY is an AI-powered exam preparation platform for Indian competitive exams.
Return ONLY valid JSON array, no markdown.`;

    const aiResponse = await fetch("https://yvxrsujwgmzdjzsjyqfb.supabase.co/functions/v1/ai-support-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        model: "google/gemini-2.5-flash-lite",
      }),
    });

    let suggestions: any[] = [];
    
    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const content = aiData.reply || aiData.content || "";
      try {
        // Try to parse AI response as JSON
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        suggestions = JSON.parse(cleaned);
      } catch {
        // Fallback: generate basic suggestions from page data
        suggestions = needsOptimization.slice(0, 10).map(p => ({
          page_url: p.page_url,
          meta_title: `${p.page_type === 'community' ? 'Community' : 'ACRY'} - ${p.page_url.split('/').pop() || 'Page'}`,
          meta_description: `Discover ${p.page_url.split('/').pop() || 'content'} on ACRY - AI-powered exam preparation platform.`,
          keywords: ["exam preparation", "AI study", "ACRY"],
        }));
      }
    } else {
      // Fallback suggestions
      suggestions = needsOptimization.slice(0, 10).map(p => ({
        page_url: p.page_url,
        meta_title: `ACRY - ${p.page_url.replace(/\//g, ' ').trim() || 'AI Study Platform'}`,
        meta_description: `Explore ${p.page_url.replace(/\//g, ' ').trim()} on ACRY. AI-powered exam preparation for competitive exams.`,
        keywords: ["exam prep", "AI learning", "study platform"],
      }));
    }

    // Insert suggestions
    const insertRows = suggestions.map(s => {
      const matchingPage = pages.find(p => p.page_url === s.page_url);
      return {
        page_id: matchingPage?.id || null,
        page_url: s.page_url,
        suggested_meta_title: s.meta_title,
        suggested_meta_description: s.meta_description,
        suggested_keywords: s.keywords || [],
        status: "pending",
      };
    });

    if (insertRows.length > 0) {
      await adminClient.from("seo_ai_suggestions").insert(insertRows);
    }

    return jsonResponse({ count: insertRows.length, message: `Generated ${insertRows.length} suggestions` });
  } catch (e) {
    if (e instanceof Response) return e;
    return errorResponse(e.message || "Internal error");
  }
});
