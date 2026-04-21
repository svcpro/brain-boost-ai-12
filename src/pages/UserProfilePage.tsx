import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Mail, Lock, Camera, Save, Loader2, Eye, EyeOff,
  CheckCircle2, ArrowLeft, Shield, Clock, Calendar, Trash2, KeyRound, MapPin, Globe, Locate
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import AvatarCropDialog from "@/components/profile/AvatarCropDialog";

const UserProfilePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  // Password change
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Forgot password
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [sendingReset, setSendingReset] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, country, city")
      .eq("id", user.id)
      .single();
    if (data) {
      setDisplayName(data.display_name || "");
      setAvatarUrl(data.avatar_url);
      setCountry((data as any).country || "");
      setCity((data as any).city || "");
    }
    setForgotEmail(user.email || "");
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // Auto-detect city/country from IP geolocation (free, no key required)
  const detectLocation = useCallback(async (silent = false) => {
    setDetectingLocation(true);
    try {
      const res = await fetch("https://ipapi.co/json/");
      if (!res.ok) throw new Error("geo lookup failed");
      const data = await res.json();
      const detectedCity = (data.city || "").toString().slice(0, 60);
      const detectedCountry = (data.country_name || "").toString().slice(0, 60);
      if (detectedCity) setCity(detectedCity);
      if (detectedCountry) setCountry(detectedCountry);
      if (!silent) {
        toast({
          title: "📍 Location detected",
          description: detectedCity ? `${detectedCity}${detectedCountry ? `, ${detectedCountry}` : ""}` : "Saved",
        });
      }
    } catch {
      if (!silent) toast({ title: "Couldn't detect location", description: "Please enter it manually.", variant: "destructive" });
    } finally {
      setDetectingLocation(false);
    }
  }, [toast]);

  // Auto-detect once on mount if both fields are empty (after profile loads)
  useEffect(() => {
    if (!loading && !city && !country) {
      detectLocation(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);


  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        country: country.trim() || null,
        city: city.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    if (error) {
      toast({ title: "Failed to save profile", variant: "destructive" });
    } else {
      toast({ title: "✨ Profile updated!" });
      import("@/lib/eventBus").then(({ emitEvent }) =>
        emitEvent("profile_completed", {}, { title: "Profile Updated" })
      );
    }
    setSaving(false);
  };

  const openAvatarCropper = useCallback((file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.onerror = () => toast({ title: "Couldn't open image", variant: "destructive" });
    reader.readAsDataURL(file);
  }, [toast]);

  const uploadAvatar = async (file: Blob, ext = "jpg") => {
    if (!user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 2MB allowed", variant: "destructive" });
      return;
    }
    setUploading(true);
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });

    if (uploadError) {
      toast({ title: "Upload failed", variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    await supabase.from("profiles").update({ avatar_url: publicUrl, updated_at: new Date().toISOString() }).eq("id", user.id);
    setAvatarUrl(publicUrl);
    toast({ title: "✨ Avatar updated!" });
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
      toast({ title: "🔒 Password changed successfully!" });
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordSection(false);
    }
    setChangingPassword(false);
  };

  const sendPasswordReset = async () => {
    if (!forgotEmail) return;
    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast({ title: "Failed to send reset email", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "📧 Reset email sent!", description: "Check your inbox for the password reset link." });
      setShowForgotPassword(false);
    }
    setSendingReset(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const email = user?.email || "";
  const provider = user?.app_metadata?.provider || "email";
  const createdAt = user?.created_at ? format(new Date(user.created_at), "MMM d, yyyy") : "—";
  const lastSignIn = user?.last_sign_in_at ? format(new Date(user.last_sign_in_at), "MMM d, yyyy 'at' h:mm a") : "—";
  const initials = (displayName || email.split("@")[0] || "U").slice(0, 2).toUpperCase();

  const passwordStrength = [
    newPassword.length >= 8,
    /[A-Z]/.test(newPassword),
    /[0-9]/.test(newPassword),
    /[^A-Za-z0-9]/.test(newPassword),
  ];
  const strengthCount = passwordStrength.filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass-strong border-b border-border px-6 py-4 flex items-center gap-3 sticky top-0 z-40">
        <button onClick={() => navigate("/app")} className="p-2 -ml-2 rounded-lg hover:bg-secondary transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          <h1 className="font-display font-bold text-lg text-foreground">My Profile</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-6 py-6 space-y-5">
        {/* Avatar & Name Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl neural-border p-6"
        >
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="relative">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="block w-20 h-20 rounded-2xl overflow-hidden ring-2 ring-primary/20 bg-secondary flex items-center justify-center disabled:opacity-50"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-muted-foreground">{initials}</span>
                )}
              </button>
              {/* Always-visible camera badge */}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                aria-label="Change profile photo"
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg ring-2 ring-background hover:scale-105 active:scale-95 transition-transform disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) {
                    const reader = new FileReader();
                    reader.onload = () => setCropSrc(reader.result as string);
                    reader.readAsDataURL(f);
                  }
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
                  className="w-full mt-1 px-3 py-2.5 bg-secondary rounded-xl text-sm text-foreground placeholder:text-muted-foreground border border-border focus:border-primary outline-none transition-colors"
                />
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Email</label>
                <div className="flex items-center gap-2 mt-1 px-3 py-2.5 bg-secondary/50 rounded-xl border border-border">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm text-foreground truncate">{email}</span>
                </div>
              </div>

              {/* Country & City — used for the My City leaderboard */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Country
                  </label>
                  <input
                    value={country}
                    onChange={e => setCountry(e.target.value.slice(0, 60))}
                    placeholder="e.g. India"
                    className="w-full mt-1 px-3 py-2.5 bg-secondary rounded-xl text-sm text-foreground placeholder:text-muted-foreground border border-border focus:border-primary outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> City
                  </label>
                  <input
                    value={city}
                    onChange={e => setCity(e.target.value.slice(0, 60))}
                    placeholder="e.g. Mumbai"
                    className="w-full mt-1 px-3 py-2.5 bg-secondary rounded-xl text-sm text-foreground placeholder:text-muted-foreground border border-border focus:border-primary outline-none transition-colors"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between -mt-1">
                <p className="text-[10px] text-muted-foreground">
                  Used to rank you in the <span className="text-primary font-semibold">My City</span> leaderboard.
                </p>
                <button
                  onClick={() => detectLocation(false)}
                  disabled={detectingLocation}
                  className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                >
                  {detectingLocation ? <Loader2 className="w-3 h-3 animate-spin" /> : <Locate className="w-3 h-3" />}
                  {detectingLocation ? "Detecting..." : "Auto-detect"}
                </button>
              </div>

              {avatarUrl && (
                <button onClick={removeAvatar} disabled={uploading} className="flex items-center gap-1 text-[11px] text-destructive hover:text-destructive/80 transition-colors">
                  <Trash2 className="w-3 h-3" />
                  Remove avatar
                </button>
              )}
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button
              onClick={saveProfile}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Changes
            </button>
          </div>
        </motion.div>

        {/* Account Info */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass rounded-2xl neural-border p-5 space-y-3"
        >
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Account Details
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-secondary/50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Auth Provider</p>
              <p className="text-sm font-medium text-foreground capitalize">{provider}</p>
            </div>
            <div className="bg-secondary/50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Joined
              </p>
              <p className="text-sm font-medium text-foreground">{createdAt}</p>
            </div>
            <div className="bg-secondary/50 rounded-xl p-3 col-span-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Last Sign In
              </p>
              <p className="text-sm font-medium text-foreground">{lastSignIn}</p>
            </div>
          </div>
        </motion.div>

        {/* Password Change */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
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

          <AnimatePresence>
            {showPasswordSection && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-4 space-y-3 overflow-hidden"
              >
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">New Password</label>
                  <div className="relative mt-1">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      className="w-full px-3 py-2.5 pr-10 bg-secondary rounded-xl text-sm text-foreground placeholder:text-muted-foreground border border-border focus:border-primary outline-none"
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
                    className="w-full mt-1 px-3 py-2.5 bg-secondary rounded-xl text-sm text-foreground placeholder:text-muted-foreground border border-border focus:border-primary outline-none"
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
                    <p className="text-[10px] text-muted-foreground">
                      Password strength: {strengthCount <= 1 ? "Weak" : strengthCount === 2 ? "Fair" : strengthCount === 3 ? "Good" : "Strong"}
                    </p>
                    <div className="flex gap-1">
                      {passwordStrength.map((met, i) => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${met ? (strengthCount <= 2 ? "bg-warning" : "bg-primary") : "bg-muted"}`} />
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
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {changingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  Update Password
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Forgot Password */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-2xl neural-border p-5"
        >
          <button
            onClick={() => setShowForgotPassword(!showForgotPassword)}
            className="w-full flex items-center justify-between"
          >
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" />
              Forgot Password
            </h3>
            <span className="text-xs text-muted-foreground">{showForgotPassword ? "Hide" : "Show"}</span>
          </button>

          <AnimatePresence>
            {showForgotPassword && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-4 space-y-3 overflow-hidden"
              >
                <p className="text-xs text-muted-foreground">
                  We'll send a password reset link to your email address.
                </p>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full mt-1 px-3 py-2.5 bg-secondary rounded-xl text-sm text-foreground placeholder:text-muted-foreground border border-border focus:border-primary outline-none"
                  />
                </div>
                <button
                  onClick={sendPasswordReset}
                  disabled={sendingReset || !forgotEmail}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {sendingReset ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                  Send Reset Link
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <AvatarCropDialog
        open={!!cropSrc}
        imageSrc={cropSrc || ""}
        onCancel={() => setCropSrc(null)}
        onConfirm={async blob => {
          await uploadAvatar(blob, "jpg");
          setCropSrc(null);
        }}
      />
    </div>
  );
};

export default UserProfilePage;
