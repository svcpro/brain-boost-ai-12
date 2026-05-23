import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  GraduationCap, Search, RefreshCw, Download, Mail, Phone,
  Instagram, Linkedin, MapPin, BookOpen, MessageCircle, Eye,
} from "lucide-react";

type App = {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  college: string;
  city: string;
  course: string | null;
  instagram: string | null;
  linkedin: string | null;
  why_join: string | null;
  leadership_experience: string | null;
  status: string;
  source: string | null;
  created_at: string;
};

const STATUSES = ["new", "shortlisted", "approved", "rejected", "contacted"] as const;
const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  shortlisted: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  approved: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  contacted: "bg-violet-500/20 text-violet-400 border-violet-500/30",
};

const csvEscape = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function CampusAmbassadorManagement() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<App | null>(null);

  const fetchApps = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("campus_ambassador_applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) {
      toast.error("Failed to load applications", { description: error.message });
    } else {
      setApps((data || []) as App[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchApps(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return apps.filter(a => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (!q) return true;
      return [a.full_name, a.email, a.phone, a.college, a.city, a.course]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q));
    });
  }, [apps, search, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { total: apps.length };
    STATUSES.forEach(s => { c[s] = apps.filter(a => a.status === s).length; });
    return c;
  }, [apps]);

  const updateStatus = async (id: string, status: string) => {
    const prev = apps;
    setApps(prev.map(a => a.id === id ? { ...a, status } : a));
    if (selected?.id === id) setSelected({ ...selected, status });
    const { error } = await supabase
      .from("campus_ambassador_applications")
      .update({ status })
      .eq("id", id);
    if (error) {
      setApps(prev);
      toast.error("Failed to update status", { description: error.message });
    } else {
      toast.success(`Status set to ${status}`);
    }
  };

  const exportCsv = () => {
    const headers = ["created_at","status","full_name","phone","email","college","city","course","instagram","linkedin","why_join","leadership_experience","source"];
    const rows = [headers.join(",")].concat(
      filtered.map(a => headers.map(h => csvEscape((a as any)[h])).join(","))
    );
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `campus-ambassador-applications-${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const waLink = (phone: string, name: string) => {
    const num = phone.replace(/\D/g, "");
    const text = encodeURIComponent(`Hi ${name?.split(" ")[0] || ""}, this is ACRY AI regarding your Campus Ambassador application.`);
    return `https://wa.me/${num}?text=${text}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-primary" />
            Campus Ambassador Applications
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage applications submitted through /campus-ambassador
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchApps} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-2xl font-bold mt-1">{counts.total}</div>
        </Card>
        {STATUSES.map(s => (
          <Card key={s} className="p-4">
            <div className="text-xs text-muted-foreground capitalize">{s}</div>
            <div className="text-2xl font-bold mt-1">{counts[s] || 0}</div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, phone, college, city…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map(s => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Applicant</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>College / City</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No applications found.</TableCell></TableRow>
              ) : filtered.map(a => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="font-medium">{a.full_name}</div>
                    {a.course && <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><BookOpen className="w-3 h-3" />{a.course}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs flex items-center gap-1"><Mail className="w-3 h-3" />{a.email}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{a.phone}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{a.college}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{a.city}</div>
                  </TableCell>
                  <TableCell>
                    <Select value={a.status} onValueChange={v => updateStatus(a.id, v)}>
                      <SelectTrigger className={`h-8 w-[140px] capitalize border ${STATUS_COLORS[a.status] || ""}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map(s => (
                          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(a.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setSelected(a)} title="View">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <a href={waLink(a.phone, a.full_name)} target="_blank" rel="noopener noreferrer">
                        <Button size="icon" variant="ghost" title="WhatsApp">
                          <MessageCircle className="w-4 h-4 text-green-500" />
                        </Button>
                      </a>
                      <a href={`mailto:${a.email}`}>
                        <Button size="icon" variant="ghost" title="Email">
                          <Mail className="w-4 h-4" />
                        </Button>
                      </a>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-primary" />
                  {selected.full_name}
                </DialogTitle>
                <DialogDescription>
                  Submitted {new Date(selected.created_at).toLocaleString()}
                  {selected.source && <> · source: <span className="font-mono">{selected.source}</span></>}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`capitalize border ${STATUS_COLORS[selected.status] || ""}`}>
                    {selected.status}
                  </Badge>
                  <Select value={selected.status} onValueChange={v => updateStatus(selected.id, v)}>
                    <SelectTrigger className="h-8 w-[160px] capitalize"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <Field icon={<Mail className="w-4 h-4" />} label="Email" value={selected.email} href={`mailto:${selected.email}`} />
                  <Field icon={<Phone className="w-4 h-4" />} label="Phone" value={selected.phone} href={`tel:${selected.phone}`} />
                  <Field icon={<BookOpen className="w-4 h-4" />} label="College" value={selected.college} />
                  <Field icon={<MapPin className="w-4 h-4" />} label="City" value={selected.city} />
                  <Field icon={<BookOpen className="w-4 h-4" />} label="Course" value={selected.course || "—"} />
                  {selected.instagram && (
                    <Field icon={<Instagram className="w-4 h-4" />} label="Instagram" value={selected.instagram} href={selected.instagram.startsWith("http") ? selected.instagram : `https://instagram.com/${selected.instagram.replace("@", "")}`} />
                  )}
                  {selected.linkedin && (
                    <Field icon={<Linkedin className="w-4 h-4" />} label="LinkedIn" value={selected.linkedin} href={selected.linkedin.startsWith("http") ? selected.linkedin : `https://${selected.linkedin}`} />
                  )}
                </div>

                {selected.why_join && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Why do you want to join?</div>
                    <p className="text-sm bg-muted/40 rounded-md p-3 whitespace-pre-wrap">{selected.why_join}</p>
                  </div>
                )}

                {selected.leadership_experience && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Leadership experience</div>
                    <p className="text-sm bg-muted/40 rounded-md p-3 whitespace-pre-wrap">{selected.leadership_experience}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <a href={waLink(selected.phone, selected.full_name)} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <Button className="w-full bg-green-600 hover:bg-green-700">
                      <MessageCircle className="w-4 h-4 mr-2" /> Message on WhatsApp
                    </Button>
                  </a>
                  <a href={`mailto:${selected.email}`} className="flex-1">
                    <Button variant="outline" className="w-full">
                      <Mail className="w-4 h-4 mr-2" /> Send Email
                    </Button>
                  </a>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  const content = (
    <div className="flex items-start gap-2 bg-muted/30 rounded-md p-2.5">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm truncate">{value}</div>
      </div>
    </div>
  );
  return href ? <a href={href} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition">{content}</a> : content;
}
