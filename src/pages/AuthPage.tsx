import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, Eye, EyeOff, ArrowLeft, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SplashScreen from "@/components/splash/SplashScreen";
import { useInstitution } from "@/contexts/InstitutionContext";

const AuthPage = () => {
  const [searchParams] = useSearchParams();
  const showSplashParam = searchParams.get("splash") === "1";
  const [showSplash, setShowSplash] = useState(showSplashParam);
  const [isLogin, setIsLogin] = useState(true);
  const [authMethod, setAuthMethod] = useState<"password" | "otp">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { institution, isInstitutionDomain } = useInstitution();

  const handleSendOtp = async () => {
    if (!email) {
      toast({ title: "Enter your email first", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      setOtpSent(true);
      toast({ title: "OTP Sent!", description: "Check your email for the 6-digit code." });
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const token = otpCode.join("");
    if (token.length !== 6) {
      toast({ title: "Enter the full 6-digit code", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
      if (error) throw error;
      navigate("/app");
    } catch (error: any) {
      toast({ title: "Invalid code", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...otpCode];
    newCode[index] = value.slice(-1);
    setOtpCode(newCode);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newCode = [...otpCode];
    for (let i = 0; i < 6; i++) {
      newCode[i] = pasted[i] || "";
    }
    setOtpCode(newCode);
    const nextEmpty = pasted.length < 6 ? pasted.length : 5;
    otpRefs.current[nextEmpty]?.focus();
  };

  if (showSplash) {
    return (
      <SplashScreen
        onComplete={() => {
          sessionStorage.setItem("acry_splash_seen", "1");
          setShowSplash(false);
        }}
      />
    );
  }

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
    <div className="fixed inset-0 flex items-center justify-center"
      style={{ background: "linear-gradient(180deg, #0B0F1A 0%, #111827 100%)" }}
    >
      {/* Device frame */}
      <div className="relative w-full max-w-[430px] h-[100dvh] overflow-hidden flex flex-col md:h-[min(95dvh,920px)] md:rounded-[2.5rem] md:border md:border-border/40 md:shadow-[0_25px_80px_-12px_hsl(0_0%_0%/0.6),0_0_120px_hsl(187_100%_50%/0.06)]">

        {/* Ambient background effects */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            className="absolute w-[300px] h-[300px] rounded-full"
            style={{
              top: "-10%", left: "-20%",
              background: "radial-gradient(circle, #00E5FF08 0%, transparent 70%)",
            }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute w-[250px] h-[250px] rounded-full"
            style={{
              bottom: "5%", right: "-15%",
              background: "radial-gradient(circle, #7C4DFF06 0%, transparent 70%)",
            }}
            animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          />
          {/* Floating particles */}
          {Array.from({ length: 12 }, (_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: 1.5 + Math.random() * 1.5,
                height: 1.5 + Math.random() * 1.5,
                left: `${10 + Math.random() * 80}%`,
                top: `${10 + Math.random() * 80}%`,
                background: i % 3 === 0 ? "#00E5FF" : i % 3 === 1 ? "#7C4DFF" : "#00FF94",
              }}
              animate={{ y: [0, -15, 0], opacity: [0.05, 0.25, 0.05] }}
              transition={{ duration: 6 + Math.random() * 6, delay: Math.random() * 3, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}
        </div>

        {/* Back button */}
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          onClick={() => navigate("/")}
          className="relative z-10 flex items-center gap-1.5 text-xs mt-4 ml-5 self-start transition-colors"
          style={{ color: "#ffffff50" }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </motion.button>

        {/* Logo + Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="flex flex-col items-center mt-6 mb-5 relative z-10"
        >
          {/* Animated logo icon */}
          {isInstitutionDomain && institution?.logo_url ? (
            <motion.div
              className="relative"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.6, type: "spring", bounce: 0.25 }}
            >
              <img
                src={institution.logo_url}
                alt={institution.name}
                className="w-16 h-16 rounded-2xl object-contain"
                style={{ background: "#ffffff08", border: "1px solid #ffffff15" }}
              />
            </motion.div>
          ) : (
          <motion.div
            className="relative"
            initial={{ scale: 0, rotate: -120 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, type: "spring", bounce: 0.25 }}
          >
            <motion.div
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, hsl(228 50% 8%), hsl(228 40% 14%))",
                  border: "1px solid #00E5FF30",
                  boxShadow: "0 0 40px #00E5FF08, 0 0 80px #7C4DFF05",
                }}
              >
                <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
                  <defs>
                    <linearGradient id="authGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#00E5FF" />
                      <stop offset="60%" stopColor="#7C4DFF" />
                      <stop offset="100%" stopColor="#00E5FF" />
                    </linearGradient>
                    <filter id="authGlow">
                      <feGaussianBlur stdDeviation="1.2" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  <motion.circle cx="24" cy="24" r="22" stroke="url(#authGrad)" strokeWidth="1" fill="none" opacity="0.3"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 0.3 }}
                  />
                  <motion.path d="M24 8L38 38H10L24 8Z" stroke="url(#authGrad)" strokeWidth="1.8" fill="none"
                    strokeLinejoin="round" filter="url(#authGlow)"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 0.5 }}
                  />
                  <motion.line x1="15" y1="30" x2="33" y2="30" stroke="url(#authGrad)" strokeWidth="1.2" opacity="0.7"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.9 }}
                  />
                  <motion.circle cx="24" cy="8" r="1.8" fill="#00E5FF" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.1, type: "spring" }} />
                  <motion.circle cx="10" cy="38" r="1.3" fill="#7C4DFF" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.2, type: "spring" }} />
                  <motion.circle cx="38" cy="38" r="1.3" fill="#7C4DFF" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.3, type: "spring" }} />
                  <motion.circle cx="24" cy="30" r="1" fill="#00FF94" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.4, type: "spring" }} />
                </svg>

                {/* Light sweep */}
                <motion.div className="absolute inset-0 overflow-hidden rounded-2xl">
                  <motion.div
                    className="absolute top-0 -left-full w-1/2 h-full"
                    style={{ background: "linear-gradient(90deg, transparent, #00E5FF15, #ffffff08, transparent)" }}
                    animate={{ left: ["-50%", "150%"] }}
                    transition={{ duration: 1, delay: 1.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 5 }}
                  />
                </motion.div>
              </div>
            </motion.div>

            {/* Orbiting ring */}
            <motion.div
              className="absolute inset-[-4px] rounded-[1.1rem] pointer-events-none"
              style={{ border: "1px solid #00E5FF10" }}
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            />

            {/* Pulsing glow */}
            <motion.div
              className="absolute inset-[-6px] rounded-[1.2rem] pointer-events-none"
              animate={{
                boxShadow: [
                  "0 0 0 0 #00E5FF15",
                  "0 0 0 8px #00E5FF00",
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={isLogin ? "login-title" : "signup-title"}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="text-center mt-4"
            >
              <h1 className="text-lg font-bold" style={{ color: "#ffffffee" }}>
                {isInstitutionDomain && institution
                  ? (isLogin ? `Welcome to ${institution.name}` : `Join ${institution.name}`)
                  : (isLogin ? "Welcome back" : "Join ACRY")}
              </h1>
              <p className="text-[11px] mt-0.5" style={{ color: "#ffffff45" }}>
                {isLogin ? "Sign in to your AI Second Brain" : "Build your AI-powered study system"}
              </p>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Auth Method Tabs (only in login mode) */}
        {isLogin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.22 }}
            className="flex gap-1.5 mx-5 mb-2 relative z-10 p-1 rounded-xl"
            style={{ background: "#ffffff06", border: "1px solid #ffffff08" }}
          >
            <button
              onClick={() => { setAuthMethod("password"); setOtpSent(false); setOtpCode(["","","","","",""]); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                background: authMethod === "password" ? "#ffffff10" : "transparent",
                color: authMethod === "password" ? "#ffffffcc" : "#ffffff40",
                border: authMethod === "password" ? "1px solid #ffffff15" : "1px solid transparent",
              }}
            >
              <Lock className="w-3 h-3" />
              Password
            </button>
            <button
              onClick={() => setAuthMethod("otp")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                background: authMethod === "otp" ? "#ffffff10" : "transparent",
                color: authMethod === "otp" ? "#ffffffcc" : "#ffffff40",
                border: authMethod === "otp" ? "1px solid #ffffff15" : "1px solid transparent",
              }}
            >
              <KeyRound className="w-3 h-3" />
              Email OTP
            </button>
          </motion.div>
        )}

        {/* Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mx-5 rounded-2xl p-4 relative z-10"
          style={{
            background: "#ffffff05",
            border: "1px solid #ffffff0a",
            backdropFilter: "blur(20px)",
          }}
        >
          <AnimatePresence mode="wait">
            {authMethod === "otp" && isLogin ? (
              <motion.div
                key="otp-form"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                {!otpSent ? (
                  <>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "#ffffff30" }} />
                      <input
                        type="email" placeholder="Email address" value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-xl pl-10 pr-3 py-2.5 text-sm placeholder:opacity-40 focus:outline-none transition-all"
                        style={{ background: "#ffffff08", border: "1px solid #ffffff0a", color: "#ffffffdd" }}
                        onFocus={(e) => e.target.style.borderColor = "#00E5FF30"}
                        onBlur={(e) => e.target.style.borderColor = "#ffffff0a"}
                      />
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handleSendOtp}
                      disabled={loading || !email}
                      className="w-full py-2.5 rounded-xl font-semibold text-sm tracking-wide disabled:opacity-50 transition-all"
                      style={{
                        background: "linear-gradient(135deg, #00E5FF, #7C4DFF)",
                        color: "#0B0F1A",
                        boxShadow: "0 0 20px #00E5FF15, 0 0 40px #7C4DFF08",
                      }}
                    >
                      {loading ? "Sending..." : "Send OTP Code"}
                    </motion.button>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] text-center" style={{ color: "#ffffff60" }}>
                      Enter the 6-digit code sent to <span style={{ color: "#00E5FFcc" }}>{email}</span>
                    </p>
                    <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                      {otpCode.map((digit, i) => (
                        <input
                          key={i}
                          ref={(el) => { otpRefs.current[i] = el; }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(i, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(i, e)}
                          className="w-10 h-11 rounded-lg text-center text-base font-semibold focus:outline-none transition-all"
                          style={{
                            background: "#ffffff08",
                            border: digit ? "1px solid #00E5FF40" : "1px solid #ffffff15",
                            color: "#ffffffee",
                            boxShadow: digit ? "0 0 8px #00E5FF10" : "none",
                          }}
                          onFocus={(e) => e.target.style.borderColor = "#00E5FF50"}
                          onBlur={(e) => e.target.style.borderColor = digit ? "#00E5FF40" : "#ffffff15"}
                        />
                      ))}
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handleVerifyOtp}
                      disabled={loading || otpCode.join("").length !== 6}
                      className="w-full py-2.5 rounded-xl font-semibold text-sm tracking-wide disabled:opacity-50 transition-all"
                      style={{
                        background: "linear-gradient(135deg, #00E5FF, #7C4DFF)",
                        color: "#0B0F1A",
                        boxShadow: "0 0 20px #00E5FF15, 0 0 40px #7C4DFF08",
                      }}
                    >
                      {loading ? "Verifying..." : "Verify & Sign In"}
                    </motion.button>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => { setOtpSent(false); setOtpCode(["","","","","",""]); }}
                        className="text-[10px] hover:underline" style={{ color: "#ffffff40" }}
                      >
                        ← Change email
                      </button>
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={loading}
                        className="text-[10px] hover:underline disabled:opacity-40" style={{ color: "#00E5FF80" }}
                      >
                        Resend code
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            ) : (
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
                <motion.div className="relative" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "#ffffff30" }} />
                  <input
                    type="text" placeholder="Display name" value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded-xl pl-10 pr-3 py-2.5 text-sm placeholder:opacity-40 focus:outline-none transition-all"
                    style={{ background: "#ffffff08", border: "1px solid #ffffff0a", color: "#ffffffdd" }}
                    onFocus={(e) => e.target.style.borderColor = "#00E5FF30"}
                    onBlur={(e) => e.target.style.borderColor = "#ffffff0a"}
                    required
                  />
                </motion.div>
              )}
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "#ffffff30" }} />
                <input
                  type="email" placeholder="Email address" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl pl-10 pr-3 py-2.5 text-sm placeholder:opacity-40 focus:outline-none transition-all"
                  style={{ background: "#ffffff08", border: "1px solid #ffffff0a", color: "#ffffffdd" }}
                  onFocus={(e) => e.target.style.borderColor = "#00E5FF30"}
                  onBlur={(e) => e.target.style.borderColor = "#ffffff0a"}
                  required
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "#ffffff30" }} />
                <input
                  type={showPassword ? "text" : "password"} placeholder="Password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl pl-10 pr-10 py-2.5 text-sm placeholder:opacity-40 focus:outline-none transition-all"
                  style={{ background: "#ffffff08", border: "1px solid #ffffff0a", color: "#ffffffdd" }}
                  onFocus={(e) => e.target.style.borderColor = "#00E5FF30"}
                  onBlur={(e) => e.target.style.borderColor = "#ffffff0a"}
                  required minLength={6}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: "#ffffff30" }}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              {isLogin && (
                <div className="flex justify-end">
                  <button type="button" onClick={handleForgotPassword}
                    className="text-[10px] hover:underline" style={{ color: "#00E5FF80" }}
                  >
                    Forgot password?
                  </button>
                </div>
              )}
              <motion.button
                whileTap={{ scale: 0.97 }}
                type="submit" disabled={loading}
                className="w-full py-2.5 rounded-xl font-semibold text-sm tracking-wide disabled:opacity-50 transition-all"
                style={{
                  background: "linear-gradient(135deg, #00E5FF, #7C4DFF)",
                  color: "#0B0F1A",
                  boxShadow: "0 0 20px #00E5FF15, 0 0 40px #7C4DFF08",
                }}
              >
                {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
              </motion.button>
            </motion.form>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Divider */}
        <motion.div
          className="flex items-center gap-3 mx-5 my-3 relative z-10"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
        >
          <div className="flex-1 h-px" style={{ background: "#ffffff0a" }} />
          <span className="text-[10px]" style={{ color: "#ffffff30" }}>or continue with</span>
          <div className="flex-1 h-px" style={{ background: "#ffffff0a" }} />
        </motion.div>

        {/* Social buttons */}
        <motion.div
          className="flex gap-2.5 mx-5 relative z-10"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        >
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={async () => {
              try {
                setLoading(true);
                const { error } = await lovable.auth.signInWithOAuth("google", {
                  redirect_uri: window.location.origin,
                });
                if (error) throw error;
              } catch (error: any) {
                toast({ title: "Error", description: error.message || String(error), variant: "destructive" });
              } finally {
                setLoading(false);
              }
            }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: "#ffffff06",
              border: "1px solid #ffffff0a",
              color: "#ffffffcc",
            }}
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
              const { error } = await lovable.auth.signInWithOAuth("apple", {
                redirect_uri: window.location.origin,
              });
              if (error) toast({ title: "Error", description: String(error), variant: "destructive" });
            }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: "#ffffff06",
              border: "1px solid #ffffff0a",
              color: "#ffffffcc",
            }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            Apple
          </motion.button>
        </motion.div>

        {/* Toggle — pinned to bottom */}
        <div className="mt-auto pb-8 pt-3 relative z-10">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center text-xs"
            style={{ color: "#ffffff40" }}
          >
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button onClick={() => setIsLogin(!isLogin)}
              className="font-medium hover:underline" style={{ color: "#00E5FF" }}
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </motion.p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
