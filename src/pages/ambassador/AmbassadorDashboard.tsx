import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import {
  Home,
  Share2,
  Gift,
  CheckSquare,
  User,
  Calendar,
  Trophy,
  Users2,
  Bell,
  Loader2,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { useAmbassador } from "@/components/ambassador/useAmbassador";
import { AmbassadorSignInGate } from "@/components/ambassador/AmbassadorSignInGate";
import { SimpleAtmosphere, Btn, Card, T } from "@/components/ambassador/simple/ui";
import { SimpleHome } from "@/components/ambassador/simple/SimpleHome";
import { SimpleReferrals } from "@/components/ambassador/simple/SimpleReferrals";
import { SimpleRewards } from "@/components/ambassador/simple/SimpleRewards";
import { SimpleTasks } from "@/components/ambassador/simple/SimpleTasks";
import { SimpleWorkshops } from "@/components/ambassador/simple/SimpleWorkshops";
import { SimpleLeaderboard } from "@/components/ambassador/simple/SimpleLeaderboard";
import { SimpleCommunity } from "@/components/ambassador/simple/SimpleCommunity";
import { SimpleProfile } from "@/components/ambassador/simple/SimpleProfile";

const TABS = [
  { key: "home", label: "Home", icon: Home },
  { key: "referrals", label: "Refer", icon: Share2 },
  { key: "rewards", label: "Rewards", icon: Gift },
  { key: "tasks", label: "Tasks", icon: CheckSquare },
  { key: "profile", label: "Profile", icon: User },
] as const;

const SECONDARY = [
  { key: "workshops", label: "Workshops", icon: Calendar },
  { key: "leaderboard", label: "Leaderboard", icon: Trophy },
  { key: "community", label: "Community", icon: Users2 },
] as const;

type Key =
  | "home"
  | "referrals"
  | "rewards"
  | "tasks"
  | "profile"
  | "workshops"
  | "leaderboard"
  | "community";

export default function AmbassadorDashboard() {
  const params = useParams();
  const navigate = useNavigate();
  const { state, refresh } = useAmbassador();
  const active = (params.section as Key) || "home";

  const go = (k: string) => navigate(`/ambassador/${k === "home" ? "" : k}`);

  return (
    <MotionConfig reducedMotion="user">
      <Helmet>
        <title>Ambassador Dashboard — ACRY.ai</title>
        <meta
          name="description"
          content="Track referrals, earn rewards, and grow your campus community with ACRY Campus Ambassador."
        />
      </Helmet>

      <div
        className="relative min-h-screen overflow-x-hidden"
        style={{
          color: T.text,
          fontFamily: "'Inter', 'Poppins', system-ui, sans-serif",
          background: T.bg,
        }}
      >
        <SimpleAtmosphere />

        {state.kind === "loading" && (
          <div className="grid min-h-screen place-items-center">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: T.purple }} />
          </div>
        )}
        {state.kind === "anonymous" && <AmbassadorSignInGate />}
        {state.kind === "not_approved" && <PendingGate email={state.email} />}

        {state.kind === "ready" && (
          <div className="mx-auto max-w-xl px-4 pb-28 pt-4 sm:pt-6">
            {/* Top bar */}
            <div className="mb-4 flex items-center justify-between">
              {active === "home" ? (
                <Link to="/" className="flex items-center gap-2">
                  <div
                    className="grid h-9 w-9 place-items-center rounded-xl"
                    style={{ background: `linear-gradient(135deg, ${T.purple}, ${T.cyan})` }}
                  >
                    <Sparkles className="h-4 w-4" style={{ color: "#0a0a0a" }} />
                  </div>
                  <div className="text-sm font-bold tracking-tight" style={{ color: T.text }}>
                    ACRY Ambassador
                  </div>
                </Link>
              ) : (
                <button
                  onClick={() => go("home")}
                  className="flex items-center gap-1.5 text-sm font-semibold"
                  style={{ color: T.text }}
                >
                  <ArrowLeft className="h-4 w-4" /> {labelFor(active)}
                </button>
              )}
              <button
                className="grid h-9 w-9 place-items-center rounded-xl border"
                style={{ borderColor: T.border, background: T.surface }}
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" style={{ color: T.mute }} />
              </button>
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
                {active === "home" && <SimpleHome profile={state.profile} onGo={go} />}
                {active === "referrals" && <SimpleReferrals profile={state.profile} />}
                {active === "rewards" && <SimpleRewards profile={state.profile} />}
                {active === "tasks" && <SimpleTasks />}
                {active === "profile" && <SimpleProfile profile={state.profile} onUpdated={refresh} />}
                {active === "workshops" && <SimpleWorkshops profile={state.profile} />}
                {active === "leaderboard" && <SimpleLeaderboard profile={state.profile} />}
                {active === "community" && <SimpleCommunity />}
              </motion.div>
            </AnimatePresence>

            {/* Secondary links (shown on home) */}
            {active === "home" && (
              <div className="mt-5 grid grid-cols-3 gap-2">
                {SECONDARY.map((s) => {
                  const I = s.icon;
                  return (
                    <button
                      key={s.key}
                      onClick={() => go(s.key)}
                      className="flex flex-col items-center gap-1.5 rounded-xl border py-3 text-[11px] font-medium transition-colors hover:bg-white/5"
                      style={{ borderColor: T.border, color: T.mute, background: T.surface }}
                    >
                      <I className="h-4 w-4" style={{ color: T.purple }} />
                      {s.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Bottom nav */}
            <nav
              className="fixed inset-x-0 bottom-0 z-40 border-t"
              style={{
                borderColor: T.border,
                background: "rgba(7,10,20,0.92)",
                backdropFilter: "blur(20px)",
                paddingBottom: "env(safe-area-inset-bottom, 0px)",
              }}
            >
              <div className="mx-auto grid max-w-xl grid-cols-5">
                {TABS.map((t) => {
                  const I = t.icon;
                  const isActive = active === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => go(t.key)}
                      className="relative flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors"
                      style={{ color: isActive ? T.cyan : T.mute }}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="amb-tab-pill"
                          className="absolute inset-x-4 top-0 h-0.5 rounded-full"
                          style={{ background: `linear-gradient(90deg, ${T.purple}, ${T.cyan})` }}
                        />
                      )}
                      <I className="h-5 w-5" />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </nav>
          </div>
        )}
      </div>
    </MotionConfig>
  );
}

function labelFor(k: Key): string {
  const all = [...TABS, ...SECONDARY] as readonly { key: string; label: string }[];
  return all.find((t) => t.key === k)?.label || "Back";
}

function PendingGate({ email }: { email: string }) {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <Card glow={T.amber} className="w-full max-w-md p-6 text-center">
        <div
          className="mx-auto grid h-14 w-14 place-items-center rounded-2xl"
          style={{ background: `${T.amber}22` }}
        >
          <Trophy className="h-6 w-6" style={{ color: T.amber }} />
        </div>
        <div className="mt-4 text-lg font-bold" style={{ color: T.text }}>
          Application under review
        </div>
        <div className="mt-2 text-sm" style={{ color: T.mute }}>
          We couldn't find an approved ambassador application for{" "}
          <span style={{ color: T.cyan }}>{email}</span>. You'll unlock the dashboard once approved.
        </div>
        <div className="mt-5 flex justify-center gap-2">
          <Link to="/campus-ambassador">
            <Btn variant="ghost">Learn more</Btn>
          </Link>
          <Btn
            variant="primary"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.reload();
            }}
          >
            Switch account
          </Btn>
        </div>
      </Card>
    </div>
  );
}
