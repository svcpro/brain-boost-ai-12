import { createContext, useContext, useEffect, ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useInstitutionBySlug, InstitutionBranding } from "@/hooks/useInstitutionSubdomain";

interface InstitutionContextType {
  institution: InstitutionBranding | null;
  isInstitutionDomain: boolean;
  loading: boolean;
  error: string | null;
}

const InstitutionContext = createContext<InstitutionContextType>({
  institution: null,
  isInstitutionDomain: false,
  loading: true,
  error: null,
});

export const useInstitution = () => useContext(InstitutionContext);

/**
 * Wrapper that reads :slug from /i/:slug/* routes.
 * Placed inside <BrowserRouter> so useParams works.
 */
export const InstitutionProvider = ({ children }: { children: ReactNode }) => {
  const params = useParams<{ institutionSlug?: string }>();
  const slug = params.institutionSlug;
  const { institution, isInstitutionDomain, loading, error } = useInstitutionBySlug(slug);

  // Apply institution branding as CSS custom properties
  useEffect(() => {
    if (!institution) return;

    const root = document.documentElement;

    if (institution.primary_color) {
      root.style.setProperty("--institution-primary", institution.primary_color);
    }
    if (institution.secondary_color) {
      root.style.setProperty("--institution-secondary", institution.secondary_color);
    }
    if (institution.name) {
      document.title = `${institution.name} | ACRY`;
    }

    return () => {
      root.style.removeProperty("--institution-primary");
      root.style.removeProperty("--institution-secondary");
    };
  }, [institution]);

  return (
    <InstitutionContext.Provider value={{ institution, isInstitutionDomain, loading, error }}>
      {children}
    </InstitutionContext.Provider>
  );
};
