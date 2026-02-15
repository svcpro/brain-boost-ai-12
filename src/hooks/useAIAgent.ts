import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface BrainBriefing {
  cognitive_summary: string;
  memory_analysis: string;
  strategic_advice: { title: string; advice: string; urgency: "immediate" | "today" | "this_week" }[];
  predicted_outcome: string;
  focus_recommendation: string;
  wellness_note?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function useAIAgent() {
  const [briefing, setBriefing] = useState<BrainBriefing | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const analyze = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("ai-brain-agent", {
        body: { action: "analyze" },
      });
      if (fnError) throw fnError;
      setBriefing(data);
      return data;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  const chat = useCallback(async (message: string) => {
    if (!session) return;
    setChatMessages(prev => [...prev, { role: "user", content: message }]);
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("ai-brain-agent", {
        body: { action: "chat", message },
      });
      if (fnError) throw fnError;
      const reply = data?.reply || "I couldn't process that.";
      setChatMessages(prev => [...prev, { role: "assistant", content: reply }]);
      return reply;
    } catch (e: any) {
      setError(e.message);
      setChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }, [session]);

  const explain = useCallback(async (predictionType: string, predictionData: any) => {
    if (!session) return;
    try {
      const { data, error: fnError } = await supabase.functions.invoke("ai-brain-agent", {
        body: { action: "explain", prediction_type: predictionType, prediction_data: predictionData },
      });
      if (fnError) throw fnError;
      return data?.explanation || "";
    } catch {
      return "";
    }
  }, [session]);

  const clearChat = useCallback(() => setChatMessages([]), []);

  return { briefing, chatMessages, loading, error, analyze, chat, explain, clearChat };
}
