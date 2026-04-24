import { createClient } from "npm:@supabase/supabase-js@2";
import { edgeCache } from "../_shared/cache.ts";
import { rateLimitMiddleware } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get caller's user ID from auth header (optional, for highlighting)
    let currentUserId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData } = await supabaseUser.auth.getClaims(token);
      currentUserId = claimsData?.claims?.sub || null;
    }

    // Rate limit check (if authenticated)
    if (currentUserId) {
      const rateLimited = await rateLimitMiddleware(currentUserId, "leaderboard");
      if (rateLimited) return rateLimited;
    }

    // Cache leaderboard data for 30 seconds (hot endpoint)
    const leaderboardData: any = await edgeCache.getOrFetch("leaderboard_full", 30, async () => {
      return await fetchLeaderboardData(supabaseAdmin, currentUserId);
    });

    // If fetchLeaderboardData returned a Response (early return), pass through
    if (leaderboardData instanceof Response) return leaderboardData;

    // Personalize with current user highlight (not cached)
    const leaderboard = (leaderboardData as any[]).map((e: any) => ({
      ...e,
      is_current_user: e.user_id === currentUserId,
      display_name: e.user_id === currentUserId ? e.full_display_name : e.display_name,
    }));

    return new Response(JSON.stringify({ leaderboard, current_user_id: currentUserId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=15" },
    });
  } catch (e) {
    console.error("leaderboard error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function fetchLeaderboardData(supabaseAdmin: any, currentUserId: string | null = null): Promise<any> {
    // Get latest rank prediction per user
    const { data: rankData } = await supabaseAdmin
      .from("rank_predictions")
      .select("user_id, predicted_rank, percentile, recorded_at")
      .order("recorded_at", { ascending: false });

    // Deduplicate to latest per user
    const latestRanks = new Map<string, any>();
    for (const r of (rankData || [])) {
      if (!latestRanks.has(r.user_id)) {
        latestRanks.set(r.user_id, r);
      }
    }

    // Get profiles for display names
    const userIds = Array.from(latestRanks.keys());
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ leaderboard: [], current_user_id: currentUserId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, daily_study_goal_minutes, opt_in_leaderboard, avatar_url")
      .in("id", userIds);

    // Filter to only opted-in users (but always include current user)
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    const filteredUserIds = userIds.filter(uid =>
      uid === currentUserId || profileMap.get(uid)?.opt_in_leaderboard === true
    );

    // Calculate streaks for each user from study_logs
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const { data: allLogs } = await supabaseAdmin
      .from("study_logs")
      .select("user_id, duration_minutes, created_at")
      .gte("created_at", ninetyDaysAgo.toISOString())
      .in("user_id", filteredUserIds);

    // Group logs by user and date
    const userStreaks = new Map<string, number>();
    const userTotalMinutes = new Map<string, number>();

    for (const uid of filteredUserIds) {
      const userLogs = (allLogs || []).filter(l => l.user_id === uid);
      const profile = profileMap.get(uid);
      const dailyGoal = profile?.daily_study_goal_minutes || 60;

      // Aggregate by date
      const dayTotals = new Map<string, number>();
      let totalMin = 0;
      for (const log of userLogs) {
        const dateStr = log.created_at.split("T")[0];
        dayTotals.set(dateStr, (dayTotals.get(dateStr) || 0) + (log.duration_minutes || 0));
        totalMin += (log.duration_minutes || 0);
      }
      userTotalMinutes.set(uid, totalMin);

      // Calculate current streak
      let streak = 0;
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      for (let i = 0; i < 90; i++) {
        const checkDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = checkDate.toISOString().split("T")[0];
        const dayTotal = dayTotals.get(dateStr) || 0;

        if (i === 0 && dayTotal < dailyGoal) continue; // today not yet met is ok
        if (dayTotal >= dailyGoal) {
          streak++;
        } else if (i > 0) {
          break;
        }
      }
      userStreaks.set(uid, streak);
    }

    // Build leaderboard entries
    const entries = filteredUserIds.map(uid => {
      const rank = latestRanks.get(uid);
      const profile = profileMap.get(uid);
      const displayName = profile?.display_name || "Anonymous";
      const safeName = displayName.length > 2
        ? displayName.slice(0, 2) + "***"
        : displayName;

      return {
        user_id: uid,
        display_name: safeName,
        full_display_name: profile?.display_name || "You",
        avatar_url: profile?.avatar_url || null,
        is_current_user: false,
        predicted_rank: rank?.predicted_rank || 99999,
        percentile: rank?.percentile || 0,
        streak: userStreaks.get(uid) || 0,
        total_study_hours: Math.round((userTotalMinutes.get(uid) || 0) / 60 * 10) / 10,
      };
    });

    entries.sort((a, b) => a.predicted_rank - b.predicted_rank);

    return entries.slice(0, 50).map((e, i) => ({
      ...e,
      position: i + 1,
    }));
}
