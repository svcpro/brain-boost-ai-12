import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  LayoutDashboard,
  User,
  GraduationCap,
  Target,
  Share2,
  Trophy,
  Gift,
  Calendar,
  Users2,
  Award,
  BarChart3,
  MessageCircle,
  Sparkles,
  LogOut,
  Loader2,
  Mail,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { AmbAtmosphere, AmbParticles, AmbCard, AMB, NeonButton, LiveDot } from "@/components/ambassador/ui/primitives";
import { useAmbassador } from "@/components/ambassador/useAmbassador";
import { WelcomeSection } from "@/components/ambassador/WelcomeSection";
import { ProfileSection } from "@/components/ambassador/ProfileSection";
import { MissionsSection } from "@/components/ambassador/MissionsSection";
import { LeaderboardSection } from "@/components/ambassador/LeaderboardSection";
import { RewardsSection } from "@/components/ambassador/RewardsSection";
import { BadgesSection } from "@/components/ambassador/BadgesSection";


const SECTIONS = [
  { key: "home", label: "Home", icon: LayoutDashboard },
  { key: "profile", label: "Profile", icon: User },
  { key: "training", label: "Training", icon: GraduationCap },
  { key: "missions", label: "Missions", icon: Target },
  { key: "referrals", label: "Referrals", icon: Share2 },
  { key: "leaderboard", label: "Leaderboard", icon: Trophy },
  { key: "rewards", label: "Rewards", icon: Gift },
  { key: "badges", label: "Badges", icon: Award },
  { key: "workshops", label: "Workshops", icon: Calendar },
  { key: "events", label: "Events", icon: Sparkles },
  { key: "community", label: "Community", icon: Users2 },

  { key: "certificates", label: "Certificates", icon: Award },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "founder", label: "Founder", icon: MessageCircle },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

export default function AmbassadorDashboard() {
  const params = useParams();
  const navigate = useNavigate();
  const { state, refresh, reload } = useAmbassador();
  const active = (params.section as SectionKey) || "home";
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [active]);

  return (
    <MotionConfig reducedMotion="user">
      <Helmet>
        <title>Campus Ambassador Dashboard — ACRY.ai</title>
        <meta name="description" content="India's largest AI Student Leadership ecosystem. Track missions, climb the leaderboard, and lead your campus." />
      </Helmet>

      <div className="relative min-h-screen overflow-x-hidden" style={{ color: AMB.text, fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}>
        <AmbAtmosphere />
        <AmbParticles />

        {state.kind === "loading" && <FullScreen><Loader2 className="h-8 w-8 animate-spin" style={{ color: AMB.cyan }} /></FullScreen>}
        {state.kind === "anonymous" && <SignInGate />}
        {state.kind === "not_approved" && <PendingGate email={state.email} />}

        {state.kind === "ready" && (
          <div className="mx-auto flex max-w-[1400px]">
            {/* Desktop sidebar */}
            <aside
              className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r p-4 lg:flex"
              style={{ borderColor: AMB.border, background: "rgba(5,6,15,0.5)", backdropFilter: "blur(20px)" }}
            >
              <BrandMark />
              <nav className="mt-6 flex-1 space-y-1 overflow-y-auto">
                {SECTIONS.map((s) => (
                  <NavLink key={s.key} item={s} active={active === s.key} onClick={() => navigate(`/ambassador/${s.key === "home" ? "" : s.key}`)} />
                ))}
              </nav>
              <SignOutBtn />
            </aside>

            {/* Main */}
            <main className="min-h-screen flex-1 px-4 pb-28 pt-4 sm:px-6 sm:pt-6 lg:pb-8">
              {/* Mobile header */}
              <div className="mb-4 flex items-center justify-between lg:hidden">
                <BrandMark compact />
                <button
                  className="grid h-10 w-10 place-items-center rounded-xl border"
                  style={{ borderColor: AMB.border, background: "rgba(255,255,255,0.04)" }}
                  onClick={() => setNavOpen(true)}
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </div>

              <SectionHeader active={active} />

              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="relative"
                >
                  {active === "home" && <WelcomeSection profile={state.profile} />}
                  {active === "profile" && <ProfileSection profile={state.profile} onUpdated={refresh} />}
                  {active === "missions" && <MissionsSection profile={state.profile} />}
                  {active === "leaderboard" && <LeaderboardSection profile={state.profile} />}
                  {active === "rewards" && <RewardsSection profile={state.profile} />}
                  {active === "badges" && <BadgesSection profile={state.profile} />}
                  {!["home","profile","missions","leaderboard","rewards","badges"].includes(active) && <ComingSoon section={active} />}
                </motion.div>
              </AnimatePresence>
            </main>

            {/* Mobile drawer */}
            <AnimatePresence>
              {navOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 lg:hidden"
                  onClick={() => setNavOpen(false)}
                >
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                  <motion.aside
                    initial={{ x: -300 }}
                    animate={{ x: 0 }}
                    exit={{ x: -300 }}
                    transition={{ type: "spring", stiffness: 280, damping: 30 }}
                    onClick={(e) => e.stopPropagation()}
                    className="relative h-full w-72 border-r p-4"
                    style={{ borderColor: AMB.border, background: AMB.bg2 }}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <BrandMark compact />
                      <button onClick={() => setNavOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <nav className="space-y-1">
                      {SECTIONS.map((s) => (
                        <NavLink key={s.key} item={s} active={active === s.key} onClick={() => navigate(`/ambassador/${s.key === "home" ? "" : s.key}`)} />
                      ))}
                    </nav>
                    <div className="mt-4">
                      <SignOutBtn />
                    </div>
                  </motion.aside>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom nav (mobile only) */}
            <nav
              className="fixed inset-x-0 bottom-0 z-40 border-t lg:hidden"
              style={{
                borderColor: AMB.border,
                background: "rgba(5,6,15,0.85)",
                backdropFilter: "blur(20px)",
                paddingBottom: "env(safe-area-inset-bottom, 0px)",
              }}
            >
              <div className="grid grid-cols-5">
                {SECTIONS.slice(0, 5).map((s) => {
                  const A = s.icon;
                  const isActive = active === s.key;
                  return (
                    <button
                      key={s.key}
                      onClick={() => navigate(`/ambassador/${s.key === "home" ? "" : s.key}`)}
                      className="flex flex-col items-center gap-1 py-2.5 text-[10px]"
                      style={{ color: isActive ? AMB.cyan : AMB.mute }}
                    >
                      <A className="h-5 w-5" />
                      {s.label}
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

function NavLink({
  item,
  active,
  onClick,
}: {
  item: (typeof SECTIONS)[number];
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all"
      style={{
        background: active ? `linear-gradient(90deg, ${AMB.purple}26, transparent)` : "transparent",
        color: active ? AMB.text : AMB.mute,
        borderLeft: active ? `2px solid ${AMB.cyan}` : "2px solid transparent",
      }}
    >
      <Icon className="h-4 w-4" style={{ color: active ? AMB.cyan : AMB.mute }} />
      <span className="flex-1 text-left">{item.label}</span>
      {active && <ChevronRight className="h-3.5 w-3.5" style={{ color: AMB.cyan }} />}
    </button>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <div
        className="grid h-9 w-9 place-items-center rounded-xl"
        style={{
          background: `linear-gradient(135deg, ${AMB.purple}, ${AMB.cyan})`,
          boxShadow: `0 6px 20px -6px ${AMB.purple}`,
        }}
      >
        <Sparkles className="h-4 w-4 text-white" />
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="text-sm font-bold" style={{ color: AMB.text }}>
            ACRY Ambassador
          </div>
          <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: AMB.cyan }}>
            AI Student OS
          </div>
        </div>
      )}
      {compact && (
        <div className="text-sm font-bold" style={{ color: AMB.text }}>
          Ambassador
        </div>
      )}
    </Link>
  );
}

function SectionHeader({ active }: { active: SectionKey }) {
  const meta = SECTIONS.find((s) => s.key === active)!;
  const Icon = meta.icon;
  return (
    <div className="mb-5 flex items-center gap-3">
      <div
        className="grid h-9 w-9 place-items-center rounded-xl"
        style={{ background: `${AMB.purple}26`, border: `1px solid ${AMB.purple}40` }}
      >
        <Icon className="h-4 w-4" style={{ color: AMB.cyan }} />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: AMB.mute }}>
          Campus Ambassador
        </div>
        <div className="text-lg font-bold" style={{ color: AMB.text }}>
          {meta.label}
        </div>
      </div>
    </div>
  );
}

function ComingSoon({ section }: { section: string }) {
  return (
    <AmbCard className="p-10 text-center" glow={AMB.purple}>
      <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl" style={{ background: `${AMB.purple}26` }}>
        <Sparkles className="h-6 w-6" style={{ color: AMB.cyan }} />
      </div>
      <div className="text-lg font-bold" style={{ color: AMB.text }}>
        {section.charAt(0).toUpperCase() + section.slice(1)} — shipping next
      </div>
      <div className="mx-auto mt-2 max-w-md text-sm" style={{ color: AMB.mute }}>
        This module is built and queued. Phase 2 unlocks Missions, Leaderboard, Rewards & Referrals. Phase 3 adds Workshops, Events
        & Community. Phase 4 ships Training, Certificates, Analytics & Founder updates.
      </div>
    </AmbCard>
  );
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-screen place-items-center">{children}</div>;
}

function SignInGate() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  const sendLink = async () => {
    if (!email) return toast.error("Enter your email");
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/ambassador` },
    });
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success("Magic link sent — check your email");
  };

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <AmbCard className="w-full max-w-md p-7" glow={AMB.cyan}>
        <BrandMark />
        <div className="mt-5 text-xl font-bold" style={{ color: AMB.text }}>
          Sign in to your Ambassador HQ
        </div>
        <div className="mt-1 text-sm" style={{ color: AMB.mute }}>
          Use the email you applied with. We'll send you a magic link.
        </div>
        <div className="mt-5 flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: AMB.border, background: "rgba(255,255,255,0.04)" }}>
          <Mail className="h-4 w-4" style={{ color: AMB.mute }} />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@college.edu"
            className="w-full bg-transparent text-sm outline-none"
            style={{ color: AMB.text }}
          />
        </div>
        <NeonButton onClick={sendLink} disabled={sending} className="mt-4 w-full">
          {sending ? "Sending…" : "Send magic link"}
        </NeonButton>
        <div className="mt-4 text-center text-xs" style={{ color: AMB.mute }}>
          Not yet an ambassador?{" "}
          <Link to="/campus-ambassador" style={{ color: AMB.cyan }}>
            Apply here →
          </Link>
        </div>
      </AmbCard>
    </div>
  );
}

function PendingGate({ email }: { email: string }) {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <AmbCard className="w-full max-w-lg p-7 text-center" glow={AMB.amber}>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl" style={{ background: `${AMB.amber}22`, border: `1px solid ${AMB.amber}40` }}>
          <Trophy className="h-6 w-6" style={{ color: AMB.amber }} />
        </div>
        <div className="mt-4 text-xl font-bold" style={{ color: AMB.text }}>
          Application under review
        </div>
        <div className="mt-2 text-sm" style={{ color: AMB.mute }}>
          We couldn't find an approved ambassador application for <span style={{ color: AMB.cyan }}>{email}</span>. Once our team
          approves your application, this dashboard unlocks instantly.
        </div>
        <div className="mt-5 flex justify-center gap-3">
          <Link to="/campus-ambassador">
            <NeonButton variant="ghost">View blueprint</NeonButton>
          </Link>
          <NeonButton onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}>
            Switch account
          </NeonButton>
        </div>
      </AmbCard>
    </div>
  );
}

function SignOutBtn() {
  return (
    <button
      onClick={async () => {
        await supabase.auth.signOut();
        window.location.reload();
      }}
      className="mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-white/5"
      style={{ color: AMB.mute }}
    >
      <LogOut className="h-4 w-4" />
      Sign out
    </button>
  );
}
