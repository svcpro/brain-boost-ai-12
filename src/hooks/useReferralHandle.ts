import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Memorable suffix words for anonymous handles
const FUN_WORDS = [
  "ace", "pro", "star", "wiz", "hero", "boss", "king", "queen",
  "rank1", "topper", "ninja", "spark", "rush", "fire", "flex",
];

/**
 * Slugify a name into a URL-safe handle base.
 * "Rahul Kumar" -> "rahul"
 * "Priya@123"   -> "priya"
 */
const slugify = (raw: string): string => {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 12) || "user";
};

const randomSuffix = () => {
  // 2-3 digits keep it short and memorable like "rahul123"
  return String(Math.floor(100 + Math.random() * 899));
};

const randomFunSuffix = () => {
  return FUN_WORDS[Math.floor(Math.random() * FUN_WORDS.length)] + Math.floor(Math.random() * 99);
};

interface HandleData {
  handle: string;
  shareUrl: string;
  loading: boolean;
}

/**
 * Returns a unique, memorable referral handle for the current user
 * and a clean root-domain share URL like `acry.ai/?ref=rahul123`.
 *
 * - Caches in localStorage (`acry_ref_handle`) for instant load
 * - Persists to `myrank_handles` table on first generation
 * - Falls back to anon-friendly handles if user is signed out
 */
export const useReferralHandle = (): HandleData => {
  const { user } = useAuth();
  const [handle, setHandle] = useState<string>(() => {
    if (typeof window === "undefined") return "guest";
    return localStorage.getItem("acry_ref_handle") || "";
  });
  const [loading, setLoading] = useState(!handle);

  useEffect(() => {
    let cancelled = false;

    const ensureHandle = async () => {
      // 1) Check cache first
      const cached = localStorage.getItem("acry_ref_handle");
      if (cached && cached.length >= 3) {
        if (!cancelled) {
          setHandle(cached);
          setLoading(false);
        }
        // Still attempt to bind cached handle to user_id once they sign in
        if (user?.id) {
          await supabase
            .from("myrank_handles")
            .update({ user_id: user.id, display_name: user.user_metadata?.display_name || null })
            .eq("handle", cached)
            .is("user_id", null);
        }
        return;
      }

      // 2) Existing handle for signed-in user?
      if (user?.id) {
        const { data: existing } = await supabase
          .from("myrank_handles")
          .select("handle")
          .eq("user_id", user.id)
          .maybeSingle();
        if (existing?.handle) {
          localStorage.setItem("acry_ref_handle", existing.handle);
          if (!cancelled) {
            setHandle(existing.handle);
            setLoading(false);
          }
          return;
        }
      }

      // 3) Generate a new memorable handle
      const nameRaw =
        user?.user_metadata?.display_name ||
        user?.user_metadata?.full_name ||
        user?.email?.split("@")[0] ||
        "";
      const base = slugify(nameRaw);

      // Try base, base+digits, then fun suffix until unique
      const candidates = [
        base,
        `${base}${randomSuffix()}`,
        `${base}${randomSuffix()}`,
        `${base}${randomFunSuffix()}`,
        `${base}${Date.now().toString(36).slice(-4)}`,
      ];

      let final = candidates[candidates.length - 1];
      for (const candidate of candidates) {
        const { data: taken } = await supabase
          .from("myrank_handles")
          .select("handle")
          .eq("handle", candidate)
          .maybeSingle();
        if (!taken) {
          final = candidate;
          break;
        }
      }

      // 4) Persist (best-effort — public RLS allows insert for own row)
      if (user?.id) {
        await supabase.from("myrank_handles").insert({
          handle: final,
          user_id: user.id,
          display_name: nameRaw || null,
        } as any);
      } else {
        // Anonymous: store with anon_session_id so we can claim it later
        const anonId = localStorage.getItem("myrank_anon_id");
        if (anonId) {
          await supabase.from("myrank_handles").insert({
            handle: final,
            anon_session_id: anonId,
          } as any);
        }
      }

      localStorage.setItem("acry_ref_handle", final);
      if (!cancelled) {
        setHandle(final);
        setLoading(false);
      }
    };

    ensureHandle().catch(() => {
      // On any failure, generate a local-only fallback so UI never blocks
      const fallback = (slugify(user?.email?.split("@")[0] || "ace") + randomSuffix());
      localStorage.setItem("acry_ref_handle", fallback);
      if (!cancelled) {
        setHandle(fallback);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://acry.ai";

  // Clean memorable URL: acry.ai/?ref=rahul123
  const shareUrl = handle ? `${origin}/?ref=${handle}` : origin;

  return { handle: handle || "guest", shareUrl, loading };
};
