import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Permission {
  id: string;
  role: string;
  permission_key: string;
  permission_label: string;
  category: string;
  enabled: boolean;
}

interface PermissionsState {
  permissions: Permission[];
  loading: boolean;
  hasPermission: (key: string) => boolean;
  refetch: () => Promise<void>;
}

export const usePermissions = (): PermissionsState => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    if (!user) {
      setPermissions([]);
      setLoading(false);
      return;
    }
    try {
      // Get user's roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (!roles || roles.length === 0) {
        setPermissions([]);
        setLoading(false);
        return;
      }

      const roleNames = roles.map((r: any) => r.role);

      // Get permissions for all user roles
      const { data } = await supabase
        .from("role_permissions")
        .select("*")
        .in("role", roleNames);

      setPermissions((data || []) as Permission[]);
    } catch {
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const hasPermission = useCallback(
    (key: string) => permissions.some((p) => p.permission_key === key && p.enabled),
    [permissions]
  );

  return { permissions, loading, hasPermission, refetch: fetchPermissions };
};
