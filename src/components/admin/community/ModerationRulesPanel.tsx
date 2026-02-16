import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Settings, Loader2, RefreshCw, Save, Plus, X
} from "lucide-react";

interface ModerationRule {
  id: string;
  rule_type: string;
  rule_key: string;
  rule_value: any;
  is_active: boolean;
}

const ModerationRulesPanel = () => {
  const { toast } = useToast();
  const [rules, setRules] = useState<ModerationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newWord, setNewWord] = useState("");

  const fetchRules = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("moderation_rules").select("*").order("rule_key");
    setRules(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchRules(); }, []);

  const updateRule = async (id: string, value: any) => {
    await (supabase as any).from("moderation_rules").update({
      rule_value: value,
      updated_at: new Date().toISOString(),
      updated_by: (await supabase.auth.getUser()).data.user?.id,
    }).eq("id", id);
    toast({ title: "Rule updated ✅" });
    setEditingId(null);
    fetchRules();
  };

  const toggleRule = async (id: string, active: boolean) => {
    await (supabase as any).from("moderation_rules").update({ is_active: !active, updated_at: new Date().toISOString() }).eq("id", id);
    toast({ title: active ? "Rule disabled" : "Rule enabled ✅" });
    fetchRules();
  };

  const addBlockedWord = async (ruleId: string, currentWords: string[]) => {
    if (!newWord.trim()) return;
    const updated = [...currentWords, newWord.trim().toLowerCase()];
    await updateRule(ruleId, { words: updated });
    setNewWord("");
  };

  const removeBlockedWord = async (ruleId: string, currentWords: string[], word: string) => {
    const updated = currentWords.filter(w => w !== word);
    await updateRule(ruleId, { words: updated });
  };

  const getLabel = (key: string) => {
    const labels: Record<string, string> = {
      abuse_score_warning: "Warning Threshold (abuse score)",
      abuse_score_restrict: "Restriction Threshold (abuse score)",
      abuse_score_auto_hide: "Auto-Hide Threshold (abuse score)",
      warnings_before_restrict: "Warnings Before Auto-Restrict",
      restrictions_before_ban: "Restrictions Before Auto-Ban",
      blocked_word_list: "Blocked Words",
      allowed_word_list: "Allowed Words (bypass)",
    };
    return labels[key] || key;
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  const thresholdRules = rules.filter(r => r.rule_type !== "blocked_words" && r.rule_type !== "allowed_words");
  const wordRules = rules.filter(r => r.rule_type === "blocked_words" || r.rule_type === "allowed_words");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground">Moderation Rules</h3>
        <button onClick={fetchRules} className="p-2 hover:bg-secondary rounded-lg"><RefreshCw className="w-4 h-4 text-muted-foreground" /></button>
      </div>

      {/* Threshold Rules */}
      <div className="glass rounded-xl p-4 neural-border space-y-4">
        <h4 className="text-sm font-semibold text-foreground">Thresholds & Limits</h4>
        {thresholdRules.map(r => {
          const value = r.rule_value?.threshold ?? r.rule_value?.count ?? 0;
          return (
            <div key={r.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
              <div className="flex-1">
                <p className="text-sm text-foreground">{getLabel(r.rule_key)}</p>
                <p className="text-[10px] text-muted-foreground">{r.rule_type}</p>
              </div>
              <div className="flex items-center gap-2">
                {editingId === r.id ? (
                  <>
                    <input
                      type="number"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      className="w-16 px-2 py-1 rounded-lg bg-secondary/50 border border-border text-sm text-foreground text-center"
                    />
                    <button onClick={() => {
                      const val = parseInt(editValue);
                      if (isNaN(val)) return;
                      const key = r.rule_value?.threshold !== undefined ? "threshold" : "count";
                      updateRule(r.id, { [key]: val });
                    }} className="p-1 bg-primary/10 text-primary rounded-lg"><Save className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setEditingId(null)} className="p-1 bg-secondary text-muted-foreground rounded-lg"><X className="w-3.5 h-3.5" /></button>
                  </>
                ) : (
                  <>
                    <span className="text-lg font-bold text-primary">{value}</span>
                    <button onClick={() => { setEditingId(r.id); setEditValue(String(value)); }}
                      className="px-2 py-1 rounded-lg bg-secondary/50 text-xs text-muted-foreground hover:text-foreground">Edit</button>
                  </>
                )}
                <button onClick={() => toggleRule(r.id, r.is_active)}
                  className={`px-2 py-1 rounded-lg text-xs font-medium ${r.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                  {r.is_active ? "Active" : "Off"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Word Lists */}
      {wordRules.map(r => (
        <div key={r.id} className="glass rounded-xl p-4 neural-border space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">{getLabel(r.rule_key)}</h4>
            <button onClick={() => toggleRule(r.id, r.is_active)}
              className={`px-2 py-1 rounded-lg text-xs font-medium ${r.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
              {r.is_active ? "Active" : "Off"}
            </button>
          </div>
          <div className="flex gap-2">
            <input value={newWord} onChange={e => setNewWord(e.target.value)} placeholder="Add word..."
              className="flex-1 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border text-sm text-foreground"
              onKeyDown={e => e.key === "Enter" && addBlockedWord(r.id, r.rule_value?.words || [])}
            />
            <button onClick={() => addBlockedWord(r.id, r.rule_value?.words || [])}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(r.rule_value?.words || []).map((w: string) => (
              <span key={w} className="px-2 py-1 rounded-full bg-destructive/10 text-destructive text-xs flex items-center gap-1">
                {w}
                <button onClick={() => removeBlockedWord(r.id, r.rule_value?.words || [], w)} className="hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {(r.rule_value?.words || []).length === 0 && <p className="text-[11px] text-muted-foreground">No words added</p>}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ModerationRulesPanel;
