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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const signupHandledRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

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

    // Use onAuthStateChange as the SOLE source of truth.
    // INITIAL_SESSION fires once and covers OAuth redirects properly,
    // unlike getSession() which can resolve before the URL hash is processed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!isMounted) return;
        console.log("[Auth] onAuthStateChange:", event, "user:", newSession?.user?.id ?? "none");

        if (event === "INITIAL_SESSION") {
          // This is the definitive initial auth state — safe to stop loading
          setSession(newSession);
          setUser(newSession?.user ?? null);
          initializedRef.current = true;
          setLoading(false);

          if (newSession?.user) {
            setTimeout(() => handleSignupNotifications(newSession.user), 0);
          }
          return;
        }

        if (event === "SIGNED_OUT") {
          setSession(null);
          setUser(null);
          return;
        }

        // For TOKEN_REFRESHED, only update session to avoid re-render cascades
        if (event === "TOKEN_REFRESHED") {
          setSession(newSession);
          return;
        }

        // For SIGNED_IN (e.g., OAuth redirect completing after initial), update both
        if (event === "SIGNED_IN" && newSession?.user) {
          setSession(newSession);
          setUser(newSession.user);
          // Ensure loading is false in case INITIAL_SESSION was missed
          if (!initializedRef.current) {
            initializedRef.current = true;
            setLoading(false);
          }
          setTimeout(() => handleSignupNotifications(newSession.user), 0);
          return;
        }

        // For any other events, sync session
        if (newSession) {
          setSession(newSession);
          setUser(newSession.user ?? null);
        }
      }
    );

    // Safety fallback: if INITIAL_SESSION never fires (shouldn't happen),
    // unlock loading after 5s to prevent infinite loading screen
    const fallbackTimer = setTimeout(() => {
      if (isMounted && !initializedRef.current) {
        console.warn("[Auth] Fallback: INITIAL_SESSION never fired, unlocking loading");
        initializedRef.current = true;
        setLoading(false);
      }
    }, 5000);

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
