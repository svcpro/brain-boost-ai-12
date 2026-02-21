import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Building2, Users, GraduationCap, Plus, Search, ToggleLeft, ToggleRight,
  Loader2, Trash2, Eye, Pencil, Globe, Palette, BarChart3
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Institution {
  id: string;
  name: string;
  slug: string;
  type: string;
  logo_url: string | null;
  primary_color: string;
  domain: string | null;
  is_active: boolean;
  student_count: number;
  teacher_count: number;
  created_at: string;
}

export default function InstitutionManagement() {
  const { toast } = useToast();
  const [tab, setTab] = useState("list");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("coaching");
  const [creating, setCreating] = useState(false);
  const [selectedInst, setSelectedInst] = useState<Institution | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  useEffect(() => { loadInstitutions(); }, []);

  const loadInstitutions = async () => {
    setLoading(true);
    const { data } = await supabase.from("institutions").select("*").order("created_at", { ascending: false });
    setInstitutions((data as any[]) || []);
    setLoading(false);
  };

  const createInstitution = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const slug = newName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCreating(false); return; }

    const { error } = await supabase.from("institutions").insert({
      name: newName.trim(),
      slug,
      type: newType,
      admin_user_id: user.id,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Institution created ✅" });
      setNewName("");
      setShowCreate(false);
      loadInstitutions();
    }
    setCreating(false);
  };

  const toggleActive = async (inst: Institution) => {
    await supabase.from("institutions").update({ is_active: !inst.is_active }).eq("id", inst.id);
    loadInstitutions();
  };

  const loadMembers = async (instId: string) => {
    setMembersLoading(true);
    const { data } = await supabase.from("institution_members")
      .select("*")
      .eq("institution_id", instId)
      .order("joined_at", { ascending: false });
    setMembers((data as any[]) || []);
    setMembersLoading(false);
  };

  const viewInstitution = (inst: Institution) => {
    setSelectedInst(inst);
    loadMembers(inst.id);
    setTab("detail");
  };

  const filtered = institutions.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.slug.toLowerCase().includes(search.toLowerCase())
  );

  const TYPE_COLORS: Record<string, string> = {
    coaching: "bg-primary/15 text-primary",
    school: "bg-success/15 text-success",
    university: "bg-accent/15 text-accent",
    enterprise: "bg-warning/15 text-warning",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Institution Management</h2>
          <p className="text-xs text-muted-foreground">Manage schools, coaching centers, and enterprise clients</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="list" className="text-xs">All Institutions</TabsTrigger>
          <TabsTrigger value="detail" className="text-xs" disabled={!selectedInst}>Details</TabsTrigger>
          <TabsTrigger value="webhooks" className="text-xs">Webhooks</TabsTrigger>
          <TabsTrigger value="billing" className="text-xs">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4 mt-4">
          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search institutions..."
                className="w-full bg-secondary/60 border border-border/50 rounded-lg pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
            >
              <Plus className="w-3.5 h-3.5" /> Add Institution
            </button>
          </div>

          {/* Create form */}
          {showCreate && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="glass rounded-xl p-4 neural-border space-y-3">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Institution name"
                className="w-full bg-secondary/60 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
              <div className="flex gap-2">
                {["coaching", "school", "university", "enterprise"].map(t => (
                  <button
                    key={t}
                    onClick={() => setNewType(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${newType === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <button onClick={createInstitution} disabled={creating || !newName.trim()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create"}
              </button>
            </motion.div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total", value: institutions.length, icon: Building2 },
              { label: "Active", value: institutions.filter(i => i.is_active).length, icon: ToggleRight },
              { label: "Total Students", value: institutions.reduce((s, i) => s + i.student_count, 0), icon: GraduationCap },
              { label: "Total Teachers", value: institutions.reduce((s, i) => s + i.teacher_count, 0), icon: Users },
            ].map(s => (
              <div key={s.label} className="glass rounded-xl p-3 neural-border">
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">{s.label}</span>
                </div>
                <span className="text-lg font-bold text-foreground">{s.value}</span>
              </div>
            ))}
          </div>

          {/* List */}
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No institutions found</p>
          ) : (
            <div className="space-y-2">
              {filtered.map(inst => (
                <motion.div key={inst.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-xl p-4 neural-border flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: inst.primary_color + "20" }}>
                    <Building2 className="w-5 h-5" style={{ color: inst.primary_color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground truncate">{inst.name}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${TYPE_COLORS[inst.type] || "bg-secondary text-muted-foreground"}`}>{inst.type}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1"><GraduationCap className="w-3 h-3" />{inst.student_count} students</span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" />{inst.teacher_count} teachers</span>
                      {inst.domain && <span className="text-[10px] text-primary flex items-center gap-1"><Globe className="w-3 h-3" />{inst.domain}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => viewInstitution(inst)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"><Eye className="w-3.5 h-3.5" /></button>
                    <button onClick={() => toggleActive(inst)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">
                      {inst.is_active ? <ToggleRight className="w-3.5 h-3.5 text-success" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="detail" className="space-y-4 mt-4">
          {selectedInst && (
            <>
              <div className="glass rounded-xl p-5 neural-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: selectedInst.primary_color + "20" }}>
                    <Building2 className="w-6 h-6" style={{ color: selectedInst.primary_color }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{selectedInst.name}</h3>
                    <p className="text-xs text-muted-foreground">/{selectedInst.slug} • {selectedInst.type}</p>
                  </div>
                </div>

                {/* White-label branding */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-secondary/40">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Palette className="w-3 h-3" />Brand Color</span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-6 h-6 rounded-md border border-border" style={{ backgroundColor: selectedInst.primary_color }} />
                      <span className="text-xs font-mono text-foreground">{selectedInst.primary_color}</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/40">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Globe className="w-3 h-3" />Custom Domain</span>
                    <span className="text-xs font-medium text-foreground mt-1 block">{selectedInst.domain || "Not set"}</span>
                  </div>
                </div>
              </div>

              {/* Members */}
              <div className="glass rounded-xl p-4 neural-border">
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-primary" />Members</h4>
                {membersLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
                ) : members.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No members yet</p>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {members.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center">
                            {m.role === "teacher" ? <GraduationCap className="w-3.5 h-3.5 text-accent" /> : <Users className="w-3.5 h-3.5 text-muted-foreground" />}
                          </div>
                          <div>
                            <span className="text-xs font-medium text-foreground">{m.user_id.slice(0, 8)}...</span>
                            <span className={`ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${m.role === "teacher" ? "bg-accent/15 text-accent" : m.role === "institution_admin" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>{m.role}</span>
                          </div>
                        </div>
                        <span className={`text-[10px] ${m.is_active ? "text-success" : "text-muted-foreground"}`}>{m.is_active ? "Active" : "Inactive"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="webhooks" className="mt-4">
          <WebhookManagement />
        </TabsContent>

        <TabsContent value="billing" className="mt-4">
          <div className="glass rounded-xl p-8 neural-border text-center">
            <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-foreground mb-1">Enterprise Billing</h3>
            <p className="text-xs text-muted-foreground">Per-institution billing analytics coming soon</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Webhook Management Sub-component ───
function WebhookManagement() {
  const { toast } = useToast();
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadWebhooks(); }, []);

  const loadWebhooks = async () => {
    setLoading(true);
    const { data } = await supabase.from("webhook_endpoints").select("*").order("created_at", { ascending: false });
    setWebhooks((data as any[]) || []);
    setLoading(false);
  };

  const toggleWebhook = async (wh: any) => {
    await supabase.from("webhook_endpoints").update({ is_active: !wh.is_active }).eq("id", wh.id);
    loadWebhooks();
  };

  const EVENT_TYPES = ["session_completed", "score_changed", "topic_mastered", "streak_broken", "plan_expired", "emergency_triggered"];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Globe className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Webhook Endpoints</h3>
      </div>

      <div className="glass rounded-xl p-3 neural-border">
        <p className="text-[10px] text-muted-foreground mb-2">Supported events:</p>
        <div className="flex flex-wrap gap-1">
          {EVENT_TYPES.map(e => (
            <span key={e} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-mono">{e}</span>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : webhooks.length === 0 ? (
        <div className="glass rounded-xl p-8 neural-border text-center">
          <Globe className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No webhook endpoints configured</p>
          <p className="text-[10px] text-muted-foreground mt-1">Institutions can configure webhooks via the Enterprise API</p>
        </div>
      ) : (
        <div className="space-y-2">
          {webhooks.map(wh => (
            <div key={wh.id} className="glass rounded-xl p-3 neural-border flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${wh.is_active ? "bg-success" : "bg-muted-foreground"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-foreground truncate">{wh.url}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">{(wh.events || []).length} events</span>
                  {wh.failure_count > 0 && <span className="text-[10px] text-destructive">{wh.failure_count} failures</span>}
                  {wh.last_status_code && <span className={`text-[10px] ${wh.last_status_code < 400 ? "text-success" : "text-destructive"}`}>Last: {wh.last_status_code}</span>}
                </div>
              </div>
              <button onClick={() => toggleWebhook(wh)} className="p-1.5 rounded-lg hover:bg-secondary">
                {wh.is_active ? <ToggleRight className="w-4 h-4 text-success" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
