import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Shield, Loader2, Check, X, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { AppRole } from "@/hooks/useAdminRole";

const ROLE_ORDER: AppRole[] = ["super_admin", "admin", "ai_admin", "support_admin", "finance_admin"];
const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  ai_admin: "AI Admin",
  support_admin: "Support Admin",
  finance_admin: "Finance Admin",
};

const CATEGORIES = [
  "User Management",
  "AI Management",
  "Subscription Management",
  "Notification Management",
  "Admin Management",
];

interface Permission {
  id: string;
  role: string;
  permission_key: string;
  permission_label: string;
  category: string;
  enabled: boolean;
}

const PermissionManagement = () => {
  const { toast } = useToast();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedRole, setExpandedRole] = useState<AppRole | null>("super_admin");

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("role_permissions")
      .select("*")
      .order("category")
      .order("permission_key");
    setPermissions((data || []) as Permission[]);
    setLoading(false);
  };

  const togglePermission = async (perm: Permission) => {
    // Prevent disabling super_admin permissions
    if (perm.role === "super_admin") {
      toast({ title: "Cannot modify", description: "Super Admin always has full access.", variant: "destructive" });
      return;
    }

    setSaving(perm.id);
    const { error } = await supabase
      .from("role_permissions")
      .update({ enabled: !perm.enabled })
      .eq("id", perm.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setPermissions((prev) =>
        prev.map((p) => (p.id === perm.id ? { ...p, enabled: !p.enabled } : p))
      );
    }
    setSaving(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Shield className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">Permission Matrix</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Configure granular permissions for each admin role. Super Admin permissions cannot be modified.
      </p>

      {ROLE_ORDER.map((role) => {
        const rolePerms = permissions.filter((p) => p.role === role);
        const enabledCount = rolePerms.filter((p) => p.enabled).length;
        const isExpanded = expandedRole === role;

        return (
          <motion.div
            key={role}
            className="glass rounded-xl neural-border overflow-hidden"
            initial={false}
          >
            <button
              onClick={() => setExpandedRole(isExpanded ? null : role)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-foreground">{ROLE_LABELS[role]}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {enabledCount}/{rolePerms.length} enabled
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
              />
            </button>

            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-border"
              >
                {CATEGORIES.map((cat) => {
                  const catPerms = rolePerms.filter((p) => p.category === cat);
                  if (catPerms.length === 0) return null;

                  return (
                    <div key={cat} className="px-5 py-3 border-b border-border/50 last:border-b-0">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        {cat}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {catPerms.map((perm) => (
                          <button
                            key={perm.id}
                            onClick={() => togglePermission(perm)}
                            disabled={saving === perm.id || role === "super_admin"}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                              perm.enabled
                                ? "bg-primary/10 text-primary border border-primary/20"
                                : "bg-secondary/50 text-muted-foreground border border-border hover:border-muted-foreground/30"
                            } ${role === "super_admin" ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
                          >
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${
                                perm.enabled
                                  ? "bg-primary"
                                  : "border border-muted-foreground/40"
                              }`}
                            >
                              {perm.enabled && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                            </div>
                            <span className="text-xs">{perm.permission_label}</span>
                            {saving === perm.id && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

export default PermissionManagement;
