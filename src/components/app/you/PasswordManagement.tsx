import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { KeyRound, Eye, EyeOff, Loader2, Check, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const PasswordManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const provider = user?.app_metadata?.provider || "email";
  const isOAuth = provider !== "email";
  const label = isOAuth ? "Set Password" : "Change Password";

  const handleSubmit = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: "Password too short", description: "Minimum 6 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // For OAuth users setting password for the first time, no current password needed
      if (!isOAuth && currentPassword) {
        // Verify current password by re-signing in
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user?.email || "",
          password: currentPassword,
        });
        if (signInError) {
          toast({ title: "Current password incorrect", variant: "destructive" });
          setSaving(false);
          return;
        }
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast({ title: "✅ Password updated successfully!" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setOpen(false);
    } catch (err: any) {
      toast({ title: "Failed to update password", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-secondary/60 transition-all border border-transparent hover:border-border"
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
          <KeyRound className="w-4 h-4 text-primary" />
        </div>
        <span className="flex-1 text-left text-sm text-foreground font-medium">{label}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 space-y-3">
              {isOAuth && (
                <p className="text-xs text-muted-foreground">
                  You signed in with {provider.charAt(0).toUpperCase() + provider.slice(1)}. Set a password to also log in with email.
                </p>
              )}

              {!isOAuth && (
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    placeholder="Current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-lg bg-secondary border border-border px-3 py-2.5 text-sm text-foreground pr-10 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              )}

              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg bg-secondary border border-border px-3 py-2.5 text-sm text-foreground pr-10 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg bg-secondary border border-border px-3 py-2.5 text-sm text-foreground pr-10 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {newPassword && newPassword.length < 6 && (
                <p className="text-xs text-destructive">Minimum 6 characters</p>
              )}
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">Passwords don't match</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={saving || !newPassword || newPassword !== confirmPassword || newPassword.length < 6}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? "Updating..." : label}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default PasswordManagement;
