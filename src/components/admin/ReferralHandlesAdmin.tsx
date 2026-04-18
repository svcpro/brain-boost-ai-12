import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Link as LinkIcon, MousePointerClick, UserPlus, TrendingUp,
  Search, Copy, Check, RefreshCw, ExternalLink, Loader2,
} from "lucide-react";

interface Handle {
  id: string;
  handle: string;
  user_id: string | null;
  anon_session_id: string | null;
  display_name: string | null;
  click_count: number;
  signup_count: number;
  last_clicked_at: string | null;
  created_at: string;
}

interface Summary {
  total_handles: number;
  total_clicks: number;
  total_signups: number;
  conversion_rate: number;
}

const SORT_OPTIONS = [
  { key: "created_at", label: "Newest" },
  { key: "click_count", label: "Most clicks" },
  { key: "signup_count", label: "Most signups" },
  { key: "last_clicked_at", label: "Recently clicked" },
];

const ReferralHandlesAdmin = () => {
  const { toast } = useToast();
  const [handles, setHandles] = useState<Handle[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("created_at");
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("myrank-engine", {
      body: { action: "admin_list_handles", search, sort_by: sortBy, limit: 200 },
    });
    setLoading(false);
    if (error || (data as any)?.error) {
      toast({
        title: "Failed to load handles",
        description: (data as any)?.error || error?.message,
        variant: "destructive",
      });
      return;
    }
    setHandles((data as any).handles || []);
    setSummary((data as any).summary || null);
  }, [search, sortBy, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const copyLink = async (handle: string) => {
    const url = `https://acry.ai/?ref=${handle}`;
    await navigator.clipboard.writeText(url);
    setCopied(handle);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <LinkIcon className="w-6 h-6 text-primary" />
          Referral Handles
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage memorable share links like <span className="font-mono">acry.ai/?ref=rahul123</span> — track clicks, signups & conversion.
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            <LinkIcon className="w-3.5 h-3.5" /> Total handles
          </div>
          <div className="text-2xl font-bold tabular-nums mt-1">
            {summary?.total_handles ?? "—"}
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            <MousePointerClick className="w-3.5 h-3.5" /> Total clicks
          </div>
          <div className="text-2xl font-bold tabular-nums mt-1">
            {summary?.total_clicks ?? "—"}
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            <UserPlus className="w-3.5 h-3.5" /> Signups
          </div>
          <div className="text-2xl font-bold tabular-nums mt-1">
            {summary?.total_signups ?? "—"}
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            <TrendingUp className="w-3.5 h-3.5" /> Conversion
          </div>
          <div className="text-2xl font-bold tabular-nums mt-1">
            {summary ? `${summary.conversion_rate}%` : "—"}
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by handle or display name…"
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {SORT_OPTIONS.map((opt) => (
              <Button
                key={opt.key}
                size="sm"
                variant={sortBy === opt.key ? "default" : "outline"}
                onClick={() => setSortBy(opt.key)}
              >
                {opt.label}
              </Button>
            ))}
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Handle</th>
                <th className="text-left px-4 py-3 font-semibold">Owner</th>
                <th className="text-right px-4 py-3 font-semibold">Clicks</th>
                <th className="text-right px-4 py-3 font-semibold">Signups</th>
                <th className="text-right px-4 py-3 font-semibold">CR</th>
                <th className="text-left px-4 py-3 font-semibold">Last click</th>
                <th className="text-left px-4 py-3 font-semibold">Created</th>
                <th className="text-right px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && handles.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && handles.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    No referral handles yet.
                  </td>
                </tr>
              )}
              {handles.map((h) => {
                const cr = h.click_count > 0
                  ? Math.round((h.signup_count / h.click_count) * 100)
                  : 0;
                return (
                  <tr key={h.id} className="border-t hover:bg-muted/30 transition">
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-primary">{h.handle}</div>
                      <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px]">
                        acry.ai/?ref={h.handle}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs">
                        {h.display_name || (
                          <span className="text-muted-foreground italic">
                            {h.user_id ? "Signed user" : "Anonymous"}
                          </span>
                        )}
                      </div>
                      {h.user_id && (
                        <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[140px]">
                          {h.user_id.slice(0, 8)}…
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      {h.click_count}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-500">
                      {h.signup_count}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={cr > 30 ? "text-emerald-500 font-bold" : cr > 10 ? "text-amber-500" : "text-muted-foreground"}>
                        {cr}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {h.last_clicked_at
                        ? new Date(h.last_clicked_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(h.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyLink(h.handle)}
                          title="Copy link"
                        >
                          {copied === h.handle ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          asChild
                          title="Open in new tab"
                        >
                          <a
                            href={`https://acry.ai/?ref=${h.handle}`}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default ReferralHandlesAdmin;
