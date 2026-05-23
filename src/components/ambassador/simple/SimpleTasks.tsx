import { useEffect, useRef, useState } from "react";
import { Card, SectionTitle, T } from "./ui";
import { CheckCircle2, Circle, Upload, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_TASKS = [
  { id: "invite5", label: "Invite 5 students", reward: "+50 pts", needsProof: false },
  { id: "poster", label: "Share workshop poster", reward: "+30 pts", needsProof: true },
  { id: "meeting", label: "Join weekly workshop", reward: "+25 pts", needsProof: false },
];

type Proof = string; // data URL

export function SimpleTasks() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [proofs, setProofs] = useState<Record<string, Proof>>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    try {
      const d = localStorage.getItem("amb_tasks_done");
      if (d) setDone(JSON.parse(d));
      const p = localStorage.getItem("amb_tasks_proofs");
      if (p) setProofs(JSON.parse(p));
    } catch {}
  }, []);

  const persist = (key: string, value: any) =>
    localStorage.setItem(key, JSON.stringify(value));

  const toggle = (id: string) => {
    setDone((d) => {
      const next = { ...d, [id]: !d[id] };
      persist("amb_tasks_done", next);
      if (!d[id]) toast.success("Task completed 🎉");
      return next;
    });
  };

  const onFile = (id: string, file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Image too large (max 4 MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setProofs((p) => {
        const next = { ...p, [id]: url };
        persist("amb_tasks_proofs", next);
        return next;
      });
      setDone((d) => {
        if (d[id]) return d;
        const next = { ...d, [id]: true };
        persist("amb_tasks_done", next);
        return next;
      });
      toast.success("Screenshot uploaded ✓");
    };
    reader.readAsDataURL(file);
  };

  const removeProof = (id: string) => {
    setProofs((p) => {
      const next = { ...p };
      delete next[id];
      persist("amb_tasks_proofs", next);
      return next;
    });
  };

  const completed = DEFAULT_TASKS.filter((t) => done[t.id]).length;
  const pct = Math.round((completed / DEFAULT_TASKS.length) * 100);

  return (
    <div className="space-y-4">
      <Card glow={T.purple} className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider" style={{ color: T.mute }}>
              This week
            </div>
            <div className="mt-0.5 text-xl font-bold" style={{ color: T.text }}>
              {completed} / {DEFAULT_TASKS.length} done
            </div>
          </div>
          <Sparkles className="h-6 w-6" style={{ color: T.amber }} />
        </div>
        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${T.cyan}, ${T.purple})`,
            }}
          />
        </div>
      </Card>

      <SectionTitle title="Weekly tasks" />
      <div className="space-y-2">
        {DEFAULT_TASKS.map((t) => {
          const isDone = !!done[t.id];
          const proof = proofs[t.id];
          return (
            <Card key={t.id} className="p-3">
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => toggle(t.id)}
                  className="flex flex-1 items-center gap-3 text-left"
                >
                  {isDone ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: T.green }} />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0" style={{ color: T.mute }} />
                  )}
                  <div>
                    <div
                      className="text-sm font-medium"
                      style={{
                        color: T.text,
                        textDecoration: isDone ? "line-through" : undefined,
                        opacity: isDone ? 0.6 : 1,
                      }}
                    >
                      {t.label}
                    </div>
                    <div className="text-[11px]" style={{ color: T.amber }}>
                      {t.reward}
                      {t.needsProof ? " · screenshot needed" : ""}
                    </div>
                  </div>
                </button>

                <input
                  ref={(el) => (fileRefs.current[t.id] = el)}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onFile(t.id, f);
                    e.currentTarget.value = "";
                  }}
                />
                <button
                  onClick={() => fileRefs.current[t.id]?.click()}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                  style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${T.border}` }}
                  aria-label="Upload screenshot"
                >
                  <Upload className="h-3.5 w-3.5" style={{ color: T.mute }} />
                </button>
              </div>

              {proof && (
                <div className="relative mt-3">
                  <img
                    src={proof}
                    alt="proof"
                    className="h-28 w-full rounded-lg object-cover"
                    style={{ border: `1px solid ${T.border}` }}
                  />
                  <button
                    onClick={() => removeProof(t.id)}
                    className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full"
                    style={{ background: "rgba(0,0,0,0.6)", color: T.text }}
                    aria-label="Remove screenshot"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
