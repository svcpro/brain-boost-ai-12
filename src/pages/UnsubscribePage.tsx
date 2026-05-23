import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Loader2, Check, AlertTriangle, Mail } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State = "loading" | "valid" | "already" | "invalid" | "confirming" | "done" | "error";

export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (!token) { setState("invalid"); setMessage("Missing unsubscribe token."); return; }
    (async () => {
      try {
        const r = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON } }
        );
        const d = await r.json().catch(() => ({}));
        if (r.ok && d?.valid) setState("valid");
        else if (d?.reason === "already_unsubscribed") setState("already");
        else { setState("invalid"); setMessage(d?.error || "Invalid or expired link."); }
      } catch (e: any) {
        setState("error"); setMessage(e?.message || "Network error.");
      }
    })();
  }, [token]);

  const confirm = async () => {
    setState("confirming");
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON },
        body: JSON.stringify({ token }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && (d?.success || d?.reason === "already_unsubscribed")) setState("done");
      else { setState("error"); setMessage(d?.error || "Could not process request."); }
    } catch (e: any) {
      setState("error"); setMessage(e?.message || "Network error.");
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #0B0F1A 0%, #141832 100%)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 text-center"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(124,77,255,0.25)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div
          className="mx-auto mb-5 w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #00BCD4, #7C4DFF)" }}
        >
          <Mail className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Email preferences</h1>

        {state === "loading" && (
          <div className="flex items-center justify-center gap-2 text-white/70 py-6">
            <Loader2 className="w-4 h-4 animate-spin" /> Verifying link…
          </div>
        )}

        {state === "valid" && (
          <>
            <p className="text-white/70 mb-6">
              Click below to unsubscribe from ACRY AI emails. You can re-subscribe anytime by signing back in.
            </p>
            <button
              onClick={confirm}
              className="w-full py-3 rounded-xl font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #00BCD4, #7C4DFF)" }}
            >
              Confirm unsubscribe
            </button>
          </>
        )}

        {state === "confirming" && (
          <div className="flex items-center justify-center gap-2 text-white/70 py-6">
            <Loader2 className="w-4 h-4 animate-spin" /> Processing…
          </div>
        )}

        {state === "done" && (
          <>
            <div className="mx-auto mb-3 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.4)" }}>
              <Check className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-white/80">You've been unsubscribed. We're sorry to see you go.</p>
          </>
        )}

        {state === "already" && (
          <p className="text-white/70 py-2">You're already unsubscribed. No further action needed.</p>
        )}

        {(state === "invalid" || state === "error") && (
          <>
            <div className="mx-auto mb-3 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.4)" }}>
              <AlertTriangle className="w-5 h-5 text-rose-400" />
            </div>
            <p className="text-white/70">{message || "This link is invalid or expired."}</p>
          </>
        )}

        <Link to="/" className="inline-block mt-6 text-sm text-cyan-300 hover:text-cyan-200">
          ← Back to ACRY
        </Link>
      </div>
    </div>
  );
}
