import { createContext, useContext, useEffect, ReactNode } from "react";
import { useInstitutionSubdomain, InstitutionBranding } from "@/hooks/useInstitutionSubdomain";

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

export const InstitutionProvider = ({ children }: { children: ReactNode }) => {
  const { institution, isInstitutionDomain, loading, error } = useInstitutionSubdomain();

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
