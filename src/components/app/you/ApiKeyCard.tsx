import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Key, Copy, Check, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface ApiKeyRow {
  id: string;
  key_hash: string;
  key_prefix: string;
  is_active: boolean;
  rate_limit_per_minute: number | null;
  created_at: string;
}

const REVEALED_FLAG_PREFIX = "acry_apikey_revealed_";

const ApiKeyCard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [row, setRow] = useState<ApiKeyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFull, setShowFull] = useState(false);
  const [copied, setCopied] = useState(false);
  const [alreadyRevealed, setAlreadyRevealed] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("api_keys")
        .select("id, key_hash, key_prefix, is_active, rate_limit_per_minute, created_at")
        .eq("created_by", user.id)
        .eq("name", "Default API Key")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setRow(data as ApiKeyRow);
        const flag = localStorage.getItem(REVEALED_FLAG_PREFIX + data.id);
        setAlreadyRevealed(!!flag);
      }
      setLoading(false);
    };
    load();
  }, [user?.id]);

  const handleReveal = () => {
    if (!row) return;
    setShowFull(true);
    localStorage.setItem(REVEALED_FLAG_PREFIX + row.id, "1");
    setAlreadyRevealed(true);
  };

  const handleCopy = async () => {
    if (!row) return;
    try {
      await navigator.clipboard.writeText(row.key_hash);
      setCopied(true);
      toast({ title: "Copied", description: "API key copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Please copy manually.", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-xl p-4 animate-pulse h-28" />
    );
  }

  if (!row) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-xl p-4 text-sm text-muted-foreground">
        No API key found. Please contact support.
      </div>
    );
  }

  const masked = `${row.key_prefix}••••••••••••••••`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-primary/20 bg-gradient-to-br from-card/60 to-card/30 backdrop-blur-xl p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
          <Key className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Your API Key</p>
          <p className="text-[11px] text-muted-foreground">
            Use to access ACRY APIs · {row.rate_limit_per_minute ?? 60} req/min
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-background/60 border border-border/50 px-3 py-2.5 font-mono text-xs break-all flex items-center gap-2">
        <span className="flex-1 select-all">
          {showFull ? row.key_hash : masked}
        </span>
        {showFull ? (
          <button
            onClick={() => setShowFull(false)}
            className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground"
            aria-label="Hide key"
          >
            <EyeOff className="w-3.5 h-3.5" />
          </button>
        ) : (
          !alreadyRevealed && (
            <button
              onClick={handleReveal}
              className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground"
              aria-label="Reveal key"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          )
        )}
        <button
          onClick={handleCopy}
          disabled={!showFull && alreadyRevealed}
          className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Copy key"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      {!alreadyRevealed && !showFull && (
        <p className="text-[11px] text-amber-500 flex items-start gap-1.5">
          <ShieldAlert className="w-3 h-3 mt-0.5 shrink-0" />
          For your security, you can reveal this key only once. Copy and store it safely.
        </p>
      )}

      {alreadyRevealed && !showFull && (
        <p className="text-[11px] text-muted-foreground">
          Key already revealed on this device. Only the prefix is shown for security.
        </p>
      )}
    </motion.div>
  );
};

export default ApiKeyCard;
