import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2, AlertTriangle, Building2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  faculty: "Faculty",
  staff: "Staff",
  admin: "Admin",
  student: "Student",
};

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [peek, setPeek] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [done, setDone] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data } = await supabase.rpc("peek_institution_invite", { p_token: token });
      setPeek(data);
      setLoading(false);
    })();
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    if (!user) {
      // store and redirect to auth
      sessionStorage.setItem("pending_invite_token", token);
      navigate("/auth");
      return;
    }
    setAccepting(true);
    const { data, error } = await supabase.rpc("accept_institution_invite", { p_token: token });
    setAccepting(false);
    if (error) {
      setDone({ ok: false, msg: error.message });
      return;
    }
    const result = data as any;
    if (!result?.ok) {
      setDone({ ok: false, msg: result?.error || "Failed to accept invite" });
      return;
    }
    setDone({ ok: true, msg: `You've joined ${peek?.institution_name} as ${ROLE_LABEL[result.role] || result.role}.` });
    toast({ title: "Welcome aboard 🎉" });
    setTimeout(() => navigate(result.role === "admin" ? "/institute" : "/app"), 1800);
  };

  // Auto-accept if user just logged in with a stored token
  useEffect(() => {
    if (!authLoading && user && token && !accepting && !done && peek?.ok) {
      const stored = sessionStorage.getItem("pending_invite_token");
      if (stored === token) {
        sessionStorage.removeItem("pending_invite_token");
        handleAccept();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, peek]);

  if (loading || authLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const invalid = !peek?.ok;
  const expired = peek?.ok && new Date(peek.expires_at) < new Date();
  const notPending = peek?.ok && peek.status !== "pending";

  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-sm w-full rounded-2xl bg-card border border-border p-6 space-y-5"
      >
        {invalid ? (
          <>
            <div className="w-14 h-14 rounded-2xl bg-destructive/15 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7 text-destructive" />
            </div>
            <div className="text-center">
              <h1 className="text-lg font-bold text-foreground">Invalid Invite</h1>
              <p className="text-xs text-muted-foreground mt-1">This invite link is not valid or has been removed.</p>
            </div>
          </>
        ) : (
          <>
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-lg"
              style={{ background: `linear-gradient(135deg, ${peek.primary_color || "#6366f1"}, ${peek.primary_color || "#6366f1"}99)` }}
            >
              {peek.logo_url ? (
                <img src={peek.logo_url} alt="" className="w-full h-full object-cover rounded-2xl" />
              ) : (
                <Building2 className="w-7 h-7 text-white" />
              )}
            </div>

            <div className="text-center space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">You're invited to</p>
              <h1 className="text-xl font-extrabold text-foreground">{peek.institution_name}</h1>
              <p className="text-xs text-muted-foreground">
                As <span className="font-bold text-primary">{ROLE_LABEL[peek.role] || peek.role}</span>
              </p>
            </div>

            {done ? (
              <div className={cn(
                "rounded-xl p-3 flex items-start gap-2",
                done.ok ? "bg-success/10 border border-success/30" : "bg-destructive/10 border border-destructive/30"
              )}>
                {done.ok ? <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />}
                <span className={cn("text-xs", done.ok ? "text-success" : "text-destructive")}>{done.msg}</span>
              </div>
            ) : expired || notPending ? (
              <div className="rounded-xl bg-warning/10 border border-warning/30 p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <span className="text-xs text-warning">
                  {notPending ? `This invite has been ${peek.status}.` : "This invite has expired. Ask the admin for a new one."}
                </span>
              </div>
            ) : (
              <button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-sm font-bold shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {accepting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {user ? "Accept Invite" : "Sign in to Accept"}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}

            {!user && !done && !expired && !notPending && (
              <p className="text-[10px] text-muted-foreground text-center">
                You'll be redirected to sign in. The invite will be applied automatically.
              </p>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
