import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Shield, Loader2, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onComplete: () => void;
}

const AdminMFASetup = ({ onComplete }: Props) => {
  const { toast } = useToast();
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [factorId, setFactorId] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    enrollMFA();
  }, []);

  const enrollMFA = async () => {
    setLoading(true);
    try {
      // Unenroll any unverified factors first
      const { data: existing } = await supabase.auth.mfa.listFactors();
      const unverified = existing?.totp?.filter(f => f.status !== "verified") || [];
      for (const f of unverified) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Admin TOTP",
      });
      if (error) throw error;
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
    } catch (error: any) {
      toast({ title: "MFA Setup Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: otp,
      });
      if (verifyError) throw verifyError;

      toast({ title: "2FA Enabled", description: "Your authenticator is now linked." });
      onComplete();
    } catch (error: any) {
      toast({ title: "Verification Failed", description: error.message, variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Setup Two-Factor Auth</h1>
            <p className="text-xs text-muted-foreground">Required for admin access</p>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 neural-border space-y-5">
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              1. Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </p>
            <div className="flex justify-center p-4 bg-white rounded-xl">
              <img src={qrCode} alt="MFA QR Code" className="w-48 h-48" />
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-2">Or enter this secret manually:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-secondary px-3 py-2 rounded-lg font-mono text-foreground break-all">
                {secret}
              </code>
              <button onClick={copySecret} className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
                {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
              </button>
            </div>
          </div>

          <form onSubmit={handleVerify} className="space-y-3">
            <p className="text-sm text-muted-foreground">
              2. Enter the 6-digit code from your app:
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-xl bg-secondary border border-border px-4 py-3.5 text-center text-2xl font-mono tracking-[0.5em] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              required
            />
            <button
              type="submit"
              disabled={verifying || otp.length !== 6}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold transition-all disabled:opacity-50"
            >
              {verifying ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Verify & Enable 2FA"}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminMFASetup;
