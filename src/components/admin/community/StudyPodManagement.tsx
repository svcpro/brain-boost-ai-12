import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Loader2, RefreshCw, Brain, ToggleLeft, ToggleRight,
  Search, Clock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Pod {
  id: string;
  name: string;
  description: string | null;
  subject: string | null;
  exam_type: string | null;
  difficulty_level: string;
  max_members: number;
  is_active: boolean;
  is_ai_created: boolean;
  created_at: string;
  member_count: number;
}

const StudyPodManagement = () => {
  const { toast } = useToast();
  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchPods = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("study-pods", { body: { action: "admin_list" } });
      if (error) throw error;
      setPods(data?.pods || []);
    } catch { toast({ title: "Failed to load pods", variant: "destructive" }); }
    setLoading(false);
  };

  useEffect(() => { fetchPods(); }, []);

  const togglePod = async (podId: string) => {
    try {
      const { error } = await supabase.functions.invoke("study-pods", { body: { action: "admin_toggle", pod_id: podId } });
      if (error) throw error;
      setPods(prev => prev.map(p => p.id === podId ? { ...p, is_active: !p.is_active } : p));
      toast({ title: "Pod updated" });
    } catch { toast({ title: "Failed", variant: "destructive" }); }
  };

  const filtered = pods.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.subject || "").toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: pods.length,
    active: pods.filter(p => p.is_active).length,
    aiCreated: pods.filter(p => p.is_ai_created).length,
    totalMembers: pods.reduce((s, p) => s + p.member_count, 0),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground">Study Pod Management</h3>
        <button onClick={fetchPods} className="p-2 hover:bg-secondary rounded-lg">
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Pods", value: stats.total, color: "text-primary" },
          { label: "Active", value: stats.active, color: "text-success" },
          { label: "AI Created", value: stats.aiCreated, color: "text-accent" },
          { label: "Total Members", value: stats.totalMembers, color: "text-warning" },
        ].map(s => (
          <div key={s.label} className="glass rounded-xl p-3 neural-border text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search pods..." className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary/50 border border-border text-sm text-foreground" />
      </div>

      {/* Pods List */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8">
          <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No study pods found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(pod => (
            <div key={pod.id} className="glass rounded-xl p-3 neural-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-foreground truncate">{pod.name}</h4>
                    {pod.is_ai_created && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium flex items-center gap-0.5">
                        <Brain className="w-2.5 h-2.5" /> AI
                      </span>
                    )}
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${pod.is_active ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                      {pod.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                    <span>{pod.member_count}/{pod.max_members} members</span>
                    {pod.subject && <span>{pod.subject}</span>}
                    <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{formatDistanceToNow(new Date(pod.created_at), { addSuffix: true })}</span>
                  </div>
                </div>
                <button onClick={() => togglePod(pod.id)} className="p-2 hover:bg-secondary rounded-lg">
                  {pod.is_active
                    ? <ToggleRight className="w-5 h-5 text-success" />
                    : <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                  }
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudyPodManagement;
