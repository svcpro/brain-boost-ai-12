import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ACRYLogo from "@/components/landing/ACRYLogo";

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/app");
      } else {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } },
        });
        if (error) throw error;
        if (data.user) {
          supabase.functions.invoke("send-branded-auth-email", {
            body: { type: "confirm", email, user_id: data.user.id, redirect_to: `${window.location.origin}/app` },
          }).catch(() => {});
        }
        toast({ title: "Check your email", description: "We sent you a confirmation link to verify your account." });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({ title: "Enter your email first", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase.functions.invoke("send-branded-auth-email", {
        body: { type: "reset", email, redirect_to: `${window.location.origin}/reset-password` },
      });
      if (error) throw error;
      toast({ title: "📧 Reset email sent!", description: "Check your inbox for the password reset link." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to send reset email", variant: "destructive" });
    }
  };

  return (
    <div className="h-[100dvh] bg-background flex flex-col max-w-lg mx-auto px-5 py-4 overflow-hidden">
      {/* Back */}
      <motion.button
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate("/")}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-xs mb-3 self-start transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back
      </motion.button>

      {/* Logo + Title — compact hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center mb-4"
      >
        <ACRYLogo variant="icon" animate={true} className="scale-[0.55] -my-4" />
        <AnimatePresence mode="wait">
          <motion.div
            key={isLogin ? "login-title" : "signup-title"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="text-center"
          >
            <h1 className="text-lg font-bold text-foreground">{isLogin ? "Welcome back" : "Join ACRY"}</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isLogin ? "Sign in to your AI Second Brain" : "Build your AI-powered study system"}
            </p>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Form Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-2xl p-4"
        style={{
          background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--secondary)) 100%)",
          border: "1px solid hsl(var(--border))",
        }}
      >
        <AnimatePresence mode="wait">
          <motion.form
            key={isLogin ? "login" : "signup"}
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleSubmit}
            className="space-y-2.5"
          >
            {!isLogin && (
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text" placeholder="Display name" value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-xl bg-background/60 backdrop-blur-sm border border-border pl-10 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  required
                />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="email" placeholder="Email address" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl bg-background/60 backdrop-blur-sm border border-border pl-10 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                required
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"} placeholder="Password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl bg-background/60 backdrop-blur-sm border border-border pl-10 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                required minLength={6}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {isLogin && (
              <div className="flex justify-end">
                <button type="button" onClick={handleForgotPassword} className="text-[10px] text-primary hover:underline">
                  Forgot password?
                </button>
              </div>
            )}
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="submit" disabled={loading}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm glow-primary hover:glow-primary-strong transition-all duration-300 disabled:opacity-50"
            >
              {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
            </motion.button>
          </motion.form>
        </AnimatePresence>
      </motion.div>

      {/* Divider */}
      <div className="flex items-center gap-3 my-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[10px] text-muted-foreground">or continue with</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Social buttons — horizontal */}
      <div className="flex gap-2.5">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={async () => {
            const { error } = await lovable.auth.signInWithOAuth("google");
            if (error) toast({ title: "Error", description: String(error), variant: "destructive" });
          }}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-card border border-border text-sm font-medium text-foreground hover:border-primary/30 transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Google
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={async () => {
            const { error } = await lovable.auth.signInWithOAuth("apple");
            if (error) toast({ title: "Error", description: String(error), variant: "destructive" });
          }}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-card border border-border text-sm font-medium text-foreground hover:border-primary/30 transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
          </svg>
          Apple
        </motion.button>
      </div>

      {/* Toggle — pushed to bottom */}
      <div className="mt-auto pt-3">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center text-xs text-muted-foreground"
        >
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline font-medium">
            {isLogin ? "Sign up" : "Sign in"}
          </button>
        </motion.p>
      </div>
    </div>
  );
};

export default AuthPage;
