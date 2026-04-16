import { useEffect, useState, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ACRYLogo from "@/components/landing/ACRYLogo";
import ExpiredTrialGate from "@/components/app/ExpiredTrialGate";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const [profileState, setProfileState] = useState<"loading" | "onboarding" | "banned" | "expired" | "ready">("loading");
  const checkedUserIdRef = useRef<string | null>(null);

  // Reset profile state when user changes (e.g., different user logs in)
  useEffect(() => {
    if (checkedUserIdRef.current && user && checkedUserIdRef.current !== user.id) {
      console.log("[ProtectedRoute] User changed, resetting profile state");
      checkedUserIdRef.current = null;
      setProfileState("loading");
    }
  }, [user]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setProfileState("ready");
      checkedUserIdRef.current = null;
      return;
    }

    if (checkedUserIdRef.current === user.id) return;

    let cancelled = false;

    const checkProfile = async () => {
      try {
        const [profileRes, subRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("study_preferences, is_banned")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("user_subscriptions")
            .select("status, is_trial, trial_end_date, expires_at")
            .eq("user_id", user.id)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        const data = profileRes.data;
        const sub = subRes.data;
        const prefs = data?.study_preferences as Record<string, unknown> | null;

        if ((data as any)?.is_banned) {
          setProfileState("banned");
        } else if (!prefs?.onboarded) {
          setProfileState("onboarding");
        } else {
          const now = new Date();
          const isTrialExpired = sub?.is_trial && sub?.trial_end_date && new Date(sub.trial_end_date) < now;
          const isSubExpired = !sub?.is_trial && sub?.expires_at && new Date(sub.expires_at) < now;
          const noSub = !sub;

          if (isTrialExpired || isSubExpired || noSub) {
            setProfileState("expired");
          } else {
            setProfileState("ready");
          }
        }
        checkedUserIdRef.current = user.id;
      } catch (e) {
        console.error("ProtectedRoute profile check error:", e);
        if (!cancelled) {
          setProfileState("ready");
          checkedUserIdRef.current = user.id;
        }
      }
    };

    checkProfile();
    return () => { cancelled = true; };
  }, [user, loading]);

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

  if (profileState === "expired") {
    return <ExpiredTrialGate onUpgraded={() => {
      checkedUserIdRef.current = null;
      setProfileState("loading");
    }} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
