import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = "super_admin" | "admin" | "ai_admin" | "support_admin" | "finance_admin";

interface AdminRoleState {
  roles: AppRole[];
  isAdmin: boolean;
  isSuperAdmin: boolean;
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (...roles: AppRole[]) => boolean;
  refetch: () => Promise<void>;
}

export const useAdminRole = (): AdminRoleState => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoles = useCallback(async () => {
    if (!user) { setRoles([]); setLoading(false); return; }
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      setRoles((data || []).map((r: any) => r.role as AppRole));
    } catch { setRoles([]); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const hasRole = (role: AppRole) => roles.includes(role);
  const hasAnyRole = (...r: AppRole[]) => r.some(role => roles.includes(role));

  return {
    roles,
    isAdmin: roles.length > 0,
    isSuperAdmin: roles.includes("super_admin"),
    loading,
    hasRole,
    hasAnyRole,
    refetch: fetchRoles,
  };
};
