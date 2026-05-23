import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AmbassadorProfile = {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  college: string | null;
  city: string | null;
  course: string | null;
  bio: string | null;
  skills: string[] | null;
  instagram: string | null;
  linkedin: string | null;
  twitter: string | null;
  youtube: string | null;
  website: string | null;
  public_slug: string | null;
  ambassador_code: string | null;
  ai_level: string;
  xp: number;
  points: number;
  rank: number | null;
  streak_days: number;
  longest_streak: number;
  badges: any[];
  weekly_xp: number;
  monthly_xp: number;
  status: string;
  joined_at: string;
};

export type AmbState =
  | { kind: "loading" }
  | { kind: "anonymous" }
  | { kind: "not_approved"; email: string }
  | { kind: "ready"; profile: AmbassadorProfile };

export function useAmbassador() {
  const [state, setState] = useState<AmbState>({ kind: "loading" });

  const load = async () => {
    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user) {
      setState({ kind: "anonymous" });
      return;
    }

    // Try fetch existing profile
    const { data: existing } = await supabase
      .from("ambassador_profiles" as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      setState({ kind: "ready", profile: existing as any });
      return;
    }

    // Try to claim
    const { data: claimed, error } = await supabase.rpc("claim_ambassador_profile" as any);
    if (error || !claimed) {
      setState({ kind: "not_approved", email: user.email ?? "" });
      return;
    }
    setState({ kind: "ready", profile: claimed as any });
  };

  useEffect(() => {
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = async () => {
    if (state.kind !== "ready") return;
    const { data } = await supabase
      .from("ambassador_profiles" as any)
      .select("*")
      .eq("user_id", state.profile.user_id)
      .maybeSingle();
    if (data) setState({ kind: "ready", profile: data as any });
  };

  return { state, refresh, reload: load };
}
