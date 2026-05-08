import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Building2, MessageSquare, Smartphone, ArrowLeft, ShieldCheck } from "lucide-react";

type Channel = "sms" | "whatsapp";

export default function InstituteLoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [channel, setChannel] = useState<Channel>("sms");
  const [countryCode] = useState("91");
  const [mobile, setMobile] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const fullMobile = `${countryCode}${mobile.replace(/\D/g, "")}`;
  const isValidMobile = mobile.replace(/\D/g, "").length >= 10;
  const accent = channel === "whatsapp" ? "#25D366" : "#00E5FF";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/institute", { replace: true });
    });
  }, [navigate]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

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
      setOtpSent(true);
      setResendCooldown(30);
      toast({
        title: "OTP sent",
        description:
          channel === "whatsapp"
            ? `WhatsApp message sent to +${fullMobile}`
            : `SMS sent to +${fullMobile}`,
      });
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
      toast({ title: "OTP resent", description: data?.message || "Check your messages" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    const code = otp.join("");
    if (code.length !== 4) {
      toast({ title: "Enter the full 4-digit code", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
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

      // Verify institute access
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Session not established");

      const [{ data: adminInst }, { data: memberRow }] = await Promise.all([
        supabase.from("institutions").select("id").eq("admin_user_id", user.id).limit(1).maybeSingle(),
        supabase.from("institution_members").select("institution_id").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle(),
      ]);

      if (!adminInst && !memberRow) {
        toast({
          title: "No institute access",
          description: "This number is not linked to any institute. Contact your institute admin for an invite.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      toast({ title: "Welcome back ✅" });
      setTimeout(() => navigate("/institute", { replace: true }), 400);
    } catch (e: any) {
      toast({ title: "Verification failed", description: e.message, variant: "destructive" });
      setOtp(["", "", "", ""]);
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
        background:
          "radial-gradient(ellipse 80% 60% at 50% 0%, hsl(220 60% 12%) 0%, #0B0F1A 60%)",
      }}
    >
      <div
        className="w-full max-w-[430px] rounded-3xl border p-6 backdrop-blur-xl"
        style={{
          background: "linear-gradient(145deg, rgba(15,20,35,.85), rgba(8,12,22,.95))",
          borderColor: `${accent}30`,
          boxShadow: `0 30px 80px -20px ${accent}25, inset 0 1px 0 ${accent}15`,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => (otpSent ? setOtpSent(false) : navigate("/"))}
            className="text-white/60 hover:text-white p-2 -ml-2"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-white/80 text-xs uppercase tracking-widest">
            <ShieldCheck className="w-4 h-4" style={{ color: accent }} />
            Institute Portal
          </div>
          <div className="w-9" />
        </div>

        {/* Brand */}
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
          <h1 className="text-2xl font-bold text-white">Institute Login</h1>
          <p className="text-sm text-white/50 mt-1">
            Verify your number to manage your institute
          </p>
        </div>

        {!otpSent ? (
          <>
            {/* Channel switch */}
            <div
              className="relative grid grid-cols-2 p-1 rounded-2xl mb-5"
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
                    color:
                      channel === c
                        ? c === "whatsapp"
                          ? "#25D366"
                          : "#00E5FF"
                        : "rgba(255,255,255,0.4)",
                  }}
                >
                  {c === "sms" ? <Smartphone className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                  {c === "sms" ? "SMS OTP" : "WhatsApp OTP"}
                </button>
              ))}
            </div>

            {/* Mobile input */}
            <label className="block text-xs uppercase tracking-wider text-white/40 mb-2">
              Mobile number
            </label>
            <div
              className="flex items-center rounded-xl overflow-hidden mb-5"
              style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${accent}25` }}
            >
              <span className="px-3 py-3 text-white/80 border-r border-white/10 text-sm">+{countryCode}</span>
              <Input
                inputMode="numeric"
                placeholder="98765 43210"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                className="border-0 bg-transparent text-white text-base focus-visible:ring-0"
                onKeyDown={(e) => e.key === "Enter" && isValidMobile && sendOtp()}
              />
            </div>

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
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>Send {channel === "whatsapp" ? "WhatsApp" : "SMS"} OTP</>
              )}
            </Button>

            <p className="text-[11px] text-white/30 text-center mt-4 leading-relaxed">
              Only numbers linked to an institute admin or invited member can sign in here.
            </p>
            <p className="text-[11px] text-white/50 text-center mt-3">
              New here?{" "}
              <button
                onClick={() => navigate("/institute/signup")}
                className="text-white/90 hover:text-white underline underline-offset-2 font-semibold"
              >
                Onboard your institute
              </button>
            </p>
          </>
        ) : (
          <>
            <div className="text-center mb-5">
              <p className="text-sm text-white/60">
                Enter the 4-digit code sent via{" "}
                <span style={{ color: accent }} className="font-semibold">
                  {channel === "whatsapp" ? "WhatsApp" : "SMS"}
                </span>{" "}
                to
              </p>
              <p className="text-white font-semibold mt-1">+{fullMobile}</p>
            </div>

            <div className="flex justify-center gap-3 mb-5">
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
              onClick={verifyOtp}
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
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Continue"}
            </Button>

            <div className="text-center mt-4">
              <button
                onClick={resendOtp}
                disabled={resendCooldown > 0 || loading}
                className="text-xs text-white/50 hover:text-white disabled:opacity-40"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
