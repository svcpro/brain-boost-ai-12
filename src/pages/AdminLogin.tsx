import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Shield, Mail, Lock, Eye, EyeOff, ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AdminMFAVerify from "@/components/admin/AdminMFAVerify";
import AdminMFASetup from "@/components/admin/AdminMFASetup";

const AdminLogin = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"login" | "mfa_verify" | "mfa_setup">("login");
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [autoChecking, setAutoChecking] = useState(false);

  // If user is already logged in, check admin role and MFA
  useEffect(() => {
    if (authLoading) return;
    if (user) {
      setAutoChecking(true);
      checkAdminAndMFA().finally(() => setAutoChecking(false));
    }
  }, [user, authLoading]);

  const checkAdminAndMFA = async () => {
    if (!user) return;
    // Check if user has admin role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (!roles || roles.length === 0) {
      setStep("login");
      return;
    }

    // Check MFA enrollment
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totp = factors?.totp;
    if (totp && totp.length > 0) {
      const verified = totp.find(f => f.status === "verified");
      if (verified) {
        // Check if there's an active MFA challenge already verified in this session
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal?.currentLevel === "aal2") {
          navigate("/admin");
        } else {
          setStep("mfa_verify");
        }
      } else {
        // Factor exists but not verified, re-setup
        setStep("mfa_setup");
      }
    } else {
      // No MFA enrolled, require setup
      setStep("mfa_setup");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Check admin role
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);

      if (!roles || roles.length === 0) {
        await supabase.auth.signOut();
        toast({ title: "Access Denied", description: "You don't have admin privileges.", variant: "destructive" });
        setLoading(false);
        return;
      }

      // Check MFA
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp;
      if (totp && totp.length > 0 && totp.find(f => f.status === "verified")) {
        setStep("mfa_verify");
      } else {
        setStep("mfa_setup");
      }
    } catch (error: any) {
      toast({ title: "Login Failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: "Error", description: "Enter your admin email address.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/admin/login`,
      });
      if (error) throw error;
      setResetSent(true);
      toast({ title: "Email Sent", description: "Check your inbox for the password reset link." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleMFAComplete = () => {
    navigate("/admin");
  };

  if (step === "mfa_verify") {
    return <AdminMFAVerify onSuccess={handleMFAComplete} />;
  }

  if (step === "mfa_setup") {
    return <AdminMFASetup onComplete={() => setStep("mfa_verify")} />;
  }

  // Show loading while auto-detecting an already logged-in user
  if (authLoading || autoChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 relative">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[400px] h-[400px] rounded-full bg-destructive/5 blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to home</span>
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-destructive/15 border border-destructive/30 flex items-center justify-center">
            <Shield className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <span className="font-display font-bold text-2xl text-foreground">Admin Portal</span>
            <p className="text-xs text-muted-foreground">Secured access only</p>
          </div>
        </div>

        {resetMode ? (
          <>
            <h1 className="text-2xl font-bold text-foreground mb-2">Reset Password</h1>
            <p className="text-muted-foreground text-sm mb-6">Enter your admin email to receive a reset link.</p>

            {resetSent ? (
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-sm text-primary">
                ✓ Reset link sent. Check your email and follow the instructions.
              </div>
            ) : (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    placeholder="Admin email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl bg-secondary border border-border pl-11 pr-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive/50 focus:border-destructive transition-all"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-destructive text-destructive-foreground font-semibold transition-all duration-300 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Send Reset Link"}
                </button>
              </form>
            )}

            <button
              onClick={() => { setResetMode(false); setResetSent(false); }}
              className="text-primary hover:underline text-sm mt-4 block mx-auto"
            >
              Back to login
            </button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-foreground mb-2">Admin Sign In</h1>
            <p className="text-muted-foreground text-sm mb-6">Authenticate with your admin credentials.</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="Admin email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl bg-secondary border border-border pl-11 pr-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive/50 focus:border-destructive transition-all"
                  required
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl bg-secondary border border-border pl-11 pr-11 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive/50 focus:border-destructive transition-all"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-destructive text-destructive-foreground font-semibold transition-all duration-300 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Sign In to Admin"}
              </button>
            </form>

            <button
              onClick={() => setResetMode(true)}
              className="text-muted-foreground hover:text-foreground text-sm mt-4 block mx-auto transition-colors"
            >
              Forgot password?
            </button>
          </>
        )}

        <div className="mt-8 p-3 rounded-xl bg-secondary/50 border border-border">
          <p className="text-[11px] text-muted-foreground text-center">
            🔒 This portal is protected by 2FA. After login you'll be asked to verify with your authenticator app.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
