import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Target, Loader2, CheckCircle2, Clock, Upload, ExternalLink, Flame, Trophy, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AmbCard, AMB, NeonButton } from "./ui/primitives";
import type { AmbassadorProfile } from "./useAmbassador";

type Mission = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  reward_xp: number;
  reward_points: number;
  difficulty: string;
  proof_type: string;
  ends_at: string | null;
  is_weekly: boolean;
};

type Submission = {
  id: string;
  mission_id: string;
  status: string;
  awarded_xp: number | null;
  created_at: string;
  reviewer_notes: string | null;
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: AMB.emerald,
  medium: AMB.amber,
  hard: AMB.pink,
};

const CATEGORY_LABELS: Record<string, string> = {
  social: "Social",
  growth: "Growth",
  content: "Content",
  event: "Event",
  community: "Community",
  general: "General",
};

export function MissionsSection({ profile }: { profile: AmbassadorProfile }) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [active, setActive] = useState<Mission | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: m }, { data: s }] = await Promise.all([
      supabase.from("ambassador_missions" as any).select("*").eq("is_published", true).order("reward_xp", { ascending: false }),
      supabase.from("ambassador_mission_submissions" as any).select("*").eq("user_id", profile.user_id),
    ]);
    setMissions((m as any) ?? []);
    setSubs((s as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile.user_id]);

  const subMap = useMemo(() => {
    const m: Record<string, Submission> = {};
    subs.forEach((s) => { if (!m[s.mission_id]) m[s.mission_id] = s; });
    return m;
  }, [subs]);

  const filtered = useMemo(() => {
    if (filter === "all") return missions;
    if (filter === "weekly") return missions.filter((m) => m.is_weekly);
    return missions.filter((m) => m.category === filter);
  }, [missions, filter]);

  const stats = useMemo(() => {
    const completed = subs.filter((s) => s.status === "approved").length;
    const pending = subs.filter((s) => s.status === "pending").length;
    const totalXp = subs.filter((s) => s.status === "approved").reduce((sum, s) => sum + (s.awarded_xp ?? 0), 0);
    return { completed, pending, totalXp };
  }, [subs]);

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: AMB.cyan }} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stat strip */}
      <div className="grid grid-cols-3 gap-3">
        <StatPill icon={<Trophy className="h-4 w-4" />} label="Completed" value={stats.completed} color={AMB.emerald} />
        <StatPill icon={<Clock className="h-4 w-4" />} label="Pending" value={stats.pending} color={AMB.amber} />
        <StatPill icon={<Flame className="h-4 w-4" />} label="XP Earned" value={stats.totalXp} color={AMB.cyan} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter className="h-4 w-4 shrink-0" style={{ color: AMB.mute }} />
        {["all", "weekly", "social", "growth", "content", "event", "community"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="shrink-0 rounded-full border px-3 py-1 text-xs font-medium capitalize transition-all"
            style={{
              borderColor: filter === f ? AMB.cyan : AMB.border,
              color: filter === f ? AMB.cyan : AMB.mute,
              background: filter === f ? `${AMB.cyan}14` : "rgba(255,255,255,0.02)",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Mission grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {filtered.map((m, i) => {
          const sub = subMap[m.id];
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
            >
              <AmbCard className="flex h-full flex-col p-5" glow={DIFFICULTY_COLORS[m.difficulty]}>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                    style={{ background: `${DIFFICULTY_COLORS[m.difficulty]}22`, border: `1px solid ${DIFFICULTY_COLORS[m.difficulty]}40` }}
                  >
                    <Target className="h-4 w-4" style={{ color: DIFFICULTY_COLORS[m.difficulty] }} />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{ background: `${DIFFICULTY_COLORS[m.difficulty]}22`, color: DIFFICULTY_COLORS[m.difficulty] }}
                    >
                      {m.difficulty}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: AMB.mute }}>
                      {CATEGORY_LABELS[m.category] ?? m.category}
                    </span>
                  </div>
                </div>

                <div className="text-base font-bold leading-tight" style={{ color: AMB.text }}>{m.title}</div>
                <div className="mt-1.5 line-clamp-2 text-xs leading-relaxed" style={{ color: AMB.mute }}>{m.description}</div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="inline-flex items-center gap-1 font-bold" style={{ color: AMB.cyan }}>
                      +{m.reward_xp} XP
                    </span>
                    <span style={{ color: AMB.mute }}>·</span>
                    <span style={{ color: AMB.mute }}>+{m.reward_points} pts</span>
                  </div>
                  <StatusBadge sub={sub} onSubmit={() => setActive(m)} />
                </div>
              </AmbCard>
            </motion.div>
          );
        })}
        {filtered.length === 0 && (
          <AmbCard className="col-span-full p-10 text-center">
            <div className="text-sm" style={{ color: AMB.mute }}>No missions in this category yet.</div>
          </AmbCard>
        )}
      </div>

      {active && (
        <SubmitModal
          mission={active}
          userId={profile.user_id}
          ambassadorId={profile.id}
          onClose={() => setActive(null)}
          onSubmitted={() => { setActive(null); load(); }}
        />
      )}
    </div>
  );
}

function StatPill({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <AmbCard className="flex items-center gap-3 p-4">
      <div className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${color}22`, color }}>{icon}</div>
      <div>
        <div className="text-[10px] uppercase tracking-wider" style={{ color: AMB.mute }}>{label}</div>
        <div className="text-lg font-bold" style={{ color: AMB.text }}>{value.toLocaleString()}</div>
      </div>
    </AmbCard>
  );
}

function StatusBadge({ sub, onSubmit }: { sub?: Submission; onSubmit: () => void }) {
  if (!sub) {
    return (
      <NeonButton onClick={onSubmit} className="!px-3 !py-1.5 !text-xs">
        <Upload className="h-3.5 w-3.5" /> Submit
      </NeonButton>
    );
  }
  if (sub.status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold" style={{ background: `${AMB.emerald}22`, color: AMB.emerald }}>
        <CheckCircle2 className="h-3.5 w-3.5" /> Approved
      </span>
    );
  }
  if (sub.status === "rejected") {
    return (
      <button onClick={onSubmit} className="rounded-full px-3 py-1.5 text-xs font-bold" style={{ background: `${AMB.pink}22`, color: AMB.pink }}>
        Retry
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold" style={{ background: `${AMB.amber}22`, color: AMB.amber }}>
      <Clock className="h-3.5 w-3.5" /> Pending
    </span>
  );
}

function SubmitModal({
  mission, userId, ambassadorId, onClose, onSubmitted,
}: {
  mission: Mission; userId: string; ambassadorId: string;
  onClose: () => void; onSubmitted: () => void;
}) {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      let proofUrl: string | null = url || null;
      if (file) {
        const path = `${userId}/missions/${mission.id}-${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        proofUrl = data.publicUrl;
      }
      const { error } = await supabase.from("ambassador_mission_submissions" as any).insert({
        mission_id: mission.id,
        ambassador_id: ambassadorId,
        user_id: userId,
        proof_url: proofUrl,
        proof_text: text || null,
        status: "pending",
      });
      if (error) throw error;
      toast.success("Submission received — review in 24-48h");
      onSubmitted();
    } catch (e: any) {
      toast.error(e.message ?? "Submission failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }} onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
        <AmbCard className="p-6" glow={AMB.purple}>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: AMB.cyan }}>Submit proof</div>
          <div className="mt-1 text-lg font-bold" style={{ color: AMB.text }}>{mission.title}</div>
          <div className="mt-1 text-xs" style={{ color: AMB.mute }}>{mission.description}</div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold" style={{ color: AMB.mute }}>
                <ExternalLink className="mr-1 inline h-3 w-3" /> Proof URL (optional)
              </label>
              <input
                value={url} onChange={(e) => setUrl(e.target.value)}
                placeholder="https://instagram.com/p/…"
                className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: AMB.border, color: AMB.text, background: "rgba(255,255,255,0.04)" }}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold" style={{ color: AMB.mute }}>
                <Upload className="mr-1 inline h-3 w-3" /> Screenshot (optional)
              </label>
              <input
                type="file" accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-xs"
                style={{ color: AMB.mute }}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold" style={{ color: AMB.mute }}>Note (optional)</label>
              <textarea
                value={text} onChange={(e) => setText(e.target.value)} rows={3}
                placeholder="Anything we should know?"
                className="w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: AMB.border, color: AMB.text, background: "rgba(255,255,255,0.04)" }}
              />
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <NeonButton variant="ghost" onClick={onClose} className="flex-1">Cancel</NeonButton>
            <NeonButton onClick={submit} disabled={busy || (!url && !file && !text)} className="flex-1">
              {busy ? "Submitting…" : "Submit"}
            </NeonButton>
          </div>
        </AmbCard>
      </motion.div>
    </div>
  );
}
