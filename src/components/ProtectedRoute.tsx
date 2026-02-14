import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (!user) {
      setCheckingOnboarding(false);
      return;
    }
    supabase
      .from("profiles")
      .select("study_preferences")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const prefs = data?.study_preferences as Record<string, unknown> | null;
        setNeedsOnboarding(!prefs?.onboarded);
        setCheckingOnboarding(false);
      });
  }, [user]);

  if (loading || checkingOnboarding) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-xl neural-gradient neural-border flex items-center justify-center animate-pulse">
          <span className="text-primary font-bold text-sm">A</span>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (needsOnboarding) return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
};

export default ProtectedRoute;
