import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PlanFeatureGate {
  id: string;
  feature_key: string;
  feature_label: string;
  feature_category: string;
  free_enabled: boolean;
  pro_enabled: boolean;
  ultra_enabled: boolean;
  sort_order: number;
}

interface PlanGatingContextType {
  gates: PlanFeatureGate[];
  currentPlan: string;
  loading: boolean;
  canAccess: (featureKey: string) => boolean;
  getRequiredPlan: (featureKey: string) => string | null;
  refetch: () => Promise<void>;
}

export const PlanGatingContext = createContext<PlanGatingContextType>({
  gates: [],
  currentPlan: "free",
  loading: true,
  canAccess: () => true,
  getRequiredPlan: () => null,
  refetch: async () => {},
});

export const usePlanGatingContext = () => useContext(PlanGatingContext);

export const usePlanGating = () => {
  const { user } = useAuth();
  const [gates, setGates] = useState<PlanFeatureGate[]>([]);
  const [currentPlan, setCurrentPlan] = useState("free");
  const [loading, setLoading] = useState(true);

  const fetchGates = useCallback(async () => {
    const { data } = await supabase
      .from("plan_feature_gates")
      .select("*")
      .order("sort_order");
    setGates((data as any[]) || []);
  }, []);

  const fetchPlan = useCallback(async () => {
    if (!user) { setCurrentPlan("free"); return; }
    const { data } = await supabase
      .from("user_subscriptions")
      .select("plan_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setCurrentPlan(data?.plan_id || "free");
  }, [user]);

  const refetch = useCallback(async () => {
    await Promise.all([fetchGates(), fetchPlan()]);
  }, [fetchGates, fetchPlan]);

  useEffect(() => {
    Promise.all([fetchGates(), fetchPlan()]).then(() => setLoading(false));
  }, [fetchGates, fetchPlan]);

  const canAccess = useCallback((featureKey: string) => {
    const gate = gates.find(g => g.feature_key === featureKey);
    if (!gate) return true; // no gate = allowed
    if (currentPlan === "ultra") return gate.ultra_enabled;
    if (currentPlan === "pro") return gate.pro_enabled;
    return gate.free_enabled;
  }, [gates, currentPlan]);

  const getRequiredPlan = useCallback((featureKey: string): string | null => {
    const gate = gates.find(g => g.feature_key === featureKey);
    if (!gate) return null;
    if (gate.free_enabled) return null;
    if (gate.pro_enabled) return "pro";
    return "ultra";
  }, [gates]);

  return { gates, currentPlan, loading, canAccess, getRequiredPlan, refetch };
};
