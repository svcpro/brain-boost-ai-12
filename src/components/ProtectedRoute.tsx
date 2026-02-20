import { useEffect, useState, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ACRYLogo from "@/components/landing/ACRYLogo";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const [profileState, setProfileState] = useState<"loading" | "onboarding" | "banned" | "ready">("loading");
  const checkedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    console.log("[ProtectedRoute] user:", user?.id ?? "none", "loading:", loading, "profileState:", profileState);
    if (loading) return; // Wait for auth to finish first

    if (!user) {
      setProfileState("ready"); // Will redirect to /auth below
      checkedUserIdRef.current = null;
      return;
    }

    // Skip re-check if we already checked this exact user
    if (checkedUserIdRef.current === user.id) return;

    let cancelled = false;

    const checkProfile = async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("study_preferences, is_banned")
          .eq("id", user.id)
          .maybeSingle();

        if (cancelled) return;

        const prefs = data?.study_preferences as Record<string, unknown> | null;
        
        if ((data as any)?.is_banned) {
          setProfileState("banned");
        } else if (!prefs?.onboarded) {
          setProfileState("onboarding");
        } else {
          setProfileState("ready");
        }
        checkedUserIdRef.current = user.id;
      } catch (e) {
        console.error("ProtectedRoute profile check error:", e);
        if (!cancelled) {
          // On error, let them through rather than blocking forever
          setProfileState("ready");
          checkedUserIdRef.current = user.id;
        }
      }
    };

    checkProfile();
    return () => { cancelled = true; };
  }, [user, loading]);

  // Show loading while auth is initializing OR profile is being checked
  if (loading || (user && profileState === "loading")) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <ACRYLogo variant="icon" animate={true} className="animate-pulse" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (profileState === "banned") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-8 neural-border text-center max-w-sm space-y-4">
          <div className="w-16 h-16 rounded-full bg-destructive/15 flex items-center justify-center mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>
          </div>
          <h1 className="text-xl font-bold text-foreground">Account Suspended</h1>
          <p className="text-sm text-muted-foreground">Your account has been suspended. Please contact support if you believe this is a mistake.</p>
        </div>
      </div>
    );
  }

  if (profileState === "onboarding") return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
};

export default ProtectedRoute;
