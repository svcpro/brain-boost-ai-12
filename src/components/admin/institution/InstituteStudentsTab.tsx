import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Users, GraduationCap, Mail, Phone, ShieldOff, ShieldCheck, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Props {
  institutionId: string;
  institutionName: string;
}

interface StudentRow {
  id: string;
  user_id: string;
  is_active: boolean;
  joined_at: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
}

export default function InstituteStudentsTab({ institutionId, institutionName }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!institutionId) return;
    load();
  }, [institutionId]);

  const load = async () => {
    setLoading(true);
    try {
      // SCOPED: institution_id filter is enforced both at query level + RLS
      const { data: members, error } = await supabase
        .from("institution_members")
        .select("id, user_id, is_active, joined_at")
        .eq("institution_id", institutionId)
        .eq("role", "student")
        .order("joined_at", { ascending: false });
      if (error) throw error;

      const ids = (members || []).map((m) => m.user_id);
      let profilesById: Record<string, any> = {};
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name, email, phone, avatar_url")
          .in("id", ids);
        (profs || []).forEach((p: any) => (profilesById[p.id] = p));
      }

      const merged: StudentRow[] = (members || []).map((m) => ({
        id: m.id,
        user_id: m.user_id,
        is_active: !!m.is_active,
        joined_at: m.joined_at,
        display_name: profilesById[m.user_id]?.display_name ?? null,
        email: profilesById[m.user_id]?.email ?? null,
        phone: profilesById[m.user_id]?.phone ?? null,
        avatar_url: profilesById[m.user_id]?.avatar_url ?? null,
      }));
      setStudents(merged);
    } catch (e: any) {
      toast({ title: "Failed to load students", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (row: StudentRow) => {
    setBusy(row.id);
    try {
      const { error } = await supabase
        .from("institution_members")
        .update({ is_active: !row.is_active })
        .eq("id", row.id)
        .eq("institution_id", institutionId);
      if (error) throw error;
      setStudents((s) => s.map((x) => (x.id === row.id ? { ...x, is_active: !row.is_active } : x)));
      toast({ title: row.is_active ? "Access revoked" : "Access restored" });
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        (s.display_name || "").toLowerCase().includes(q) ||
        (s.email || "").toLowerCase().includes(q) ||
        (s.phone || "").toLowerCase().includes(q),
    );
  }, [students, search]);

  const stats = useMemo(
    () => ({
      total: students.length,
      active: students.filter((s) => s.is_active).length,
      inactive: students.filter((s) => !s.is_active).length,
    }),
    [students],
  );

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: stats.total, icon: Users, color: "text-primary" },
          { label: "Active", value: stats.active, icon: ShieldCheck, color: "text-success" },
          { label: "Revoked", value: stats.inactive, icon: ShieldOff, color: "text-destructive" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl bg-card border border-border p-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <k.icon className={cn("w-3.5 h-3.5", k.color)} />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{k.label}</span>
            </div>
            <div className="text-2xl font-extrabold text-foreground">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* List */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12 px-4">
            <GraduationCap className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground">No students yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Invite students to {institutionName} from the Members tab.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-3.5 hover:bg-secondary/30 transition-colors">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                  {s.avatar_url ? (
                    <img src={s.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-foreground">
                      {(s.display_name || s.email || "?").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-foreground truncate">
                      {s.display_name || "Unnamed"}
                    </span>
                    <span
                      className={cn(
                        "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase",
                        s.is_active ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
                      )}
                    >
                      {s.is_active ? "Active" : "Revoked"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                    {s.email && (
                      <span className="flex items-center gap-1 truncate"><Mail className="w-3 h-3" />{s.email}</span>
                    )}
                    {s.phone && (
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{s.phone}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(s.joined_at), "dd MMM yyyy")}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => toggleActive(s)}
                  disabled={busy === s.id}
                  className={cn(
                    "text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-colors shrink-0",
                    s.is_active
                      ? "border-destructive/30 text-destructive hover:bg-destructive/10"
                      : "border-success/30 text-success hover:bg-success/10",
                  )}
                >
                  {busy === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : s.is_active ? "Revoke" : "Restore"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
