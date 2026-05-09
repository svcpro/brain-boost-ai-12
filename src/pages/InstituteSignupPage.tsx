import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, Building2, MessageSquare, Smartphone, ArrowLeft, ShieldCheck,
  GraduationCap, Crown, BookOpen, School, ChevronRight, CheckCircle2,
} from "lucide-react";

type Channel = "sms" | "whatsapp";
type Step = "details" | "otp" | "verify" | "done";

const TYPES = [
  { key: "coaching", label: "Coaching", icon: BookOpen },
  { key: "school", label: "School", icon: School },
  { key: "university", label: "University", icon: Crown },
  { key: "enterprise", label: "Institute", icon: Building2 },
];

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);

export default function InstituteSignupPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("details");
  const [channel, setChannel] = useState<Channel>("sms");
  const accent = channel === "whatsapp" ? "#25D366" : "#00E5FF";

  // Institute details
  const [name, setName] = useState("");
  const [type, setType] = useState("coaching");
  const [city, setCity] = useState("");
  const [branch, setBranch] = useState("");
  const [adminName, setAdminName] = useState("");

  // OTP
  const [countryCode] = useState("91");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [loading, setLoading] = useState(false);
  const fullMobile = `${countryCode}${mobile.replace(/\D/g, "")}`;
  const isValidMobile = mobile.replace(/\D/g, "").length >= 10;

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const detailsValid = name.trim().length >= 3 && adminName.trim().length >= 2 && city.trim().length >= 2;

  const sendOtp = async () => {
    if (!isValidMobile) {
      toast({ title: "Enter a valid mobile number", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const action = channel === "whatsapp" ? "send_whatsapp" : "send";
      const { data, error } = await supabase.functions.invoke("msg91-otp", {
        body: { action, mobile: fullMobile },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setStep("verify");
      setResendCooldown(30);
      toast({ title: "OTP sent", description: `Sent via ${channel === "whatsapp" ? "WhatsApp" : "SMS"} to +${fullMobile}` });
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (e: any) {
      toast({ title: "Failed to send OTP", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (resendCooldown > 0 || loading) return;
    setLoading(true);
    try {
      const action = channel === "whatsapp" ? "resend_whatsapp" : "resend";
      const { data, error } = await supabase.functions.invoke("msg91-otp", {
        body: { action, mobile: fullMobile },
      });
      if (error) throw error;
      setResendCooldown(30);
      toast({ title: "OTP resent" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const verifyAndCreate = async () => {
    const code = otp.join("");
    if (code.length !== 4) {
      toast({ title: "Enter the full 4-digit code", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      // 1) Verify OTP & sign in
      const { data, error } = await supabase.functions.invoke("msg91-otp", {
        body: { action: "verify", mobile: fullMobile, otp: code },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
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

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Session not established");

      // 2) Block if user already owns an institute
      const { data: existing } = await supabase
        .from("institutions")
        .select("id, slug")
        .eq("admin_user_id", user.id)
        .maybeSingle();

      if (existing) {
        toast({ title: "You already own an institute", description: "Redirecting to your panel…" });
        setTimeout(() => navigate("/institute", { replace: true }), 600);
        return;
      }

      // 3) Build a unique slug
      const baseSlug = slugify(name) || "institute";
      let slug = baseSlug;
      for (let i = 0; i < 5; i++) {
        const { data: clash } = await supabase
          .from("institutions").select("id").eq("slug", slug).maybeSingle();
        if (!clash) break;
        slug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
      }

      // 4) Update profile display name (best effort)
      await supabase.from("profiles").update({ display_name: adminName }).eq("id", user.id);

      // 5) Create institution
      const { error: insErr } = await supabase.from("institutions").insert({
        name: name.trim(),
        slug,
        type,
        city: city.trim() || null,
        branch: branch.trim() || null,
        admin_user_id: user.id,
        is_active: true,
        primary_color: "#6366f1",
        secondary_color: "#8b5cf6",
        source: "self_signup",
      } as any);
      if (insErr) throw insErr;

      setStep("done");
      toast({ title: "Institute created 🎉", description: "Welcome aboard!" });
      setTimeout(() => navigate("/institute", { replace: true }), 1200);
    } catch (e: any) {
      toast({ title: "Signup failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (i: number, v: string) => {
    if (v && !/^\d$/.test(v)) return;
    const next = [...otp];
    next[i] = v;
    setOtp(next);
    if (v && i < 3) otpRefs.current[i + 1]?.focus();
  };

  const handleOtpKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  };

  return (
    <div
      className="min-h-[100dvh] w-full flex items-center justify-center px-4 py-8"
      style={{
        background: "radial-gradient(ellipse 80% 60% at 50% 0%, hsl(220 60% 12%) 0%, #0B0F1A 60%)",
      }}
    >
      <div
        className="w-full max-w-[460px] rounded-3xl border p-6 backdrop-blur-xl"
        style={{
          background: "linear-gradient(145deg, rgba(15,20,35,.85), rgba(8,12,22,.95))",
          borderColor: `${accent}30`,
          boxShadow: `0 30px 80px -20px ${accent}25, inset 0 1px 0 ${accent}15`,
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => (step === "verify" ? setStep("otp") : step === "otp" ? setStep("details") : navigate("/"))}
            className="text-white/60 hover:text-white p-2 -ml-2"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-white/80 text-xs uppercase tracking-widest">
            <ShieldCheck className="w-4 h-4" style={{ color: accent }} />
            Institute Signup
          </div>
          <div className="w-9" />
        </div>

        <div className="text-center mb-6">
          <div
            className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3"
            style={{
              background: `linear-gradient(135deg, ${accent}25, ${accent}10)`,
              border: `1px solid ${accent}40`,
            }}
          >
            <Building2 className="w-7 h-7" style={{ color: accent }} />
          </div>
          <h1 className="text-2xl font-bold text-white">
            {step === "done" ? "All set!" : "Onboard Your Institute"}
          </h1>
          <p className="text-sm text-white/50 mt-1">
            {step === "details" && "Tell us about your coaching, school or university"}
            {step === "otp" && "Verify your mobile to create your admin account"}
            {step === "verify" && "Enter the 4-digit verification code"}
            {step === "done" && "Redirecting to your institute panel…"}
          </p>
        </div>

        {step === "details" && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-white/40 mb-2">Institute type</label>
              <div className="grid grid-cols-4 gap-2">
                {TYPES.map((t) => {
                  const active = type === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setType(t.key)}
                      className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all"
                      style={{
                        background: active ? `${accent}15` : "rgba(255,255,255,0.03)",
                        border: `1px solid ${active ? `${accent}60` : "rgba(255,255,255,0.06)"}`,
                        color: active ? accent : "rgba(255,255,255,0.5)",
                      }}
                    >
                      <t.icon className="w-4 h-4" />
                      <span className="text-[10px] font-semibold">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Field label="Institute name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Allen Career Institute"
                className="border-0 bg-transparent text-white text-base focus-visible:ring-0"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="City">
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Kota"
                  className="border-0 bg-transparent text-white focus-visible:ring-0"
                />
              </Field>
              <Field label="Branch (optional)">
                <Input
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="Main"
                  className="border-0 bg-transparent text-white focus-visible:ring-0"
                />
              </Field>
            </div>

            <Field label="Your name (admin)">
              <Input
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Full name"
                className="border-0 bg-transparent text-white focus-visible:ring-0"
              />
            </Field>

            <Button
              onClick={() => setStep("otp")}
              disabled={!detailsValid}
              className="w-full h-12 rounded-xl font-semibold text-black"
              style={{
                background: "linear-gradient(135deg, #00E5FF, #00b8d4)",
                boxShadow: `0 10px 30px -10px #00E5FF80`,
              }}
            >
              Continue <ChevronRight className="w-4 h-4 ml-1" />
            </Button>

            <p className="text-[11px] text-white/40 text-center">
              Already have an institute?{" "}
              <Link to="/institute/login" className="text-white/80 hover:text-white underline underline-offset-2">
                Sign in
              </Link>
            </p>
          </div>
        )}

        {step === "otp" && (
          <div className="space-y-4">
            <div
              className="relative grid grid-cols-2 p-1 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div
                className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl transition-all duration-300"
                style={{
                  left: channel === "sms" ? 4 : "calc(50% + 0px)",
                  background:
                    channel === "whatsapp"
                      ? "linear-gradient(135deg, #25D36625, #25D36610)"
                      : "linear-gradient(135deg, #00E5FF25, #00E5FF10)",
                  border: `1px solid ${accent}40`,
                }}
              />
              {(["sms", "whatsapp"] as Channel[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setChannel(c)}
                  className="relative z-10 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors"
                  style={{
                    color: channel === c ? (c === "whatsapp" ? "#25D366" : "#00E5FF") : "rgba(255,255,255,0.4)",
                  }}
                >
                  {c === "sms" ? <Smartphone className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                  {c === "sms" ? "SMS OTP" : "WhatsApp OTP"}
                </button>
              ))}
            </div>

            <Field label="Mobile number">
              <span className="px-3 py-3 text-white/80 border-r border-white/10 text-sm">+{countryCode}</span>
              <Input
                inputMode="numeric"
                placeholder="98765 43210"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                className="border-0 bg-transparent text-white text-base focus-visible:ring-0"
                onKeyDown={(e) => e.key === "Enter" && isValidMobile && sendOtp()}
              />
            </Field>

            <Button
              onClick={sendOtp}
              disabled={!isValidMobile || loading}
              className="w-full h-12 rounded-xl font-semibold text-black"
              style={{
                background:
                  channel === "whatsapp"
                    ? "linear-gradient(135deg, #25D366, #1ea855)"
                    : "linear-gradient(135deg, #00E5FF, #00b8d4)",
                boxShadow: `0 10px 30px -10px ${accent}80`,
              }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send {channel === "whatsapp" ? "WhatsApp" : "SMS"} OTP</>}
            </Button>
          </div>
        )}

        {step === "verify" && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-white/60">
                Code sent via{" "}
                <span style={{ color: accent }} className="font-semibold">
                  {channel === "whatsapp" ? "WhatsApp" : "SMS"}
                </span>{" "}
                to
              </p>
              <p className="text-white font-semibold mt-1">+{fullMobile}</p>
            </div>

            <div className="flex justify-center gap-3">
              {otp.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => (otpRefs.current[i] = el)}
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKey(i, e)}
                  className="w-14 h-14 text-center text-2xl font-bold rounded-xl bg-white/5 text-white outline-none transition-all"
                  style={{
                    border: `1.5px solid ${d ? accent : "rgba(255,255,255,0.1)"}`,
                    boxShadow: d ? `0 0 20px -8px ${accent}80` : "none",
                  }}
                />
              ))}
            </div>

            <Button
              onClick={verifyAndCreate}
              disabled={otp.join("").length !== 4 || loading}
              className="w-full h-12 rounded-xl font-semibold text-black"
              style={{
                background:
                  channel === "whatsapp"
                    ? "linear-gradient(135deg, #25D366, #1ea855)"
                    : "linear-gradient(135deg, #00E5FF, #00b8d4)",
                boxShadow: `0 10px 30px -10px ${accent}80`,
              }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Create Institute"}
            </Button>

            <div className="text-center">
              <button
                onClick={resendOtp}
                disabled={resendCooldown > 0 || loading}
                className="text-xs text-white/50 hover:text-white disabled:opacity-40"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
              </button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 className="w-14 h-14" style={{ color: accent }} />
            <p className="text-white/70 text-sm">Taking you to your dashboard…</p>
          </div>
        )}
      </div>
    </div>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs uppercase tracking-wider text-white/40 mb-2">{label}</label>
    <div
      className="flex items-center rounded-xl overflow-hidden"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      {children}
    </div>
  </div>
);
