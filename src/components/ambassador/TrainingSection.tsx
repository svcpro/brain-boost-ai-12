import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Zap, Users, Calendar, Mic, Share2, Users2, Rocket,
  Play, FileText, StickyNote, HelpCircle, Lock, CheckCircle2,
  Trophy, Flame, Award, ChevronRight, X, Download, Sparkles, Clock,
} from "lucide-react";
import { AmbCard, AMB, NeonButton, ProgressRing, HudCorners, AnimatedCounter, LiveDot } from "./ui/primitives";
import type { AmbassadorProfile } from "./useAmbassador";
import { toast } from "sonner";

type Lesson = { id: string; title: string; type: "video" | "pdf" | "notes" | "quiz"; duration: string; xp: number };
type Module = {
  id: string;
  title: string;
  icon: any;
  color: string;
  tagline: string;
  level: "Foundation" | "Intermediate" | "Advanced" | "Elite";
  unlockXP: number;
  totalXP: number;
  lessons: Lesson[];
};

const MODULES: Module[] = [
  {
    id: "ai-basics", title: "AI Basics", icon: Brain, color: AMB.cyan,
    tagline: "Decode the language of intelligent machines",
    level: "Foundation", unlockXP: 0, totalXP: 220,
    lessons: [
      { id: "l1", title: "What is AI? The 2026 reality", type: "video", duration: "12m", xp: 30 },
      { id: "l2", title: "LLMs, agents & reasoning", type: "video", duration: "18m", xp: 40 },
      { id: "l3", title: "AI prompt engineering 101", type: "pdf", duration: "8m read", xp: 25 },
      { id: "l4", title: "Founder's notes: AI mental models", type: "notes", duration: "5m", xp: 20 },
      { id: "l5", title: "Quiz: Foundation check", type: "quiz", duration: "10 Qs", xp: 50 },
      { id: "l6", title: "Capstone: Build your first agent", type: "video", duration: "22m", xp: 55 },
    ],
  },
  {
    id: "ai-productivity", title: "AI Productivity", icon: Zap, color: AMB.amber,
    tagline: "10x your output with co-pilot workflows",
    level: "Foundation", unlockXP: 100, totalXP: 240,
    lessons: [
      { id: "l1", title: "The 5-tool AI productivity stack", type: "video", duration: "15m", xp: 35 },
      { id: "l2", title: "Email, calendar & research automation", type: "video", duration: "20m", xp: 45 },
      { id: "l3", title: "Prompt templates pack (50+)", type: "pdf", duration: "Download", xp: 30 },
      { id: "l4", title: "Daily AI rituals", type: "notes", duration: "6m", xp: 25 },
      { id: "l5", title: "Quiz: Workflow mastery", type: "quiz", duration: "8 Qs", xp: 50 },
      { id: "l6", title: "Capstone: Build your AI assistant", type: "video", duration: "18m", xp: 55 },
    ],
  },
  {
    id: "leadership", title: "Campus Leadership", icon: Users, color: AMB.purple,
    tagline: "Lead movements, not just meetings",
    level: "Intermediate", unlockXP: 300, totalXP: 280,
    lessons: [
      { id: "l1", title: "The Ambassador Operating System", type: "video", duration: "16m", xp: 40 },
      { id: "l2", title: "Building your inner circle", type: "video", duration: "14m", xp: 35 },
      { id: "l3", title: "Influence frameworks", type: "pdf", duration: "12m read", xp: 35 },
      { id: "l4", title: "Captain's playbook", type: "notes", duration: "8m", xp: 30 },
      { id: "l5", title: "Quiz: Leadership IQ", type: "quiz", duration: "12 Qs", xp: 60 },
      { id: "l6", title: "Capstone: 30-day campus blueprint", type: "video", duration: "25m", xp: 80 },
    ],
  },
  {
    id: "workshops", title: "Workshop Management", icon: Calendar, color: AMB.pink,
    tagline: "Host events that go viral on campus",
    level: "Intermediate", unlockXP: 500, totalXP: 260,
    lessons: [
      { id: "l1", title: "Workshop design canvas", type: "video", duration: "14m", xp: 40 },
      { id: "l2", title: "Logistics, sponsors & venues", type: "video", duration: "16m", xp: 40 },
      { id: "l3", title: "Run-of-show templates", type: "pdf", duration: "Download", xp: 35 },
      { id: "l4", title: "Post-event amplification", type: "notes", duration: "6m", xp: 25 },
      { id: "l5", title: "Quiz: Event readiness", type: "quiz", duration: "10 Qs", xp: 50 },
      { id: "l6", title: "Capstone: Plan your launch event", type: "video", duration: "20m", xp: 70 },
    ],
  },
  {
    id: "speaking", title: "Public Speaking", icon: Mic, color: AMB.cyan,
    tagline: "Command any room — physical or digital",
    level: "Intermediate", unlockXP: 700, totalXP: 250,
    lessons: [
      { id: "l1", title: "Stage presence fundamentals", type: "video", duration: "18m", xp: 45 },
      { id: "l2", title: "Story arcs that convert", type: "video", duration: "20m", xp: 50 },
      { id: "l3", title: "Speech architecture guide", type: "pdf", duration: "15m read", xp: 35 },
      { id: "l4", title: "Voice & breath drills", type: "notes", duration: "7m", xp: 25 },
      { id: "l5", title: "Quiz: Speaker IQ", type: "quiz", duration: "10 Qs", xp: 45 },
      { id: "l6", title: "Capstone: Record a 3-min talk", type: "video", duration: "Submission", xp: 50 },
    ],
  },
  {
    id: "branding", title: "Social Media Branding", icon: Share2, color: AMB.amber,
    tagline: "Engineer a magnetic personal brand",
    level: "Advanced", unlockXP: 1000, totalXP: 290,
    lessons: [
      { id: "l1", title: "Positioning & niche selection", type: "video", duration: "16m", xp: 45 },
      { id: "l2", title: "Content engine: ideation to post", type: "video", duration: "22m", xp: 55 },
      { id: "l3", title: "AI content workflows", type: "pdf", duration: "12m read", xp: 40 },
      { id: "l4", title: "Hook & hashtag vault", type: "notes", duration: "Download", xp: 35 },
      { id: "l5", title: "Quiz: Brand growth audit", type: "quiz", duration: "12 Qs", xp: 55 },
      { id: "l6", title: "Capstone: 30-day content sprint", type: "video", duration: "18m", xp: 60 },
    ],
  },
  {
    id: "community", title: "Student Community Building", icon: Users2, color: AMB.purple,
    tagline: "Spark tribes that outlast graduation",
    level: "Advanced", unlockXP: 1500, totalXP: 270,
    lessons: [
      { id: "l1", title: "Anatomy of high-trust communities", type: "video", duration: "17m", xp: 45 },
      { id: "l2", title: "Onboarding & rituals", type: "video", duration: "15m", xp: 40 },
      { id: "l3", title: "Community OS template", type: "pdf", duration: "Download", xp: 40 },
      { id: "l4", title: "Engagement loops", type: "notes", duration: "8m", xp: 30 },
      { id: "l5", title: "Quiz: Community health", type: "quiz", duration: "10 Qs", xp: 50 },
      { id: "l6", title: "Capstone: Launch a study pod", type: "video", duration: "20m", xp: 65 },
    ],
  },
  {
    id: "future-skills", title: "AI Future Skills", icon: Rocket, color: AMB.pink,
    tagline: "Skills for jobs that don't exist yet",
    level: "Elite", unlockXP: 2500, totalXP: 350,
    lessons: [
      { id: "l1", title: "Agentic workflows & autonomy", type: "video", duration: "22m", xp: 60 },
      { id: "l2", title: "Building with no-code + AI", type: "video", duration: "25m", xp: 65 },
      { id: "l3", title: "Future of work playbook", type: "pdf", duration: "20m read", xp: 50 },
      { id: "l4", title: "AI ethics & safety", type: "notes", duration: "10m", xp: 40 },
      { id: "l5", title: "Quiz: Future readiness", type: "quiz", duration: "15 Qs", xp: 65 },
      { id: "l6", title: "Capstone: Ship an AI product", type: "video", duration: "30m", xp: 70 },
    ],
  },
];

type Progress = Record<string, string[]>; // moduleId -> completed lessonIds
const LS_KEY = "amb_training_progress_v1";
const LS_STREAK = "amb_training_streak_v1";

function loadProgress(): Progress {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
}
function saveProgress(p: Progress) { localStorage.setItem(LS_KEY, JSON.stringify(p)); }

function loadStreak(): { count: number; lastDay: string } {
  try { return JSON.parse(localStorage.getItem(LS_STREAK) || "{}"); } catch { return { count: 0, lastDay: "" }; }
}
function bumpStreak(): number {
  const today = new Date().toISOString().slice(0, 10);
  const s = loadStreak();
  if (s.lastDay === today) return s.count;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const next = { count: s.lastDay === yesterday ? (s.count || 0) + 1 : 1, lastDay: today };
  localStorage.setItem(LS_STREAK, JSON.stringify(next));
  return next.count;
}

const TYPE_META: Record<Lesson["type"], { icon: any; label: string; color: string }> = {
  video: { icon: Play, label: "Video", color: AMB.cyan },
  pdf: { icon: FileText, label: "PDF", color: AMB.amber },
  notes: { icon: StickyNote, label: "Notes", color: AMB.purple },
  quiz: { icon: HelpCircle, label: "Quiz", color: AMB.pink },
};

export function TrainingSection({ profile }: { profile: AmbassadorProfile }) {
  const [progress, setProgress] = useState<Progress>({});
  const [streak, setStreak] = useState<number>(0);
  const [openModule, setOpenModule] = useState<Module | null>(null);

  useEffect(() => {
    setProgress(loadProgress());
    setStreak(loadStreak().count || 0);
  }, []);

  const totalXP = useMemo(() => {
    let xp = 0;
    for (const m of MODULES) {
      const done = progress[m.id] || [];
      for (const l of m.lessons) if (done.includes(l.id)) xp += l.xp;
    }
    return xp;
  }, [progress]);

  const completedModules = MODULES.filter(m => (progress[m.id]?.length || 0) === m.lessons.length).length;
  const totalLessons = MODULES.reduce((a, m) => a + m.lessons.length, 0);
  const completedLessons = Object.values(progress).reduce((a, arr) => a + arr.length, 0);
  const overallPct = Math.round((completedLessons / totalLessons) * 100);

  const userXP = profile.xp || 0;

  const toggleLesson = (mod: Module, lesson: Lesson) => {
    const done = new Set(progress[mod.id] || []);
    const wasDone = done.has(lesson.id);
    if (wasDone) done.delete(lesson.id);
    else done.add(lesson.id);
    const next = { ...progress, [mod.id]: Array.from(done) };
    setProgress(next);
    saveProgress(next);
    if (!wasDone) {
      const s = bumpStreak();
      setStreak(s);
      toast.success(`+${lesson.xp} XP earned`, { description: `${lesson.title} · streak ${s} 🔥` });
      // Module complete?
      if (next[mod.id].length === mod.lessons.length) {
        setTimeout(() => toast.success(`🏆 ${mod.title} complete!`, { description: "Certificate unlocked" }), 400);
      }
    }
  };

  const downloadCert = (mod: Module) => {
    const name = profile.full_name || "Ambassador";
    const code = profile.ambassador_code || "ACRY";
    const date = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1100">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0d0512"/><stop offset="100%" stop-color="#1a0726"/>
    </linearGradient>
    <linearGradient id="acc" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${AMB.cyan}"/><stop offset="50%" stop-color="${AMB.amber}"/><stop offset="100%" stop-color="${AMB.purple}"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="1100" fill="url(#bg)"/>
  <rect x="40" y="40" width="1520" height="1020" fill="none" stroke="url(#acc)" stroke-width="4" rx="20"/>
  <rect x="60" y="60" width="1480" height="980" fill="none" stroke="${AMB.border}" stroke-width="1" rx="14"/>
  <text x="800" y="200" font-family="Space Grotesk, sans-serif" font-size="28" fill="${AMB.amber}" text-anchor="middle" letter-spacing="14">ACRY · AMBASSADOR OS</text>
  <text x="800" y="320" font-family="Space Grotesk, sans-serif" font-weight="800" font-size="84" fill="${AMB.text}" text-anchor="middle">CERTIFICATE OF MASTERY</text>
  <line x1="500" y1="370" x2="1100" y2="370" stroke="url(#acc)" stroke-width="3"/>
  <text x="800" y="450" font-family="DM Sans, sans-serif" font-size="26" fill="${AMB.mute}" text-anchor="middle">This is to certify that</text>
  <text x="800" y="540" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="68" fill="${AMB.cyan}" text-anchor="middle">${name}</text>
  <text x="800" y="610" font-family="DM Sans, sans-serif" font-size="24" fill="${AMB.mute}" text-anchor="middle">has successfully completed the training module</text>
  <text x="800" y="700" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="54" fill="${AMB.amber}" text-anchor="middle">${mod.title}</text>
  <text x="800" y="760" font-family="DM Sans, sans-serif" font-size="22" fill="${AMB.text}" text-anchor="middle">${mod.tagline}</text>
  <text x="200" y="950" font-family="Space Grotesk, sans-serif" font-size="20" fill="${AMB.text}">${code}</text>
  <text x="200" y="980" font-family="DM Sans, sans-serif" font-size="14" fill="${AMB.mute}">Ambassador ID</text>
  <text x="1400" y="950" font-family="Space Grotesk, sans-serif" font-size="20" fill="${AMB.text}" text-anchor="end">${date}</text>
  <text x="1400" y="980" font-family="DM Sans, sans-serif" font-size="14" fill="${AMB.mute}" text-anchor="end">Issued on</text>
  <text x="800" y="970" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="22" fill="url(#acc)" text-anchor="middle">ACRY.ai · India's largest AI Student Leadership ecosystem</text>
</svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ACRY-Certificate-${mod.id}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Certificate downloaded");
  };

  return (
    <div className="space-y-5">
      {/* HERO — Training command bay */}
      <AmbCard hud glow={AMB.cyan} className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <LiveDot color={AMB.amber} label="Training Reactor · Online" />
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl" style={{ color: AMB.text, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}>
              Ambassador <span style={{ color: AMB.amber }}>Training Center</span>
            </h2>
            <p className="mt-1 text-sm" style={{ color: AMB.mute }}>
              8 modules · {totalLessons} lessons · {MODULES.reduce((a, m) => a + m.totalXP, 0)} XP at stake
            </p>
          </div>
          <div className="flex items-center gap-4">
            <ProgressRing value={overallPct} size={104} color={AMB.cyan} glow={AMB.amber} label={`${overallPct}%`} sub="Mastery" />
            <div className="grid grid-cols-2 gap-2">
              <StatTile icon={Trophy} label="Modules" value={`${completedModules}/${MODULES.length}`} color={AMB.amber} />
              <StatTile icon={Flame} label="Streak" value={`${streak}d`} color={AMB.pink} />
              <StatTile icon={Zap} label="XP earned" value={<AnimatedCounter value={totalXP} />} color={AMB.cyan} />
              <StatTile icon={Award} label="Certificates" value={completedModules} color={AMB.purple} />
            </div>
          </div>
        </div>
      </AmbCard>

      {/* MODULE GRID */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {MODULES.map((m, i) => {
          const done = progress[m.id]?.length || 0;
          const pct = Math.round((done / m.lessons.length) * 100);
          const locked = userXP < m.unlockXP;
          const complete = done === m.lessons.length;
          const Icon = m.icon;
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <AmbCard hud glow={m.color} className="group relative p-5">
                {/* Level pill */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="absolute -inset-1 rounded-2xl opacity-50 blur-md" style={{ background: `radial-gradient(circle, ${m.color}, transparent 70%)` }} />
                      <div className="relative grid h-12 w-12 place-items-center rounded-2xl"
                        style={{ background: `linear-gradient(135deg, ${m.color}33, ${AMB.amber}22)`, border: `1px solid ${m.color}55` }}>
                        <Icon className="h-5 w-5" style={{ color: m.color }} />
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: m.color }}>{m.level}</div>
                      <div className="text-base font-bold" style={{ color: AMB.text, fontFamily: "'Space Grotesk', sans-serif" }}>{m.title}</div>
                    </div>
                  </div>
                  {complete ? (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold"
                      style={{ background: `${AMB.amber}22`, color: AMB.amber, border: `1px solid ${AMB.amber}55` }}>
                      <CheckCircle2 className="h-3 w-3" /> COMPLETE
                    </span>
                  ) : locked ? (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold"
                      style={{ background: "rgba(255,255,255,0.05)", color: AMB.mute, border: `1px solid ${AMB.border}` }}>
                      <Lock className="h-3 w-3" /> LOCKED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold"
                      style={{ background: `${m.color}22`, color: m.color, border: `1px solid ${m.color}55` }}>
                      <Sparkles className="h-3 w-3" /> ACTIVE
                    </span>
                  )}
                </div>

                <p className="mt-3 text-sm leading-snug" style={{ color: AMB.mute }}>{m.tagline}</p>

                {/* Stats strip */}
                <div className="mt-3 flex items-center gap-3 text-[10px] uppercase tracking-wider" style={{ color: AMB.mute }}>
                  <span className="inline-flex items-center gap-1"><Play className="h-3 w-3" /> {m.lessons.length} lessons</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1"><Zap className="h-3 w-3" style={{ color: AMB.amber }} /> {m.totalXP} XP</span>
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider" style={{ color: AMB.mute }}>
                    <span>Progress</span>
                    <span style={{ color: m.color }}>{done}/{m.lessons.length} · {pct}%</span>
                  </div>
                  <div className="relative h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(255,244,234,0.06)" }}>
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }}
                      className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${m.color}, ${AMB.amber})` }}
                    />
                  </div>
                </div>

                {/* CTA */}
                <div className="mt-4 flex gap-2">
                  {locked ? (
                    <div className="flex-1 rounded-xl px-3 py-2.5 text-center text-xs"
                      style={{ background: "rgba(255,255,255,0.04)", color: AMB.mute, border: `1px dashed ${AMB.border}` }}>
                      Unlock at <span style={{ color: AMB.amber, fontWeight: 700 }}>{m.unlockXP} XP</span> · you have {userXP}
                    </div>
                  ) : (
                    <NeonButton onClick={() => setOpenModule(m)} className="flex-1" variant={complete ? "ghost" : "primary"}>
                      {complete ? "Review" : done > 0 ? "Continue" : "Start"}
                      <ChevronRight className="h-4 w-4" />
                    </NeonButton>
                  )}
                  {complete && (
                    <NeonButton variant="ghost" onClick={() => downloadCert(m)} title="Download certificate">
                      <Download className="h-4 w-4" />
                    </NeonButton>
                  )}
                </div>
              </AmbCard>
            </motion.div>
          );
        })}
      </div>

      {/* LESSON DRAWER */}
      <AnimatePresence>
        {openModule && (
          <ModuleDrawer
            module={openModule}
            done={progress[openModule.id] || []}
            onClose={() => setOpenModule(null)}
            onToggle={(l) => toggleLesson(openModule, l)}
            onCert={() => downloadCert(openModule)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, color }: { icon: any; label: string; value: React.ReactNode; color: string }) {
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: "rgba(255,244,234,0.04)", border: `1px solid ${AMB.border}` }}>
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider" style={{ color: AMB.mute }}>
        <Icon className="h-3 w-3" style={{ color }} /> {label}
      </div>
      <div className="mt-0.5 text-base font-bold" style={{ color: AMB.text, fontFamily: "'Space Grotesk', sans-serif" }}>{value}</div>
    </div>
  );
}

function ModuleDrawer({
  module: mod, done, onClose, onToggle, onCert,
}: {
  module: Module; done: string[]; onClose: () => void; onToggle: (l: Lesson) => void; onCert: () => void;
}) {
  const Icon = mod.icon;
  const complete = done.length === mod.lessons.length;
  const pct = Math.round((done.length / mod.lessons.length) * 100);
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50" onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 280, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l p-5 sm:p-6"
        style={{ borderColor: AMB.border, background: AMB.bg2 }}
      >
        <HudCorners color={mod.color} />
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl"
              style={{ background: `linear-gradient(135deg, ${mod.color}33, ${AMB.amber}22)`, border: `1px solid ${mod.color}55` }}>
              <Icon className="h-5 w-5" style={{ color: mod.color }} />
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: mod.color }}>{mod.level} module</div>
              <div className="text-xl font-bold" style={{ color: AMB.text, fontFamily: "'Space Grotesk', sans-serif" }}>{mod.title}</div>
            </div>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: "rgba(255,255,255,0.06)" }}>
            <X className="h-4 w-4" style={{ color: AMB.text }} />
          </button>
        </div>

        <p className="mt-3 text-sm" style={{ color: AMB.mute }}>{mod.tagline}</p>

        <div className="mt-4 rounded-xl px-3 py-2" style={{ background: "rgba(255,244,234,0.04)", border: `1px solid ${AMB.border}` }}>
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider" style={{ color: AMB.mute }}>
            <span>Module progress</span>
            <span style={{ color: mod.color }}>{done.length}/{mod.lessons.length} · {pct}%</span>
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(255,244,234,0.06)" }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7 }}
              className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${mod.color}, ${AMB.amber})` }} />
          </div>
        </div>

        <div className="mt-5 space-y-2">
          {mod.lessons.map((l, idx) => {
            const meta = TYPE_META[l.type];
            const LIcon = meta.icon;
            const isDone = done.includes(l.id);
            return (
              <motion.button
                key={l.id}
                onClick={() => onToggle(l)}
                initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }}
                className="group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all hover:-translate-y-[1px]"
                style={{ borderColor: AMB.border, background: isDone ? `${meta.color}11` : "rgba(255,244,234,0.03)" }}
              >
                <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                  style={{ background: `${meta.color}22`, border: `1px solid ${meta.color}55` }}>
                  {isDone ? <CheckCircle2 className="h-4 w-4" style={{ color: AMB.amber }} /> : <LIcon className="h-4 w-4" style={{ color: meta.color }} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold" style={{ color: AMB.text }}>{l.title}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] uppercase tracking-wider" style={{ color: AMB.mute }}>
                    <span style={{ color: meta.color }}>{meta.label}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> {l.duration}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold" style={{ color: AMB.amber }}>+{l.xp}</div>
                  <div className="text-[9px] uppercase tracking-wider" style={{ color: AMB.mute }}>XP</div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {complete && (
          <div className="mt-5 rounded-2xl p-4 text-center" style={{ background: `linear-gradient(135deg, ${mod.color}22, ${AMB.amber}22)`, border: `1px solid ${AMB.amber}55` }}>
            <Award className="mx-auto h-7 w-7" style={{ color: AMB.amber }} />
            <div className="mt-1 text-sm font-bold" style={{ color: AMB.text }}>Module Mastered</div>
            <div className="mt-0.5 text-xs" style={{ color: AMB.mute }}>Your certificate is ready to download.</div>
            <NeonButton onClick={onCert} className="mt-3"><Download className="h-4 w-4" /> Download certificate</NeonButton>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
