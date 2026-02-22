import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

async function caInvoke(action: string, params: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("current-affairs-intelligence", {
    body: { action, ...params },
  });
  if (error) throw error;
  return data;
}

export function useCADashboard() {
  return useQuery({
    queryKey: ["ca-dashboard"],
    queryFn: () => caInvoke("get_dashboard", {}),
    staleTime: 30_000,
  });
}

export function useCAEvents() {
  return useQuery({
    queryKey: ["ca-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ca_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });
}

export function useCAEventDetail(eventId: string | null) {
  return useQuery({
    queryKey: ["ca-event-detail", eventId],
    queryFn: async () => {
      if (!eventId) return null;
      const [event, entities, edges, links, questions] = await Promise.all([
        supabase.from("ca_events").select("*").eq("id", eventId).single(),
        supabase.from("ca_event_entities").select("*, ca_entities(*)").eq("event_id", eventId),
        supabase.from("ca_graph_edges").select("*").eq("event_id", eventId),
        supabase.from("ca_syllabus_links").select("*").eq("event_id", eventId),
        supabase.from("ca_generated_questions").select("*").eq("event_id", eventId),
      ]);
      return {
        event: event.data,
        entities: entities.data || [],
        edges: edges.data || [],
        links: links.data || [],
        questions: questions.data || [],
      };
    },
    enabled: !!eventId,
  });
}

export function useAddEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (event: { title: string; summary?: string; raw_content?: string; source_url?: string; source_name?: string; category?: string }) => {
      const { data, error } = await supabase.from("ca_events").insert(event).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ca-events"] }),
  });
}

export function useCAPipeline() {
  const qc = useQueryClient();
  const [stage, setStage] = useState<string | null>(null);

  const run = useMutation({
    mutationFn: async ({ event_id, exam_type = "UPSC" }: { event_id: string; exam_type?: string }) => {
      setStage("entities");
      await caInvoke("extract_entities", { event_id });
      setStage("graph");
      await caInvoke("build_graph", { event_id });
      setStage("syllabus");
      await caInvoke("link_syllabus", { event_id, exam_type });
      setStage("questions");
      await caInvoke("generate_questions", { event_id, exam_type });
      setStage("done");
      return true;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ca-events"] });
      qc.invalidateQueries({ queryKey: ["ca-dashboard"] });
      qc.invalidateQueries({ queryKey: ["ca-event-detail"] });
    },
    onSettled: () => setTimeout(() => setStage(null), 2000),
  });

  return { ...run, stage };
}

export function useApproveQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.from("ca_generated_questions").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ca-event-detail"] }),
  });
}

// Push approved CA questions to main question_bank
export function usePushToQuestionBank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // Get all approved CA questions not yet pushed
      const { data: approved, error: fetchErr } = await supabase
        .from("ca_generated_questions")
        .select("*, ca_events(category, title)")
        .eq("status", "approved")
        .eq("question_type", "prelims_mcq"); // Only MCQs fit the question_bank format

      if (fetchErr) throw fetchErr;
      if (!approved || approved.length === 0) return { pushed: 0 };

      let pushed = 0;
      for (const q of approved) {
        // Check duplicate by question text hash
        const { data: existing } = await supabase
          .from("question_bank")
          .select("id")
          .eq("question", q.question_text)
          .limit(1);

        if (existing && existing.length > 0) continue;

        const options = Array.isArray(q.options) ? q.options : [];
        const correctIndex = options.indexOf(q.correct_answer);

        const { error: insertErr } = await supabase.from("question_bank").insert({
          exam_type: q.exam_type || "UPSC CSE",
          subject: (q as any).ca_events?.category || "Current Affairs",
          topic: (q as any).ca_events?.title?.substring(0, 100) || "Current Affairs",
          year: new Date().getFullYear(),
          difficulty: q.difficulty || "moderate",
          question: q.question_text,
          options: options,
          correct_answer: correctIndex >= 0 ? correctIndex : 0,
          explanation: q.explanation || "",
          previous_year_tag: "CA-AI-Generated",
        });

        if (!insertErr) pushed++;
      }

      return { pushed };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["ca-dashboard"] });
    },
  });
}

// Student-facing: fetch approved CA questions for practice
export function useCAStudentQuestions(limit = 10) {
  return useQuery({
    queryKey: ["ca-student-questions", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ca_generated_questions")
        .select("*, ca_events(title, category, summary)")
        .eq("status", "approved")
        .eq("question_type", "prelims_mcq")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
  });
}

// Student-facing: fetch today's CA events
export function useTodayCAEvents() {
  return useQuery({
    queryKey: ["ca-today-events"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("ca_events")
        .select("id, title, summary, category, event_date, created_at")
        .gte("created_at", today)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });
}
