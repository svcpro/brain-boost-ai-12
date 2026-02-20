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
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let initialLoadDone = false;

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

    const applySession = (s: Session | null) => {
      if (!isMounted) return;
      const newUserId = s?.user?.id ?? null;

      // Only update user state if the user actually changed
      if (newUserId !== currentUserIdRef.current) {
        currentUserIdRef.current = newUserId;
        setUser(s?.user ?? null);
      }
      // Always update session (token may have refreshed)
      setSession(s);
    };

    // 1. Set up the auth state listener FIRST (Supabase recommendation)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!isMounted) return;

        applySession(newSession);

        // Mark loading done on the first event if getSession hasn't finished yet
        if (!initialLoadDone) {
          initialLoadDone = true;
          setLoading(false);
        }

        if (event === "SIGNED_IN" && newSession?.user) {
          setTimeout(() => handleSignupNotifications(newSession.user), 0);
        }

        if (event === "SIGNED_OUT") {
          currentUserIdRef.current = null;
          setUser(null);
          setSession(null);
        }
      }
    );

    // 2. Then get initial session as a fallback (in case listener is slow)
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!isMounted) return;
      applySession(s);
      if (!initialLoadDone) {
        initialLoadDone = true;
        setLoading(false);
      }
    }).catch((e) => {
      console.error("Auth initialization error:", e);
      if (isMounted && !initialLoadDone) {
        initialLoadDone = true;
        setLoading(false);
      }
    });

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
