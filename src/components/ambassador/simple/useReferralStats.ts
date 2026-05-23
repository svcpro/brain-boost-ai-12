import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RefStats = {
  total: number;
  active: number; // signed up, not yet paid
  paid: number;
  conversions: number; // anyone who converted (active + paid)
  recent: Array<{
    id: string;
    referred_email: string | null;
    converted: boolean;
    is_paid: boolean;
    created_at: string;
  }>;
  loading: boolean;
};

const PAYOUT_PER_PAID = 50; // ₹ per paid referral

export function useReferralStats(userId: string | undefined) {
  const [data, setData] = useState<RefStats>({
    total: 0,
    active: 0,
    paid: 0,
    recent: [],
    loading: true,
  });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      const { data: rows, error } = await supabase
        .from("ambassador_referrals" as any)
        .select("id, referred_email, converted, is_paid, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (cancelled) return;
      if (error || !rows) {
        setData((d) => ({ ...d, loading: false }));
        return;
      }

      const r = rows as any[];
      const paid = r.filter((x) => x.is_paid).length;
      const active = r.filter((x) => x.converted && !x.is_paid).length;
      setData({
        total: r.length,
        active,
        paid,
        recent: r.slice(0, 5) as any,
        loading: false,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return {
    ...data,
    earnings: data.paid * PAYOUT_PER_PAID,
    pending: data.active * PAYOUT_PER_PAID,
  };
}
