import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours

const AdminProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasMFA, setHasMFA] = useState(false);

  useEffect(() => {
    if (!user) {
      setChecking(false);
      return;
    }

    const check = async () => {
      try {
        // Check admin role
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (!roles || roles.length === 0) {
          setIsAdmin(false);
          setChecking(false);
          return;
        }
        setIsAdmin(true);

        // OAuth users (Google, Apple) bypass MFA — provider-level auth is sufficient
        const provider = user.app_metadata?.provider;
        if (provider && provider !== "email") {
          setHasMFA(true);
        } else {
          // Email/password users require MFA aal2
          const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          setHasMFA(aal?.currentLevel === "aal2");
        }

        // Auto session expiry timer
        const loginTime = sessionStorage.getItem("admin_login_time");
        if (!loginTime) {
          sessionStorage.setItem("admin_login_time", Date.now().toString());
        } else if (Date.now() - parseInt(loginTime) > SESSION_TIMEOUT_MS) {
          sessionStorage.removeItem("admin_login_time");
          await supabase.auth.signOut();
          setIsAdmin(false);
        }
      } catch {
        setIsAdmin(false);
      } finally {
        setChecking(false);
      }
    };

    check();
  }, [user]);

  // Set up auto-expiry interval
  useEffect(() => {
    const interval = setInterval(async () => {
      const loginTime = sessionStorage.getItem("admin_login_time");
      if (loginTime && Date.now() - parseInt(loginTime) > SESSION_TIMEOUT_MS) {
        sessionStorage.removeItem("admin_login_time");
        await supabase.auth.signOut();
        window.location.href = "/admin/login";
      }
    }, 60000); // check every minute
    return () => clearInterval(interval);
  }, []);

  if (loading || checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/admin/login" replace />;
  if (!isAdmin) return <Navigate to="/admin/login" replace />;
  if (!hasMFA) return <Navigate to="/admin/login" replace />;

  return <>{children}</>;
};

export default AdminProtectedRoute;
