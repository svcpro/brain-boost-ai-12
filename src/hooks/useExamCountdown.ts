import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanGatingContext } from "@/hooks/usePlanGating";

export type ExamPhase = "normal" | "acceleration" | "lockdown" | "no_exam";

interface ExamCountdownConfig {
  normal_mode_min_days: number;
  acceleration_mode_min_days: number;
  lockdown_mode_min_days: number;
  normal_locked_modes: string[];
  acceleration_locked_modes: string[];
  lockdown_locked_modes: string[];
  acceleration_lock_message: string;
  lockdown_lock_message: string;
  acceleration_recommended_mode: string;
  lockdown_recommended_mode: string;
  bypass_plan_keys: string[];
  is_enabled: boolean;
}

const DEFAULT_CONFIG: ExamCountdownConfig = {
  normal_mode_min_days: 30,
  acceleration_mode_min_days: 15,
  lockdown_mode_min_days: 0,
  normal_locked_modes: [],
  acceleration_locked_modes: [],
  lockdown_locked_modes: ["revision"],
  acceleration_lock_message: "Your exam is approaching. This mode is restricted during Acceleration phase to maximize focus.",
  lockdown_lock_message: "Your exam is imminent. This mode is locked during Lockdown to eliminate distractions and optimize preparation.",
  acceleration_recommended_mode: "mock",
  lockdown_recommended_mode: "emergency",
  bypass_plan_keys: ["ultra"],
  is_enabled: true,
};

export interface ExamCountdownState {
  phase: ExamPhase;
  daysRemaining: number | null;
  examDate: string | null;
  lockedModes: string[];
  lockMessage: string;
  recommendedMode: string;
  canBypass: boolean;
  loading: boolean;
  isEnabled: boolean;
  isModeBlocked: (modeId: string) => boolean;
}

export const useExamCountdown = (): ExamCountdownState => {
  const { user } = useAuth();
  const { currentPlan } = usePlanGatingContext();
  const [config, setConfig] = useState<ExamCountdownConfig>(DEFAULT_CONFIG);
  const [examDate, setExamDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const fetch = async () => {
      const [configRes, profileRes] = await Promise.all([
        (supabase as any).from("exam_countdown_config").select("*").limit(1).maybeSingle(),
        supabase.from("profiles").select("exam_date").eq("id", user.id).maybeSingle(),
      ]);
      if (configRes.data) setConfig(configRes.data as ExamCountdownConfig);
      if (profileRes.data) setExamDate((profileRes.data as any).exam_date);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const daysRemaining = useMemo(() => {
    if (!examDate) return null;
    const diff = Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000);
    return diff;
  }, [examDate]);

  const phase: ExamPhase = useMemo(() => {
    if (!config.is_enabled || daysRemaining === null || daysRemaining < 0) return "no_exam";
    if (daysRemaining >= config.normal_mode_min_days) return "normal";
    if (daysRemaining >= config.acceleration_mode_min_days) return "acceleration";
    return "lockdown";
  }, [daysRemaining, config]);

  const canBypass = useMemo(() => {
    return config.bypass_plan_keys.includes(currentPlan);
  }, [config.bypass_plan_keys, currentPlan]);

  const lockedModes = useMemo(() => {
    if (canBypass) return [];
    switch (phase) {
      case "normal": return config.normal_locked_modes;
      case "acceleration": return config.acceleration_locked_modes;
      case "lockdown": return config.lockdown_locked_modes;
      default: return [];
    }
  }, [phase, config, canBypass]);

  const lockMessage = useMemo(() => {
    switch (phase) {
      case "acceleration": return config.acceleration_lock_message;
      case "lockdown": return config.lockdown_lock_message;
      default: return "";
    }
  }, [phase, config]);

  const recommendedMode = useMemo(() => {
    switch (phase) {
      case "acceleration": return config.acceleration_recommended_mode;
      case "lockdown": return config.lockdown_recommended_mode;
      default: return "focus";
    }
  }, [phase, config]);

  const isModeBlocked = useCallback((modeId: string) => {
    return lockedModes.includes(modeId);
  }, [lockedModes]);

  return {
    phase,
    daysRemaining,
    examDate,
    lockedModes,
    lockMessage,
    recommendedMode,
    canBypass,
    loading,
    isEnabled: config.is_enabled,
    isModeBlocked,
  };
};
