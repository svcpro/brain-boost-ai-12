import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle, CheckCircle2, Eye, Loader2, Search, ShieldCheck, XCircle
} from "lucide-react";

// Known variable defaults (mirrors the edge function UVR)
const KNOWN_VARIABLES: Record<string, string> = {
  user_name: "Student", name: "Student", topic_name: "a topic", score: "N/A",
  rank: "your rank", new_rank: "your rank", streak_days: "0", days: "0",
  minutes: "0", strength: "0", memory_score: "0", brain_score: "0",
  exam_name: "your exam", exam_type: "your exam", days_left: "soon",
  percentage: "N/A", badge_name: "Achievement", mission_title: "a mission",
  summary: "", recommendation: "Check the app", days_inactive: "a few",
  post_title: "a discussion", plan: "Pro", plan_name: "Pro", total: "0",
  remaining: "0", message: "Notification", at_risk_count: "0",
  topics_count: "some", topic_names: "your topics", mastery: "needs improvement",
  improvement: "significantly", predicted_rank: "improving",
  readiness_score: "N/A", amount: "N/A", study_hours: "0",
  avg_memory: "N/A", streak_days_display: "0", body: "", title: "Notification",
  previous_days: "0", difficulty: "", direction: "changed", reward: "a reward",
  streak_bonus: "", digest_text: "", description: "",
  area: "your studies", topics: "multiple topics", feature_name: "a new feature",
  last_studied: "recently", avg_score: "0", total_topics: "0", hours_studied: "0h",
  accuracy: "N/A", weak_area: "N/A", top_improvement: "N/A",
  daily_target: "1 topic", optimal_study_time: "morning",
  app_url: "https://brain-boost-ai-12.lovable.app",
};

function extractVars(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))];
}

function resolvePreview(template: string, sampleData: Record<string, string>): string {
  let result = template;
  const vars = extractVars(template);
  for (const v of vars) {
    const val = sampleData[v] || KNOWN_VARIABLES[v] || `[UNKNOWN:${v}]`;
    result = result.split(`{{${v}}}`).join(val);
  }
  return result.replace(/\s{2,}/g, " ").trim();
}

interface Props {
  template: string;
  channel: "push" | "email" | "voice";
  className?: string;
}

export default function TemplateVariableValidator({ template, channel, className }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [testUserId, setTestUserId] = useState("");
  const [livePreview, setLivePreview] = useState<string | null>(null);
  const [liveWarnings, setLiveWarnings] = useState<string[]>([]);

  const vars = extractVars(template);
  const knownVars = vars.filter((v) => v in KNOWN_VARIABLES);
  const unknownVars = vars.filter((v) => !(v in KNOWN_VARIABLES));

  // Static preview using defaults
  const staticPreview = resolvePreview(template, {});

  // Live test with a real user
  const testWithUser = useCallback(async () => {
    if (!testUserId.trim()) {
      toast({ title: "Enter a user ID to test", variant: "destructive" });
      return;
    }
    setLoading(true);
    setLiveWarnings([]);
    try {
      const { data, error } = await supabase.functions.invoke("resolve-variables", {
        body: { user_ids: [testUserId.trim()], template_message: template },
      });
      if (error) throw error;
      const resolved = data?.resolved_messages?.[testUserId.trim()];
      const warnings = data?.validation_warnings?.[testUserId.trim()] || [];
      setLivePreview(resolved || "No data returned for this user");
      setLiveWarnings(warnings);
    } catch (err: any) {
      toast({ title: "Test failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [testUserId, template, toast]);

  const hasIssues = unknownVars.length > 0;

  return (
    <Card className={`border-border/50 ${className || ""}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          Variable Validator
          <Badge variant={hasIssues ? "destructive" : "secondary"} className="text-[10px] ml-auto">
            {hasIssues ? `${unknownVars.length} unknown` : "All valid"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Variable list */}
        <div className="flex flex-wrap gap-1.5">
          {knownVars.map((v) => (
            <Badge key={v} variant="outline" className="text-[10px] gap-1 border-green-500/30 text-green-400">
              <CheckCircle2 className="w-2.5 h-2.5" />
              {`{{${v}}}`}
            </Badge>
          ))}
          {unknownVars.map((v) => (
            <Badge key={v} variant="outline" className="text-[10px] gap-1 border-destructive/50 text-destructive">
              <XCircle className="w-2.5 h-2.5" />
              {`{{${v}}}`}
            </Badge>
          ))}
          {vars.length === 0 && (
            <span className="text-xs text-muted-foreground">No variables detected</span>
          )}
        </div>

        {/* Static preview */}
        {vars.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Preview (defaults)</p>
            <div className="bg-muted/30 rounded-lg p-3 text-xs text-foreground/80 border border-border/30">
              {staticPreview}
            </div>
          </div>
        )}

        {/* Live test */}
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Test with real user</p>
          <div className="flex gap-2">
            <Textarea
              placeholder="Paste user ID..."
              value={testUserId}
              onChange={(e) => setTestUserId(e.target.value)}
              className="h-8 min-h-[32px] text-xs resize-none"
            />
            <Button size="sm" variant="outline" onClick={testWithUser} disabled={loading} className="shrink-0">
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
              Test
            </Button>
          </div>
          {livePreview && (
            <div className="bg-muted/30 rounded-lg p-3 text-xs border border-border/30 space-y-2">
              <p className="text-foreground/80">{livePreview}</p>
              {liveWarnings.length > 0 && (
                <div className="space-y-1">
                  {liveWarnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[10px] text-yellow-400">
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                      {w}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Unknown variable warning */}
        {unknownVars.length > 0 && (
          <div className="flex items-start gap-2 bg-destructive/10 rounded-lg p-3 border border-destructive/20">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <div className="text-xs text-destructive">
              <p className="font-medium">Unknown variables will use empty fallback</p>
              <p className="opacity-70 mt-0.5">
                {unknownVars.map((v) => `{{${v}}}`).join(", ")} not found in system defaults.
                These may render blank unless data is passed at send time.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
