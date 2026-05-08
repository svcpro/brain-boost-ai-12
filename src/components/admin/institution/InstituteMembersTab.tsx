import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Users, Plus, Loader2, Copy, Check, X, Trash2, Mail, Phone, Crown,
  GraduationCap, Briefcase, UserCog, Link2, RefreshCw, Clock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

interface Props {
  institutionId: string;
  institutionName: string;
}

const ROLES = [
  { key: "faculty", label: "Faculty", icon: GraduationCap, color: "text-blue-400", bg: "bg-blue-500/15" },
  { key: "staff", label: "Staff", icon: Briefcase, color: "text-emerald-400", bg: "bg-emerald-500/15" },
  { key: "admin", label: "Admin", icon: UserCog, color: "text-amber-400", bg: "bg-amber-500/15" },
  { key: "student", label: "Student", icon: Users, color: "text-primary", bg: "bg-primary/15" },
] as const;

const roleMeta = (r: string) => ROLES.find(x => x.key === r) || ROLES[0];

export default function InstituteMembersTab({ institutionId, institutionName }: Props) {
  const { toast } = useToast();
  const [members, setMembers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [form, setForm] = useState({ role: "faculty", email: "", phone: "", note: "" });

  const load = async () => {
    setLoading(true);
    const [{ data: m }, { data: inv }] = await Promise.all([
      supabase.from("institution_members").select("*").eq("institution_id", institutionId).order("joined_at", { ascending: false }),
      supabase.from("institution_invites").select("*").eq("institution_id", institutionId).order("created_at", { ascending: false }),
    ]);
    setMembers((m as any[]) || []);
    setInvites((inv as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [institutionId]);

  const createInvite = async () => {
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCreating(false); return; }
    const { error } = await supabase.from("institution_invites").insert({
      institution_id: institutionId,
      role: form.role,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      note: form.note.trim() || null,
      invited_by: user.id,
    });
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Invite created ✅", description: "Copy the link and share it." });
      setForm({ role: "faculty", email: "", phone: "", note: "" });
      setShowCreate(false);
      load();
    }
    setCreating(false);
  };

  const revokeInvite = async (id: string) => {
    await supabase.from("institution_invites").update({ status: "revoked" }).eq("id", id);
    toast({ title: "Invite revoked" });
    load();
  };

  const removeMember = async (id: string) => {
    await supabase.from("institution_members").update({ is_active: false }).eq("id", id);
    toast({ title: "Member deactivated" });
    load();
  };

  const updateMemberRole = async (id: string, role: string) => {
    await supabase.from("institution_members").update({ role }).eq("id", id);
    load();
  };

  const copyLink = async (token: string, id: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast({ title: "Link copied" });
    setTimeout(() => setCopiedId(null), 1800);
  };

  const pending = useMemo(() => invites.filter(i => i.status === "pending" && new Date(i.expires_at) > new Date()), [invites]);
  const past = useMemo(() => invites.filter(i => i.status !== "pending" || new Date(i.expires_at) <= new Date()), [invites]);
  const activeMembers = members.filter(m => m.is_active);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Members & Invites</h3>
            <p className="text-[10px] text-muted-foreground">{activeMembers.length} active • {pending.length} pending invites</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20"
        >
          <Plus className="w-3.5 h-3.5" /> Invite
        </button>
      </div>

      {/* Create invite form */}
      {showCreate && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="rounded-2xl bg-card border border-border p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground">New Invite</h4>
            <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg hover:bg-secondary">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Role</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 mt-1.5">
              {ROLES.map(r => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, role: r.key }))}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-medium border transition-all",
                    form.role === r.key
                      ? cn(r.bg, r.color, "border-current")
                      : "bg-secondary/30 text-muted-foreground border-transparent hover:bg-secondary/60"
                  )}
                >
                  <r.icon className="w-3.5 h-3.5" />
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              maxLength={255}
              placeholder="Email (optional)"
              className="px-3 py-2 rounded-xl bg-secondary/30 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              maxLength={20}
              placeholder="Phone (optional)"
              className="px-3 py-2 rounded-xl bg-secondary/30 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <input
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            maxLength={200}
            placeholder="Internal note (optional)"
            className="w-full px-3 py-2 rounded-xl bg-secondary/30 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />

          <button
            onClick={createInvite}
            disabled={creating}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
            Generate Invite Link
          </button>
          <p className="text-[10px] text-muted-foreground text-center">
            Link expires in 14 days. Share via WhatsApp, email, or any channel.
          </p>
        </motion.div>
      )}

      {/* Pending invites */}
      {pending.length > 0 && (
        <div className="rounded-2xl bg-card border border-border p-4">
          <h4 className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-warning" /> Pending Invites ({pending.length})
          </h4>
          <div className="space-y-2">
            {pending.map(inv => {
              const r = roleMeta(inv.role);
              return (
                <div key={inv.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/30">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", r.bg)}>
                    <r.icon className={cn("w-4 h-4", r.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded uppercase", r.bg, r.color)}>{inv.role}</span>
                      {inv.email && <span className="text-[11px] text-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{inv.email}</span>}
                      {inv.phone && <span className="text-[11px] text-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{inv.phone}</span>}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Expires {formatDistanceToNow(new Date(inv.expires_at), { addSuffix: true })}
                      {inv.note && ` • ${inv.note}`}
                    </p>
                  </div>
                  <button
                    onClick={() => copyLink(inv.token, inv.id)}
                    className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy invite link"
                  >
                    {copiedId === inv.id ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => revokeInvite(inv.id)}
                    className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title="Revoke"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active members */}
      <div className="rounded-2xl bg-card border border-border p-4">
        <h4 className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
          <Crown className="w-3.5 h-3.5 text-primary" /> Active Members ({activeMembers.length})
        </h4>
        {activeMembers.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No members yet. Send your first invite above.</p>
        ) : (
          <div className="space-y-1.5">
            {activeMembers.map(m => {
              const r = roleMeta(m.role);
              return (
                <div key={m.id} className="flex items-center gap-2 p-2 rounded-xl bg-secondary/20">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", r.bg)}>
                    <r.icon className={cn("w-4 h-4", r.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-mono text-foreground truncate">{m.user_id.slice(0, 8)}…</div>
                    <div className="text-[10px] text-muted-foreground">Joined {format(new Date(m.joined_at), "dd MMM yyyy")}</div>
                  </div>
                  <select
                    value={m.role}
                    onChange={e => updateMemberRole(m.id, e.target.value)}
                    className="text-[10px] font-bold uppercase bg-secondary border border-border rounded-md px-1.5 py-1 text-foreground focus:outline-none"
                  >
                    {ROLES.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
                  </select>
                  <button
                    onClick={() => removeMember(m.id)}
                    className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* History */}
      {past.length > 0 && (
        <div className="rounded-2xl bg-card border border-border p-4">
          <h4 className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" /> History
          </h4>
          <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-hide">
            {past.slice(0, 20).map(inv => {
              const r = roleMeta(inv.role);
              const expired = new Date(inv.expires_at) <= new Date() && inv.status === "pending";
              const status = expired ? "expired" : inv.status;
              return (
                <div key={inv.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/10">
                  <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded uppercase", r.bg, r.color)}>{inv.role}</span>
                  <span className="text-[10px] text-muted-foreground flex-1 truncate">{inv.email || inv.phone || "—"}</span>
                  <span className={cn(
                    "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded",
                    status === "accepted" ? "bg-success/15 text-success" :
                    status === "revoked" ? "bg-destructive/15 text-destructive" :
                    "bg-muted-foreground/15 text-muted-foreground"
                  )}>{status}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
