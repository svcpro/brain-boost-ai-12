import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  GraduationCap, Search, RefreshCw, Download, Mail, Phone,
  Instagram, Linkedin, MapPin, BookOpen, MessageCircle, Eye,
  Sparkles, TrendingUp, Users, Clock, CheckCircle2, XCircle,
  Star, Filter, MoreVertical, Send, Trash2, ChevronRight,
  Activity, Award, Target, Zap, Calendar, ArrowUpRight,
  LayoutGrid, List as ListIcon, Flame, ShieldCheck, Copy,
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
type Status = typeof STATUSES[number];

const STATUS_META: Record<string, { label: string; color: string; ring: string; chip: string; icon: any; glow: string }> = {
  new:         { label: "New",         color: "from-sky-500 to-blue-600",     ring: "ring-sky-400/40",     chip: "bg-sky-500/15 text-sky-300 border-sky-500/30",         icon: Sparkles,    glow: "shadow-[0_0_30px_-5px_rgba(56,189,248,0.4)]" },
  shortlisted: { label: "Shortlisted", color: "from-amber-500 to-orange-600", ring: "ring-amber-400/40",   chip: "bg-amber-500/15 text-amber-300 border-amber-500/30",   icon: Star,        glow: "shadow-[0_0_30px_-5px_rgba(245,158,11,0.4)]" },
  approved:    { label: "Approved",    color: "from-emerald-500 to-green-600",ring: "ring-emerald-400/40", chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", icon: CheckCircle2,glow: "shadow-[0_0_30px_-5px_rgba(16,185,129,0.4)]" },
  rejected:    { label: "Rejected",    color: "from-rose-500 to-red-600",     ring: "ring-rose-400/40",    chip: "bg-rose-500/15 text-rose-300 border-rose-500/30",      icon: XCircle,     glow: "shadow-[0_0_30px_-5px_rgba(244,63,94,0.4)]" },
  contacted:   { label: "Contacted",   color: "from-violet-500 to-purple-600",ring: "ring-violet-400/40",  chip: "bg-violet-500/15 text-violet-300 border-violet-500/30",icon: Send,        glow: "shadow-[0_0_30px_-5px_rgba(139,92,246,0.4)]" },
};

const csvEscape = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const timeAgo = (iso: string) => {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  if (d < 604800) return `${Math.floor(d / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
};

const scoreApplicant = (a: App): number => {
  let s = 0;
  if (a.why_join && a.why_join.length > 80) s += 25;
  if (a.leadership_experience && a.leadership_experience.length > 60) s += 25;
  if (a.linkedin) s += 15;
  if (a.instagram) s += 10;
  if (a.course) s += 10;
  if (a.email && a.phone) s += 15;
  return Math.min(100, s);
};

const initials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map(n => n[0]).join("").toUpperCase() || "?";

export default function CampusAmbassadorManagement() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const [view, setView] = useState<"pipeline" | "table">("pipeline");
  const [selected, setSelected] = useState<App | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const fetchApps = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("campus_ambassador_applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) toast.error("Failed to load", { description: error.message });
    else setApps((data || []) as App[]);
    setLoading(false);
  };

  useEffect(() => { fetchApps(); }, []);

  const cities = useMemo(() => Array.from(new Set(apps.map(a => a.city).filter(Boolean))).sort(), [apps]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return apps.filter(a => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (cityFilter !== "all" && a.city !== cityFilter) return false;
      if (scoreFilter !== "all") {
        const s = scoreApplicant(a);
        if (scoreFilter === "hot" && s < 75) return false;
        if (scoreFilter === "warm" && (s < 50 || s >= 75)) return false;
        if (scoreFilter === "cold" && s >= 50) return false;
      }
      if (!q) return true;
      return [a.full_name, a.email, a.phone, a.college, a.city, a.course]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(q));
    });
  }, [apps, search, statusFilter, cityFilter, scoreFilter]);

  const stats = useMemo(() => {
    const total = apps.length;
    const today = apps.filter(a => Date.now() - new Date(a.created_at).getTime() < 86400000).length;
    const week = apps.filter(a => Date.now() - new Date(a.created_at).getTime() < 604800000).length;
    const counts: Record<string, number> = {};
    STATUSES.forEach(s => counts[s] = apps.filter(a => a.status === s).length);
    const approvedRate = total ? Math.round((counts.approved / total) * 100) : 0;
    const responseRate = total ? Math.round(((counts.contacted + counts.approved + counts.rejected) / total) * 100) : 0;
    const hot = apps.filter(a => scoreApplicant(a) >= 75).length;
    return { total, today, week, counts, approvedRate, responseRate, hot };
  }, [apps]);

  const updateStatus = async (ids: string[], status: string) => {
    const prev = apps;
    setApps(prev.map(a => ids.includes(a.id) ? { ...a, status } : a));
    if (selected && ids.includes(selected.id)) setSelected({ ...selected, status });
    const { error } = await supabase
      .from("campus_ambassador_applications")
      .update({ status }).in("id", ids);
    if (error) { setApps(prev); toast.error("Update failed", { description: error.message }); }
    else toast.success(`${ids.length > 1 ? `${ids.length} applications` : "Status"} → ${status}`);
  };

  const deleteApps = async (ids: string[]) => {
    if (!confirm(`Delete ${ids.length} application(s)? This cannot be undone.`)) return;
    const prev = apps;
    setApps(prev.filter(a => !ids.includes(a.id)));
    setChecked(new Set());
    const { error } = await supabase.from("campus_ambassador_applications").delete().in("id", ids);
    if (error) { setApps(prev); toast.error("Delete failed", { description: error.message }); }
    else toast.success(`Deleted ${ids.length} application(s)`);
  };

  const exportCsv = (rows: App[]) => {
    const headers = ["created_at","status","full_name","phone","email","college","city","course","instagram","linkedin","why_join","leadership_experience","source"];
    const csv = [headers.join(",")].concat(rows.map(a => headers.map(h => csvEscape((a as any)[h])).join(","))).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `campus-ambassadors-${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} rows`);
  };

  const waLink = (phone: string, name: string) => {
    const num = phone.replace(/\D/g, "");
    const text = encodeURIComponent(`Hi ${name?.split(" ")[0] || ""}, this is ACRY AI regarding your Campus Ambassador application.`);
    return `https://wa.me/${num}?text=${text}`;
  };

  const toggleCheck = (id: string) => {
    setChecked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const grouped = useMemo(() => {
    const g: Record<Status, App[]> = { new: [], shortlisted: [], approved: [], rejected: [], contacted: [] };
    filtered.forEach(a => { (g[a.status as Status] || g.new).push(a); });
    return g;
  }, [filtered]);

  return (
    <div className="space-y-6 pb-20">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-950/40 via-violet-950/30 to-fuchsia-950/40 p-6"
      >
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,rgba(139,92,246,0.25),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(236,72,153,0.2),transparent_50%)]" />
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-violet-500/10 blur-3xl animate-pulse" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/30">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 gap-1">
                <Activity className="w-3 h-3 animate-pulse" /> LIVE
              </Badge>
            </div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-white via-violet-200 to-fuchsia-200 bg-clip-text text-transparent">
              Campus Ambassador Command Center
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
              India's next generation of AI leaders — apply intelligently, recruit ruthlessly.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchApps} disabled={loading} className="border-white/10 bg-white/5 backdrop-blur">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Sync
            </Button>
            <Button size="sm" onClick={() => exportCsv(filtered)} disabled={!filtered.length}
              className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 text-white border-0">
              <Download className="w-4 h-4 mr-2" /> Export {filtered.length}
            </Button>
          </div>
        </div>

        {/* Stat strip */}
        <div className="relative grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mt-6">
          <HeroStat icon={Users} label="Total" value={stats.total} accent="from-blue-500 to-cyan-500" />
          <HeroStat icon={Flame} label="Hot Leads" value={stats.hot} accent="from-orange-500 to-red-500" pulse />
          <HeroStat icon={Clock} label="Today" value={stats.today} accent="from-emerald-500 to-teal-500" />
          <HeroStat icon={Calendar} label="This Week" value={stats.week} accent="from-violet-500 to-purple-500" />
          <HeroStat icon={Target} label="Response" value={`${stats.responseRate}%`} accent="from-amber-500 to-orange-500" />
          <HeroStat icon={Award} label="Approved" value={stats.counts.approved || 0} accent="from-emerald-500 to-green-500" />
          <HeroStat icon={TrendingUp} label="Approval" value={`${stats.approvedRate}%`} accent="from-fuchsia-500 to-pink-500" />
        </div>

        {/* Funnel */}
        <div className="relative mt-6">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
            <Zap className="w-3 h-3" /> Conversion Pipeline
          </div>
          <div className="flex h-3 rounded-full overflow-hidden bg-white/5 border border-white/10">
            {STATUSES.map(s => {
              const pct = stats.total ? (stats.counts[s] / stats.total) * 100 : 0;
              if (!pct) return null;
              return (
                <motion.div
                  key={s}
                  initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className={`bg-gradient-to-r ${STATUS_META[s].color} relative group`}
                  title={`${STATUS_META[s].label}: ${stats.counts[s]} (${pct.toFixed(0)}%)`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 mt-2 text-[11px]">
            {STATUSES.map(s => (
              <div key={s} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${STATUS_META[s].color}`} />
                <span className="text-muted-foreground capitalize">{s}</span>
                <span className="font-semibold">{stats.counts[s] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Filter Bar */}
      <Card className="p-3 border-white/10 bg-card/50 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search name, email, phone, college, city…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-background/40 border-white/10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] bg-background/40 border-white/10"><Filter className="w-3.5 h-3.5 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-[150px] bg-background/40 border-white/10"><MapPin className="w-3.5 h-3.5 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">All cities</SelectItem>
              {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={scoreFilter} onValueChange={setScoreFilter}>
            <SelectTrigger className="w-[140px] bg-background/40 border-white/10"><Flame className="w-3.5 h-3.5 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All scores</SelectItem>
              <SelectItem value="hot">🔥 Hot (75+)</SelectItem>
              <SelectItem value="warm">⚡ Warm (50-74)</SelectItem>
              <SelectItem value="cold">❄ Cold (&lt;50)</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-1 bg-background/40 rounded-md p-1 border border-white/10">
            <Button variant={view === "pipeline" ? "default" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setView("pipeline")}>
              <LayoutGrid className="w-3.5 h-3.5" />
            </Button>
            <Button variant={view === "table" ? "default" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setView("table")}>
              <ListIcon className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Bulk action bar */}
        <AnimatePresence>
          {checked.size > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 p-3 rounded-lg bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 border border-violet-500/30 flex items-center justify-between flex-wrap gap-2">
                <div className="text-sm font-medium flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-violet-400" />
                  {checked.size} selected
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {STATUSES.map(s => (
                    <Button key={s} size="sm" variant="outline" className="h-7 capitalize border-white/10"
                      onClick={() => { updateStatus(Array.from(checked), s); setChecked(new Set()); }}>
                      → {s}
                    </Button>
                  ))}
                  <Button size="sm" variant="outline" className="h-7 border-white/10" onClick={() => exportCsv(apps.filter(a => checked.has(a.id)))}>
                    <Download className="w-3.5 h-3.5 mr-1" /> Export
                  </Button>
                  <Button size="sm" variant="destructive" className="h-7" onClick={() => deleteApps(Array.from(checked))}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => setChecked(new Set())}>Clear</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-64 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : view === "pipeline" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          {STATUSES.map(s => {
            const meta = STATUS_META[s];
            const items = grouped[s];
            const Icon = meta.icon;
            return (
              <div key={s} className="rounded-xl border border-white/10 bg-card/40 backdrop-blur flex flex-col min-h-[300px]">
                <div className={`p-3 border-b border-white/10 bg-gradient-to-r ${meta.color}/10`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-md bg-gradient-to-br ${meta.color} ${meta.glow}`}>
                        <Icon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="font-semibold text-sm">{meta.label}</span>
                    </div>
                    <Badge variant="outline" className={`${meta.chip} border`}>{items.length}</Badge>
                  </div>
                </div>
                <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[600px]">
                  {items.length === 0 ? (
                    <div className="text-center text-xs text-muted-foreground py-8">Empty</div>
                  ) : items.map(a => (
                    <ApplicantCard key={a.id} app={a} onClick={() => setSelected(a)}
                      checked={checked.has(a.id)} onCheck={() => toggleCheck(a.id)}
                      onStatus={(st) => updateStatus([a.id], st)} waLink={waLink}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden border-white/10 bg-card/40 backdrop-blur">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filtered.length > 0 && filtered.every(a => checked.has(a.id))}
                      onCheckedChange={(v) => {
                        const n = new Set(checked);
                        filtered.forEach(a => v ? n.add(a.id) : n.delete(a.id));
                        setChecked(n);
                      }}
                    />
                  </TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>College / City</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                    <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No applications match your filters.
                  </TableCell></TableRow>
                ) : filtered.map(a => {
                  const score = scoreApplicant(a);
                  const meta = STATUS_META[a.status] || STATUS_META.new;
                  return (
                    <TableRow key={a.id} className="border-white/10 hover:bg-white/5">
                      <TableCell>
                        <Checkbox checked={checked.has(a.id)} onCheckedChange={() => toggleCheck(a.id)} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${meta.color} flex items-center justify-center text-white text-xs font-bold ${meta.glow}`}>
                            {initials(a.full_name)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate max-w-[160px]">{a.full_name}</div>
                            {a.course && <div className="text-[11px] text-muted-foreground truncate max-w-[160px]">{a.course}</div>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><ScoreRing score={score} /></TableCell>
                      <TableCell>
                        <div className="text-xs flex items-center gap-1"><Mail className="w-3 h-3 opacity-60" />{a.email}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3 opacity-60" />{a.phone}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm truncate max-w-[180px]">{a.college}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{a.city}</div>
                      </TableCell>
                      <TableCell>
                        <Select value={a.status} onValueChange={v => updateStatus([a.id], v)}>
                          <SelectTrigger className={`h-7 w-[130px] capitalize border ${meta.chip}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(a.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-0.5">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSelected(a)}><Eye className="w-3.5 h-3.5" /></Button>
                          <a href={waLink(a.phone, a.full_name)} target="_blank" rel="noopener noreferrer">
                            <Button size="icon" variant="ghost" className="h-7 w-7"><MessageCircle className="w-3.5 h-3.5 text-green-500" /></Button>
                          </a>
                          <a href={`mailto:${a.email}`}>
                            <Button size="icon" variant="ghost" className="h-7 w-7"><Mail className="w-3.5 h-3.5" /></Button>
                          </a>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7"><MoreVertical className="w-3.5 h-3.5" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel className="text-xs">Quick Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(a.email); toast.success("Email copied"); }}>
                                <Copy className="w-3.5 h-3.5 mr-2" /> Copy email
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(a.phone); toast.success("Phone copied"); }}>
                                <Copy className="w-3.5 h-3.5 mr-2" /> Copy phone
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => deleteApps([a.id])} className="text-rose-400">
                                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Detail */}
      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto p-0 border-white/10 bg-gradient-to-br from-card to-card/80">
          {selected && (() => {
            const meta = STATUS_META[selected.status] || STATUS_META.new;
            const score = scoreApplicant(selected);
            return (
              <>
                <div className={`relative p-6 bg-gradient-to-br ${meta.color}/20 border-b border-white/10`}>
                  <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
                  <DialogHeader className="relative">
                    <div className="flex items-start gap-4">
                      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${meta.color} flex items-center justify-center text-white text-xl font-black ${meta.glow}`}>
                        {initials(selected.full_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <DialogTitle className="text-2xl font-bold">{selected.full_name}</DialogTitle>
                        <DialogDescription className="mt-1 flex items-center gap-2 flex-wrap">
                          <Badge className={`capitalize border ${meta.chip}`}>{selected.status}</Badge>
                          <span className="text-xs">Applied {timeAgo(selected.created_at)}</span>
                          {selected.source && <Badge variant="outline" className="text-xs">src: {selected.source}</Badge>}
                        </DialogDescription>
                      </div>
                      <ScoreRing score={score} size="lg" />
                    </div>
                  </DialogHeader>
                </div>

                <div className="p-6 space-y-5">
                  {/* Status changer */}
                  <div className="flex gap-1.5 flex-wrap">
                    {STATUSES.map(s => {
                      const m = STATUS_META[s];
                      const active = selected.status === s;
                      return (
                        <button key={s} onClick={() => updateStatus([selected.id], s)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize border transition-all ${
                            active ? `bg-gradient-to-r ${m.color} text-white border-transparent ${m.glow}` : "border-white/10 hover:bg-white/5"
                          }`}>
                          {s}
                        </button>
                      );
                    })}
                  </div>

                  <Tabs defaultValue="profile">
                    <TabsList className="bg-white/5 border border-white/10">
                      <TabsTrigger value="profile">Profile</TabsTrigger>
                      <TabsTrigger value="essays">Essays</TabsTrigger>
                      <TabsTrigger value="social">Social</TabsTrigger>
                    </TabsList>

                    <TabsContent value="profile" className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-4">
                      <Field icon={<Mail className="w-4 h-4" />} label="Email" value={selected.email} href={`mailto:${selected.email}`} />
                      <Field icon={<Phone className="w-4 h-4" />} label="Phone" value={selected.phone} href={`tel:${selected.phone}`} />
                      <Field icon={<BookOpen className="w-4 h-4" />} label="College" value={selected.college} />
                      <Field icon={<MapPin className="w-4 h-4" />} label="City" value={selected.city} />
                      <Field icon={<BookOpen className="w-4 h-4" />} label="Course" value={selected.course || "—"} />
                    </TabsContent>

                    <TabsContent value="essays" className="space-y-3 mt-4">
                      {selected.why_join ? (
                        <EssayCard label="Why do you want to join?" text={selected.why_join} />
                      ) : <Empty msg="No motivation provided" />}
                      {selected.leadership_experience ? (
                        <EssayCard label="Leadership Experience" text={selected.leadership_experience} />
                      ) : <Empty msg="No leadership experience provided" />}
                    </TabsContent>

                    <TabsContent value="social" className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-4">
                      {selected.instagram ? (
                        <Field icon={<Instagram className="w-4 h-4" />} label="Instagram" value={selected.instagram}
                          href={selected.instagram.startsWith("http") ? selected.instagram : `https://instagram.com/${selected.instagram.replace("@","")}`} />
                      ) : <Empty msg="No Instagram" />}
                      {selected.linkedin ? (
                        <Field icon={<Linkedin className="w-4 h-4" />} label="LinkedIn" value={selected.linkedin}
                          href={selected.linkedin.startsWith("http") ? selected.linkedin : `https://${selected.linkedin}`} />
                      ) : <Empty msg="No LinkedIn" />}
                    </TabsContent>
                  </Tabs>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2 border-t border-white/10">
                    <a href={waLink(selected.phone, selected.full_name)} target="_blank" rel="noopener noreferrer">
                      <Button className="w-full bg-green-600 hover:bg-green-700">
                        <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
                      </Button>
                    </a>
                    <a href={`mailto:${selected.email}`}>
                      <Button variant="outline" className="w-full border-white/10">
                        <Mail className="w-4 h-4 mr-2" /> Email
                      </Button>
                    </a>
                    <a href={`tel:${selected.phone}`}>
                      <Button variant="outline" className="w-full border-white/10">
                        <Phone className="w-4 h-4 mr-2" /> Call
                      </Button>
                    </a>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Sub components ---------- */

function HeroStat({ icon: Icon, label, value, accent, pulse }: { icon: any; label: string; value: any; accent: string; pulse?: boolean }) {
  return (
    <motion.div whileHover={{ y: -2 }} className="relative group">
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur p-3 transition-all group-hover:border-white/20">
        <div className={`absolute -top-8 -right-8 w-16 h-16 rounded-full bg-gradient-to-br ${accent} opacity-20 blur-2xl ${pulse ? "animate-pulse" : ""}`} />
        <div className="relative flex items-start justify-between gap-1">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
            <div className="text-xl font-black mt-0.5">{value}</div>
          </div>
          <div className={`p-1.5 rounded-md bg-gradient-to-br ${accent} bg-opacity-20`}>
            <Icon className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ApplicantCard({ app, onClick, checked, onCheck, onStatus, waLink }: {
  app: App; onClick: () => void; checked: boolean; onCheck: () => void;
  onStatus: (s: string) => void; waLink: (p: string, n: string) => string;
}) {
  const meta = STATUS_META[app.status] || STATUS_META.new;
  const score = scoreApplicant(app);
  const isHot = score >= 75;
  return (
    <motion.div
      layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01, y: -1 }}
      className={`group relative rounded-lg border bg-card/80 p-2.5 cursor-pointer transition-all ${
        checked ? "border-violet-500/60 ring-2 ring-violet-500/30" : "border-white/10 hover:border-white/20"
      }`}
      onClick={onClick}
    >
      {isHot && (
        <div className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-[9px] font-black text-white shadow-lg shadow-red-500/40 flex items-center gap-0.5">
          <Flame className="w-2.5 h-2.5" /> HOT
        </div>
      )}
      <div className="flex items-start gap-2">
        <div onClick={(e) => { e.stopPropagation(); onCheck(); }} className="pt-0.5">
          <Checkbox checked={checked} onCheckedChange={onCheck} className="h-3.5 w-3.5" />
        </div>
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${meta.color} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>
          {initials(app.full_name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate">{app.full_name}</div>
          <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
            <MapPin className="w-2.5 h-2.5" /> {app.city}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">{app.college}</div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
        <div className="flex items-center gap-1">
          <div className="text-[10px] text-muted-foreground">Score</div>
          <div className={`text-[11px] font-bold ${score >= 75 ? "text-orange-400" : score >= 50 ? "text-amber-400" : "text-muted-foreground"}`}>{score}</div>
        </div>
        <div className="text-[10px] text-muted-foreground">{timeAgo(app.created_at)}</div>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition" onClick={(e) => e.stopPropagation()}>
          <a href={waLink(app.phone, app.full_name)} target="_blank" rel="noopener noreferrer">
            <button className="p-1 rounded hover:bg-green-500/20"><MessageCircle className="w-3 h-3 text-green-500" /></button>
          </a>
          <a href={`mailto:${app.email}`}>
            <button className="p-1 rounded hover:bg-white/10"><Mail className="w-3 h-3" /></button>
          </a>
        </div>
      </div>
    </motion.div>
  );
}

function ScoreRing({ score, size = "sm" }: { score: number; size?: "sm" | "lg" }) {
  const dim = size === "lg" ? 56 : 36;
  const stroke = size === "lg" ? 5 : 3;
  const r = (dim - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const color = score >= 75 ? "stroke-orange-500" : score >= 50 ? "stroke-amber-500" : "stroke-slate-500";
  return (
    <div className="relative" style={{ width: dim, height: dim }}>
      <svg width={dim} height={dim} className="-rotate-90">
        <circle cx={dim/2} cy={dim/2} r={r} strokeWidth={stroke} className="stroke-white/10" fill="none" />
        <circle cx={dim/2} cy={dim/2} r={r} strokeWidth={stroke} className={color} fill="none"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className={`absolute inset-0 flex items-center justify-center font-black ${size === "lg" ? "text-base" : "text-[10px]"}`}>
        {score}
      </div>
    </div>
  );
}

function Field({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  const content = (
    <div className="flex items-start gap-2 bg-white/5 hover:bg-white/10 transition rounded-lg p-2.5 border border-white/5">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</div>
        <div className="text-sm truncate">{value}</div>
      </div>
      {href && <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />}
    </div>
  );
  return href ? <a href={href} target="_blank" rel="noopener noreferrer" className="group">{content}</a> : content;
}

function EssayCard({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2 flex items-center gap-1.5">
        <ChevronRight className="w-3 h-3 text-violet-400" /> {label}
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
      <div className="mt-2 text-[10px] text-muted-foreground">{text.length} chars · ~{Math.ceil(text.split(/\s+/).length)} words</div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="text-xs text-muted-foreground italic p-3 rounded-lg border border-dashed border-white/10">{msg}</div>;
}
