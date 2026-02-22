import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Newspaper, Brain, Dna, Layers, Sparkles, Network, Target,
  Plus, Play, Loader2, CheckCircle2, XCircle, ChevronRight,
  Globe, Shield, TrendingUp, Atom, ArrowUpRight, ArrowDownRight,
  Eye, BookOpen, Zap, RefreshCw, Clock, BarChart3, CircleDot,
  FileText, Building2, MapPin, Scale, Activity, Landmark, IndianRupee
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCADashboard, useCAEvents, useCAEventDetail, useAddEvent, useCAPipeline, useApproveQuestion } from "@/hooks/useCurrentAffairs";
import { toast } from "sonner";

const ENTITY_ICONS: Record<string, any> = {
  policy: FileText,
  scheme: Shield,
  govt_body: Landmark,
  constitutional_article: Scale,
  act: BookOpen,
  location: MapPin,
  economic_indicator: IndianRupee,
  person: Brain,
  organization: Building2,
};

const ENTITY_COLORS: Record<string, string> = {
  policy: "text-blue-400 bg-blue-500/15 border-blue-500/20",
  scheme: "text-emerald-400 bg-emerald-500/15 border-emerald-500/20",
  govt_body: "text-violet-400 bg-violet-500/15 border-violet-500/20",
  constitutional_article: "text-amber-400 bg-amber-500/15 border-amber-500/20",
  act: "text-rose-400 bg-rose-500/15 border-rose-500/20",
  location: "text-cyan-400 bg-cyan-500/15 border-cyan-500/20",
  economic_indicator: "text-orange-400 bg-orange-500/15 border-orange-500/20",
  person: "text-pink-400 bg-pink-500/15 border-pink-500/20",
  organization: "text-teal-400 bg-teal-500/15 border-teal-500/20",
};

const EDGE_COLORS: Record<string, string> = {
  syllabus: "from-violet-500 to-purple-500",
  historical: "from-amber-500 to-orange-500",
  pyq: "from-rose-500 to-red-500",
  policy: "from-blue-500 to-indigo-500",
  impact: "from-emerald-500 to-teal-500",
};

const TABS = [
  { key: "overview", label: "Dashboard", icon: BarChart3 },
  { key: "events", label: "Events", icon: Newspaper },
  { key: "graph", label: "Event Graph", icon: Network },
  { key: "questions", label: "Questions", icon: Sparkles },
] as const;

type Tab = typeof TABS[number]["key"];

const PIPELINE_STAGES = [
  { key: "entities", label: "Entity Extraction", icon: Dna },
  { key: "graph", label: "Knowledge Graph", icon: Network },
  { key: "syllabus", label: "Syllabus Linking", icon: Target },
  { key: "questions", label: "Question Gen", icon: Sparkles },
  { key: "done", label: "Complete", icon: CheckCircle2 },
];

export default function CurrentAffairsAdmin() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", summary: "", raw_content: "", source_url: "", source_name: "", category: "polity" });
  const [examType, setExamType] = useState("UPSC");

  const { data: dashboard, isLoading: dashLoading } = useCADashboard();
  const { data: events, isLoading: eventsLoading } = useCAEvents();
  const { data: detail } = useCAEventDetail(selectedEvent);
  const addEvent = useAddEvent();
  const pipeline = useCAPipeline();
  const approveQ = useApproveQuestion();

  const handleAddEvent = async () => {
    if (!newEvent.title.trim()) return toast.error("Title is required");
    try {
      const created = await addEvent.mutateAsync(newEvent);
      toast.success("Event added");
      setShowAddEvent(false);
      setNewEvent({ title: "", summary: "", raw_content: "", source_url: "", source_name: "", category: "polity" });
      setSelectedEvent(created.id);
    } catch { toast.error("Failed to add event"); }
  };

  const runPipeline = (eventId: string) => {
    pipeline.mutate({ event_id: eventId, exam_type: examType }, {
      onSuccess: () => toast.success("Full pipeline complete!"),
      onError: () => toast.error("Pipeline failed"),
    });
  };

  const stageIndex = PIPELINE_STAGES.findIndex(s => s.key === pipeline.stage);

  return (
    <div className="space-y-5 relative">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <motion.div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-cyan-500/5 blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 7, repeat: Infinity }} />
        <motion.div className="absolute -bottom-20 -left-20 w-48 h-48 rounded-full bg-emerald-500/5 blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.4, 0.2, 0.4] }}
          transition={{ duration: 9, repeat: Infinity }} />
      </div>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/40 via-card/80 to-emerald-950/30 p-5"
      >
        <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent skew-x-12 pointer-events-none"
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 4, repeat: Infinity, repeatDelay: 6 }} />

        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <motion.div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/30 to-emerald-500/30 flex items-center justify-center backdrop-blur-sm border border-cyan-500/20"
              animate={{ boxShadow: ["0 0 20px rgba(6,182,212,0.2)", "0 0 40px rgba(6,182,212,0.4)", "0 0 20px rgba(6,182,212,0.2)"] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <Newspaper className="w-7 h-7 text-cyan-400" />
            </motion.div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-foreground tracking-tight">Current Affairs 2.0</h2>
                <Badge className="bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 border-cyan-500/30 text-cyan-300 text-[10px] font-mono">v2.0</Badge>
                <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                  <Badge className="bg-emerald-500/15 border-emerald-500/30 text-emerald-400 text-[9px]">
                    <CircleDot className="w-2 h-2 mr-0.5" /> LIVE
                  </Badge>
                </motion.div>
              </div>
              <p className="text-xs text-muted-foreground/80">Event Graph Intelligence · Auto Syllabus Mapping · Exam Question Generation</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative z-50">
              <Select value={examType} onValueChange={setExamType}>
                <SelectTrigger className="w-28 h-9 text-xs bg-secondary/50 border-border/50 backdrop-blur-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[200] bg-popover border border-border shadow-xl">
                  {["UPSC", "NEET", "JEE", "SSC CGL", "CAT", "GATE"].map(e => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" className="gap-1.5 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white" onClick={() => setShowAddEvent(true)}>
              <Plus className="w-3.5 h-3.5" /> Add Event
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Pipeline Progress */}
      <AnimatePresence>
        {pipeline.isPending && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/5 to-emerald-500/5 p-4"
          >
            <p className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" /> AI Pipeline Running
            </p>
            <div className="flex items-center gap-1">
              {PIPELINE_STAGES.map((s, i) => {
                const isActive = i === stageIndex;
                const isDone = i < stageIndex;
                return (
                  <div key={s.key} className="flex-1 flex items-center gap-1">
                    <motion.div
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
                        isDone ? "bg-emerald-500/20 text-emerald-400" :
                        isActive ? "bg-cyan-500/20 text-cyan-400" :
                        "bg-secondary/30 text-muted-foreground"
                      }`}
                      animate={isActive ? { scale: [1, 1.05, 1] } : {}}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      {isDone ? <CheckCircle2 className="w-3 h-3" /> : isActive ? <Loader2 className="w-3 h-3 animate-spin" /> : <s.icon className="w-3 h-3" />}
                      <span className="hidden sm:inline">{s.label}</span>
                    </motion.div>
                    {i < PIPELINE_STAGES.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/30" />}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {[
          { label: "Events", count: dashboard?.events?.count || 0, icon: Newspaper, color: "text-cyan-400", bg: "from-cyan-500/20 to-cyan-500/5", border: "border-cyan-500/20" },
          { label: "Entities", count: dashboard?.entities?.count || 0, icon: Dna, color: "text-violet-400", bg: "from-violet-500/20 to-violet-500/5", border: "border-violet-500/20" },
          { label: "Graph Edges", count: dashboard?.graph_edges?.count || 0, icon: Network, color: "text-emerald-400", bg: "from-emerald-500/20 to-emerald-500/5", border: "border-emerald-500/20" },
          { label: "Syllabus Links", count: dashboard?.syllabus_links?.count || 0, icon: Target, color: "text-amber-400", bg: "from-amber-500/20 to-amber-500/5", border: "border-amber-500/20" },
          { label: "Questions", count: dashboard?.questions?.count || 0, icon: Sparkles, color: "text-rose-400", bg: "from-rose-500/20 to-rose-500/5", border: "border-rose-500/20" },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, type: "spring" }} whileHover={{ scale: 1.04, y: -2 }}
          >
            <Card className={`bg-gradient-to-br ${s.bg} ${s.border} border shadow-lg`}>
              <CardContent className="p-3 text-center">
                <s.icon className={`w-5 h-5 mx-auto mb-1.5 ${s.color}`} />
                <motion.p className="text-2xl font-black text-foreground" key={s.count}
                  initial={{ scale: 1.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring" }}>
                  {s.count}
                </motion.p>
                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map((tab, i) => (
          <motion.button key={tab.key}
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
            onClick={() => setActiveTab(tab.key)}
            className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-300 ${
              activeTab === tab.key ? "text-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            {activeTab === tab.key && (
              <motion.div layoutId="caActiveTab"
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/15 to-emerald-500/15 border border-white/10"
                transition={{ type: "spring", stiffness: 300, damping: 30 }} />
            )}
            <tab.icon className="w-3.5 h-3.5 relative z-10" />
            <span className="relative z-10">{tab.label}</span>
          </motion.button>
        ))}
      </div>

      {/* Add Event Modal */}
      <AnimatePresence>
        {showAddEvent && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="rounded-xl border border-border bg-card p-5 space-y-3"
          >
            <h3 className="text-sm font-bold text-foreground">Add Current Affairs Event</h3>
            <Input placeholder="Event Title *" value={newEvent.title} onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))} className="text-xs" />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Source Name" value={newEvent.source_name} onChange={e => setNewEvent(p => ({ ...p, source_name: e.target.value }))} className="text-xs" />
              <Input placeholder="Source URL" value={newEvent.source_url} onChange={e => setNewEvent(p => ({ ...p, source_url: e.target.value }))} className="text-xs" />
            </div>
            <Textarea placeholder="Summary (brief overview)" value={newEvent.summary} onChange={e => setNewEvent(p => ({ ...p, summary: e.target.value }))} className="text-xs min-h-[60px]" />
            <Textarea placeholder="Full Content (paste article text for AI analysis)" value={newEvent.raw_content} onChange={e => setNewEvent(p => ({ ...p, raw_content: e.target.value }))} className="text-xs min-h-[100px]" />
            <div className="flex gap-2">
              <Select value={newEvent.category} onValueChange={v => setNewEvent(p => ({ ...p, category: v }))}>
                <SelectTrigger className="w-40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[200] bg-popover border border-border shadow-xl">
                  {["polity", "economy", "science", "environment", "international", "social", "defence", "sports"].map(c => (
                    <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" onClick={() => setShowAddEvent(false)}>Cancel</Button>
              <Button size="sm" disabled={addEvent.isPending} onClick={handleAddEvent}
                className="bg-gradient-to-r from-cyan-600 to-emerald-600 text-white">
                {addEvent.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add & Analyze
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>

          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* Entity Distribution */}
              {dashboard?.entities?.by_type && Object.keys(dashboard.entities.by_type).length > 0 && (
                <Card className="border-border/50 bg-card/80">
                  <CardContent className="p-4">
                    <p className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
                      <Dna className="w-3.5 h-3.5 text-violet-400" /> Entity Distribution
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(dashboard.entities.by_type as Record<string, number>).map(([type, count]) => {
                        const Icon = ENTITY_ICONS[type] || Atom;
                        const color = ENTITY_COLORS[type] || "text-muted-foreground bg-secondary/50 border-border/50";
                        return (
                          <motion.div key={type} whileHover={{ scale: 1.05 }}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${color}`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-medium capitalize">{type.replace(/_/g, " ")}</span>
                            <span className="text-xs font-black">{count}</span>
                          </motion.div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Graph Edge Distribution */}
              {dashboard?.graph_edges?.by_type && Object.keys(dashboard.graph_edges.by_type).length > 0 && (
                <Card className="border-border/50 bg-card/80">
                  <CardContent className="p-4">
                    <p className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
                      <Network className="w-3.5 h-3.5 text-emerald-400" /> Knowledge Graph Distribution
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {Object.entries(dashboard.graph_edges.by_type as Record<string, number>).map(([type, count]) => (
                        <div key={type} className="text-center p-2 rounded-lg bg-secondary/30">
                          <div className={`w-full h-1 rounded-full bg-gradient-to-r ${EDGE_COLORS[type] || "from-gray-400 to-gray-500"} mb-2`} />
                          <p className="text-lg font-black text-foreground">{count}</p>
                          <p className="text-[9px] text-muted-foreground capitalize">{type}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {dashLoading && (
                <div className="text-center py-10 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  <p className="text-xs">Loading dashboard...</p>
                </div>
              )}
            </div>
          )}

          {/* EVENTS TAB */}
          {activeTab === "events" && (
            <div className="space-y-3">
              {eventsLoading && <div className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>}
              {events && events.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                  <Newspaper className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No events yet. Click "Add Event" to start.</p>
                </div>
              )}
              {events?.map((event: any, i: number) => (
                <motion.div key={event.id}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                  className={`rounded-xl border p-4 cursor-pointer transition-all ${
                    selectedEvent === event.id
                      ? "border-cyan-500/30 bg-cyan-500/5 shadow-lg"
                      : "border-border/50 bg-card/80 hover:border-border hover:bg-card"
                  }`}
                  onClick={() => setSelectedEvent(event.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="text-sm font-bold text-foreground truncate">{event.title}</h4>
                        <Badge variant="outline" className="text-[9px]">{event.category}</Badge>
                        <Badge className={`text-[9px] ${
                          event.processing_status === "completed" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" :
                          event.processing_status === "processing" ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/20" :
                          "bg-secondary/50 text-muted-foreground border-border/50"
                        }`}>{event.processing_status}</Badge>
                      </div>
                      {event.summary && <p className="text-[11px] text-muted-foreground line-clamp-2">{event.summary}</p>}
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Dna className="w-3 h-3" />{event.entity_count} entities</span>
                        <span className="flex items-center gap-1"><Target className="w-3 h-3" />{event.syllabus_link_count} links</span>
                        <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" />{event.question_count} Qs</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(event.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1 text-[10px] shrink-0"
                      disabled={pipeline.isPending}
                      onClick={(e) => { e.stopPropagation(); runPipeline(event.id); }}>
                      {pipeline.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                      Run Pipeline
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* GRAPH TAB */}
          {activeTab === "graph" && (
            <div className="space-y-4">
              {!selectedEvent ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Network className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Select an event from the Events tab to view its knowledge graph.</p>
                </div>
              ) : detail ? (
                <>
                  {/* Entities */}
                  <Card className="border-border/50 bg-card/80">
                    <CardContent className="p-4">
                      <p className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
                        <Dna className="w-3.5 h-3.5 text-violet-400" /> Extracted Entities ({detail.entities.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {detail.entities.map((e: any, i: number) => {
                          const ent = e.ca_entities;
                          if (!ent) return null;
                          const Icon = ENTITY_ICONS[ent.entity_type] || Atom;
                          const color = ENTITY_COLORS[ent.entity_type] || "text-muted-foreground bg-secondary/50 border-border/50";
                          return (
                            <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i * 0.03 }} whileHover={{ scale: 1.05 }}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${color}`}
                            >
                              <Icon className="w-3 h-3" />
                              <span className="text-[10px] font-medium">{ent.name}</span>
                            </motion.div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Graph Edges */}
                  <Card className="border-border/50 bg-card/80">
                    <CardContent className="p-4">
                      <p className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
                        <Network className="w-3.5 h-3.5 text-emerald-400" /> Knowledge Graph Connections ({detail.edges.length})
                      </p>
                      <div className="space-y-2">
                        {detail.edges.map((edge: any, i: number) => (
                          <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/20"
                          >
                            <div className={`w-8 h-1 rounded-full bg-gradient-to-r ${EDGE_COLORS[edge.edge_type] || "from-gray-400 to-gray-500"}`} />
                            <Badge variant="outline" className="text-[9px] capitalize">{edge.edge_type}</Badge>
                            <span className="text-[11px] text-foreground font-medium flex-1">{edge.target_label}</span>
                            <span className="text-[10px] text-muted-foreground">{Math.round((edge.weight || 0) * 100)}%</span>
                          </motion.div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Syllabus Links */}
                  <Card className="border-border/50 bg-card/80">
                    <CardContent className="p-4">
                      <p className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
                        <Target className="w-3.5 h-3.5 text-amber-400" /> Syllabus Mapping ({detail.links.length})
                      </p>
                      <div className="space-y-2">
                        {detail.links.map((link: any, i: number) => (
                          <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/20">
                            <div className="flex-1">
                              <p className="text-[11px] font-medium text-foreground">{link.micro_topic}</p>
                              <p className="text-[10px] text-muted-foreground">{link.subject} · {link.exam_type}</p>
                            </div>
                            <div className="text-right">
                              <Progress value={(link.relevance_score || 0) * 100} className="w-16 h-1.5" />
                              <p className="text-[9px] text-muted-foreground mt-0.5">{Math.round((link.relevance_score || 0) * 100)}% relevance</p>
                            </div>
                            {link.pattern_detected && (
                              <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/20 text-[9px]">
                                <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> Pattern
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
              )}
            </div>
          )}

          {/* QUESTIONS TAB */}
          {activeTab === "questions" && (
            <div className="space-y-3">
              {!selectedEvent ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Select an event to view generated questions.</p>
                </div>
              ) : detail?.questions?.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No questions generated yet. Run the pipeline first.</p>
                </div>
              ) : (
                detail?.questions?.map((q: any, i: number) => (
                  <motion.div key={q.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <Card className={`border-border/50 ${
                      q.status === "approved" ? "bg-emerald-500/5 border-emerald-500/20" :
                      q.status === "rejected" ? "bg-destructive/5 border-destructive/20 opacity-60" :
                      "bg-card/80"
                    }`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={`text-[9px] capitalize ${
                              q.question_type === "prelims_mcq" ? "bg-violet-500/15 text-violet-400 border-violet-500/20" :
                              q.question_type === "mains_10" ? "bg-blue-500/15 text-blue-400 border-blue-500/20" :
                              q.question_type === "mains_15" ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/20" :
                              "bg-amber-500/15 text-amber-400 border-amber-500/20"
                            }`}>{q.question_type.replace(/_/g, " ")}</Badge>
                            {q.marks > 0 && <Badge variant="outline" className="text-[9px]">{q.marks} marks</Badge>}
                            <Badge variant="outline" className="text-[9px] capitalize">{q.difficulty}</Badge>
                            <Badge variant="outline" className="text-[9px] capitalize">{q.cognitive_level}</Badge>
                          </div>
                          {q.status === "draft" && (
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-400 hover:bg-emerald-500/10"
                                onClick={() => approveQ.mutate({ id: q.id, status: "approved" })}>
                                <CheckCircle2 className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                onClick={() => approveQ.mutate({ id: q.id, status: "rejected" })}>
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                          {q.status !== "draft" && (
                            <Badge className={`text-[9px] ${q.status === "approved" ? "bg-emerald-500/15 text-emerald-400" : "bg-destructive/15 text-destructive"}`}>
                              {q.status}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-foreground leading-relaxed mb-2">{q.question_text}</p>
                        {q.options && Array.isArray(q.options) && (
                          <div className="space-y-1 mb-2">
                            {q.options.map((opt: string, oi: number) => (
                              <div key={oi} className={`text-[11px] p-1.5 rounded ${
                                opt === q.correct_answer ? "bg-emerald-500/10 text-emerald-400 font-medium" : "text-muted-foreground"
                              }`}>
                                {String.fromCharCode(65 + oi)}. {opt}
                              </div>
                            ))}
                          </div>
                        )}
                        {q.explanation && (
                          <p className="text-[10px] text-muted-foreground bg-secondary/20 p-2 rounded-lg mt-2">{q.explanation}</p>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
