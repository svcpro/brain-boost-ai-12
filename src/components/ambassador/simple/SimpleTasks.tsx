import { useEffect, useState } from "react";
import { Btn, Card, SectionTitle, T } from "./ui";
import { CheckCircle2, Circle, Upload, Sparkles } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_TASKS = [
  { id: "invite5", label: "Invite 5 students", reward: "+50 pts" },
  { id: "poster", label: "Share workshop poster on Instagram", reward: "+30 pts" },
  { id: "meeting", label: "Join weekly ambassador meeting", reward: "+25 pts" },
];

export function SimpleTasks() {
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem("amb_tasks_done");
      if (raw) setDone(JSON.parse(raw));
    } catch {}
  }, []);

  const toggle = (id: string) => {
    setDone((d) => {
      const next = { ...d, [id]: !d[id] };
      localStorage.setItem("amb_tasks_done", JSON.stringify(next));
      if (!d[id]) toast.success("Task completed 🎉");
      return next;
    });
  };

  const completed = DEFAULT_TASKS.filter((t) => done[t.id]).length;

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
      </Card>

      <SectionTitle title="Weekly tasks" />
      <div className="space-y-2">
        {DEFAULT_TASKS.map((t) => {
          const isDone = !!done[t.id];
          return (
            <Card key={t.id} className="flex items-center justify-between py-3">
              <button onClick={() => toggle(t.id)} className="flex flex-1 items-center gap-3 text-left">
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: T.green }} />
                ) : (
                  <Circle className="h-5 w-5 shrink-0" style={{ color: T.mute }} />
                )}
                <div>
                  <div
                    className="text-sm font-medium"
                    style={{ color: T.text, textDecoration: isDone ? "line-through" : undefined, opacity: isDone ? 0.6 : 1 }}
                  >
                    {t.label}
                  </div>
                  <div className="text-[11px]" style={{ color: T.amber }}>
                    {t.reward}
                  </div>
                </div>
              </button>
              <Btn variant="ghost" size="sm" onClick={() => toast.info("Screenshot upload coming soon")}>
                <Upload className="h-3.5 w-3.5" />
              </Btn>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
