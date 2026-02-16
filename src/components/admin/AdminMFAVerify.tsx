import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Shield, Loader2, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface Props {
  onSuccess: () => void;
}

const AdminMFAVerify = ({ onSuccess }: Props) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.find(f => f.status === "verified");
      if (!totp) throw new Error("No verified TOTP factor found.");

      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totp.id,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totp.id,
        challengeId: challenge.id,
        code: otp,
      });
      if (verifyError) throw verifyError;

      onSuccess();
    } catch (error: any) {
      toast({ title: "Verification Failed", description: error.message, variant: "destructive" });
      setOtp("");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-destructive/15 border border-destructive/30 flex items-center justify-center">
            <Shield className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">2FA Verification</h1>
            <p className="text-xs text-muted-foreground">Enter your authenticator code</p>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 neural-border">
          <p className="text-sm text-muted-foreground mb-4">
            Open your authenticator app and enter the 6-digit code to continue.
          </p>

          <form onSubmit={handleVerify} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-xl bg-secondary border border-border px-4 py-4 text-center text-2xl font-mono tracking-[0.5em] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive/50 focus:border-destructive transition-all"
              required
            />
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full py-3.5 rounded-xl bg-destructive text-destructive-foreground font-semibold transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Verify"}
            </button>
          </form>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 mt-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminMFAVerify;
