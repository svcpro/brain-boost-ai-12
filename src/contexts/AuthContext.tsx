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

  useEffect(() => {
    const handleSignupNotifications = async (newUser: User) => {
      // Prevent duplicate triggers per session
      if (signupHandledRef.current.has(newUser.id)) return;
      signupHandledRef.current.add(newUser.id);

      const createdAt = new Date(newUser.created_at).getTime();
      const now = Date.now();
      const isNewUser = now - createdAt < 120_000; // within 2 minutes

      if (isNewUser) {
        const displayName =
          newUser.user_metadata?.display_name ||
          newUser.user_metadata?.full_name ||
          newUser.user_metadata?.name ||
          newUser.email?.split("@")[0] || "Student";
        const provider = newUser.app_metadata?.provider || "email";

        // Emit signup event to omnichannel engine (non-blocking)
        emitEvent("signup", { method: provider, email: newUser.email }, {
          title: "Welcome to ACRY!",
          body: "Your AI Second Brain is ready.",
        });

        // Trigger welcome notifications edge function (non-blocking)
        supabase.functions.invoke("signup-welcome-notifications", {
          body: {
            user_id: newUser.id,
            email: newUser.email,
            display_name: displayName,
            event: "signup",
          },
        }).catch(() => {});
      } else {
        // Returning user login
        emitEvent("login", { method: newUser.app_metadata?.provider || "password" }, {
          title: "Welcome back!",
          body: "You logged in successfully.",
        });
      }

      // Track engagement for send-time optimization (non-blocking)
      trackEngagement("app_open");
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Handle signup/login events for ALL auth methods (OAuth, email, etc.)
        if (event === "SIGNED_IN" && session?.user) {
          // Use setTimeout to avoid Supabase auth deadlock
          setTimeout(() => handleSignupNotifications(session.user), 0);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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
