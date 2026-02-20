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

    // Get initial session first, then set up listener
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);
      } catch (e) {
        console.error("Auth initialization error:", e);
      } finally {
        if (isMounted) {
          initializedRef.current = true;
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Set up listener for SUBSEQUENT auth changes only (sign in/out/token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!isMounted) return;

        // Skip the initial events that fire before/during getSession
        if (!initializedRef.current) return;

        // Only update state if the user actually changed
        const newUserId = newSession?.user?.id ?? null;
        const currentUserId = user?.id ?? null;
        
        if (event === "SIGNED_OUT") {
          setSession(null);
          setUser(null);
        } else if (event === "TOKEN_REFRESHED") {
          // Just update session/token, don't trigger full re-render cascade
          setSession(newSession);
        } else if (newUserId !== currentUserId) {
          setSession(newSession);
          setUser(newSession?.user ?? null);
        }

        if (event === "SIGNED_IN" && newSession?.user) {
          setTimeout(() => handleSignupNotifications(newSession.user), 0);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
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
