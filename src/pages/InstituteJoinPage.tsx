import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, Building2, Smartphone, MessageSquare, ArrowLeft, ShieldCheck, CheckCircle2,
  Users, GraduationCap,
} from "lucide-react";

type Channel = "sms" | "whatsapp";
type Step = "loading" | "choose" | "otp" | "verify" | "joining" | "done" | "invalid";

interface Batch {
  id: string;
  name: string;
  description: string | null;
  academic_year: string | null;
}

interface InstPreview {
  institution_id: string;
  name: string;
  type: string;
  logo_url: string | null;
  primary_color: string | null;
  city: string | null;
  branch: string | null;
  batches?: Batch[];
  exam_types?: string[];
}

const DEFAULT_EXAMS = [
  "UPSC CSE", "SSC CGL", "NEET", "JEE Main", "JEE Advanced",
  "CAT", "GATE", "Bank PO", "CLAT", "CUET",
];

export default function InstituteJoinPage() {
  const { code } = useParams<{ code: string }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("loading");
  const [preview, setPreview] = useState<InstPreview | null>(null);
  const [channel, setChannel] = useState<Channel>("sms");
  const [isAuthed, setIsAuthed] = useState(false);
  const accent = preview?.primary_color || (channel === "whatsapp" ? "#25D366" : "#00E5FF");

  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [examType, setExamType] = useState<string>("");

  const [countryCode] = useState("91");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [loading, setLoading] = useState(false);

  const fullMobile = `${countryCode}${mobile.replace(/\D/g, "")}`;
  const isValidMobile = mobile.replace(/\D/g, "").length >= 10;
  const sourceParam = (search.get("src") || "qr").toLowerCase();

  const batches: Batch[] = preview?.batches || [];
  const examOptions: string[] =
    (preview?.exam_types && preview.exam_types.length > 0)
      ? preview.exam_types
      : DEFAULT_EXAMS;
  const canContinue = (batches.length === 0 || !!selectedBatch) && !!examType;

  useEffect(() => {
    if (!code) return;
    (async () => {
      const { data, error } = await supabase.rpc("peek_institution_by_referral", { p_code: code });
      if (error || !data || (data as any).ok === false) {
        setStep("invalid");
        return;
      }
      setPreview(data as any);
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthed(!!session);
      setStep("choose");
    })();
  }, [code]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const joinNow = async (codeArg: string) => {
    setStep("joining");
    try {
      const { data, error } = await supabase.rpc("join_institution_by_referral", {
        p_code: codeArg,
        p_source: sourceParam,
        p_batch_id: selectedBatch || null,
        p_exam_type: examType || null,
      } as any);
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error || "Join failed");
      setStep("done");
      toast({ title: `Welcome to ${preview?.name || "your institute"} 🎉`, description: "Let's finish your setup." });
      setTimeout(() => navigate("/onboarding", { replace: true }), 1200);
    } catch (e: any) {
      toast({ title: "Could not join", description: e.message, variant: "destructive" });
      setStep("choose");
    }
  };

  const handleContinue = () => {
    if (!canContinue) {
      toast({
        title: "Select your details",
        description: batches.length > 0
          ? "Pick a batch and exam to continue."
          : "Pick your exam to continue.",
        variant: "destructive",
      });
      return;
    }
    if (isAuthed) {
      joinNow(code!);
    } else {
      setStep("otp");
    }
  };

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
      if ((data as any)?.error) throw new Error((data as any).error);
      setStep("verify");
      setResendCooldown(30);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (e: any) {
      toast({ title: "Failed to send OTP", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    const codeStr = otp.join("");
    if (codeStr.length !== 4) {
      toast({ title: "Enter the full 4-digit code", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("msg91-otp", {
        body: { action: "verify", mobile: fullMobile, otp: codeStr },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      if (!(data as any)?.verified) throw new Error("Verification failed");

      if ((data as any)?.access_token && (data as any)?.refresh_token) {
        const { error: sErr } = await supabase.auth.setSession({
          access_token: (data as any).access_token,
          refresh_token: (data as any).refresh_token,
        });
        if (sErr) throw sErr;
      } else if ((data as any)?.token_hash) {
        const { error: vErr } = await supabase.auth.verifyOtp({
          token_hash: (data as any).token_hash,
          type: (data as any)?.verification_type || "magiclink",
        });
        if (vErr) throw vErr;
      } else {
        throw new Error("Missing session payload");
      }

      await joinNow(code!);
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
        background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${accent}25 0%, #0B0F1A 60%)`,
      }}
    >
      <div
        className="w-full max-w-[430px] rounded-3xl border p-6 backdrop-blur-xl"
        style={{
          background: "linear-gradient(145deg, rgba(15,20,35,.85), rgba(8,12,22,.95))",
          borderColor: `${accent}30`,
          boxShadow: `0 30px 80px -20px ${accent}40, inset 0 1px 0 ${accent}15`,
        }}
      >
        {step === "loading" && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="w-7 h-7 animate-spin text-white/70" />
            <p className="text-white/60 text-sm">Looking up your institute…</p>
          </div>
        )}

        {step === "invalid" && (
          <div className="text-center py-8 space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/15 flex items-center justify-center">
              <Building2 className="w-7 h-7 text-red-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Invalid invite code</h1>
            <p className="text-sm text-white/50">
              This referral code doesn't exist or has been deactivated. Ask your institute for a fresh link.
            </p>
            <Button
              onClick={() => navigate("/")}
              className="w-full h-11 rounded-xl mt-2 bg-white/10 text-white hover:bg-white/15"
            >
              Go home
            </Button>
          </div>
        )}

        {step !== "loading" && step !== "invalid" && preview && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <button
                onClick={() => {
                  if (step === "verify") setStep("otp");
                  else if (step === "otp") setStep("choose");
                  else navigate("/");
                }}
                className="text-white/60 hover:text-white p-2 -ml-2"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 text-white/80 text-xs uppercase tracking-widest">
                <ShieldCheck className="w-4 h-4" style={{ color: accent }} /> Institute Invite
              </div>
              <div className="w-9" />
            </div>

            {/* Brand */}
            <div className="text-center mb-6">
              <div
                className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-3 overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${accent}30, ${accent}10)`,
                  border: `1px solid ${accent}50`,
                }}
              >
                {preview.logo_url ? (
                  <img src={preview.logo_url} alt={preview.name} className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-7 h-7" style={{ color: accent }} />
                )}
              </div>
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">You're joining</p>
              <h1 className="text-2xl font-extrabold text-white">{preview.name}</h1>
              <p className="text-xs text-white/50 mt-1 capitalize">
                {preview.type}
                {preview.city ? ` • ${preview.city}` : ""}
                {preview.branch ? ` • ${preview.branch}` : ""}
              </p>
            </div>

            {step === "choose" && (
              <div className="space-y-5">
                {/* Batch */}
                {batches.length > 0 && (
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/50 font-bold mb-2">
                      <Users className="w-3.5 h-3.5" style={{ color: accent }} /> Choose your batch
                    </label>
                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                      {batches.map((b) => {
                        const active = selectedBatch === b.id;
                        return (
                          <button
                            key={b.id}
                            onClick={() => setSelectedBatch(b.id)}
                            className="w-full text-left rounded-xl p-3 transition-all"
                            style={{
                              background: active
                                ? `linear-gradient(135deg, ${accent}25, ${accent}08)`
                                : "rgba(255,255,255,0.03)",
                              border: `1px solid ${active ? accent + "80" : "rgba(255,255,255,0.08)"}`,
                              boxShadow: active ? `0 6px 20px -10px ${accent}80` : "none",
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-white">{b.name}</span>
                              {b.academic_year && (
                                <span className="text-[10px] text-white/50 font-medium">
                                  {b.academic_year}
                                </span>
                              )}
                            </div>
                            {b.description && (
                              <p className="text-[11px] text-white/50 mt-0.5 line-clamp-1">
                                {b.description}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Exam */}
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/50 font-bold mb-2">
                    <GraduationCap className="w-3.5 h-3.5" style={{ color: accent }} /> Target exam
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {examOptions.map((ex) => {
                      const active = examType === ex;
                      return (
                        <button
                          key={ex}
                          onClick={() => setExamType(ex)}
                          className="rounded-xl py-2.5 text-xs font-semibold transition-all"
                          style={{
                            background: active
                              ? `linear-gradient(135deg, ${accent}25, ${accent}08)`
                              : "rgba(255,255,255,0.03)",
                            color: active ? "#fff" : "rgba(255,255,255,0.7)",
                            border: `1px solid ${active ? accent + "80" : "rgba(255,255,255,0.08)"}`,
                          }}
                        >
                          {ex}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Button
                  onClick={handleContinue}
                  disabled={!canContinue}
                  className="w-full h-12 rounded-xl font-semibold text-black disabled:opacity-50"
                  style={{
                    background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                    boxShadow: `0 10px 30px -10px ${accent}80`,
                  }}
                >
                  {isAuthed ? "Enroll Now" : "Continue with Mobile OTP"}
                </Button>
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
                          : `linear-gradient(135deg, ${accent}25, ${accent}10)`,
                      border: `1px solid ${channel === "whatsapp" ? "#25D36660" : accent + "60"}`,
                    }}
                  />
                  {(["sms", "whatsapp"] as Channel[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => setChannel(c)}
                      className="relative z-10 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors"
                      style={{
                        color: channel === c ? (c === "whatsapp" ? "#25D366" : accent) : "rgba(255,255,255,0.4)",
                      }}
                    >
                      {c === "sms" ? <Smartphone className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                      {c === "sms" ? "SMS" : "WhatsApp"}
                    </button>
                  ))}
                </div>

                <div
                  className="flex items-center rounded-xl overflow-hidden"
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
                    background: channel === "whatsapp"
                      ? "linear-gradient(135deg, #25D366, #1ea855)"
                      : `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                    boxShadow: `0 10px 30px -10px ${accent}80`,
                  }}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send OTP"}
                </Button>
              </div>
            )}

            {step === "verify" && (
              <div className="space-y-4">
                <p className="text-sm text-white/60 text-center">
                  Enter the 4-digit code sent to <span className="text-white font-semibold">+{fullMobile}</span>
                </p>
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
                  onClick={verifyOtp}
                  disabled={otp.join("").length !== 4 || loading}
                  className="w-full h-12 rounded-xl font-semibold text-black"
                  style={{
                    background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                    boxShadow: `0 10px 30px -10px ${accent}80`,
                  }}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Enroll"}
                </Button>
              </div>
            )}

            {step === "joining" && (
              <div className="flex flex-col items-center gap-3 py-6">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: accent }} />
                <p className="text-white/70 text-sm">Enrolling you in {preview.name}…</p>
              </div>
            )}

            {step === "done" && (
              <div className="flex flex-col items-center gap-3 py-6">
                <CheckCircle2 className="w-14 h-14" style={{ color: accent }} />
                <p className="text-white font-bold">Enrolled successfully!</p>
                <p className="text-white/50 text-xs">Taking you to your dashboard…</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
