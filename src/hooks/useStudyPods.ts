import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface StudyPod {
  id: string;
  name: string;
  description: string | null;
  exam_type: string | null;
  subject: string | null;
  difficulty_level: string;
  max_members: number;
  is_active: boolean;
  is_ai_created: boolean;
  created_at: string;
  member_count: number;
  match_score?: number;
  my_role?: string;
  joined_at?: string;
  last_message?: { content: string; created_at: string } | null;
}

export interface PodMessage {
  id: string;
  pod_id: string;
  user_id: string;
  content: string;
  is_ai_message: boolean;
  created_at: string;
}

export function useStudyPods() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [myPods, setMyPods] = useState<StudyPod[]>([]);
  const [suggestedPods, setSuggestedPods] = useState<StudyPod[]>([]);
  const [messages, setMessages] = useState<PodMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [matchLoading, setMatchLoading] = useState(false);

  const fetchMyPods = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("study-pods", { body: { action: "my_pods" } });
      if (error) throw error;
      setMyPods(data?.pods || []);
    } catch { toast({ title: "Couldn't load pods", variant: "destructive" }); }
    setLoading(false);
  }, [session]);

  const findMatch = useCallback(async () => {
    if (!session) return;
    setMatchLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("study-pods", { body: { action: "ai_match" } });
      if (error) throw error;
      if (data?.created) {
        toast({ title: "AI created a pod for you! 🧠" });
        setMyPods(prev => [data.pod, ...prev]);
      } else {
        setSuggestedPods(data?.pods || []);
      }
    } catch { toast({ title: "Matching failed", variant: "destructive" }); }
    setMatchLoading(false);
  }, [session]);

  const joinPod = async (podId: string) => {
    try {
      const { error } = await supabase.functions.invoke("study-pods", { body: { action: "join", pod_id: podId } });
      if (error) throw error;
      toast({ title: "Joined pod! 🎉" });
      setSuggestedPods(prev => prev.filter(p => p.id !== podId));
      fetchMyPods();
    } catch (e: any) { toast({ title: e.message || "Couldn't join", variant: "destructive" }); }
  };

  const leavePod = async (podId: string) => {
    try {
      const { error } = await supabase.functions.invoke("study-pods", { body: { action: "leave", pod_id: podId } });
      if (error) throw error;
      toast({ title: "Left pod" });
      setMyPods(prev => prev.filter(p => p.id !== podId));
    } catch { toast({ title: "Couldn't leave", variant: "destructive" }); }
  };

  const loadMessages = async (podId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("study-pods", { body: { action: "get_messages", pod_id: podId } });
      if (error) throw error;
      setMessages(data?.messages || []);
    } catch { /* silent */ }
  };

  const sendMessage = async (podId: string, content: string) => {
    try {
      const { error } = await supabase.functions.invoke("study-pods", { body: { action: "send_message", pod_id: podId, message: content } });
      if (error) throw error;
    } catch { toast({ title: "Send failed", variant: "destructive" }); }
  };

  return {
    myPods, suggestedPods, messages, loading, matchLoading,
    fetchMyPods, findMatch, joinPod, leavePod, loadMessages, sendMessage, setMessages,
  };
}
