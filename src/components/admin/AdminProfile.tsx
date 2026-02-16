import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  User, Mail, Lock, Camera, Save, Loader2, Eye, EyeOff,
  CheckCircle2, AlertTriangle, Shield, Clock, Calendar
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  ai_admin: "AI Admin",
  support_admin: "Support Admin",
  finance_admin: "Finance Admin",
};

const AdminProfile = () => {
  const { user } = useAuth();
  const { roles } = useAdminRole();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Password change
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .single();
    if (data) {
      setDisplayName(data.display_name || "");
      setAvatarUrl(data.avatar_url);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim(), updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) {
      toast({ title: "Failed to save profile", variant: "destructive" });
    } else {
      toast({ title: "Profile updated" });
    }
    setSaving(false);
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 2MB allowed", variant: "destructive" });
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Upload failed", variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    await supabase.from("profiles").update({ avatar_url: publicUrl, updated_at: new Date().toISOString() }).eq("id", user.id);
    setAvatarUrl(publicUrl);
    toast({ title: "Avatar updated" });
    setUploading(false);
  };

  const removeAvatar = async () => {
    if (!user) return;
    setUploading(true);
    await supabase.from("profiles").update({ avatar_url: null, updated_at: new Date().toISOString() }).eq("id", user.id);
    setAvatarUrl(null);
    toast({ title: "Avatar removed" });
    setUploading(false);
  };

  const changePassword = async () => {
    if (newPassword.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: "Failed to change password", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password changed successfully" });
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordSection(false);
    }
    setChangingPassword(false);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const email = user?.email || "";
  const provider = user?.app_metadata?.provider || "email";
  const createdAt = user?.created_at ? format(new Date(user.created_at), "MMM d, yyyy") : "—";
  const lastSignIn = user?.last_sign_in_at ? format(new Date(user.last_sign_in_at), "MMM d, yyyy 'at' h:mm a") : "—";
  const initials = (displayName || email.split("@")[0] || "A").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-2">
        <User className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold text-foreground">My Profile</h2>
      </div>

      {/* Avatar & Name Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl neural-border p-6"
      >
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="relative group">
            <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-primary/20 bg-secondary flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-muted-foreground">{initials}</span>
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin text-white" />
              ) : (
                <Camera className="w-5 h-5 text-white" />
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) uploadAvatar(f);
                e.target.value = "";
              }}
            />
          </div>

          <div className="flex-1 space-y-3">
            {/* Display Name */}
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Display Name</label>
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full mt-1 px-3 py-2 bg-secondary rounded-lg text-sm text-foreground placeholder:text-muted-foreground border border-border focus:border-primary outline-none transition-colors"
              />
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Email</label>
              <div className="flex items-center gap-2 mt-1 px-3 py-2 bg-secondary/50 rounded-lg border border-border">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm text-foreground">{email}</span>
              </div>
            </div>

            {avatarUrl && (
              <button onClick={removeAvatar} disabled={uploading} className="text-[11px] text-destructive hover:text-destructive/80 transition-colors">
                Remove avatar
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={saveProfile}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Changes
          </button>
        </div>
      </motion.div>

      {/* Account Info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass rounded-2xl neural-border p-5 space-y-3"
      >
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          Account Details
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-secondary/50 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Roles</p>
            <div className="flex flex-wrap gap-1">
              {roles.map(r => (
                <span key={r} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                  {ROLE_LABELS[r] || r}
                </span>
              ))}
            </div>
          </div>
          <div className="bg-secondary/50 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Auth Provider</p>
            <p className="text-sm font-medium text-foreground capitalize">{provider}</p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Account Created
            </p>
            <p className="text-sm font-medium text-foreground">{createdAt}</p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Last Sign In
            </p>
            <p className="text-sm font-medium text-foreground">{lastSignIn}</p>
          </div>
        </div>

        <div className="bg-secondary/50 rounded-lg p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">User ID</p>
          <p className="text-xs font-mono text-muted-foreground break-all">{user?.id}</p>
        </div>
      </motion.div>

      {/* Password Change */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-2xl neural-border p-5"
      >
        <button
          onClick={() => setShowPasswordSection(!showPasswordSection)}
          className="w-full flex items-center justify-between"
        >
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            Change Password
          </h3>
          <span className="text-xs text-muted-foreground">{showPasswordSection ? "Hide" : "Show"}</span>
        </button>

        {showPasswordSection && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="mt-4 space-y-3"
          >
            {provider !== "email" && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <p className="text-xs text-warning">You signed up via {provider}. Setting a password will enable email+password login as well.</p>
              </div>
            )}

            <div className="relative">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">New Password</label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full px-3 py-2 pr-10 bg-secondary rounded-lg text-sm text-foreground placeholder:text-muted-foreground border border-border focus:border-primary outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Confirm Password</label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full mt-1 px-3 py-2 bg-secondary rounded-lg text-sm text-foreground placeholder:text-muted-foreground border border-border focus:border-primary outline-none"
              />
              {confirmPassword && confirmPassword !== newPassword && (
                <p className="text-[10px] text-destructive mt-1">Passwords do not match</p>
              )}
              {confirmPassword && confirmPassword === newPassword && newPassword.length >= 8 && (
                <p className="text-[10px] text-success mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Passwords match
                </p>
              )}
            </div>

            {/* Strength indicator */}
            {newPassword && (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">Password strength</p>
                <div className="flex gap-1">
                  {[
                    newPassword.length >= 8,
                    /[A-Z]/.test(newPassword),
                    /[0-9]/.test(newPassword),
                    /[^A-Za-z0-9]/.test(newPassword),
                  ].map((met, i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${met ? "bg-primary" : "bg-muted"}`} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 text-[9px] text-muted-foreground">
                  <span className={newPassword.length >= 8 ? "text-primary" : ""}>8+ chars</span>
                  <span className={/[A-Z]/.test(newPassword) ? "text-primary" : ""}>Uppercase</span>
                  <span className={/[0-9]/.test(newPassword) ? "text-primary" : ""}>Number</span>
                  <span className={/[^A-Za-z0-9]/.test(newPassword) ? "text-primary" : ""}>Symbol</span>
                </div>
              </div>
            )}

            <button
              onClick={changePassword}
              disabled={changingPassword || newPassword.length < 8 || newPassword !== confirmPassword}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {changingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
              Update Password
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default AdminProfile;
