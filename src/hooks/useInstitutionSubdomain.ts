import { useState, useEffect } from "react";
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

const MAIN_DOMAINS = ["lovable.app", "lovableproject.com", "localhost", "acry.ai"];

/**
 * Extracts the institution slug from the current hostname.
 * e.g. akash-institute.acry.ai → "akash-institute"
 * Returns null if on a main domain (acry.ai, lovable.app, etc.)
 */
export function getInstitutionSlug(): string | null {
  const hostname = window.location.hostname;

  // Check if we're on a subdomain of acry.ai
  if (hostname.endsWith(".acry.ai")) {
    const sub = hostname.replace(".acry.ai", "");
    // Ignore www or empty
    if (sub && sub !== "www") return sub;
  }

  // Not an institution subdomain
  return null;
}

export function useInstitutionSubdomain() {
  const [institution, setInstitution] = useState<InstitutionBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const slug = getInstitutionSlug();

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

  return { institution, slug, loading, error, isInstitutionDomain: !!slug };
}
