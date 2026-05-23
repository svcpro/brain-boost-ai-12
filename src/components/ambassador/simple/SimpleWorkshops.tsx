import { useEffect, useState } from "react";
import { Btn, Card, SectionTitle, T } from "./ui";
import type { AmbassadorProfile } from "../useAmbassador";
import { Calendar, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type WS = {
  id: string;
  college: string;
  faculty: string;
  expected: number;
  city: string;
  status: "pending" | "approved" | "scheduled";
  created_at: string;
};

export function SimpleWorkshops({ profile }: { profile: AmbassadorProfile }) {
  const [list, setList] = useState<WS[]>([]);
  const [form, setForm] = useState({
    college: profile.college || "",
    faculty: "",
    expected: 50,
    city: profile.city || "",
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem("amb_workshops");
      if (raw) setList(JSON.parse(raw));
    } catch {}
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.college || !form.faculty) return toast.error("Fill all fields");
    const ws: WS = {
      id: crypto.randomUUID(),
      ...form,
      expected: Number(form.expected) || 0,
      status: "pending",
      created_at: new Date().toISOString(),
    };
    const next = [ws, ...list];
    setList(next);
    localStorage.setItem("amb_workshops", JSON.stringify(next));
    setForm({ ...form, faculty: "", expected: 50 });
    toast.success("Workshop requested");
  };

  return (
    <div className="space-y-4">
      <Card glow={T.cyan} className="p-5">
        <div className="text-base font-semibold" style={{ color: T.text }}>
          Request a workshop
        </div>
        <div className="mt-0.5 text-[11px]" style={{ color: T.mute }}>
          We'll get back to you in 48 hours
        </div>
        <form onSubmit={submit} className="mt-4 space-y-2.5">
          <Input label="College name" value={form.college} onChange={(v) => setForm({ ...form, college: v })} />
          <Input label="Faculty name" value={form.faculty} onChange={(v) => setForm({ ...form, faculty: v })} />
          <div className="grid grid-cols-2 gap-2.5">
            <Input
              label="Expected students"
              type="number"
              value={String(form.expected)}
              onChange={(v) => setForm({ ...form, expected: Number(v) })}
            />
            <Input label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
          </div>
          <Btn type="submit" variant="primary" className="w-full">
            <Calendar className="h-4 w-4" /> Request Workshop
          </Btn>
        </form>
      </Card>

      <SectionTitle title="Your requests" />
      {list.length === 0 ? (
        <Card className="py-8 text-center">
          <div className="text-sm" style={{ color: T.mute }}>
            No workshops yet. Request your first one above.
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {list.map((w) => (
            <Card key={w.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold" style={{ color: T.text }}>
                    {w.college}
                  </div>
                  <div className="mt-0.5 text-[11px]" style={{ color: T.mute }}>
                    {w.faculty} · {w.city} · {w.expected} students
                  </div>
                </div>
                <StatusPill status={w.status} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wider" style={{ color: T.mute }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border bg-transparent px-3 py-2.5 text-sm outline-none transition-colors focus:border-purple-500"
        style={{ borderColor: T.border, color: T.text }}
      />
    </label>
  );
}

function StatusPill({ status }: { status: WS["status"] }) {
  const map = {
    pending: { color: T.amber, icon: <Clock className="h-3 w-3" />, label: "Pending" },
    approved: { color: T.cyan, icon: <CheckCircle2 className="h-3 w-3" />, label: "Approved" },
    scheduled: { color: T.green, icon: <Calendar className="h-3 w-3" />, label: "Scheduled" },
  } as const;
  const m = map[status];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ background: `${m.color}22`, color: m.color }}
    >
      {m.icon} {m.label}
    </span>
  );
}
