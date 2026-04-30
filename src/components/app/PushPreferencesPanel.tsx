import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bell, Moon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CATEGORIES: { key: string; label: string; emoji: string; desc: string }[] = [
  { key: "category_study", label: "Study", emoji: "🧠", desc: "Reviews, missions, streaks, weak topics" },
  { key: "category_exam", label: "Exam", emoji: "🎯", desc: "Countdown, mocks, rank, SureShot" },
  { key: "category_growth", label: "Growth", emoji: "🚀", desc: "Trial, subscription, level-ups, rewards" },
  { key: "category_social", label: "Social", emoji: "💬", desc: "Replies, mentions, leaderboard, pods" },
  { key: "category_system", label: "System", emoji: "⚙️", desc: "Updates, maintenance, security alerts" },
];

const PushPreferencesPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<any>({
    master_enabled: true,
    category_study: true, category_exam: true, category_growth: true, category_social: true, category_system: true,
    quiet_hours_enabled: false, quiet_start: "22:00", quiet_end: "07:00",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("push_user_prefs" as any).select("*").eq("user_id", user.id).maybeSingle();
      if (data) setPrefs(data);
      setLoading(false);
    })();
  }, [user]);

  const update = async (field: string, value: any) => {
    if (!user) return;
    const next = { ...prefs, [field]: value };
    setPrefs(next);
    const { error } = await supabase.from("push_user_prefs" as any).upsert({
      user_id: user.id,
      master_enabled: next.master_enabled,
      category_study: next.category_study,
      category_exam: next.category_exam,
      category_growth: next.category_growth,
      category_social: next.category_social,
      category_system: next.category_system,
      quiet_hours_enabled: next.quiet_hours_enabled,
      quiet_start: next.quiet_start,
      quiet_end: next.quiet_end,
      timezone: prefs.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    }, { onConflict: "user_id" });
    if (error) toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
  };

  if (loading) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="glass rounded-xl p-4 neural-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <div>
              <p className="text-sm font-semibold">All Notifications</p>
              <p className="text-[10px] text-muted-foreground">Master switch for everything</p>
            </div>
          </div>
          <Switch checked={prefs.master_enabled} onCheckedChange={v => update("master_enabled", v)} />
        </div>

        <div className="space-y-2 mt-2">
          {CATEGORIES.map(c => (
            <div key={c.key} className="flex items-center gap-3 p-2 rounded-lg bg-background/40">
              <span className="text-lg">{c.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">{c.label}</p>
                <p className="text-[10px] text-muted-foreground truncate">{c.desc}</p>
              </div>
              <Switch
                disabled={!prefs.master_enabled}
                checked={!!prefs[c.key]}
                onCheckedChange={v => update(c.key, v)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="glass rounded-xl p-4 neural-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Moon className="w-4 h-4 text-purple-400" />
            <div>
              <p className="text-sm font-semibold">Quiet Hours</p>
              <p className="text-[10px] text-muted-foreground">No pushes during sleep time</p>
            </div>
          </div>
          <Switch checked={prefs.quiet_hours_enabled} onCheckedChange={v => update("quiet_hours_enabled", v)} />
        </div>
        {prefs.quiet_hours_enabled && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">From</Label>
              <Input type="time" value={String(prefs.quiet_start || "22:00").slice(0, 5)} onChange={e => update("quiet_start", e.target.value)} />
            </div>
            <div>
              <Label className="text-[10px]">To</Label>
              <Input type="time" value={String(prefs.quiet_end || "07:00").slice(0, 5)} onChange={e => update("quiet_end", e.target.value)} />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default PushPreferencesPanel;
