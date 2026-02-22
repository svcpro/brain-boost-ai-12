import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radar, TrendingUp, Target, AlertTriangle, Shield,
  ArrowUpRight, ArrowDownRight, Minus, Sparkles, Zap,
  ChevronRight, X, Play, Brain, Loader2, CheckCircle2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useExamIntelV10 } from "@/hooks/useExamIntelV10";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

interface IntelPracticeSessionProps {
  onClose: () => void;
}

export default function IntelPracticeSession({ onClose }: IntelPracticeSessionProps) {
  const { user } = useAuth();
  const { loading, getStudentIntel, computeStudentBrief } = useExamIntelV10();
  const [intel, setIntel] = useState<any>(null);
  const [examType, setExamType] = useState<string | null>(null);
  const [quizMode, setQuizMode] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [loadingIntel, setLoadingIntel] = useState(true);

  // Fetch exam type from profile
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("exam_type")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.exam_type) {
        setExamType(data.exam_type);
      }
    })();
  }, [user]);

  // Fetch intel data
  useEffect(() => {
    if (!examType) return;
    setLoadingIntel(true);
    getStudentIntel(examType).then((data) => {
      if (data) setIntel(data);
      setLoadingIntel(false);
    });
  }, [examType]);

  const questions = intel?.practice_questions || [];
  const brief = intel?.brief;
  const alerts = intel?.unread_alerts || [];
  const topPredictions = intel?.top_predictions || [];

  const trendIcon = (dir: string) =>
    dir === "rising" ? <ArrowUpRight className="w-3 h-3 text-emerald-400" /> :
    dir === "declining" ? <ArrowDownRight className="w-3 h-3 text-red-400" /> :
    <Minus className="w-3 h-3 text-muted-foreground" />;

  const handleAnswer = (idx: number) => {
    if (showAnswer) return;
    setSelected(idx);
    setShowAnswer(true);
    const q = questions[currentQ];
    if (idx === q.correct_answer) setScore(s => s + 1);
  };

  const nextQuestion = () => {
    if (currentQ + 1 >= questions.length) {
      setFinished(true);
    } else {
      setCurrentQ(c => c + 1);
      setSelected(null);
      setShowAnswer(false);
    }
  };

  if (loadingIntel) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
        <p className="text-xs text-muted-foreground">Loading your Exam Intel...</p>
      </div>
    );
  }

  if (!examType) {
    return (
      <div className="text-center py-16">
        <Radar className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Set your exam type in profile to access Exam Intel</p>
        <Button variant="outline" size="sm" onClick={onClose} className="mt-3">Close</Button>
      </div>
    );
  }

  // Quiz Mode
  if (quizMode && questions.length > 0) {
    if (finished) {
      return (
        <div className="space-y-5">
          <div className="text-center py-8">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="inline-flex p-4 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 mb-4">
              <CheckCircle2 className="w-10 h-10 text-violet-400" />
            </motion.div>
            <h3 className="text-lg font-bold">Intel Practice Complete!</h3>
            <p className="text-3xl font-black mt-2 bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              {score}/{questions.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">High-probability topic mastery</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => { setQuizMode(false); setFinished(false); setCurrentQ(0); setScore(0); }}>
              Back to Intel
            </Button>
            <Button className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600" onClick={onClose}>Done</Button>
          </div>
        </div>
      );
    }

    const q = questions[currentQ];
    const options = Array.isArray(q.options) ? q.options : [];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-[9px]">
            Intel Q{currentQ + 1}/{questions.length}
          </Badge>
          <Badge variant="outline" className="text-[9px]">
            {Math.round((q.probability_score || 0.5) * 100)}% probability
          </Badge>
        </div>

        <Progress value={((currentQ + 1) / questions.length) * 100} className="h-1" />

        <Card className="bg-card/50 border-border/30">
          <CardContent className="p-4">
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
              <ReactMarkdown>{q.question_text}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {options.map((opt: string, idx: number) => {
            const isCorrect = idx === q.correct_answer;
            const isSelected = idx === selected;
            let optClass = "bg-card/30 border-border/30 hover:border-violet-500/50";
            if (showAnswer) {
              if (isCorrect) optClass = "bg-emerald-500/10 border-emerald-500/50";
              else if (isSelected && !isCorrect) optClass = "bg-red-500/10 border-red-500/50";
            }

            return (
              <button
                key={idx}
                onClick={() => handleAnswer(idx)}
                disabled={showAnswer}
                className={`w-full text-left p-3 rounded-lg border text-sm transition-all ${optClass}`}
              >
                <span className="font-bold mr-2 text-muted-foreground">{String.fromCharCode(65 + idx)}.</span>
                {opt}
              </button>
            );
          })}
        </div>

        {showAnswer && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="bg-violet-500/5 border-violet-500/20">
              <CardContent className="p-3">
                <p className="text-xs font-bold mb-1 text-violet-400">Explanation</p>
                <div className="prose prose-sm dark:prose-invert max-w-none text-xs">
                  <ReactMarkdown>{q.explanation || "No explanation available."}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
            <Button className="w-full mt-3 bg-gradient-to-r from-violet-600 to-fuchsia-600" onClick={nextQuestion}>
              {currentQ + 1 >= questions.length ? "Finish" : "Next Question"} <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </motion.div>
        )}
      </div>
    );
  }

  // Intel Dashboard
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20">
            <Radar className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Exam Intel v10.0</h3>
            <p className="text-[10px] text-muted-foreground">{examType} — AI Prediction Dashboard</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7"><X className="w-4 h-4" /></Button>
      </div>

      {/* Readiness Score */}
      {brief && (
        <Card className="bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border-violet-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold">Your Exam Readiness</span>
              <span className="text-2xl font-black bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                {brief.overall_readiness_score || 0}%
              </span>
            </div>
            <Progress value={brief.overall_readiness_score || 0} className="h-2 mb-2" />
            <p className="text-[10px] text-muted-foreground">{brief.ai_strategy_summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Critical Alerts
          </h4>
          {alerts.slice(0, 3).map((a: any) => (
            <Card key={a.id} className={`border-l-2 ${a.severity === "critical" ? "border-l-red-500 bg-red-500/5" : "border-l-amber-500 bg-amber-500/5"}`}>
              <CardContent className="p-2.5">
                <p className="text-[11px]">{a.message}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Top Predictions */}
      {topPredictions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Top Predicted Topics
          </h4>
          {topPredictions.slice(0, 6).map((t: any, i: number) => (
            <div key={t.id || i} className="flex items-center justify-between p-2 rounded-lg bg-card/30 border border-border/20">
              <div className="flex items-center gap-2">
                {trendIcon(t.trend_direction)}
                <span className="text-xs font-medium">{t.topic}</span>
              </div>
              <Badge className={`text-[9px] h-4 ${
                (t.composite_score || 0) > 0.7 ? "bg-red-500/20 text-red-400" :
                (t.composite_score || 0) > 0.5 ? "bg-amber-500/20 text-amber-400" :
                "bg-emerald-500/20 text-emerald-400"
              }`}>
                {Math.round((t.composite_score || 0) * 100)}%
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Weakness Overlap */}
      {brief?.weakness_overlap?.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold flex items-center gap-1.5 text-red-400">
            <Target className="w-3.5 h-3.5" /> Critical Gaps (High Probability + Low Strength)
          </h4>
          {brief.weakness_overlap.map((w: any, i: number) => (
            <Card key={i} className="bg-red-500/5 border-red-500/20">
              <CardContent className="p-2.5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium">{w.topic}</p>
                  <p className="text-[10px] text-muted-foreground">{w.subject}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px]">Exam: <span className="font-bold text-red-400">{Math.round(w.probability * 100)}%</span></p>
                  <p className="text-[10px]">You: <span className="font-bold text-amber-400">{Math.round(w.your_strength * 100)}%</span></p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Practice Button */}
      {questions.length > 0 && (
        <Button
          className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
          onClick={() => { setQuizMode(true); setCurrentQ(0); setScore(0); setSelected(null); setShowAnswer(false); setFinished(false); }}
        >
          <Play className="w-4 h-4 mr-2" /> Start Intel Practice ({questions.length} Questions)
        </Button>
      )}

      {!brief && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => { if (examType) computeStudentBrief(examType).then(() => { if (examType) getStudentIntel(examType).then(d => { if (d) setIntel(d); }); }); }}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}
          Generate My Intel Brief
        </Button>
      )}
    </div>
  );
}
