import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export interface InstitutionBranding {
  id: string;
  name: string;
  slug: string;
  type: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  domain: string | null;
  settings: Record<string, any> | null;
  is_active: boolean;
}

/**
 * Hook for institution pages rendered under /i/:slug routes.
 * Fetches institution branding based on the slug param.
 */
export function useInstitutionBySlug(slug: string | undefined) {
  const [institution, setInstitution] = useState<InstitutionBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    const fetchInstitution = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from("institutions")
          .select("id, name, slug, type, logo_url, primary_color, secondary_color, domain, settings, is_active")
          .eq("slug", slug)
          .eq("is_active", true)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (!data) {
          setError(`Institution "${slug}" not found`);
        } else {
          setInstitution(data as InstitutionBranding);
        }
      } catch (err: any) {
        console.error("[Institution] Failed to load:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInstitution();
  }, [slug]);

  return { institution, slug: slug || null, loading, error, isInstitutionDomain: !!slug };
}

// Keep backward compat — no longer used for subdomain detection
export function getInstitutionSlug(): string | null {
  return null;
}

export function useInstitutionSubdomain() {
  return { institution: null, slug: null, loading: false, error: null, isInstitutionDomain: false };
}
