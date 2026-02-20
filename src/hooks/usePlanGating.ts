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
  isTrialActive: boolean;
  trialDaysLeft: number;
  subscription: any;
}

export const PlanGatingContext = createContext<PlanGatingContextType>({
  gates: [],
  currentPlan: "none",
  loading: true,
  canAccess: () => false,
  getRequiredPlan: () => "premium",
  refetch: async () => {},
  isTrialActive: false,
  trialDaysLeft: 0,
  subscription: null,
});

export const usePlanGatingContext = () => useContext(PlanGatingContext);

export const usePlanGating = () => {
  const { user } = useAuth();
  const [gates, setGates] = useState<PlanFeatureGate[]>([]);
  const [currentPlan, setCurrentPlan] = useState("none");
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);

  const fetchGates = useCallback(async () => {
    const { data } = await supabase
      .from("plan_feature_gates")
      .select("*")
      .order("sort_order");
    setGates((data as any[]) || []);
  }, []);

  const fetchPlan = useCallback(async () => {
    if (!user) { setCurrentPlan("none"); setSubscription(null); return; }
    const { data } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (!data) {
      setCurrentPlan("none");
      setSubscription(null);
      return;
    }

    // Check if trial expired
    if (data.is_trial && data.trial_end_date && new Date(data.trial_end_date) < new Date()) {
      setCurrentPlan("none");
      setSubscription(data);
      return;
    }

    // Check if subscription expired
    if (data.expires_at && new Date(data.expires_at) < new Date() && !data.is_trial) {
      setCurrentPlan("none");
      setSubscription(data);
      return;
    }

    // Resolve plan_id to plan_key
    let planKey = data.plan_id || "none";
    if (planKey.includes("-") && planKey.length > 10) {
      const { data: planData } = await supabase
        .from("subscription_plans")
        .select("plan_key")
        .eq("id", planKey)
        .maybeSingle();
      planKey = planData?.plan_key || "none";
    }

    setCurrentPlan(planKey);
    setSubscription(data);
  }, [user]);

  const refetch = useCallback(async () => {
    await Promise.all([fetchGates(), fetchPlan()]);
  }, [fetchGates, fetchPlan]);

  useEffect(() => {
    Promise.all([fetchGates(), fetchPlan()]).then(() => setLoading(false));
  }, [fetchGates, fetchPlan]);

  const canAccess = useCallback((featureKey: string) => {
    // Premium plan (or legacy pro/ultra) gets access to everything
    if (currentPlan === "premium" || currentPlan === "ultra" || currentPlan === "pro") {
      return true;
    }
    // No plan = no access (no free tier)
    if (currentPlan === "none") {
      return false;
    }
    return false;
  }, [currentPlan]);

  const getRequiredPlan = useCallback((_featureKey: string): string | null => {
    return "premium";
  }, []);

  const isTrialActive = subscription?.is_trial && subscription?.status === "active" && subscription?.trial_end_date && new Date(subscription.trial_end_date) > new Date();
  const trialDaysLeft = isTrialActive ? Math.ceil((new Date(subscription.trial_end_date).getTime() - Date.now()) / 86400000) : 0;

  return { gates, currentPlan, loading, canAccess, getRequiredPlan, refetch, isTrialActive, trialDaysLeft, subscription };
};
