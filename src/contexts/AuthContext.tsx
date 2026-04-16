import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { emitEvent, trackEngagement } from "@/lib/eventBus";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

/**
 * Detect if the current URL looks like an OAuth callback
 * (has access_token/refresh_token in hash or code in query params).
 */
const isOAuthCallback = (): boolean => {
  const hash = window.location.hash;
  const search = window.location.search;
  return (
    hash.includes("access_token") ||
    hash.includes("refresh_token") ||
    search.includes("code=")
  );
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const signupHandledRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  // If we're landing on an OAuth callback, INITIAL_SESSION may fire with null
  // before the token exchange finishes. We must wait for SIGNED_IN in that case.
  const isOAuthRedirectRef = useRef(isOAuthCallback());

  useEffect(() => {
    let isMounted = true;

    const handleSignupNotifications = async (newUser: User) => {
      if (signupHandledRef.current.has(newUser.id)) return;
      signupHandledRef.current.add(newUser.id);

      const createdAt = new Date(newUser.created_at).getTime();
      const now = Date.now();
      const isNewUser = now - createdAt < 120_000;

      if (isNewUser) {
        const displayName =
          newUser.user_metadata?.display_name ||
          newUser.user_metadata?.full_name ||
          newUser.user_metadata?.name ||
          newUser.email?.split("@")[0] || "Student";
        const provider = newUser.app_metadata?.provider || "email";

        emitEvent("signup", { method: provider, email: newUser.email }, {
          title: "Welcome to ACRY!",
          body: "Your AI Second Brain is ready.",
        });

        supabase.functions.invoke("signup-welcome-notifications", {
          body: {
            user_id: newUser.id,
            email: newUser.email,
            display_name: displayName,
            event: "signup",
          },
        }).catch(() => {});
      } else {
        emitEvent("login", { method: newUser.app_metadata?.provider || "password" }, {
          title: "Welcome back!",
          body: "You logged in successfully.",
        });
      }

      trackEngagement("app_open");
    };

    const markReady = (newSession: Session | null) => {
      if (initializedRef.current) return;
      initializedRef.current = true;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
      if (newSession?.user) {
        setTimeout(() => handleSignupNotifications(newSession.user), 0);
      }
    };

    // Helper: only update state when user/session actually changed
    const updateAuthState = (newSession: Session | null) => {
      setSession(prev => {
        // Skip if same access token (avoids re-render cascade)
        if (prev?.access_token === newSession?.access_token) return prev;
        return newSession;
      });
      setUser(prev => {
        const newUser = newSession?.user ?? null;
        if (!newUser && !prev) return prev;
        // ALWAYS update if user ID changed (different user logged in)
        if (prev?.id !== newUser?.id) return newUser;
        // Same user — skip to avoid re-triggering effects
        return prev;
      });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!isMounted) return;
        console.log("[Auth] onAuthStateChange:", event, "user:", newSession?.user?.id ?? "none", "oauthRedirect:", isOAuthRedirectRef.current);

        if (event === "INITIAL_SESSION") {
          if (!newSession && isOAuthRedirectRef.current) {
            // OAuth callback: INITIAL_SESSION fired before token exchange.
            // Do NOT set loading=false yet — wait for SIGNED_IN.
            console.log("[Auth] OAuth redirect detected, waiting for SIGNED_IN...");
            return;
          }
          // Normal case (not OAuth, or OAuth already resolved with session)
          markReady(newSession);
          return;
        }

        if (event === "SIGNED_IN" && newSession?.user) {
          updateAuthState(newSession);
          // If we were waiting for this after an OAuth INITIAL_SESSION(null), unlock now
          if (!initializedRef.current) {
            initializedRef.current = true;
            isOAuthRedirectRef.current = false;
            setLoading(false);
          }
          setTimeout(() => handleSignupNotifications(newSession.user), 0);
          return;
        }

        if (event === "SIGNED_OUT") {
          setSession(null);
          setUser(null);
          return;
        }

        if (event === "TOKEN_REFRESHED") {
          // Only update session token, never change user reference
          setSession(newSession);
          return;
        }

        // Any other event — deduplicated update
        if (newSession) {
          updateAuthState(newSession);
        }
      }
    );

    // Safety fallback: if neither INITIAL_SESSION nor SIGNED_IN unlock loading
    // within 6 seconds (e.g. OAuth failed silently), unlock to prevent stuck screen
    const fallbackTimer = setTimeout(() => {
      if (isMounted && !initializedRef.current) {
        console.warn("[Auth] Fallback: auth never resolved, unlocking loading");
        initializedRef.current = true;
        setLoading(false);
      }
    }, 6000);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearTimeout(fallbackTimer);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
