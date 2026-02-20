import { useState, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Network, Sparkles } from "lucide-react";
import { isPast, isToday } from "date-fns";
import NeuralNodeActionPanel from "./NeuralNodeActionPanel";

/* ───────── Types ───────── */
interface TopicInfo {
  id: string;
  name: string;
  memory_strength: number;
  next_predicted_drop_date: string | null;
  last_revision_date: string | null;
}

interface SubjectHealthData {
  id: string;
  name: string;
  strength: number;
  topicCount: number;
  topics: TopicInfo[];
}

interface InteractiveMemoryMapProps {
  subjectHealth: SubjectHealthData[];
  onReview: (subject: string, topic: string) => void;
}

/* ───────── Constants ───────── */
const SUBJECT_HUES = [175, 260, 340, 45, 200, 120, 300, 30];
const CX = 180;
const CY = 180;
const VIEW = 360;

const strengthColor = (s: number) =>
  s > 70 ? "hsl(142 71% 45%)" : s > 50 ? "hsl(38 92% 50%)" : "hsl(0 72% 51%)";

const strengthGlow = (s: number) =>
  s > 70 ? "hsl(142 71% 45% / 0.5)" : s > 50 ? "hsl(38 92% 50% / 0.5)" : "hsl(0 72% 51% / 0.5)";

/* ───────── Subject orbit positions ───────── */
function getSubjectPositions(count: number) {
  const orbitR = 110;
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    return { x: CX + orbitR * Math.cos(angle), y: CY + orbitR * Math.sin(angle) };
  });
}

/* ───────── Topic positions around a subject ───────── */
function getTopicPositions(sx: number, sy: number, count: number) {
  const r = 38;
  return Array.from({ length: Math.min(count, 6) }, (_, i) => {
    const angle = (2 * Math.PI * i) / Math.min(count, 6) - Math.PI / 2;
    return { x: sx + r * Math.cos(angle), y: sy + r * Math.sin(angle) };
  });
}

/* ───────── Brain Core ───────── */
const BrainCore = ({ avgHealth }: { avgHealth: number }) => (
  <g>
    {/* Outer glow rings */}
    <motion.circle
      cx={CX} cy={CY} r={38} fill="none"
      stroke="hsl(var(--primary) / 0.08)" strokeWidth="1"
      animate={{ r: [38, 44], opacity: [0.3, 0] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeOut" }}
    />
    <motion.circle
      cx={CX} cy={CY} r={34} fill="none"
      stroke="hsl(var(--primary) / 0.12)" strokeWidth="1"
      animate={{ r: [34, 42], opacity: [0.4, 0] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeOut", delay: 1 }}
    />
    {/* Core gradient */}
    <circle cx={CX} cy={CY} r={30} fill="url(#coreGradient)" />
    <circle cx={CX} cy={CY} r={30} fill="none" stroke="hsl(var(--primary) / 0.4)" strokeWidth="1.5" />
    {/* Core label */}
    <text x={CX} y={CY - 4} textAnchor="middle" fill="hsl(var(--primary))" fontSize="16" fontWeight="800">
      {avgHealth}%
    </text>
    <text x={CX} y={CY + 10} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="7" fontWeight="600">
      BRAIN CORE
    </text>
  </g>
);

/* ───────── Connection lines ───────── */
const ConnectionLine = ({ x1, y1, x2, y2, hue, strength }: {
  x1: number; y1: number; x2: number; y2: number; hue: number; strength: number;
}) => {
  const opacity = Math.max(0.08, strength / 200);
  return (
    <motion.line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={`hsl(${hue} 50% 50% / ${opacity})`}
      strokeWidth="1"
      strokeDasharray="4 4"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 1.2, ease: "easeOut" }}
    />
  );
};

/* ───────── Subject Node ───────── */
const SubjectNode = ({ x, y, sub, hue, isSelected, onSelect, delay }: {
  x: number; y: number; sub: SubjectHealthData; hue: number;
  isSelected: boolean; onSelect: () => void; delay: number;
}) => {
  const atRisk = sub.topics.filter(t =>
    t.next_predicted_drop_date && (isPast(new Date(t.next_predicted_drop_date)) || isToday(new Date(t.next_predicted_drop_date)))
  ).length;
  const nodeR = 20;
  const col = `hsl(${hue} 60% 55%)`;
  const colDim = `hsl(${hue} 40% 25%)`;

  return (
    <motion.g
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay, type: "spring", stiffness: 200, damping: 20 }}
      style={{ cursor: "pointer" }}
      onClick={onSelect}
    >
      {/* Selection ring */}
      {isSelected && (
        <motion.circle
          cx={x} cy={y} r={nodeR + 5}
          fill="none" stroke={col} strokeWidth="1.5"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.6 }}
          transition={{ duration: 0.3 }}
        />
      )}
      {/* At-risk pulse */}
      {atRisk > 0 && (
        <motion.circle
          cx={x} cy={y} r={nodeR + 3}
          fill="none" stroke="hsl(0 72% 51% / 0.4)" strokeWidth="1.5"
          animate={{ r: [nodeR + 3, nodeR + 12], opacity: [0.5, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
      {/* Node body */}
      <circle cx={x} cy={y} r={nodeR} fill={colDim} stroke={col} strokeWidth="1.5"
        style={{ filter: `drop-shadow(0 0 8px ${col}40)` }}
      />
      {/* Strength text */}
      <text x={x} y={y - 2} textAnchor="middle" fill={col} fontSize="10" fontWeight="800">
        {sub.strength}%
      </text>
      {/* Name */}
      <text x={x} y={y + 8} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="6" fontWeight="500">
        {sub.name.length > 8 ? sub.name.slice(0, 7) + "…" : sub.name}
      </text>
      {/* Risk badge */}
      {atRisk > 0 && (
        <>
          <circle cx={x + nodeR - 4} cy={y - nodeR + 4} r={6} fill="hsl(0 72% 51%)" />
          <text x={x + nodeR - 4} y={y - nodeR + 7} textAnchor="middle" fill="white" fontSize="7" fontWeight="700">
            {atRisk}
          </text>
        </>
      )}
    </motion.g>
  );
};

/* ───────── Topic Node ───────── */
const TopicNode = ({ x, y, topic, hue, onTap, delay }: {
  x: number; y: number; topic: TopicInfo; hue: number;
  onTap: () => void; delay: number;
}) => {
  const s = topic.memory_strength;
  const col = strengthColor(s);
  const glow = strengthGlow(s);
  const nodeR = 10;
  const isAtRisk = topic.next_predicted_drop_date &&
    (isPast(new Date(topic.next_predicted_drop_date)) || isToday(new Date(topic.next_predicted_drop_date)));

  return (
    <motion.g
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ delay, type: "spring", stiffness: 300, damping: 25 }}
      style={{ cursor: "pointer" }}
      onClick={(e) => { e.stopPropagation(); onTap(); }}
    >
      {/* Decay ripple */}
      {isAtRisk && (
        <motion.circle
          cx={x} cy={y} r={nodeR}
          fill="none" stroke="hsl(0 72% 51% / 0.35)" strokeWidth="1"
          animate={{ r: [nodeR, nodeR + 10], opacity: [0.5, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, delay: delay * 0.5 }}
        />
      )}
      {/* Node */}
      <circle cx={x} cy={y} r={nodeR} fill={col} opacity={0.2}
        stroke={col} strokeWidth="1.2"
        style={{ filter: `drop-shadow(0 0 6px ${glow})` }}
      />
      <circle cx={x} cy={y} r={nodeR * (s / 100)} fill={col} opacity={0.7} />
      {/* Label */}
      <text x={x} y={y + nodeR + 9} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="5.5" fontWeight="500">
        {topic.name.length > 10 ? topic.name.slice(0, 9) + "…" : topic.name}
      </text>
    </motion.g>
  );
};

/* ───────── Influence Lines (topic→topic within subject) ───────── */
const InfluenceLines = ({ positions, topics }: {
  positions: { x: number; y: number }[];
  topics: TopicInfo[];
}) => {
  if (positions.length < 2) return null;
  const lines: { x1: number; y1: number; x2: number; y2: number; opacity: number }[] = [];
  for (let i = 0; i < positions.length; i++) {
    const next = (i + 1) % positions.length;
    const avgS = (topics[i].memory_strength + topics[next].memory_strength) / 200;
    lines.push({ x1: positions[i].x, y1: positions[i].y, x2: positions[next].x, y2: positions[next].y, opacity: Math.max(0.06, avgS * 0.25) });
  }
  return (
    <>
      {lines.map((l, i) => (
        <motion.line
          key={i}
          x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
          stroke={`hsl(var(--primary) / ${l.opacity})`}
          strokeWidth="0.7" strokeDasharray="2 3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 + i * 0.05 }}
        />
      ))}
    </>
  );
};

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */
export default function InteractiveMemoryMap({ subjectHealth, onReview }: InteractiveMemoryMapProps) {
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<{ topic: TopicInfo; subjectName: string; hue: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const subjectPositions = useMemo(() => getSubjectPositions(subjectHealth.length), [subjectHealth.length]);

  const avgHealth = useMemo(() => {
    if (subjectHealth.length === 0) return 0;
    return Math.round(subjectHealth.reduce((a, s) => a + s.strength, 0) / subjectHealth.length);
  }, [subjectHealth]);

  const selectedSub = useMemo(
    () => subjectHealth.find(s => s.id === selectedSubject),
    [subjectHealth, selectedSubject]
  );

  const selectedSubIndex = useMemo(
    () => subjectHealth.findIndex(s => s.id === selectedSubject),
    [subjectHealth, selectedSubject]
  );

  const topicPositions = useMemo(() => {
    if (!selectedSub || selectedSubIndex < 0) return [];
    const sp = subjectPositions[selectedSubIndex];
    return getTopicPositions(sp.x, sp.y, selectedSub.topics.length);
  }, [selectedSub, selectedSubIndex, subjectPositions]);

  const handleSubjectTap = useCallback((id: string) => {
    setSelectedTopic(null);
    setSelectedSubject(prev => prev === id ? null : id);
  }, []);

  const handleTopicTap = useCallback((topic: TopicInfo, subName: string, hue: number) => {
    setSelectedTopic({ topic, subjectName: subName, hue });
  }, []);

  /* ── Empty state ── */
  if (subjectHealth.length === 0) {
    return (
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
            <Network className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Neural Control</h3>
            <p className="text-[10px] text-muted-foreground">Memory network visualization</p>
          </div>
        </div>
        <div className="rounded-2xl p-6 text-center" style={{
          background: "linear-gradient(135deg, hsl(var(--card)), hsl(var(--secondary) / 0.3))",
          border: "1px solid hsl(var(--border))",
        }}>
          <Network className="w-8 h-8 text-primary/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Add subjects to activate neural map</p>
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.5 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
          <Network className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-foreground">Neural Control</h3>
          <p className="text-[10px] text-muted-foreground">Tap nodes to inspect &amp; stabilize</p>
        </div>
        {selectedSubject && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => { setSelectedSubject(null); setSelectedTopic(null); }}
            className="text-[10px] text-primary font-semibold px-2.5 py-1 rounded-lg bg-primary/10"
          >
            Reset View
          </motion.button>
        )}
      </div>

      {/* Neural visualization */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--secondary) / 0.3) 100%)",
          border: "1px solid hsl(var(--border))",
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className="w-full"
          style={{ aspectRatio: "1 / 1" }}
        >
          <defs>
            <radialGradient id="coreGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="hsl(var(--primary) / 0.25)" />
              <stop offset="100%" stopColor="hsl(var(--primary) / 0.05)" />
            </radialGradient>
            <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="hsl(var(--primary) / 0.06)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          {/* Background glow */}
          <circle cx={CX} cy={CY} r={170} fill="url(#bgGlow)" />

          {/* Orbit ring */}
          <circle
            cx={CX} cy={CY} r={110}
            fill="none" stroke="hsl(var(--border) / 0.3)" strokeWidth="1"
            strokeDasharray="4 6"
          />

          {/* Connection lines: core → subjects */}
          {subjectHealth.map((sub, si) => {
            const sp = subjectPositions[si];
            const hue = SUBJECT_HUES[si % SUBJECT_HUES.length];
            return (
              <ConnectionLine
                key={`conn-${sub.id}`}
                x1={CX} y1={CY} x2={sp.x} y2={sp.y}
                hue={hue} strength={sub.strength}
              />
            );
          })}

          {/* Topic influence lines */}
          {selectedSub && topicPositions.length > 1 && (
            <InfluenceLines
              positions={topicPositions}
              topics={selectedSub.topics.slice(0, 6)}
            />
          )}

          {/* Topic→Subject connection lines */}
          {selectedSub && selectedSubIndex >= 0 && (
            <>
              {topicPositions.map((tp, ti) => {
                const sp = subjectPositions[selectedSubIndex];
                return (
                  <motion.line
                    key={`tconn-${ti}`}
                    x1={sp.x} y1={sp.y} x2={tp.x} y2={tp.y}
                    stroke={`hsl(${SUBJECT_HUES[selectedSubIndex % SUBJECT_HUES.length]} 40% 40% / 0.15)`}
                    strokeWidth="0.8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: ti * 0.05 }}
                  />
                );
              })}
            </>
          )}

          {/* Brain Core */}
          <BrainCore avgHealth={avgHealth} />

          {/* Subject nodes */}
          {subjectHealth.map((sub, si) => {
            const sp = subjectPositions[si];
            const hue = SUBJECT_HUES[si % SUBJECT_HUES.length];
            return (
              <SubjectNode
                key={sub.id}
                x={sp.x} y={sp.y} sub={sub} hue={hue}
                isSelected={selectedSubject === sub.id}
                onSelect={() => handleSubjectTap(sub.id)}
                delay={0.2 + si * 0.08}
              />
            );
          })}

          {/* Topic nodes (shown when subject selected) */}
          <AnimatePresence>
            {selectedSub && selectedSubIndex >= 0 && (
              <>
                {selectedSub.topics.slice(0, 6).map((topic, ti) => {
                  const tp = topicPositions[ti];
                  if (!tp) return null;
                  const hue = SUBJECT_HUES[selectedSubIndex % SUBJECT_HUES.length];
                  return (
                    <TopicNode
                      key={topic.id}
                      x={tp.x} y={tp.y}
                      topic={topic} hue={hue}
                      onTap={() => handleTopicTap(topic, selectedSub.name, hue)}
                      delay={ti * 0.06}
                    />
                  );
                })}
              </>
            )}
          </AnimatePresence>
        </svg>

        {/* Tap hint */}
        {!selectedSubject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="absolute bottom-3 inset-x-0 flex justify-center pointer-events-none"
          >
            <span className="text-[9px] text-muted-foreground/60 bg-background/60 backdrop-blur-sm px-3 py-1 rounded-full">
              Tap a subject node to expand topics
            </span>
          </motion.div>
        )}

        {/* Topic action panel overlay */}
        <AnimatePresence>
          {selectedTopic && (
            <NeuralNodeActionPanel
              topic={selectedTopic.topic}
              subjectName={selectedTopic.subjectName}
              hue={selectedTopic.hue}
              onReview={onReview}
              onClose={() => setSelectedTopic(null)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3">
        {[
          { color: "hsl(142 71% 45%)", label: "Strong" },
          { color: "hsl(38 92% 50%)", label: "At Risk" },
          { color: "hsl(0 72% 51%)", label: "Critical" },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: l.color, boxShadow: `0 0 4px ${l.color}` }} />
            <span className="text-[9px] text-muted-foreground">{l.label}</span>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
