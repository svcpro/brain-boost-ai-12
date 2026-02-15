import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";

// Context to share feature flags across components without extra DB queries
export const FeatureFlagContext = createContext<{ isEnabled: (key: string) => boolean }>({
  isEnabled: () => true,
});

export const useFeatureFlagContext = () => useContext(FeatureFlagContext);

export interface FeatureFlag {
  id: string;
  flag_key: string;
  enabled: boolean;
  label: string | null;
  updated_at: string;
}

export const useFeatureFlags = () => {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from("feature_flags")
      .select("*")
      .order("flag_key");
    setFlags((data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const isEnabled = (key: string) => {
    const flag = flags.find(f => f.flag_key === key);
    return flag ? flag.enabled : true; // default enabled if not found
  };

  const toggle = async (key: string, enabled: boolean) => {
    await supabase
      .from("feature_flags")
      .update({ enabled, updated_at: new Date().toISOString() } as any)
      .eq("flag_key", key);
    setFlags(prev => prev.map(f => f.flag_key === key ? { ...f, enabled } : f));
  };

  return { flags, loading, isEnabled, toggle, refetch: fetch };
};
