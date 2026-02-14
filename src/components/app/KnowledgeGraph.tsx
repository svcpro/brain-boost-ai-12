import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { X, ZoomIn, ZoomOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface TopicNode {
  id: string;
  name: string;
  subjectId: string;
  subjectName: string;
  strength: number;
  x: number;
  y: number;
}

interface Edge {
  from: string;
  to: string;
  crossSubject?: boolean;
}

const SUBJECT_COLORS = [
  "hsl(175, 80%, 50%)",
  "hsl(260, 70%, 60%)",
  "hsl(340, 75%, 55%)",
  "hsl(45, 90%, 55%)",
  "hsl(200, 80%, 55%)",
  "hsl(120, 60%, 50%)",
];

const KnowledgeGraph = ({ onClose }: { onClose: () => void }) => {
  const { user } = useAuth();
  const [nodes, setNodes] = useState<TopicNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadGraph = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: subjects } = await supabase
      .from("subjects")
      .select("id, name")
      .eq("user_id", user.id);

    if (!subjects || subjects.length === 0) {
      setLoading(false);
      return;
    }

    const { data: topics } = await supabase
      .from("topics")
      .select("id, name, subject_id, memory_strength")
      .eq("user_id", user.id);

    if (!topics || topics.length === 0) {
      setLoading(false);
      return;
    }

    const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));
    const cx = 200;
    const cy = 180;

    // Group topics by subject for cluster layout
    const grouped = new Map<string, typeof topics>();
    for (const t of topics) {
      const list = grouped.get(t.subject_id) || [];
      list.push(t);
      grouped.set(t.subject_id, list);
    }

    const allNodes: TopicNode[] = [];
    const subjectIds = Array.from(grouped.keys());

    subjectIds.forEach((sid, si) => {
      const clusterAngle = (2 * Math.PI * si) / subjectIds.length - Math.PI / 2;
      const clusterR = Math.min(120, 60 + subjectIds.length * 15);
      const clusterCx = cx + Math.cos(clusterAngle) * clusterR;
      const clusterCy = cy + Math.sin(clusterAngle) * clusterR;
      const items = grouped.get(sid)!;

      items.forEach((t, ti) => {
        const angle = (2 * Math.PI * ti) / items.length - Math.PI / 2;
        const r = Math.min(60, 25 + items.length * 8);
        allNodes.push({
          id: t.id,
          name: t.name,
          subjectId: t.subject_id,
          subjectName: subjectMap.get(t.subject_id) || "Unknown",
          strength: Number(t.memory_strength),
          x: clusterCx + Math.cos(angle) * r,
          y: clusterCy + Math.sin(angle) * r,
        });
      });
    });

    // Edges: connect topics within same subject
    const newEdges: Edge[] = [];
    for (const [, items] of grouped) {
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          newEdges.push({ from: items[i].id, to: items[j].id });
        }
      }
    }

    // Cross-subject edges: topics studied in the same session (same created_at minute window)
    const { data: studyLogs } = await supabase
      .from("study_logs")
      .select("topic_id, created_at")
      .eq("user_id", user.id)
      .not("topic_id", "is", null);

    if (studyLogs && studyLogs.length > 1) {
      // Group logs by 30-min windows to find co-studied topics
      const windowMap = new Map<string, Set<string>>();
      for (const log of studyLogs) {
        if (!log.topic_id) continue;
        const ts = new Date(log.created_at).getTime();
        const windowKey = String(Math.floor(ts / (30 * 60 * 1000)));
        if (!windowMap.has(windowKey)) windowMap.set(windowKey, new Set());
        windowMap.get(windowKey)!.add(log.topic_id);
      }

      const topicSubjectMap = new Map(topics.map((t) => [t.id, t.subject_id]));
      const crossEdgeSet = new Set<string>();

      for (const [, topicIds] of windowMap) {
        const ids = Array.from(topicIds);
        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            const sA = topicSubjectMap.get(ids[i]);
            const sB = topicSubjectMap.get(ids[j]);
            if (sA && sB && sA !== sB) {
              const key = [ids[i], ids[j]].sort().join("-");
              if (!crossEdgeSet.has(key)) {
                crossEdgeSet.add(key);
                newEdges.push({ from: ids[i], to: ids[j], crossSubject: true });
              }
            }
          }
        }
      }
    }

    setNodes(allNodes);
    setEdges(newEdges);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    const uniqueSubjects = [...new Set(nodes.map((n) => n.subjectId))];
    uniqueSubjects.forEach((sid, i) => {
      map.set(sid, SUBJECT_COLORS[i % SUBJECT_COLORS.length]);
    });
    return map;
  }, [nodes]);

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="glass rounded-2xl p-5 neural-border"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-foreground text-sm">Knowledge Graph</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setZoom((z) => Math.min(z + 0.2, 2))} className="p-1 rounded neural-border hover:glow-primary transition-all">
            <ZoomIn className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button onClick={() => setZoom((z) => Math.max(z - 0.2, 0.4))} className="p-1 rounded neural-border hover:glow-primary transition-all">
            <ZoomOut className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button onClick={onClose} className="p-1 rounded neural-border hover:glow-primary transition-all">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-[360px] flex items-center justify-center text-muted-foreground text-sm">Loading graph…</div>
      ) : nodes.length === 0 ? (
        <div className="h-[360px] flex items-center justify-center text-muted-foreground text-sm">Add topics to see your knowledge graph.</div>
      ) : (
        <>
          <svg
            viewBox="0 0 400 360"
            className="w-full h-auto"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
          >
            {/* Edges */}
            {edges.map((e, i) => {
              const from = nodeMap.get(e.from);
              const to = nodeMap.get(e.to);
              if (!from || !to) return null;
              return (
                <motion.line
                  key={i}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={e.crossSubject ? "hsl(45, 90%, 55%)" : "hsl(var(--border))"}
                  strokeWidth={e.crossSubject ? 1 : 0.5}
                  strokeOpacity={e.crossSubject ? 0.6 : 0.4}
                  strokeDasharray={e.crossSubject ? "4 3" : undefined}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, delay: i * 0.02 }}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map((node, i) => {
              const color = colorMap.get(node.subjectId) || SUBJECT_COLORS[0];
              const r = 4 + (node.strength / 100) * 8;
              return (
                <motion.g
                  key={node.id}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.1 + i * 0.03 }}
                >
                  <circle cx={node.x} cy={node.y} r={r + 3} fill={color} opacity={0.15} />
                  <circle cx={node.x} cy={node.y} r={r} fill={color} opacity={0.9} />
                  <title>{`${node.name} (${node.subjectName}) — ${node.strength}%`}</title>
                  <text
                    x={node.x}
                    y={node.y + r + 10}
                    textAnchor="middle"
                    fill="hsl(var(--muted-foreground))"
                    fontSize={6}
                    fontFamily="inherit"
                  >
                    {node.name.length > 12 ? node.name.slice(0, 11) + "…" : node.name}
                  </text>
                </motion.g>
              );
            })}
          </svg>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-3">
            {[...colorMap.entries()].map(([sid, color]) => {
              const subName = nodes.find((n) => n.subjectId === sid)?.subjectName || "";
              return (
                <div key={sid} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-[10px] text-muted-foreground">{subName}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </motion.div>
  );
};

export default KnowledgeGraph;
