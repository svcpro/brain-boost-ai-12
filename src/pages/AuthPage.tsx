import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { ArrowLeft, Phone, Shield, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SplashScreen from "@/components/splash/SplashScreen";
import { useInstitution } from "@/contexts/InstitutionContext";

type AuthMethod = "mobile" | "whatsapp";

/* ─── Animated SMS Icon ─── */
const AnimatedSmsIcon = ({ active }: { active: boolean }) => (
  <motion.div className="relative flex items-center justify-center w-8 h-8">
    <motion.div
      className="absolute inset-0 rounded-xl"
      animate={{
        boxShadow: active
          ? ["0 0 12px #00E5FF40, 0 0 24px #00E5FF15", "0 0 20px #00E5FF60, 0 0 40px #00E5FF25", "0 0 12px #00E5FF40, 0 0 24px #00E5FF15"]
          : "0 0 0px transparent",
        background: active ? "#00E5FF15" : "#ffffff08",
      }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.svg
      width="20" height="20" viewBox="0 0 24 24" fill="none"
      animate={{ scale: active ? [1, 1.08, 1] : 1 }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    >
      <motion.rect
        x="2" y="4" width="20" height="14" rx="3"
        stroke={active ? "#00E5FF" : "#ffffff50"}
        strokeWidth="1.5" fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1, stroke: active ? "#00E5FF" : "#ffffff50" }}
        transition={{ duration: 0.6 }}
      />
      <motion.path
        d="M2 7l10 5 10-5"
        stroke={active ? "#00E5FF" : "#ffffff40"}
        strokeWidth="1.5" fill="none" strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      />
      {active && (
        <>
          <motion.circle cx="19" cy="6" r="1" fill="#00E5FF"
            animate={{ scale: [0, 1.2, 0.8, 1], opacity: [0, 1] }}
            transition={{ duration: 0.4, delay: 0.5 }}
          />
          <motion.circle cx="19" cy="6" r="3" fill="none" stroke="#00E5FF"
            initial={{ scale: 0, opacity: 0.6 }}
            animate={{ scale: [0, 2], opacity: [0.6, 0] }}
            transition={{ duration: 1, repeat: Infinity, delay: 0.8 }}
          />
        </>
      )}
    </motion.svg>
  </motion.div>
);

/* ─── Animated WhatsApp Icon ─── */
const AnimatedWhatsAppIcon = ({ active }: { active: boolean }) => (
  <motion.div className="relative flex items-center justify-center w-8 h-8">
    <motion.div
      className="absolute inset-0 rounded-xl"
      animate={{
        boxShadow: active
          ? ["0 0 12px #25D36640, 0 0 24px #25D36615", "0 0 20px #25D36660, 0 0 40px #25D36625", "0 0 12px #25D36640, 0 0 24px #25D36615"]
          : "0 0 0px transparent",
        background: active ? "#25D36615" : "#ffffff08",
      }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.svg
      width="20" height="20" viewBox="0 0 24 24" fill="none"
      animate={{ scale: active ? [1, 1.08, 1] : 1 }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    >
      <motion.path
        d="M12 2C6.48 2 2 6.26 2 11.35c0 1.78.53 3.44 1.45 4.87L2 22l5.94-1.56A10.1 10.1 0 0012 21.7c5.52 0 10-4.26 10-9.35S17.52 2 12 2z"
        stroke={active ? "#25D366" : "#ffffff50"}
        strokeWidth="1.5" fill={active ? "#25D36615" : "none"}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6 }}
      />
      <motion.path
        d="M16.5 14.2c-.5.7-1.3 1.2-2.2 1.1-.9-.1-2.3-.8-3.3-1.8s-1.7-2.4-1.8-3.3c-.1-.9.4-1.7 1.1-2.2.3-.2.7-.1.9.2l.7 1.1c.2.3.1.6-.1.8l-.3.3c-.1.1-.1.3 0 .4.3.5.8 1.1 1.3 1.5.4.3.9.6 1.4.8.2.1.3 0 .4-.1l.3-.3c.2-.2.5-.3.8-.1l1.1.7c.3.2.4.6.2.9z"
        stroke={active ? "#25D366" : "#ffffff40"}
        strokeWidth="1" fill={active ? "#25D36640" : "none"}
        initial={{ pathLength: 0, scale: 0.8 }}
        animate={{ pathLength: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      />
      {active && (
        <motion.circle cx="18" cy="5" r="2.5" fill="#25D366"
          animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
    </motion.svg>
  </motion.div>
);

/* ─── Progress Bar (on submit) ─── */
const OtpProgressBar = ({ color }: { color: string }) => (
  <motion.div className="w-full h-1 rounded-full overflow-hidden mt-3" style={{ background: "#ffffff08" }}>
    <motion.div
      className="h-full rounded-full"
      style={{ background: `linear-gradient(90deg, ${color}, ${color}80)` }}
      initial={{ width: "0%" }}
      animate={{ width: ["0%", "30%", "60%", "85%", "95%"] }}
      transition={{ duration: 3, times: [0, 0.2, 0.5, 0.8, 1], ease: "easeOut" }}
    />
  </motion.div>
);

/* ─── Floating Particle ─── */
const FloatingParticle = ({ delay, x, y, size, color }: { delay: number; x: string; y: string; size: number; color: string }) => (
  <motion.div
    className="absolute rounded-full pointer-events-none"
    style={{ left: x, top: y, width: size, height: size, background: color }}
    animate={{ y: [0, -20, 0], opacity: [0.05, 0.3, 0.05], scale: [1, 1.4, 1] }}
    transition={{ duration: 5 + delay * 2, delay, repeat: Infinity, ease: "easeInOut" }}
  />
);

/* ─── Security Badge ─── */
const SecurityBadge = () => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.8 }}
    className="flex items-center justify-center gap-1.5 mt-4"
  >
    <motion.div
      animate={{ rotate: [0, 5, -5, 0] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
    >
      <Shield className="w-3 h-3" style={{ color: "#00FF9450" }} />
    </motion.div>
    <span className="text-[9px] tracking-wider uppercase font-medium" style={{ color: "#ffffff25" }}>
      256-bit encrypted · Secure Login
    </span>
  </motion.div>
);

const AuthPage = () => {
  const [searchParams] = useSearchParams();
  const showSplashParam = searchParams.get("splash") === "1";
  const [showSplash, setShowSplash] = useState(showSplashParam);
  // Optional redirect target after a successful login (used by /myrank gate, etc.).
  // Only allow same-origin paths to prevent open-redirect attacks.
  const rawRedirect = searchParams.get("redirect");
  const redirectTo =
    rawRedirect && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/app";

  // Persist the redirect intent so it survives the onboarding bounce that
  // happens for new users (AuthPage → /app → ProtectedRoute → /onboarding →
  // /app). OnboardingPage and ProtectedRoute both consume this key on success.
  useEffect(() => {
    if (rawRedirect && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")) {
      try { sessionStorage.setItem("post_login_redirect", rawRedirect); } catch {}
    }
  }, [rawRedirect]);
  const [isLogin, setIsLogin] = useState(true);
  const [authMethod, setAuthMethod] = useState<AuthMethod>("mobile");
  const [mobile, setMobile] = useState("");
  const [countryCode, setCountryCode] = useState("91");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState(["", "", "", ""]);
  const [inputFocused, setInputFocused] = useState(false);
  const [verifySuccess, setVerifySuccess] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { institution, isInstitutionDomain } = useInstitution();

  // If user is already authenticated when they LAND on /auth (e.g. via browser
  // Back from /onboarding, or refresh after logging in), skip the OTP screen so
  // they aren't asked to re-verify. We deliberately only check the existing
  // session ONCE on mount — we do NOT subscribe to onAuthStateChange here,
  // because that would race with handleVerifyMobileOtp's own navigate("/app")
  // call (firing SIGNED_IN immediately after setSession), causing a double
  // navigation that occasionally produces a blank /app screen.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        // Always send through /app so ProtectedRoute can enforce onboarding.
        // If a `redirect=` was supplied, sessionStorage has already stored it
        // and OnboardingPage / ProtectedRoute will honor it after onboarding.
        navigate("/app", { replace: true });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const accentColor = authMethod === "whatsapp" ? "#25D366" : "#00E5FF";
  const fullMobile = `${countryCode}${mobile.replace(/\D/g, "")}`;

  /* ═══ WhatsApp OTP ═══ */
  const handleSendWhatsAppOtp = async () => {
    if (!mobile || mobile.replace(/\D/g, "").length < 10) {
      toast({ title: "Enter a valid mobile number", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("msg91-otp", {
        body: { action: "send_whatsapp", mobile: fullMobile },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setOtpSent(true);
      toast({ title: "OTP Sent!", description: `Code sent to WhatsApp +${fullMobile}` });
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  /* ═══ SMS OTP ═══ */
  const handleSendMobileOtp = async () => {
    if (!mobile || mobile.replace(/\D/g, "").length < 10) {
      toast({ title: "Enter a valid mobile number", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("msg91-otp", {
        body: { action: "send", mobile: fullMobile },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setOtpSent(true);
      toast({ title: "OTP Sent!", description: `Code sent to +${fullMobile}` });
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  /* ═══ Verify ═══ */
  const handleVerifyMobileOtp = async () => {
    const otp = otpCode.join("");
    if (otp.length !== 4) {
      toast({ title: "Enter the full 4-digit code", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("msg91-otp", {
        body: { action: "verify", mobile: fullMobile, otp },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (!data?.verified) {
        throw new Error(data?.message || "Verification failed");
      }

      if (data?.access_token && data?.refresh_token) {
        const { error: sessionErr } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        if (sessionErr) throw sessionErr;
      } else if (data?.token_hash) {
        const { error: verifyErr } = await supabase.auth.verifyOtp({
          token_hash: data.token_hash,
          type: data?.verification_type || "magiclink",
        });
        if (verifyErr) throw verifyErr;
      } else {
        throw new Error("Missing session payload from verification response");
      }

      setVerifySuccess(true);
      // Always send through /app so ProtectedRoute enforces onboarding for new
      // users. The original `redirect=` target is stored in sessionStorage and
      // honored by OnboardingPage / ProtectedRoute after onboarding completes.
      setTimeout(() => navigate("/app"), 800);
    } catch (error: any) {
      toast({ title: "Verification Failed", description: error.message, variant: "destructive" });
      setOtpCode(["", "", "", ""]);
    } finally {
      setLoading(false);
    }
  };

  /* ═══ Resend ═══ */
  const handleResend = async () => {
    setLoading(true);
    try {
      const action = authMethod === "whatsapp" ? "resend_whatsapp" : "resend";
      const { data, error } = await supabase.functions.invoke("msg91-otp", {
        body: { action, mobile: fullMobile },
      });
      if (error) throw error;
      toast({ title: "OTP Resent", description: data?.message || `Check your ${authMethod === "whatsapp" ? "WhatsApp" : "phone"}` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = authMethod === "whatsapp" ? handleSendWhatsAppOtp : handleSendMobileOtp;

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...otpCode];
    newCode[index] = value.slice(-1);
    setOtpCode(newCode);
    if (value && index < 3) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    const newCode = [...otpCode];
    for (let i = 0; i < 4; i++) newCode[i] = pasted[i] || "";
    setOtpCode(newCode);
    otpRefs.current[Math.min(pasted.length, 3)]?.focus();
  };

  const resetOtp = () => { setOtpSent(false); setOtpCode(["", "", "", ""]); };

  const isValidMobile = mobile.replace(/\D/g, "").length >= 10;

  if (showSplash) {
    return (
      <SplashScreen onComplete={() => { sessionStorage.setItem("acry_splash_seen", "1"); setShowSplash(false); }} />
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#0B0E1A" }}>
      <div className="relative w-full max-w-[430px] h-[100dvh] overflow-hidden flex flex-col md:h-[min(95dvh,920px)] md:rounded-[2.5rem] md:border md:border-border/40 md:shadow-[0_25px_80px_-12px_hsl(0_0%_0%/0.6)]">

        {/* Ambient Background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Top orb */}
          <motion.div
            className="absolute w-[350px] h-[350px] rounded-full"
            style={{ top: "-15%", left: "-25%", background: `radial-gradient(circle, ${accentColor}08 0%, transparent 70%)` }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Bottom orb */}
          <motion.div
            className="absolute w-[280px] h-[280px] rounded-full"
            style={{ bottom: "0%", right: "-20%", background: "radial-gradient(circle, #7C4DFF06 0%, transparent 70%)" }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          />
          {/* Center glow reacting to method */}
          <motion.div
            className="absolute w-[200px] h-[200px] rounded-full"
            style={{ top: "35%", left: "50%", transform: "translate(-50%, -50%)" }}
            animate={{
              background: authMethod === "whatsapp"
                ? "radial-gradient(circle, #25D36606 0%, transparent 70%)"
                : "radial-gradient(circle, #00E5FF06 0%, transparent 70%)",
              scale: [1, 1.15, 1],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Floating particles */}
          <FloatingParticle delay={0} x="15%" y="20%" size={2} color="#00E5FF" />
          <FloatingParticle delay={1} x="80%" y="15%" size={1.5} color="#7C4DFF" />
          <FloatingParticle delay={2} x="60%" y="70%" size={2} color="#00FF94" />
          <FloatingParticle delay={0.5} x="25%" y="60%" size={1.8} color={accentColor} />
          <FloatingParticle delay={1.5} x="70%" y="40%" size={1.2} color="#00E5FF" />
          <FloatingParticle delay={3} x="40%" y="85%" size={1.5} color="#7C4DFF" />
          <FloatingParticle delay={2.5} x="90%" y="55%" size={1} color="#25D366" />
          <FloatingParticle delay={0.8} x="10%" y="45%" size={1.8} color="#00FF94" />
        </div>

        {/* Back Button */}
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          onClick={() => navigate("/")}
          className="relative z-10 flex items-center gap-1.5 text-xs mt-4 ml-5 self-start"
          style={{ color: "#ffffff40" }}
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </motion.button>

        {/* Logo + Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="flex flex-col items-center mt-6 mb-4 relative z-10"
        >
          {isInstitutionDomain && institution?.logo_url ? (
            <motion.img
              src={institution.logo_url}
              alt={institution.name}
              className="w-16 h-16 rounded-2xl object-contain"
              style={{ background: "#ffffff08", border: "1px solid #ffffff15" }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", bounce: 0.25 }}
            />
          ) : (
            <motion.div
              className="relative"
              initial={{ scale: 0, rotate: -120 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.8, type: "spring", bounce: 0.25 }}
            >
              <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center relative overflow-hidden"
                  style={{
                    background: "linear-gradient(135deg, hsl(228 50% 8%), hsl(228 40% 14%))",
                    border: `1px solid ${accentColor}30`,
                    boxShadow: `0 0 40px ${accentColor}08, 0 0 80px #7C4DFF05`,
                  }}
                >
                  <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
                    <defs>
                      <linearGradient id="aGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#00E5FF" /><stop offset="60%" stopColor="#7C4DFF" /><stop offset="100%" stopColor="#00E5FF" />
                      </linearGradient>
                    </defs>
                    <motion.circle cx="24" cy="24" r="22" stroke="url(#aGrad)" strokeWidth="1" fill="none" opacity="0.3"
                      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 0.3 }}
                    />
                    <motion.path d="M24 8L38 38H10L24 8Z" stroke="url(#aGrad)" strokeWidth="1.8" fill="none" strokeLinejoin="round"
                      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 0.5 }}
                    />
                    <motion.circle cx="24" cy="8" r="1.8" fill="#00E5FF" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.1, type: "spring" }} />
                    <motion.circle cx="10" cy="38" r="1.3" fill="#7C4DFF" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.2, type: "spring" }} />
                    <motion.circle cx="38" cy="38" r="1.3" fill="#7C4DFF" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.3, type: "spring" }} />
                  </svg>
                  {/* Shimmer sweep */}
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
                style={{ border: `1px solid ${accentColor}10` }}
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              />
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={isLogin ? "l" : "s"}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
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

        {/* ─── Method Toggle ─── */}
        {!otpSent && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mx-5 mb-4 relative z-10"
          >
            <div className="flex rounded-2xl p-1 relative" style={{ background: "#ffffff06", border: "1px solid #ffffff08" }}>
              {/* Sliding indicator */}
              <motion.div
                className="absolute top-1 bottom-1 rounded-xl"
                style={{ width: "calc(50% - 4px)" }}
                animate={{
                  left: authMethod === "mobile" ? 4 : "calc(50% + 0px)",
                  background: authMethod === "whatsapp"
                    ? "linear-gradient(135deg, #25D36612, #128C7E10)"
                    : "linear-gradient(135deg, #00E5FF10, #7C4DFF08)",
                  borderColor: authMethod === "whatsapp" ? "#25D36625" : "#00E5FF20",
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />

              {(["mobile", "whatsapp"] as AuthMethod[]).map((method) => (
                <motion.button
                  key={method}
                  onClick={() => { setAuthMethod(method); resetOtp(); }}
                  whileTap={{ scale: 0.96 }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium relative z-10 transition-colors"
                  style={{ color: authMethod === method ? (method === "whatsapp" ? "#25D366" : "#00E5FF") : "#ffffff40" }}
                >
                  {method === "mobile" ? <AnimatedSmsIcon active={authMethod === "mobile"} /> : <AnimatedWhatsAppIcon active={authMethod === "whatsapp"} />}
                  <span>{method === "mobile" ? "SMS" : "WhatsApp"}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ─── Form Card ─── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mx-5 rounded-3xl p-5 relative z-10"
          style={{
            background: "linear-gradient(180deg, #ffffff06 0%, #ffffff03 100%)",
            border: `1px solid ${inputFocused ? `${accentColor}20` : "#ffffff0a"}`,
            backdropFilter: "blur(24px)",
            boxShadow: inputFocused ? `0 0 30px ${accentColor}06` : "none",
            transition: "border-color 0.3s, box-shadow 0.3s",
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`${authMethod}-${otpSent}-${verifySuccess}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              {verifySuccess ? (
                /* ─── Success State ─── */
                <motion.div className="flex flex-col items-center py-6 gap-3">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.2, 1] }}
                    transition={{ duration: 0.5, type: "spring" }}
                  >
                    <CheckCircle2 className="w-14 h-14" style={{ color: "#00FF94" }} />
                  </motion.div>
                  <motion.div
                    className="absolute inset-0 rounded-3xl pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.15, 0] }}
                    transition={{ duration: 1 }}
                    style={{ background: `radial-gradient(circle, #00FF9420 0%, transparent 70%)` }}
                  />
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-sm font-semibold" style={{ color: "#00FF94" }}
                  >
                    Verified Successfully!
                  </motion.p>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-[10px]" style={{ color: "#ffffff40" }}
                  >
                    Redirecting to your dashboard…
                  </motion.p>
                </motion.div>
              ) : !otpSent ? (
                /* ─── Input State ─── */
                <>
                  {authMethod === "whatsapp" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="flex items-center gap-1.5 justify-center"
                    >
                      <motion.div
                        animate={{ scale: [1, 1.15, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#25D366" }} />
                      </motion.div>
                      <span className="text-[10px] font-medium" style={{ color: "#25D366cc" }}>OTP will be sent to your WhatsApp</span>
                    </motion.div>
                  )}

                  {/* Phone input */}
                  <div className="flex gap-2">
                    <motion.div
                      className="relative w-[72px]"
                      whileFocus={{ scale: 1.02 }}
                    >
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "#ffffff50" }}>+</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
                        className="w-full rounded-xl pl-6 pr-2 py-3 text-sm text-center focus:outline-none transition-all"
                        style={{ background: "#ffffff08", border: "1px solid #ffffff0a", color: "#ffffffdd" }}
                        onFocus={(e) => { e.target.style.borderColor = `${accentColor}40`; setInputFocused(true); }}
                        onBlur={(e) => { e.target.style.borderColor = "#ffffff0a"; setInputFocused(false); }}
                      />
                    </motion.div>
                    <div className="relative flex-1">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "#ffffff30" }} />
                      <input
                        type="tel"
                        inputMode="numeric"
                        placeholder="Mobile number"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        className="w-full rounded-xl pl-10 pr-3 py-3 text-sm placeholder:opacity-40 focus:outline-none transition-all"
                        style={{ background: "#ffffff08", border: "1px solid #ffffff0a", color: "#ffffffdd" }}
                        onFocus={(e) => { e.target.style.borderColor = `${accentColor}40`; setInputFocused(true); }}
                        onBlur={(e) => { e.target.style.borderColor = "#ffffff0a"; setInputFocused(false); }}
                      />
                      {/* Validation indicator */}
                      <AnimatePresence>
                        {isValidMobile && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            className="absolute right-3 top-1/2 -translate-y-1/2"
                          >
                            <CheckCircle2 className="w-4 h-4" style={{ color: "#00FF94" }} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Character count */}
                  <div className="flex justify-end px-1">
                    <motion.span
                      className="text-[9px] font-mono"
                      style={{ color: isValidMobile ? "#00FF9460" : "#ffffff20" }}
                      animate={{ color: isValidMobile ? "#00FF9480" : "#ffffff20" }}
                    >
                      {mobile.replace(/\D/g, "").length}/10
                    </motion.span>
                  </div>

                  {/* Submit Button */}
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleSendOtp}
                    disabled={loading || !isValidMobile}
                    className="w-full py-3 rounded-xl font-semibold text-sm tracking-wide disabled:opacity-40 transition-all relative overflow-hidden"
                    style={{
                      background: authMethod === "whatsapp"
                        ? "linear-gradient(135deg, #25D366, #128C7E)"
                        : "linear-gradient(135deg, #00E5FF, #7C4DFF)",
                      color: authMethod === "whatsapp" ? "#ffffff" : "#0B0F1A",
                      boxShadow: isValidMobile
                        ? `0 4px 24px ${accentColor}25, 0 0 48px ${accentColor}10`
                        : "none",
                    }}
                  >
                    {/* Shimmer on hover */}
                    <motion.div
                      className="absolute inset-0"
                      style={{ background: "linear-gradient(90deg, transparent 0%, #ffffff18 50%, transparent 100%)" }}
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                    />
                    <span className="relative z-10">
                      {loading ? "Sending..." : authMethod === "whatsapp" ? "Send OTP via WhatsApp" : "Send OTP Code"}
                    </span>
                  </motion.button>

                  {/* Progress bar while loading */}
                  <AnimatePresence>
                    {loading && <OtpProgressBar color={accentColor} />}
                  </AnimatePresence>
                </>
              ) : (
                /* ─── OTP Verify State ─── */
                <>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[11px] text-center" style={{ color: "#ffffff60" }}
                  >
                    Enter the 4-digit code sent {authMethod === "whatsapp" ? "via WhatsApp " : ""}to{" "}
                    <span style={{ color: `${accentColor}cc` }}>+{fullMobile}</span>
                  </motion.p>

                  {/* OTP Grid */}
                  <div className="flex gap-3 justify-center py-2" onPaste={handleOtpPaste}>
                    {otpCode.map((digit, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="relative"
                      >
                        <input
                          ref={(el) => { otpRefs.current[i] = el; }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(i, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(i, e)}
                          className="w-12 h-14 rounded-xl text-center text-lg font-bold focus:outline-none transition-all"
                          style={{
                            background: digit ? `${accentColor}10` : "#ffffff06",
                            border: digit ? `1.5px solid ${accentColor}50` : "1.5px solid #ffffff12",
                            color: "#ffffffee",
                            boxShadow: digit ? `0 0 12px ${accentColor}15` : "none",
                          }}
                          onFocus={(e) => { e.target.style.borderColor = `${accentColor}60`; e.target.style.boxShadow = `0 0 16px ${accentColor}20`; }}
                          onBlur={(e) => { e.target.style.borderColor = digit ? `${accentColor}50` : "#ffffff12"; e.target.style.boxShadow = digit ? `0 0 12px ${accentColor}15` : "none"; }}
                        />
                        {/* Bottom accent line */}
                        <motion.div
                          className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                          style={{ background: accentColor }}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: digit ? 1 : 0, opacity: digit ? 0.6 : 0 }}
                          transition={{ duration: 0.2 }}
                        />
                      </motion.div>
                    ))}
                  </div>

                  {/* Verify Button */}
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleVerifyMobileOtp}
                    disabled={loading || otpCode.join("").length !== 4}
                    className="w-full py-3 rounded-xl font-semibold text-sm tracking-wide disabled:opacity-40 transition-all relative overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${accentColor}, #7C4DFF)`,
                      color: "#0B0F1A",
                      boxShadow: otpCode.join("").length === 4 ? `0 4px 24px ${accentColor}25` : "none",
                    }}
                  >
                    <motion.div
                      className="absolute inset-0"
                      style={{ background: "linear-gradient(90deg, transparent 0%, #ffffff15 50%, transparent 100%)" }}
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                    />
                    <span className="relative z-10">
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <motion.span
                            className="inline-block w-4 h-4 rounded-full border-2 border-t-transparent"
                            style={{ borderColor: "#0B0F1A40", borderTopColor: "transparent" }}
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                          />
                          Verifying...
                        </span>
                      ) : "Verify & Sign In"}
                    </span>
                  </motion.button>

                  {/* Loading progress */}
                  <AnimatePresence>
                    {loading && <OtpProgressBar color={accentColor} />}
                  </AnimatePresence>

                  {/* Bottom actions */}
                  <div className="flex items-center justify-between pt-1">
                    <button onClick={resetOtp} className="text-[10px] hover:underline" style={{ color: "#ffffff35" }}>
                      ← Change number
                    </button>
                    <button onClick={handleResend} disabled={loading} className="text-[10px] hover:underline disabled:opacity-40" style={{ color: `${accentColor}80` }}>
                      Resend code
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Security Badge */}
        <SecurityBadge />

        {/* Bottom spacer */}
        <div className="mt-auto pb-8" />
      </div>
    </div>
  );
};

export default AuthPage;
