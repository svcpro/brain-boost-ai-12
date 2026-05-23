import { useEffect, useRef, useState, useCallback } from "react";
import { Card, SectionTitle, T, Btn } from "./ui";
import {
  CheckCircle2, Circle, Upload, Sparkles, X, Brain,
  RefreshCcw, Loader2, Zap, Clock, Flame, Trophy, Lightbulb,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type AITask = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: "low" | "medium" | "high";
  reward_points: number;
  requires_proof: boolean;
  ai_reasoning: string | null;
  estimated_minutes: number | null;
  status: "pending" | "completed";
  proof_url: string | null;
  completed_at: string | null;
  expires_at: string;
};

const PRIORITY_COLORS: Record<string, string> = {
  high: T.pink,
  medium: T.amber,
  low: T.cyan,
};

const CATEGORY_ICONS: Record<string, any> = {
  referral: Zap,
  social: Sparkles,
  community: Trophy,
  content: Lightbulb,
  learning: Brain,
};

function timeLeft(expires: string): string {
  const ms = new Date(expires).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h left`;
  return `${hours}h left`;
}

export function SimpleTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<AITask[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(
    async (regen = false) => {
      if (!user) return;
      regen ? setGenerating(true) : setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("ambassador-ai-tasks", {
          body: { action: regen ? "generate" : "list" },
        });
        if (error) throw error;
        setTasks(data?.tasks ?? []);
        if (regen) toast.success("Fresh AI tasks generated ✨");
      } catch (e: any) {
        toast.error(e?.message ?? "Could not load tasks");
      } finally {
        setLoading(false);
        setGenerating(false);
      }
    },
    [user]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const completeTask = async (task: AITask, proofUrl?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("ambassador-ai-tasks", {
        body: { action: "complete", task_id: task.id, proof_url: proofUrl ?? task.proof_url },
      });
      if (error) throw error;
      setTasks((ts) => ts.map((t) => (t.id === task.id ? data.task : t)));
      toast.success(`+${task.reward_points} pts 🎉`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  const uncompleteTask = async (task: AITask) => {
    try {
      const { data, error } = await supabase.functions.invoke("ambassador-ai-tasks", {
        body: { action: "uncomplete", task_id: task.id },
      });
      if (error) throw error;
      setTasks((ts) => ts.map((t) => (t.id === task.id ? data.task : t)));
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  const onFile = async (task: AITask, file: File) => {
    if (!user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image too large (max 5 MB)");
      return;
    }
    setUploadingId(task.id);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${task.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("ambassador-proofs")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage
        .from("ambassador-proofs")
        .createSignedUrl(path, 60 * 60 * 24 * 30);
      await completeTask(task, signed?.signedUrl ?? path);
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploadingId(null);
    }
  };

  const completed = tasks.filter((t) => t.status === "completed").length;
  const totalReward = tasks
    .filter((t) => t.status === "completed")
    .reduce((s, t) => s + t.reward_points, 0);
  const pct = tasks.length === 0 ? 0 : Math.round((completed / tasks.length) * 100);

  return (
    <div className="space-y-4">
      {/* AI summary card */}
      <Card glow={T.purple} className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div
              className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider"
              style={{ color: T.mute }}
            >
              <Brain className="h-3 w-3" style={{ color: T.purple }} />
              AI Mission Brief · Auto-assigned weekly
            </div>
            <div className="mt-1 text-xl font-bold" style={{ color: T.text }}>
              {completed} / {tasks.length || 3} done
              <span className="ml-2 text-xs font-medium" style={{ color: T.amber }}>
                +{totalReward} pts
              </span>
            </div>
          </div>
          <div
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
            style={{ background: `${T.purple}22`, border: `1px solid ${T.purple}55` }}
            title="AI-automated weekly tasks"
          >
            <Sparkles className="h-4 w-4" style={{ color: T.purple }} />
          </div>
        </div>
        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${T.cyan}, ${T.purple})`,
            }}
          />
        </div>
      </Card>

      <SectionTitle
        title="AI-assigned tasks"
        action={
          <span className="text-[10px]" style={{ color: T.mute }}>
            Auto-refreshes every Monday
          </span>
        }
      />

      {loading ? (
        <Card className="p-6 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin" style={{ color: T.mute }} />
          <div className="mt-2 text-xs" style={{ color: T.mute }}>
            AI is crafting your tasks…
          </div>
        </Card>
      ) : tasks.length === 0 ? (
        <Card className="p-6 text-center space-y-2">
          <Sparkles className="mx-auto h-6 w-6" style={{ color: T.purple }} />
          <div className="text-sm" style={{ color: T.text }}>
            New tasks will appear shortly.
          </div>
          <div className="text-[11px]" style={{ color: T.mute }}>
            The AI auto-assigns 3 fresh tasks every week.
          </div>
        </Card>
      ) : tasks.length === 0 ? (
        <Card className="p-6 text-center space-y-3">
          <Sparkles className="mx-auto h-6 w-6" style={{ color: T.purple }} />
          <div className="text-sm" style={{ color: T.text }}>
            No tasks yet for this week.
          </div>
          <Btn onClick={() => load(true)} variant="primary" size="sm">
            Generate my tasks
          </Btn>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {tasks.map((t) => {
            const isDone = t.status === "completed";
            const Icon = CATEGORY_ICONS[t.category] ?? Zap;
            const pColor = PRIORITY_COLORS[t.priority] ?? T.cyan;
            const isUploading = uploadingId === t.id;
            return (
              <Card key={t.id} className="p-4" glow={isDone ? T.green : undefined}>
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => (isDone ? uncompleteTask(t) : t.requires_proof && !t.proof_url ? fileRefs.current[t.id]?.click() : completeTask(t))}
                    className="mt-0.5 shrink-0"
                    aria-label={isDone ? "Mark incomplete" : "Mark done"}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-5 w-5" style={{ color: T.green }} />
                    ) : (
                      <Circle className="h-5 w-5" style={{ color: T.mute }} />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    {/* Tags */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                        style={{ background: `${pColor}22`, color: pColor }}
                      >
                        <Icon className="h-2.5 w-2.5" />
                        {t.category}
                      </span>
                      <span
                        className="inline-flex items-center gap-1 text-[10px]"
                        style={{ color: T.mute }}
                      >
                        <Clock className="h-2.5 w-2.5" /> ~{t.estimated_minutes ?? 10}m
                      </span>
                      <span
                        className="inline-flex items-center gap-1 text-[10px]"
                        style={{ color: T.amber }}
                      >
                        <Flame className="h-2.5 w-2.5" /> +{t.reward_points}
                      </span>
                      <span className="ml-auto text-[10px]" style={{ color: T.mute }}>
                        {timeLeft(t.expires_at)}
                      </span>
                    </div>

                    <div
                      className="mt-1.5 text-sm font-semibold leading-snug"
                      style={{
                        color: T.text,
                        textDecoration: isDone ? "line-through" : undefined,
                        opacity: isDone ? 0.55 : 1,
                      }}
                    >
                      {t.title}
                    </div>
                    {t.description && (
                      <div
                        className="mt-1 text-[12px] leading-relaxed"
                        style={{ color: T.mute }}
                      >
                        {t.description}
                      </div>
                    )}

                    {t.ai_reasoning && (
                      <div
                        className="mt-2 rounded-lg p-2 text-[11px] leading-relaxed"
                        style={{
                          background: `${T.purple}11`,
                          border: `1px solid ${T.purple}33`,
                          color: T.text,
                        }}
                      >
                        <span className="font-semibold" style={{ color: T.purple }}>
                          AI ·{" "}
                        </span>
                        {t.ai_reasoning}
                      </div>
                    )}

                    {/* Proof */}
                    <input
                      ref={(el) => (fileRefs.current[t.id] = el)}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onFile(t, f);
                        e.currentTarget.value = "";
                      }}
                    />

                    {t.requires_proof && !t.proof_url && !isDone && (
                      <button
                        onClick={() => fileRefs.current[t.id]?.click()}
                        disabled={isUploading}
                        className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium disabled:opacity-50"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: `1px solid ${T.border}`,
                          color: T.text,
                        }}
                      >
                        {isUploading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Upload className="h-3 w-3" />
                        )}
                        Upload screenshot
                      </button>
                    )}

                    {t.proof_url && (
                      <div className="relative mt-2.5 inline-block">
                        <img
                          src={t.proof_url}
                          alt="proof"
                          className="h-20 rounded-lg object-cover"
                          style={{ border: `1px solid ${T.border}` }}
                        />
                        <span
                          className="absolute -right-1 -top-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                          style={{ background: T.green, color: "#000" }}
                        >
                          <CheckCircle2 className="h-2.5 w-2.5" /> proof
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
