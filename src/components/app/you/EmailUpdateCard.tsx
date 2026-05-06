import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Loader2, Check, ShieldCheck, ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EmailUpdateCard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);

  const currentEmail = user?.email || "";
  // Supabase sets email_confirmed_at when verified
  const isVerified = !!(user as any)?.email_confirmed_at || !!(user as any)?.confirmed_at;

  const handleUpdate = async () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    if (trimmed === currentEmail.toLowerCase()) {
      toast({ title: "Same email", description: "This is already your current email.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser(
        { email: trimmed },
        { emailRedirectTo: `${window.location.origin}/app` }
      );
      if (error) throw error;
      toast({
        title: "✉️ Verification sent",
        description: `We sent a confirmation link to ${trimmed}. Click it to complete the update.`,
      });
      setEditing(false);
      setNewEmail("");
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleResendVerification = async () => {
    if (!currentEmail) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: currentEmail,
        options: { emailRedirectTo: `${window.location.origin}/app` },
      });
      if (error) throw error;
      toast({ title: "✉️ Verification resent", description: `Check ${currentEmail} for the verification link.` });
    } catch (err: any) {
      toast({ title: "Resend failed", description: err.message, variant: "destructive" });
    } finally {
      setResending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-5 neural-border space-y-4"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Mail className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground">Email Address</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Update or verify your email</p>
        </div>
        {isVerified ? (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-success bg-success/10 px-2 py-1 rounded-full">
            <ShieldCheck className="w-3 h-3" /> Verified
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-destructive bg-destructive/10 px-2 py-1 rounded-full">
            <ShieldAlert className="w-3 h-3" /> Unverified
          </span>
        )}
      </div>

      <div className="rounded-xl bg-secondary/40 border border-border/50 px-3 py-2.5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Current</p>
        <p className="text-sm font-medium text-foreground truncate">{currentEmail || "No email on file"}</p>
      </div>

      {!isVerified && currentEmail && (
        <button
          onClick={handleResendVerification}
          disabled={resending}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
          Resend verification link
        </button>
      )}

      {editing ? (
        <div className="space-y-2">
          <input
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="new@email.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            disabled={saving}
            className="w-full rounded-xl bg-secondary border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <div className="flex gap-2">
            <button
              onClick={handleUpdate}
              disabled={saving || !newEmail.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Send verification
            </button>
            <button
              onClick={() => { setEditing(false); setNewEmail(""); }}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl bg-secondary text-muted-foreground text-xs font-semibold hover:bg-secondary/80 transition"
            >
              Cancel
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            We'll send a confirmation link to your new email. Your email changes only after you click that link.
          </p>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="w-full px-3 py-2.5 rounded-xl bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/80 transition"
        >
          Change email
        </button>
      )}
    </motion.div>
  );
};

export default EmailUpdateCard;
