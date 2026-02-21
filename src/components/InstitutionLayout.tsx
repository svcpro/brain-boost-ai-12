import { Outlet } from "react-router-dom";
import { InstitutionProvider } from "@/contexts/InstitutionContext";

/**
 * Layout wrapper for /i/:institutionSlug/* routes.
 * Provides InstitutionContext to all nested pages.
 */
const InstitutionLayout = () => (
  <InstitutionProvider>
    <Outlet />
  </InstitutionProvider>
);

export default InstitutionLayout;
