import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { GraduationCap, Calendar, Clock, TrendingUp, TrendingDown, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { subDays, format, startOfDay } from "date-fns";

interface SubjectStrength {
  name: string;
  strength: number;
}

const LearningIdentitySummary = () => {
  const { user } = useAuth();
  const [examName, setExamName] = useState<string | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [studyStyle, setStudyStyle] = useState("Balanced");
  const [strongSubjects, setStrongSubjects] = useState<SubjectStrength[]>([]);
  const [weakSubjects, setWeakSubjects] = useState<SubjectStrength[]>([]);

  useEffect(() => {
    if (!user) return;

    // Load exam config
    (supabase as any).from("exam_countdown_config")
      .select("exam_name, exam_date")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) {
          setExamName(data.exam_name || null);
          if (data.exam_date) {
            const days = Math.ceil((new Date(data.exam_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            setDaysRemaining(days > 0 ? days : null);
          }
        }
      });

    // Load subject strengths
    supabase.from("subjects").select("id, name").eq("user_id", user.id).is("deleted_at", null).then(async ({ data: subjects }) => {
      if (!subjects?.length) return;
      const subjectStrengths: SubjectStrength[] = [];
      for (const sub of subjects) {
        const { data: topics } = await supabase.from("topics").select("memory_strength").eq("subject_id", sub.id).is("deleted_at", null);
        if (topics?.length) {
          const avg = Math.round(topics.reduce((s, t) => s + (t.memory_strength || 0), 0) / topics.length);
          subjectStrengths.push({ name: sub.name, strength: avg });
        }
      }
      subjectStrengths.sort((a, b) => b.strength - a.strength);
      setStrongSubjects(subjectStrengths.filter(s => s.strength >= 60).slice(0, 3));
      setWeakSubjects(subjectStrengths.filter(s => s.strength < 60).slice(-3).reverse());
    });

    // Determine study style from logs
    const since = subDays(startOfDay(new Date()), 13);
    supabase.from("study_logs").select("created_at, duration_minutes").eq("user_id", user.id).gte("created_at", since.toISOString()).then(({ data: logs }) => {
      if (!logs?.length) return;
      const hourBuckets: Record<number, number> = {};
      logs.forEach(l => {
        const h = new Date(l.created_at).getHours();
        hourBuckets[h] = (hourBuckets[h] || 0) + (l.duration_minutes || 0);
      });
      const peakHour = Object.entries(hourBuckets).sort(([, a], [, b]) => b - a)[0];
      if (peakHour) {
        const h = parseInt(peakHour[0]);
        if (h >= 5 && h < 12) setStudyStyle("Morning Learner 🌅");
        else if (h >= 12 && h < 17) setStudyStyle("Afternoon Focus 🌤️");
        else if (h >= 17 && h < 21) setStudyStyle("Evening Scholar 🌙");
        else setStudyStyle("Night Owl 🦉");
      }
    });
  }, [user]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="glass rounded-2xl p-5 neural-border space-y-4"
    >
      <div className="flex items-center gap-2">
        <GraduationCap className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Learning Identity</h3>
      </div>

      {/* Identity Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-secondary/30 p-3 border border-border/50">
          <div className="flex items-center gap-1.5 mb-1">
            <BookOpen className="w-3 h-3 text-primary" />
            <span className="text-[10px] text-muted-foreground">Target Exam</span>
          </div>
          <p className="text-sm font-semibold text-foreground truncate">{examName || "Not set"}</p>
        </div>
        <div className="rounded-xl bg-secondary/30 p-3 border border-border/50">
          <div className="flex items-center gap-1.5 mb-1">
            <Calendar className="w-3 h-3 text-warning" />
            <span className="text-[10px] text-muted-foreground">Days Left</span>
          </div>
          <p className={`text-sm font-semibold ${daysRemaining && daysRemaining <= 30 ? "text-destructive" : "text-foreground"}`}>
            {daysRemaining ? `${daysRemaining} days` : "—"}
          </p>
        </div>
        <div className="rounded-xl bg-secondary/30 p-3 border border-border/50 col-span-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="w-3 h-3 text-accent" />
            <span className="text-[10px] text-muted-foreground">Study Style</span>
          </div>
          <p className="text-sm font-semibold text-foreground">{studyStyle}</p>
        </div>
      </div>

      {/* Strong/Weak Subjects */}
      {(strongSubjects.length > 0 || weakSubjects.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {strongSubjects.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3 text-success" />
                <span className="text-[10px] font-semibold text-success">Strong</span>
              </div>
              {strongSubjects.map(s => (
                <div key={s.name} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-foreground truncate">{s.name}</p>
                  </div>
                  <div className="w-12 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-success"
                      initial={{ width: 0 }}
                      animate={{ width: `${s.strength}%` }}
                      transition={{ duration: 0.8 }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground w-8 text-right">{s.strength}%</span>
                </div>
              ))}
            </div>
          )}
          {weakSubjects.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <TrendingDown className="w-3 h-3 text-destructive" />
                <span className="text-[10px] font-semibold text-destructive">Needs Work</span>
              </div>
              {weakSubjects.map(s => (
                <div key={s.name} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-foreground truncate">{s.name}</p>
                  </div>
                  <div className="w-12 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-destructive/70"
                      initial={{ width: 0 }}
                      animate={{ width: `${s.strength}%` }}
                      transition={{ duration: 0.8 }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground w-8 text-right">{s.strength}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default LearningIdentitySummary;
