import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ToggleLeft, ToggleRight, Loader2, Settings, Layers, Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Feature {
  id: string;
  institution_id: string;
  feature_key: string;
  feature_label: string;
  category: string;
  is_enabled: boolean;
  config: any;
}

const DEFAULT_FEATURES = [
  { key: "ai_chat", label: "AI Chat Assistant", category: "ai" },
  { key: "ai_brain_agent", label: "AI Brain Agent", category: "ai" },
  { key: "ai_teacher_mode", label: "AI Teacher Mode", category: "ai" },
  { key: "mock_exams", label: "Mock Exams", category: "exam" },
  { key: "exam_simulator", label: "Exam Simulator", category: "exam" },
  { key: "sureshot_questions", label: "SureShot Questions", category: "exam" },
  { key: "community", label: "Community Hub", category: "social" },
  { key: "study_pods", label: "Study Pods", category: "social" },
  { key: "leaderboard", label: "Leaderboard", category: "social" },
  { key: "streaks", label: "Streak System", category: "gamification" },
  { key: "badges", label: "Badges & Rewards", category: "gamification" },
  { key: "focus_mode", label: "Focus Mode", category: "productivity" },
  { key: "voice_learning", label: "Voice Learning", category: "productivity" },
  { key: "passive_learning", label: "Passive Learning", category: "productivity" },
  { key: "weekly_reports", label: "Weekly Reports", category: "analytics" },
  { key: "brain_evolution", label: "Brain Evolution", category: "analytics" },
  { key: "competitive_intel", label: "Competitive Intelligence", category: "analytics" },
];

const CATEGORY_COLORS: Record<string, string> = {
  ai: "bg-primary/15 text-primary",
  exam: "bg-accent/15 text-accent",
  social: "bg-success/15 text-success",
  gamification: "bg-warning/15 text-warning",
  productivity: "bg-blue-500/15 text-blue-400",
  analytics: "bg-purple-500/15 text-purple-400",
};

interface Props {
  institutionId: string;
  institutionName: string;
}

export default function FeatureToggles({ institutionId, institutionName }: Props) {
  const { toast } = useToast();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);

  useEffect(() => { loadFeatures(); }, [institutionId]);

  const loadFeatures = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("whitelabel_features")
      .select("*")
      .eq("institution_id", institutionId)
      .order("category");
    setFeatures((data as any[]) || []);
    setLoading(false);
  };

  const initializeDefaults = async () => {
    setInitializing(true);
    const inserts = DEFAULT_FEATURES.map(f => ({
      institution_id: institutionId,
      feature_key: f.key,
      feature_label: f.label,
      category: f.category,
      is_enabled: true,
    }));

    const { error } = await supabase.from("whitelabel_features").upsert(inserts, { onConflict: "institution_id,feature_key" });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Features initialized ✅" }); loadFeatures(); }
    setInitializing(false);
  };

  const toggleFeature = async (feature: Feature) => {
    await supabase.from("whitelabel_features").update({ is_enabled: !feature.is_enabled }).eq("id", feature.id);
    setFeatures(prev => prev.map(f => f.id === feature.id ? { ...f, is_enabled: !f.is_enabled } : f));
  };

  const enableAll = async () => {
    await supabase.from("whitelabel_features").update({ is_enabled: true }).eq("institution_id", institutionId);
    loadFeatures();
    toast({ title: "All features enabled ✅" });
  };

  const disableAll = async () => {
    await supabase.from("whitelabel_features").update({ is_enabled: false }).eq("institution_id", institutionId);
    loadFeatures();
    toast({ title: "All features disabled" });
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const categories = [...new Set(features.map(f => f.category))];
  const enabledCount = features.filter(f => f.is_enabled).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Feature Toggles</h3>
            <p className="text-[10px] text-muted-foreground">{institutionName} • {enabledCount}/{features.length} enabled</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={enableAll} className="px-3 py-1.5 rounded-lg bg-success/15 text-success text-xs font-medium hover:bg-success/25">Enable All</button>
          <button onClick={disableAll} className="px-3 py-1.5 rounded-lg bg-destructive/15 text-destructive text-xs font-medium hover:bg-destructive/25">Disable All</button>
        </div>
      </div>

      {features.length === 0 ? (
        <div className="glass rounded-xl p-8 neural-border text-center">
          <Layers className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-foreground mb-2">No Features Configured</h4>
          <p className="text-xs text-muted-foreground mb-4">Initialize default feature set for this institution</p>
          <button onClick={initializeDefaults} disabled={initializing} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
            {initializing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Initialize Features"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map(cat => (
            <div key={cat} className="glass rounded-xl p-4 neural-border">
              <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${CATEGORY_COLORS[cat] || "bg-secondary text-muted-foreground"}`}>{cat}</span>
                <span className="text-muted-foreground text-[10px]">{features.filter(f => f.category === cat && f.is_enabled).length}/{features.filter(f => f.category === cat).length}</span>
              </h4>
              <div className="space-y-1.5">
                {features.filter(f => f.category === cat).map(feature => (
                  <motion.div
                    key={feature.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Zap className={`w-3.5 h-3.5 ${feature.is_enabled ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-xs font-medium ${feature.is_enabled ? "text-foreground" : "text-muted-foreground"}`}>{feature.feature_label}</span>
                    </div>
                    <button onClick={() => toggleFeature(feature)} className="p-1">
                      {feature.is_enabled
                        ? <ToggleRight className="w-5 h-5 text-success" />
                        : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
