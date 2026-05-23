import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Mail, Lock, Smartphone, MessageSquare, ArrowLeft, ShieldCheck, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { AmbCard, AMB, NeonButton, LiveDot, HudCorners } from "./ui/primitives";

type Tab = "mobile" | "email" | "magic";
type Channel = "sms" | "whatsapp";

export function AmbassadorSignInGate() {
  const [tab, setTab] = useState<Tab>("mobile");

  return (
    <div className="grid min-h-screen place-items-center px-4 py-8">
      <AmbCard className="relative w-full max-w-md p-7" glow={AMB.cyan} hud>
        {/* Brand */}
        <div className="mb-4 flex items-center gap-3">
          <div className="relative">
            <motion.div
              className="absolute -inset-1 rounded-2xl opacity-70"
              style={{ background: `conic-gradient(from 0deg, ${AMB.cyan}, ${AMB.amber}, ${AMB.purple}, ${AMB.cyan})`, filter: "blur(5px)" }}
              animate={{ rotate: 360 }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            />
            <div
              className="relative grid h-10 w-10 place-items-center rounded-xl"
              style={{ background: `linear-gradient(135deg, ${AMB.cyan}, ${AMB.amber})`, boxShadow: `0 6px 20px -6px ${AMB.cyan}` }}
            >
              <Sparkles className="h-4 w-4" style={{ color: "#1a0726" }} />
            </div>
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold" style={{ color: AMB.text, fontFamily: "'Space Grotesk', sans-serif" }}>
              ACRY Ambassador
            </div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.24em]" style={{ color: AMB.amber }}>
              AI Student OS
            </div>
          </div>
          <div className="ml-auto">
            <LiveDot color={AMB.cyan} label="Secure" />
          </div>
        </div>

        <h2 className="text-2xl font-bold" style={{ color: AMB.text, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}>
          Enter the Command Bay
        </h2>
        <p className="mt-1 text-xs" style={{ color: AMB.mute }}>
          Sign in with the channel you applied through. Approved ambassadors unlock the dashboard instantly.
        </p>

        {/* Tab switcher */}
        <div
          className="mt-5 grid grid-cols-3 gap-1 rounded-xl border p-1"
          style={{ borderColor: AMB.border, background: "rgba(0,0,0,0.25)" }}
        >
          <TabBtn active={tab === "mobile"} onClick={() => setTab("mobile")} icon={<Smartphone className="h-3.5 w-3.5" />}>
            Mobile OTP
          </TabBtn>
          <TabBtn active={tab === "email"} onClick={() => setTab("email")} icon={<Lock className="h-3.5 w-3.5" />}>
            Email
          </TabBtn>
          <TabBtn active={tab === "magic"} onClick={() => setTab("magic")} icon={<Mail className="h-3.5 w-3.5" />}>
            Magic Link
          </TabBtn>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="mt-5"
          >
            {tab === "mobile" && <MobilePanel />}
            {tab === "email" && <EmailPanel />}
            {tab === "magic" && <MagicPanel />}
          </motion.div>
        </AnimatePresence>

        {/* Divider */}
        <div className="my-5 flex items-center gap-2">
          <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, transparent, ${AMB.border}, transparent)` }} />
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: AMB.mute }}>
            or continue with
          </span>
          <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, transparent, ${AMB.border}, transparent)` }} />
        </div>

        <GoogleButton />

        <div className="mt-5 flex items-center justify-center gap-1.5 text-[10px]" style={{ color: AMB.mute }}>
          <ShieldCheck className="h-3 w-3" style={{ color: AMB.emerald }} />
          End-to-end encrypted · Trusted by 1,200+ campus leaders
        </div>

        <div className="mt-3 text-center text-xs" style={{ color: AMB.mute }}>
          Not yet an ambassador?{" "}
          <Link to="/campus-ambassador" style={{ color: AMB.cyan }} className="font-semibold">
            Apply here →
          </Link>
        </div>
      </AmbCard>
    </div>
  );
}

/* ────────── Tab pill ────────── */
function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold transition-all"
      style={{
        background: active ? `linear-gradient(135deg, ${AMB.cyan}26, ${AMB.amber}14)` : "transparent",
        color: active ? AMB.text : AMB.mute,
        border: `1px solid ${active ? `${AMB.cyan}55` : "transparent"}`,
        boxShadow: active ? `0 4px 14px -6px ${AMB.cyan}` : "none",
      }}
    >
      <span style={{ color: active ? AMB.amber : AMB.mute }}>{icon}</span>
      {children}
    </button>
  );
}

/* ────────── Inputs ────────── */
function HudInput({
  icon,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-2 rounded-xl border px-3 py-2.5"
      style={{ borderColor: AMB.border, background: "rgba(0,0,0,0.25)" }}
    >
      <span style={{ color: AMB.amber }}>{icon}</span>
      <input
        {...rest}
        className="w-full bg-transparent text-sm outline-none placeholder:text-[color:var(--amb-mute)]"
        style={{ color: AMB.text, ["--amb-mute" as any]: AMB.mute }}
      />
    </div>
  );
}

/* ────────── Mobile OTP panel (MSG91) ────────── */
function MobilePanel() {
  const [channel, setChannel] = useState<Channel>("sms");
  const [mobile, setMobile] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const fullMobile = `91${mobile.replace(/\D/g, "")}`;
  const isValidMobile = mobile.replace(/\D/g, "").length === 10;

  const sendOtp = async () => {
    if (!isValidMobile) return toast.error("Enter a valid 10-digit mobile");
    setLoading(true);
    try {
      const action = channel === "whatsapp" ? "send_whatsapp" : "send";
      const { data, error } = await supabase.functions.invoke("msg91-otp", {
        body: { action, mobile: fullMobile },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setOtpSent(true);
      toast.success(`Code sent via ${channel === "whatsapp" ? "WhatsApp" : "SMS"}`);
      setTimeout(() => otpRefs.current[0]?.focus(), 80);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    const code = otp.join("");
    if (code.length !== 4) return toast.error("Enter the 4-digit code");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("msg91-otp", {
        body: { action: "verify", mobile: fullMobile, otp: code },
      });
      if (error) throw error;
      if (!data?.verified) throw new Error(data?.message || "Verification failed");

      if (data?.access_token && data?.refresh_token) {
        const { error: sErr } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        if (sErr) throw sErr;
      } else if (data?.token_hash) {
        const { error: vErr } = await supabase.auth.verifyOtp({
          token_hash: data.token_hash,
          type: data?.verification_type || "magiclink",
        });
        if (vErr) throw vErr;
      } else {
        throw new Error("Missing session payload");
      }
      toast.success("Welcome, Ambassador");
      // useAmbassador hook reacts to auth state change automatically
    } catch (e: any) {
      toast.error(e.message ?? "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  if (!otpSent) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <ChannelBtn active={channel === "sms"} onClick={() => setChannel("sms")} color={AMB.cyan} icon={<Smartphone className="h-3.5 w-3.5" />}>
            SMS
          </ChannelBtn>
          <ChannelBtn active={channel === "whatsapp"} onClick={() => setChannel("whatsapp")} color="#25D366" icon={<MessageSquare className="h-3.5 w-3.5" />}>
            WhatsApp
          </ChannelBtn>
        </div>

        <div
          className="flex items-center gap-2 rounded-xl border px-3 py-2.5"
          style={{ borderColor: AMB.border, background: "rgba(0,0,0,0.25)" }}
        >
          <span className="select-none border-r pr-2 text-sm font-semibold" style={{ color: AMB.amber, borderColor: AMB.border }}>
            +91
          </span>
          <input
            inputMode="numeric"
            maxLength={10}
            placeholder="98765 43210"
            value={mobile}
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
            className="w-full bg-transparent text-sm outline-none placeholder:opacity-50"
            style={{ color: AMB.text }}
          />
        </div>

        <NeonButton onClick={sendOtp} disabled={loading || !isValidMobile} className="w-full">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Transmitting…" : `Send code via ${channel === "whatsapp" ? "WhatsApp" : "SMS"}`}
        </NeonButton>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => {
          setOtpSent(false);
          setOtp(["", "", "", ""]);
        }}
        className="flex items-center gap-1 text-[11px]"
        style={{ color: AMB.mute }}
      >
        <ArrowLeft className="h-3 w-3" /> Change number
      </button>
      <div className="text-xs" style={{ color: AMB.mute }}>
        Code sent to <span style={{ color: AMB.cyan }}>+{fullMobile}</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {otp.map((d, i) => (
          <input
            key={i}
            ref={(el) => (otpRefs.current[i] = el)}
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 1);
              const next = [...otp];
              next[i] = v;
              setOtp(next);
              if (v && i < 3) otpRefs.current[i + 1]?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
            }}
            className="h-12 w-full rounded-xl border bg-black/30 text-center text-lg font-black outline-none"
            style={{
              borderColor: d ? AMB.cyan : AMB.border,
              color: AMB.text,
              fontFamily: "'Space Grotesk', sans-serif",
              boxShadow: d ? `0 0 14px -4px ${AMB.cyan}` : "none",
            }}
          />
        ))}
      </div>
      <NeonButton onClick={verifyOtp} disabled={loading || otp.join("").length !== 4} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        {loading ? "Verifying…" : "Verify & enter"}
      </NeonButton>
    </div>
  );
}

function ChannelBtn({
  active,
  onClick,
  icon,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all"
      style={{
        background: active ? `${color}22` : "rgba(0,0,0,0.25)",
        color: active ? color : AMB.mute,
        border: `1px solid ${active ? `${color}66` : AMB.border}`,
        boxShadow: active ? `0 4px 14px -6px ${color}` : "none",
      }}
    >
      {icon} {children}
    </button>
  );
}

/* ────────── Email + password panel ────────── */
function EmailPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) return toast.error("Email and password required");
    if (mode === "up" && password.length < 8) return toast.error("Password needs 8+ chars");
    setLoading(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/ambassador` },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <HudInput icon={<Mail className="h-4 w-4" />} type="email" placeholder="you@college.edu" value={email} onChange={(e) => setEmail(e.target.value)} />
      <HudInput icon={<Lock className="h-4 w-4" />} type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
      <NeonButton onClick={submit} disabled={loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        {loading ? "…" : mode === "in" ? "Sign in" : "Create account"}
      </NeonButton>
      <button
        onClick={() => setMode((m) => (m === "in" ? "up" : "in"))}
        className="block w-full text-center text-[11px]"
        style={{ color: AMB.mute }}
      >
        {mode === "in" ? "New here? Create an account →" : "Have an account? Sign in →"}
      </button>
    </div>
  );
}

/* ────────── Magic link panel ────────── */
function MagicPanel() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const sendLink = async () => {
    if (!email) return toast.error("Enter your email");
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/ambassador` },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Magic link sent — check your email");
  };

  return (
    <div className="space-y-3">
      <HudInput icon={<Mail className="h-4 w-4" />} type="email" placeholder="you@college.edu" value={email} onChange={(e) => setEmail(e.target.value)} />
      <NeonButton onClick={sendLink} disabled={loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {loading ? "Sending…" : "Send magic link"}
      </NeonButton>
      <p className="text-center text-[10px]" style={{ color: AMB.mute }}>
        We'll email a one-tap sign-in link valid for 1 hour.
      </p>
    </div>
  );
}

/* ────────── Google OAuth (Lovable Cloud managed) ────────── */
function GoogleButton() {
  const [loading, setLoading] = useState(false);
  const onClick = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/ambassador`,
      });
      if (result.error) {
        toast.error("Google sign-in failed");
        setLoading(false);
        return;
      }
      if (result.redirected) return; // browser is navigating
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      toast.error(e.message ?? "Google sign-in failed");
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-50"
      style={{
        background: "rgba(255,244,234,0.96)",
        color: "#1a0726",
        borderColor: AMB.border,
        boxShadow: `0 6px 18px -8px ${AMB.amber}`,
      }}
    >
      <HudCorners color={AMB.amber} size={10} />
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
        </svg>
      )}
      Continue with Google
    </button>
  );
}
