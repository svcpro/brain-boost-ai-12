/**
 * useShareIdentity — single source of truth for per-user OG personalization.
 * Returns the fields needed by `buildShareLanderUrl` / `nativeShare({ og })`:
 *   { name, exam, level, streak }
 *
 * Pulls from the auth user metadata first (zero-latency), then enriches
 * asynchronously from the `profiles` table.
 */
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { OgPersonalization } from "@/lib/share";

export function useShareIdentity(): OgPersonalization {
  const { user } = useAuth();
  const initialName =
    (user?.user_metadata as any)?.display_name ||
    (user?.user_metadata as any)?.full_name ||
    user?.email?.split("@")[0] ||
    "";

  const [identity, setIdentity] = useState<OgPersonalization>({
    variant: "default",
    name: initialName,
  });

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("display_name, exam_type")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled) return;
        setIdentity((prev) => ({
          ...prev,
          name: data?.display_name || prev.name,
          exam: data?.exam_type || prev.exam,
        }));
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return identity;
}
