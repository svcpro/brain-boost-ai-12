import { createClient } from "npm:@supabase/supabase-js@2";
import { authenticateRequest, jsonResponse, errorResponse, handleCors } from "../_shared/auth.ts";
import { aiFetch } from "../_shared/aiFetch.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { userId, supabase } = await authenticateRequest(req);
    const { action, ...params } = await req.json();
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify teacher role in an institution
    const { data: membership } = await admin
      .from("institution_members")
      .select("institution_id, role")
      .eq("user_id", userId)
      .in("role", ["teacher", "institution_admin"])
      .limit(1)
      .maybeSingle();

    if (!membership) {
      return errorResponse("Not a teacher in any institution", 403);
    }

    if (action === "generate") {
      const { subject, topics, difficulty, question_count = 10, title } = params;
      if (!subject) return errorResponse("subject required", 400);

      const topicList = (topics || []).join(", ");
      const prompt = `Generate ${question_count} practice questions for the subject "${subject}"${topicList ? ` focusing on topics: ${topicList}` : ""}.
Difficulty: ${difficulty || "mixed"}.

Return a JSON array of objects with these fields:
- question: string (the question text)
- options: string[] (4 options, A/B/C/D)
- correct_answer: number (0-3 index)
- explanation: string (brief explanation)
- difficulty: "easy" | "medium" | "hard"
- topic: string (which topic this covers)

Return ONLY valid JSON array, no markdown.`;

      const aiResult = await aiFetch(prompt, {
        model: "gemini-2.5-flash-lite",
        temperature: 0.7,
        maxTokens: 4000,
      });

      let questions = [];
      try {
        const cleaned = aiResult.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
        questions = JSON.parse(cleaned);
      } catch {
        questions = [{ question: "AI generation failed. Please try again.", options: ["A","B","C","D"], correct_answer: 0, explanation: "", difficulty: "medium", topic: subject }];
      }

      // Save to DB
      const { data: set, error } = await supabase.from("teacher_practice_sets").insert({
        institution_id: membership.institution_id,
        teacher_id: userId,
        title: title || `${subject} Practice Set`,
        subject,
        topics: topics || [],
        difficulty: difficulty || "mixed",
        question_count: questions.length,
        questions,
        ai_generated: true,
        status: "draft",
      }).select().single();

      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ set, question_count: questions.length });
    }

    if (action === "class_performance") {
      const { institution_id } = params;
      const instId = institution_id || membership.institution_id;

      // Get all students in institution
      const { data: members } = await admin
        .from("institution_members")
        .select("user_id")
        .eq("institution_id", instId)
        .eq("role", "student")
        .eq("is_active", true);

      const studentIds = (members || []).map((m: any) => m.user_id);
      if (studentIds.length === 0) return jsonResponse({ students: 0, analytics: null });

      // Get study logs for students (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: logs } = await admin
        .from("study_logs")
        .select("user_id, duration_minutes, confidence_level, study_mode, created_at")
        .in("user_id", studentIds)
        .gte("created_at", thirtyDaysAgo);

      // Get memory scores
      const { data: scores } = await admin
        .from("memory_scores")
        .select("user_id, memory_strength, subject_name, topic_name")
        .in("user_id", studentIds);

      // Aggregate analytics
      const totalMinutes = (logs || []).reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0);
      const avgMinutesPerStudent = studentIds.length > 0 ? Math.round(totalMinutes / studentIds.length) : 0;
      const activeStudents = new Set((logs || []).map((l: any) => l.user_id)).size;

      // Subject-wise performance
      const subjectMap: Record<string, { total: number; count: number }> = {};
      (scores || []).forEach((s: any) => {
        const sub = s.subject_name || "Unknown";
        if (!subjectMap[sub]) subjectMap[sub] = { total: 0, count: 0 };
        subjectMap[sub].total += s.memory_strength || 0;
        subjectMap[sub].count++;
      });

      const subjectPerformance = Object.entries(subjectMap).map(([name, v]) => ({
        subject: name,
        avg_strength: Math.round(v.total / v.count),
        student_count: v.count,
      })).sort((a, b) => a.avg_strength - b.avg_strength);

      // Weak students (avg strength < 40)
      const studentStrengths: Record<string, { total: number; count: number }> = {};
      (scores || []).forEach((s: any) => {
        if (!studentStrengths[s.user_id]) studentStrengths[s.user_id] = { total: 0, count: 0 };
        studentStrengths[s.user_id].total += s.memory_strength || 0;
        studentStrengths[s.user_id].count++;
      });

      const weakStudents = Object.entries(studentStrengths)
        .map(([uid, v]) => ({ user_id: uid, avg_strength: Math.round(v.total / v.count) }))
        .filter(s => s.avg_strength < 40)
        .sort((a, b) => a.avg_strength - b.avg_strength);

      return jsonResponse({
        students: studentIds.length,
        active_students: activeStudents,
        total_study_minutes: totalMinutes,
        avg_minutes_per_student: avgMinutesPerStudent,
        subject_performance: subjectPerformance,
        weak_students: weakStudents.slice(0, 20),
        sessions_last_30d: (logs || []).length,
      });
    }

    return errorResponse("Unknown action", 400);
  } catch (err) {
    if (err instanceof Response) return err;
    return errorResponse(String(err), 500);
  }
});
