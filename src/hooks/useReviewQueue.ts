import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ReviewItem {
  id: string;
  name: string;
  subject_name: string | null;
  memory_strength: number;
  last_revision_date: string | null;
  next_review_date: string;
  hours_overdue: number;
  review_count: number;
  urgency: "overdue" | "due_now" | "upcoming";
  interval_days: number;
}

// SM-2 inspired interval calculation based on review count and memory strength
function calculateNextInterval(reviewCount: number, memoryStrength: number): number {
  if (reviewCount <= 1) return 1; // 1 day
  if (reviewCount === 2) return 3; // 3 days

  // Base interval grows with review count
  const baseInterval = Math.pow(2.5, reviewCount - 2);
  // Adjust by memory strength: strong memory = longer interval
  const strengthMultiplier = 0.5 + (memoryStrength / 100) * 1.0;
  return Math.min(Math.round(baseInterval * strengthMultiplier), 90); // Cap at 90 days
}

export function useReviewQueue() {
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const loadQueue = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: topics } = await supabase
        .from("topics")
        .select("*, subjects(name)")
        .eq("user_id", user.id);

      if (!topics || topics.length === 0) {
        setQueue([]);
        setLoading(false);
        return;
      }

      // Get study log counts per topic
      const { data: logs } = await supabase
        .from("study_logs")
        .select("topic_id")
        .eq("user_id", user.id);

      const logCounts: Record<string, number> = {};
      (logs || []).forEach((l) => {
        if (l.topic_id) logCounts[l.topic_id] = (logCounts[l.topic_id] || 0) + 1;
      });

      const now = new Date();
      const items: ReviewItem[] = topics.map((t: any) => {
        const reviewCount = logCounts[t.id] || 0;
        const memoryStrength = t.memory_strength ?? 0;
        const intervalDays = calculateNextInterval(reviewCount, memoryStrength);

        const lastRevision = t.last_revision_date
          ? new Date(t.last_revision_date)
          : new Date(t.created_at);

        const nextReview = new Date(lastRevision.getTime() + intervalDays * 24 * 60 * 60 * 1000);
        const hoursUntilDue = (nextReview.getTime() - now.getTime()) / (1000 * 60 * 60);

        let urgency: ReviewItem["urgency"] = "upcoming";
        if (hoursUntilDue <= -24) urgency = "overdue";
        else if (hoursUntilDue <= 6) urgency = "due_now";

        return {
          id: t.id,
          name: t.name,
          subject_name: t.subjects?.name ?? null,
          memory_strength: memoryStrength,
          last_revision_date: t.last_revision_date,
          next_review_date: nextReview.toISOString(),
          hours_overdue: Math.max(0, -hoursUntilDue),
          review_count: reviewCount,
          urgency,
          interval_days: intervalDays,
        };
      });

      // Sort: overdue first, then due_now, then upcoming by next_review_date
      const urgencyOrder = { overdue: 0, due_now: 1, upcoming: 2 };
      items.sort((a, b) => {
        const orderDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        if (orderDiff !== 0) return orderDiff;
        return new Date(a.next_review_date).getTime() - new Date(b.next_review_date).getTime();
      });

      setQueue(items);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const dueCount = queue.filter((i) => i.urgency !== "upcoming").length;

  return { queue, dueCount, loading, loadQueue };
}
