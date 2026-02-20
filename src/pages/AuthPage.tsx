import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Mail, Lock, User, Eye, EyeOff, ArrowLeft, Shield, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
          options: {
            data: { display_name: displayName },
          },
        });
        if (error) throw error;
        if (data.user) {
          supabase.functions.invoke("send-branded-auth-email", {
            body: {
              type: "confirm",
              email,
              user_id: data.user.id,
              redirect_to: `${window.location.origin}/app`,
            },
          }).catch(() => {});
        }
        toast({
          title: "Check your email",
          description: "We sent you a confirmation link to verify your account.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
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
        body: {
          type: "reset",
          email,
          redirect_to: `${window.location.origin}/reset-password`,
        },
      });
      if (error) throw error;
      toast({ title: "📧 Reset email sent!", description: "Check your inbox for the password reset link." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to send reset email", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background px-5 py-6 max-w-lg mx-auto flex flex-col">
      {/* Back button */}
      <motion.button
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate("/")}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors self-start"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Back</span>
      </motion.button>

      {/* ─── Hero Card (matches HomeTab Section 1) ─── */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative overflow-hidden rounded-3xl p-6 text-center mb-5"
        style={{
          background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--secondary)) 50%, hsl(var(--card)) 100%)",
          border: "1px solid hsl(var(--border))",
        }}
      >
        {/* Decorative glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full opacity-20 blur-3xl pointer-events-none" style={{ background: "hsl(var(--primary))" }} />

        {/* Logo */}
        <div className="relative z-10 mx-auto w-16 h-16 rounded-2xl neural-gradient neural-border flex items-center justify-center mb-4">
          <Brain className="w-8 h-8 text-primary" />
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-bold text-foreground mb-1"
        >
          {isLogin ? "Welcome back" : "Join ACRY"}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="text-sm text-muted-foreground"
        >
          {isLogin ? "Sign in to your AI Second Brain" : "Build your AI-powered study system"}
        </motion.p>

        {/* Mini stats row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-3 gap-2 mt-5"
        >
          <div className="rounded-xl bg-background/50 backdrop-blur-sm p-2.5 border border-border/50">
            <Brain className="w-4 h-4 mx-auto text-primary mb-1" />
            <p className="text-[9px] text-muted-foreground">AI Brain</p>
          </div>
          <div className="rounded-xl bg-background/50 backdrop-blur-sm p-2.5 border border-border/50">
            <Shield className="w-4 h-4 mx-auto text-primary mb-1" />
            <p className="text-[9px] text-muted-foreground">Smart Recall</p>
          </div>
          <div className="rounded-xl bg-background/50 backdrop-blur-sm p-2.5 border border-border/50">
            <Sparkles className="w-4 h-4 mx-auto text-primary mb-1" />
            <p className="text-[9px] text-muted-foreground">Adaptive</p>
          </div>
        </motion.div>
      </motion.section>

      {/* ─── Form Card ─── */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="rounded-3xl p-5 mb-5"
        style={{
          background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--secondary)) 100%)",
          border: "1px solid hsl(var(--border))",
        }}
      >
        <AnimatePresence mode="wait">
          <motion.form
            key={isLogin ? "login" : "signup"}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            onSubmit={handleSubmit}
            className="space-y-3.5"
          >
            {!isLogin && (
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-xl bg-background/60 backdrop-blur-sm border border-border pl-11 pr-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  required
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl bg-background/60 backdrop-blur-sm border border-border pl-11 pr-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
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
                className="w-full rounded-xl bg-background/60 backdrop-blur-sm border border-border pl-11 pr-11 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
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

            {isLogin && (
              <div className="flex justify-end">
                <button type="button" onClick={handleForgotPassword} className="text-xs text-primary hover:underline">
                  Forgot password?
                </button>
              </div>
            )}

            <motion.button
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold glow-primary hover:glow-primary-strong transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
            </motion.button>
          </motion.form>
        </AnimatePresence>
      </motion.section>

      {/* ─── Social Sign-In Card ─── */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35 }}
        className="rounded-3xl p-5 mb-5"
        style={{
          background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--secondary)) 100%)",
          border: "1px solid hsl(var(--border))",
        }}
      >
        <p className="text-xs text-center text-muted-foreground mb-4">or continue with</p>

        <div className="space-y-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={async () => {
              const { error } = await lovable.auth.signInWithOAuth("google");
              if (error) toast({ title: "Error", description: String(error), variant: "destructive" });
            }}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-background/50 backdrop-blur-sm border border-border font-medium text-foreground hover:border-primary/30 transition-all duration-300"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={async () => {
              const { error } = await lovable.auth.signInWithOAuth("apple");
              if (error) toast({ title: "Error", description: String(error), variant: "destructive" });
            }}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-background/50 backdrop-blur-sm border border-border font-medium text-foreground hover:border-primary/30 transition-all duration-300"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            Continue with Apple
          </motion.button>
        </div>
      </motion.section>

      {/* ─── Toggle Card ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center"
      >
        <p className="text-sm text-muted-foreground">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline font-medium">
            {isLogin ? "Sign up" : "Sign in"}
          </button>
        </p>
      </motion.div>
    </div>
  );
};

export default AuthPage;
