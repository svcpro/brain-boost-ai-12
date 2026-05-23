// Badge catalog. Earned status is computed from profile stats.
import { AmbassadorProfile } from "./useAmbassador";

export type Badge = {
  key: string;
  name: string;
  description: string;
  icon: string;
  tier: "bronze" | "silver" | "gold" | "platinum" | "diamond";
  color: string;
  check: (p: AmbassadorProfile) => boolean;
};

export const BADGES: Badge[] = [
  { key: "first_step",   name: "First Step",        description: "Joined the ACRY Ambassador program.",       icon: "🚀", tier: "bronze",   color: "#94a3b8", check: () => true },
  { key: "explorer",     name: "AI Explorer",       description: "Reached 250 XP.",                            icon: "🔭", tier: "bronze",   color: "#00e5ff", check: (p) => p.xp >= 250 },
  { key: "leader",       name: "AI Leader",         description: "Reached 750 XP.",                            icon: "⚡", tier: "silver",   color: "#7c4dff", check: (p) => p.xp >= 750 },
  { key: "captain",      name: "AI Captain",        description: "Reached 2,000 XP.",                          icon: "🛡️", tier: "gold",     color: "#ec4899", check: (p) => p.xp >= 2000 },
  { key: "champion",     name: "AI Champion",       description: "Reached 5,000 XP — top tier.",               icon: "👑", tier: "platinum", color: "#fbbf24", check: (p) => p.xp >= 5000 },
  { key: "streak_7",     name: "Week Warrior",      description: "7-day login streak.",                        icon: "🔥", tier: "bronze",   color: "#fb923c", check: (p) => (p.longest_streak ?? 0) >= 7 },
  { key: "streak_30",    name: "Consistency King",  description: "30-day login streak.",                       icon: "🔥", tier: "gold",     color: "#ef4444", check: (p) => (p.longest_streak ?? 0) >= 30 },
  { key: "social",       name: "Social Star",       description: "Linked Instagram + LinkedIn.",               icon: "🌟", tier: "bronze",   color: "#ec4899", check: (p) => !!p.instagram && !!p.linkedin },
  { key: "weekly_100",   name: "Weekly Grinder",    description: "Earned 100+ XP this week.",                  icon: "💪", tier: "silver",   color: "#10b981", check: (p) => (p.weekly_xp ?? 0) >= 100 },
  { key: "monthly_500",  name: "Monthly Beast",     description: "Earned 500+ XP this month.",                 icon: "🏆", tier: "gold",     color: "#fbbf24", check: (p) => (p.monthly_xp ?? 0) >= 500 },
  { key: "top_10",       name: "Top 10",            description: "Reached top 10 on the global leaderboard.",  icon: "🥇", tier: "platinum", color: "#fbbf24", check: (p) => !!p.rank && p.rank <= 10 },
  { key: "diamond",      name: "Diamond Founder",   description: "Reached 10,000 XP — legendary.",             icon: "💎", tier: "diamond",  color: "#22d3ee", check: (p) => p.xp >= 10000 },
];

export function getEarnedBadges(p: AmbassadorProfile) {
  return BADGES.map((b) => ({ ...b, earned: b.check(p) }));
}
