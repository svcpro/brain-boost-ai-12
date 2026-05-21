import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Rocket, Users, Layers, Database, LayoutDashboard, ShieldCheck,
  Share2, Gamepad2, MessageCircle, Sparkles, Network, Globe2,
  DollarSign, BarChart3, Lock, Server, Code2, GitBranch, Palette,
  Map, Megaphone, Atom, ArrowUp, ChevronRight,
} from "lucide-react";

/**
 * Campus Ambassador & Student Growth Engine — YC-Level Blueprint
 * Standalone marketing/strategy page. Pure presentation, no business logic.
 */

const sections = [
  { id: "vision", icon: Rocket, label: "Product Vision" },
  { id: "roles", icon: Users, label: "User Roles" },
  { id: "architecture", icon: Layers, label: "System Architecture" },
  { id: "database", icon: Database, label: "Database Design" },
  { id: "ambassador-dash", icon: LayoutDashboard, label: "Ambassador Dashboard" },
  { id: "admin-dash", icon: ShieldCheck, label: "Admin Dashboard" },
  { id: "referral", icon: Share2, label: "Referral System" },
  { id: "gamification", icon: Gamepad2, label: "Gamification" },
  { id: "whatsapp", icon: MessageCircle, label: "WhatsApp Automation" },
  { id: "ai", icon: Sparkles, label: "AI Features" },
  { id: "viral", icon: Network, label: "Viral Growth" },
  { id: "community", icon: Globe2, label: "Community System" },
  { id: "monetization", icon: DollarSign, label: "Monetization" },
  { id: "analytics", icon: BarChart3, label: "Analytics" },
  { id: "security", icon: Lock, label: "Security & Fraud" },
  { id: "scalability", icon: Server, label: "Scalability" },
  { id: "stack", icon: Code2, label: "Tech Stack" },
  { id: "flows", icon: GitBranch, label: "User Flows" },
  { id: "uiux", icon: Palette, label: "UI / UX" },
  { id: "roadmap", icon: Map, label: "Execution Roadmap" },
  { id: "marketing", icon: Megaphone, label: "Marketing Automation" },
  { id: "advanced", icon: Atom, label: "Advanced Ideas" },
];

const Section = ({ id, icon: Icon, title, n, children }: any) => (
  <section id={id} className="scroll-mt-24 mb-16">
    <div className="flex items-center gap-3 mb-6">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-purple-500/20 border border-cyan-400/30 flex items-center justify-center">
        <Icon className="w-6 h-6 text-cyan-300" />
      </div>
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-cyan-300/70 font-mono">Section {n}</div>
        <h2 className="text-2xl md:text-3xl font-black text-white">{title}</h2>
      </div>
    </div>
    <div className="space-y-4 text-slate-300 leading-relaxed">{children}</div>
  </section>
);

const Card = ({ title, children, accent = "cyan" }: any) => {
  const ring = accent === "purple" ? "border-purple-400/30" : accent === "amber" ? "border-amber-400/30" : "border-cyan-400/30";
  return (
    <div className={`rounded-2xl bg-white/[0.03] backdrop-blur border ${ring} p-5`}>
      {title && <div className="font-bold text-white mb-2 text-sm">{title}</div>}
      <div className="text-sm text-slate-300/90 space-y-1.5">{children}</div>
    </div>
  );
};

const Bullets = ({ items }: { items: string[] }) => (
  <ul className="space-y-1.5">
    {items.map((it, i) => (
      <li key={i} className="flex gap-2 text-sm">
        <ChevronRight className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
        <span>{it}</span>
      </li>
    ))}
  </ul>
);

const Table = ({ headers, rows }: { headers: string[]; rows: string[][] }) => (
  <div className="overflow-x-auto rounded-xl border border-white/10">
    <table className="w-full text-sm">
      <thead className="bg-white/[0.04]">
        <tr>{headers.map((h, i) => (
          <th key={i} className="text-left px-4 py-2.5 font-semibold text-cyan-300 text-xs uppercase tracking-wider">{h}</th>
        ))}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-white/5 hover:bg-white/[0.02]">
            {r.map((c, j) => <td key={j} className="px-4 py-2.5 text-slate-300 align-top">{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const ASCII = ({ children }: any) => (
  <pre className="text-[11px] md:text-xs font-mono bg-black/40 border border-white/10 rounded-xl p-4 overflow-x-auto text-cyan-200/90 leading-relaxed">
    {children}
  </pre>
);

const CampusAmbassadorBlueprint = () => {
  const [active, setActive] = useState("vision");
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    document.title = "Campus Ambassador Blueprint — ACRY.ai";
    const onScroll = () => {
      setShowTop(window.scrollY > 600);
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.top < 200 && r.bottom > 200) { setActive(s.id); break; }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#070912] text-white relative overflow-x-hidden">
      {/* Ambient gradients */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[600px] h-[600px] rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-[500px] h-[500px] rounded-full bg-pink-500/5 blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/10 backdrop-blur-xl bg-black/30 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-black text-lg">
            <span className="bg-gradient-to-r from-cyan-300 to-purple-400 bg-clip-text text-transparent">ACRY.ai</span>
            <span className="hidden sm:inline text-xs text-slate-400 font-normal">/ Campus Ambassador Blueprint</span>
          </Link>
          <Link
            to="/admin"
            className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition"
          >
            Admin Panel →
          </Link>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 py-10 md:py-16">
        {/* HERO */}
        <div className="text-center mb-16 md:mb-24">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold mb-6">
            <Rocket className="w-3.5 h-3.5" /> YC-LEVEL PRODUCT BLUEPRINT · v1.0
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight mb-6 leading-[1.05]">
            Campus Ambassador &<br />
            <span className="bg-gradient-to-r from-cyan-300 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Student Growth Engine
            </span>
          </h1>
          <p className="max-w-3xl mx-auto text-lg text-slate-400 leading-relaxed">
            A complete founder + engineering + growth handbook for building India's largest viral
            student acquisition system. Mobile-first, WhatsApp-native, AI-powered, gamified to the core.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            {["Viral Loops", "AI-Powered", "WhatsApp-First", "Gamified", "Hyperlocal", "Scalable to 1M+"].map(t => (
              <span key={t} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-slate-300">{t}</span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-10">
          {/* Sidebar */}
          <aside className="hidden lg:block sticky top-20 h-fit">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-3 font-mono">Sections</div>
            <nav className="space-y-0.5 max-h-[calc(100vh-120px)] overflow-y-auto pr-2">
              {sections.map((s, i) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition ${
                    active === s.id
                      ? "bg-cyan-500/10 text-cyan-300 border-l-2 border-cyan-400"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span className="font-mono text-[10px] opacity-60">{String(i + 1).padStart(2, "0")}</span>
                  <span>{s.label}</span>
                </a>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <main>
            {/* 1 VISION */}
            <Section id="vision" icon={Rocket} title="Product Vision" n="01">
              <div className="grid md:grid-cols-2 gap-4">
                <Card title="Mission" accent="cyan">
                  Make every Indian student a 30-second walk away from an AI mentor — by turning campuses into self-replicating growth engines powered by peer trust.
                </Card>
                <Card title="Core Problem" accent="purple">
                  EdTech CAC in India is ₹800–₹2,500 per user via paid ads, but peer trust converts at 8–14×. Existing ambassador programs are spreadsheet-driven, manual, opaque, and don't reward consistently — so ambassadors churn in 21 days.
                </Card>
                <Card title="Why Students Join" accent="amber">
                  <Bullets items={[
                    "Free Premium unlock via friend invites",
                    "Live campus & city leaderboards",
                    "Verified resume credential (ACRY Ambassador)",
                    "Earn ₹3K–₹40K/month + paid internship pipeline",
                  ]} />
                </Card>
                <Card title="Why Ambassadors Stay">
                  <Bullets items={[
                    "Daily WhatsApp dopamine: streaks, XP, rank moves",
                    "AI auto-writes their captions, DMs, posts",
                    "Predictable rewards (instant UPI within 24h)",
                    "Status: badges, college shoutouts, founder calls",
                  ]} />
                </Card>
              </div>
              <Card title="Viral Network Effects (k-factor target ≥ 1.4)">
                <ASCII>{`Student signs up  ─▶  Day-1 AI quiz  ─▶  Forced share (1 friend) = +20 XP
        │                                            │
        ▼                                            ▼
  Joins city LB  ◀─── Friend signs up ◀─── WhatsApp deep-link
        │                                            │
        ▼                                            ▼
  Becomes Ambassador  ─▶  Brings 12 in 30d  ─▶  Campus Lead`}</ASCII>
              </Card>
              <Card title="India-Specific Growth Psychology" accent="purple">
                <Bullets items={[
                  "WhatsApp = trust layer. SMS/email is dead for Gen Z.",
                  "₹ amount + UPI screenshot proof beats abstract 'points'.",
                  "Hostel/class group share > 1:1 share. Build for group dynamics.",
                  "Hindi/Hinglish voice notes outperform English text by 3×.",
                  "Tier-2/3 cities respond to college pride: 'Make IIT-Patna #1'.",
                ]} />
              </Card>
            </Section>

            {/* 2 ROLES */}
            <Section id="roles" icon={Users} title="User Roles & Workflows" n="02">
              <Table
                headers={["Role", "Scope", "Primary KPI", "Core Workflow"]}
                rows={[
                  ["Super Admin", "Global / ACRY HQ", "Viral coefficient, MRR", "Approve regions → set bounties → fraud review → payouts"],
                  ["Regional Lead", "State (e.g. UP, MH)", "Active campuses, regional ARR", "Recruit Campus Leads → run state battles → weekly OKR review"],
                  ["Campus Lead", "1 college", "Campus penetration %", "Recruit 5–10 ambassadors → host events → weekly campus report"],
                  ["Ambassador", "Peer network", "Activated referrals, XP", "Daily mission → AI caption → share → track conversions → claim reward"],
                  ["Student User", "Self", "Study minutes, streak", "Onboard → AI quiz → study → share badge → invite friend → unlock Premium"],
                  ["Affiliate Partner", "External (YouTubers, coaches)", "Conversions, GMV", "Get custom UTM → embed widget → monthly auto-payout"],
                ]}
              />
            </Section>

            {/* 3 ARCHITECTURE */}
            <Section id="architecture" icon={Layers} title="System Architecture" n="03">
              <ASCII>{`┌───────────────────────────────────────────────────────────────┐
│  CLIENTS:  PWA (React+Vite) · iOS/Android (Capacitor) · WA Bot │
└────────────────────────┬──────────────────────────────────────┘
                         │ HTTPS / WSS
┌────────────────────────▼──────────────────────────────────────┐
│  EDGE LAYER:  Cloudflare CDN · WAF · Rate-Limit · Geo-Routing │
└────────────────────────┬──────────────────────────────────────┘
                         │
┌────────────────────────▼──────────────────────────────────────┐
│  API GATEWAY (service.acry.ai)  · JWT/API-Key Auth · HMAC      │
└──┬───────────┬───────────┬───────────┬───────────┬────────────┘
   │           │           │           │           │
┌──▼──┐   ┌────▼────┐  ┌───▼───┐  ┌────▼────┐  ┌──▼──────┐
│Edge │   │Referral │  │Reward │  │Gamify   │  │AI       │
│Fns  │   │Engine   │  │Engine │  │Engine   │  │Gateway  │
└──┬──┘   └────┬────┘  └───┬───┘  └────┬────┘  └──┬──────┘
   │           │           │           │           │
┌──▼───────────▼───────────▼───────────▼───────────▼──────────┐
│  EVENT BUS (pg_notify + Realtime channels)                   │
└──┬──────────────────────────┬──────────────────────────┬─────┘
   │                          │                          │
┌──▼──────┐              ┌────▼────┐                ┌────▼────┐
│Postgres │              │Redis    │                │Storage  │
│(RLS)    │              │(LB,Rate)│                │(S3-comp)│
└─────────┘              └─────────┘                └─────────┘
   │
┌──▼────────────────────────────────────────────────────────────┐
│ ASYNC WORKERS: WhatsApp · SMS · Voice (MSG91) · Email (Resend)│
└───────────────────────────────────────────────────────────────┘`}</ASCII>
              <div className="grid md:grid-cols-2 gap-4">
                <Card title="Frontend Architecture">
                  <Bullets items={[
                    "React 18 + Vite 5 + TS (PWA, code-split per route)",
                    "TailwindCSS + semantic tokens (light/dark)",
                    "Zustand for ephemeral state, React Query for server cache",
                    "Capacitor wrappers for iOS/Android with native push",
                    "<3s LCP target on 3G; offline-first via service worker",
                  ]} />
                </Card>
                <Card title="Backend Architecture" accent="purple">
                  <Bullets items={[
                    "Postgres + RLS (single source of truth)",
                    "Edge Functions (Deno) — stateless, autoscale",
                    "Redis: leaderboards (ZSET), rate-limit, deduplication",
                    "Event Bus via pg_notify → Realtime channels",
                    "Workers for WhatsApp/SMS/Voice/Email (MSG91 + Resend)",
                  ]} />
                </Card>
              </div>
            </Section>

            {/* 4 DATABASE */}
            <Section id="database" icon={Database} title="Database Design" n="04">
              <Table
                headers={["Table", "Key Columns", "Purpose"]}
                rows={[
                  ["users", "id, phone, email, role, campus_id, ref_handle", "Core identity (auth.users + profiles)"],
                  ["campuses", "id, name, city, state, tier, lead_user_id, penetration_pct", "Hyperlocal entity"],
                  ["ambassador_levels", "id, name, min_xp, perks, payout_multiplier", "Bronze→Silver→Gold→Platinum→Legend"],
                  ["referrals", "id, ref_handle, source_uid, target_uid, status, attribution_meta, ip_hash, device_fp", "Multi-level attribution"],
                  ["coupons", "id, code, type, value, max_uses, scope, created_by, expires_at", "Coupon engine"],
                  ["rewards", "id, user_id, type, amount, status, paid_at, utr", "UPI payout ledger"],
                  ["transactions", "id, user_id, ref_id, gross, net, gateway, status", "Razorpay reconciliation"],
                  ["xp_events", "id, user_id, action, xp_delta, source, created_at", "Append-only XP log"],
                  ["events", "id, user_id, event_type, payload, session_id, ts", "ML event bus"],
                  ["notifications", "id, user_id, channel, template_id, status, retries", "Omnichannel queue"],
                  ["missions / tasks", "id, user_id, mission_id, status, due_at, reward_xp", "Daily/weekly missions"],
                  ["challenges", "id, type, start_at, end_at, prize_pool, rules_json", "Campus & regional battles"],
                  ["community_engagement", "id, user_id, group_id, action, score", "Telegram/WA group activity"],
                  ["daily_activity", "user_id, date, study_min, shares, signups, xp", "Materialized for LB"],
                ]}
              />
            </Section>

            {/* 5 AMBASSADOR DASHBOARD */}
            <Section id="ambassador-dash" icon={LayoutDashboard} title="Ambassador Dashboard" n="05">
              <ASCII>{`┌──────────────────────────────────────────────────────────────┐
│ Hi Rahul 👋   🔥 12-day streak    Level: GOLD ★★★   2,840 XP │
├───────────────────────┬──────────────────────────────────────┤
│ THIS MONTH            │  CAMPUS LEADERBOARD (IIT-Patna)      │
│ ₹4,820 earned         │  #1 Rahul   2,840 XP  ▲              │
│ 23 signups            │  #2 Priya   2,710 XP                 │
│ 47% conv rate         │  #3 Aman    2,540 XP                 │
├───────────────────────┴──────────────────────────────────────┤
│ TODAY'S MISSIONS                                             │
│ □ Share 3 WhatsApp statuses        +30 XP   [AI Caption →]   │
│ □ DM 5 juniors with custom invite  +50 XP   [AI DM Gen →]    │
│ □ Post 1 reel about ACRY           +80 XP   [Generate Reel →]│
├──────────────────────────────────────────────────────────────┤
│ [Share Tools]  [Heatmap]  [Badges]  [Rewards]  [Withdraw]    │
└──────────────────────────────────────────────────────────────┘`}</ASCII>
              <div className="grid md:grid-cols-3 gap-3">
                {["Earnings + Withdraw (UPI ≤24h)","Live Referral Count","Campus & City Rank","Daily Missions","Streak Badges","Weekly Challenges","Campus Heatmap","WhatsApp Share Kit","AI Caption Generator","AI DM Generator","Achievement Wall","Perks Marketplace"].map(t=>(
                  <Card key={t}>{t}</Card>
                ))}
              </div>
            </Section>

            {/* 6 ADMIN */}
            <Section id="admin-dash" icon={ShieldCheck} title="Admin Dashboard" n="06">
              <div className="grid md:grid-cols-2 gap-4">
                <Card title="Global Analytics" accent="cyan">
                  Viral coefficient (k), MAU, MRR, payout liability, top-100 campuses by penetration, cohort retention curves.
                </Card>
                <Card title="Regional Analytics" accent="purple">
                  State heatmap, regional ARR, Campus Lead performance, dead-zone identifier (campuses with 0 growth in 14d).
                </Card>
                <Card title="Ambassador Approval">KYC + college ID OCR + auto-score. One-click approve / reject / probation.</Card>
                <Card title="Fraud Detection" accent="amber">
                  Device fingerprint clustering, IP velocity, signup-graph anomaly, payout hold queue.
                </Card>
                <Card title="Revenue Analytics">Per-ambassador GMV, CAC by source, LTV by acquisition channel.</Card>
                <Card title="Coupon Abuse Prevention">Per-user cap, geo restrictions, stacking rules, auto-disable on anomaly.</Card>
              </div>
            </Section>

            {/* 7 REFERRAL */}
            <Section id="referral" icon={Share2} title="Referral System" n="07">
              <Card title="Link Format">
                <code className="text-cyan-300 text-xs">acry.ai/?ref=rahul123&amp;utm_source=wa&amp;utm_medium=status&amp;utm_campaign=jee2026</code>
              </Card>
              <ASCII>{`Click ─▶ Edge fn logs (ref, utm, ip_hash, fp, ua) ─▶ Cookie 30d
   │
   ▼
Signup ─▶ Match cookie → insert referrals(target=new_uid, status='pending')
   │
   ▼
Activation event (onboarding_complete | first_paid)
   │
   ▼
Anti-fraud score < 0.4? → status='confirmed' → reward queued → UPI payout`}</ASCII>
              <Bullets items={[
                "Multi-level (L1 = 100%, L2 = 20%, L3 = 5%) capped at 3 hops",
                "Device fingerprint (FingerprintJS open) + IP hash + behavioral velocity",
                "Smart UTM auto-rewrite when AI detects bad caption",
                "Reward automation via cron + Razorpay UPI payouts",
                "Viral sharing loop: every signup forced to share 1 of 5 templates on Day-1",
              ]} />
            </Section>

            {/* 8 GAMIFICATION */}
            <Section id="gamification" icon={Gamepad2} title="Gamification Engine" n="08">
              <Table
                headers={["Layer", "Mechanic", "Reward"]}
                rows={[
                  ["Daily", "Missions (study 25m, share 1, DM 3)", "20–80 XP"],
                  ["Weekly", "Campus battle, referral war", "₹500–₹5k pool"],
                  ["Monthly", "City leaderboard, top 3 → cash", "₹10k / ₹5k / ₹2k"],
                  ["Lifetime", "Bronze→Silver→Gold→Platinum→Legend", "Multipliers + badges"],
                  ["Streak", "🔥 Days in a row", "Streak freeze, multipliers"],
                  ["AI-Personal", "AI-generated weekly challenge based on past data", "Bonus XP"],
                ]}
              />
            </Section>

            {/* 9 WHATSAPP */}
            <Section id="whatsapp" icon={MessageCircle} title="WhatsApp Automation" n="09">
              <ASCII>{`Day 0  · Welcome + how it works (60s voice note in Hindi)
Day 1  · "Your first ₹100 is 1 share away" + AI caption ready
Day 3  · Leaderboard alert: "You're #14 in IIT-Patna, 2 signups to #10"
Day 7  · Streak nudge + reward unlock animation
Day 14 · Re-engagement: AI-generated personalized voice note
Day 30 · Promotion to next level OR re-activation campaign`}</ASCII>
              <Bullets items={[
                "MSG91 OBD (voice) for milestones + outbound transactional WA",
                "AI-personalized nudges (Gemini) — uses last 7 days of activity",
                "Voice note campaigns: founder's voice cloned per state (Hindi/Tamil/Telugu)",
                "Drip sequences orchestrated by sms-event-engine + omnichannel-notify",
              ]} />
            </Section>

            {/* 10 AI */}
            <Section id="ai" icon={Sparkles} title="AI Features" n="10">
              <div className="grid md:grid-cols-2 gap-4">
                <Card title="Smart Student Targeting">Gemini ranks unconverted contacts by likelihood-to-signup using session, engagement, exam-fit.</Card>
                <Card title="Performance Prediction" accent="purple">Predict ambassador 30-day churn — auto-trigger retention playbook.</Card>
                <Card title="Auto Captions">5 caption variants per share, tuned for WA / Insta / X / LinkedIn.</Card>
                <Card title="AI DM Generator">Personalized DMs using target's college + exam.</Card>
                <Card title="WhatsApp Reply Assistant">Suggests 3 reply options to common questions in ambassador's tone.</Card>
                <Card title="Engagement Scoring" accent="amber">Real-time 0–100 score → unlocks perks, dynamic rewards.</Card>
                <Card title="Churn Prediction">Flag at-risk ambassadors → auto founder voice note.</Card>
                <Card title="Study Integration">Hooks into ACRY's existing Forgetting Curve + Rank Prediction APIs.</Card>
              </div>
            </Section>

            {/* 11 VIRAL */}
            <Section id="viral" icon={Network} title="Viral Growth System" n="11">
              <Bullets items={[
                "Invite Loop: every milestone (rank up, streak 7, first ₹) forces a share modal with pre-generated visual.",
                "Campus Competitions: 'First college to 500 signups wins ₹50k campus party'.",
                "Referral Battles: 2 ambassadors challenge each other for 48h, loser pays winner XP.",
                "Team Invites: Form squads of 5, combined rewards + squad leaderboard.",
                "Social Unlock: Premium features unlock at 3/10/25 invites.",
                "Group Referral Bonus: WA group with >50 ACRY users → all get +1 month Premium.",
                "City Leaderboards: Live ticker on landing page — 'Patna passed Lucknow today!'",
                "Regional Expansion Loops: City unlocks 'launch event' at 1000 users → free swag.",
              ]} />
            </Section>

            {/* 12 COMMUNITY */}
            <Section id="community" icon={Globe2} title="Community System" n="12">
              <div className="grid md:grid-cols-2 gap-4">
                <Card title="Telegram">Per-exam channels, auto-bot pushes daily quiz + Q&A.</Card>
                <Card title="WhatsApp Communities" accent="purple">Per-campus group, auto-add on join via deep link.</Card>
                <Card title="Discord">Power-user + ambassador HQ, voice study rooms.</Card>
                <Card title="Campus Groups">Self-organized, Campus Lead is moderator with admin tools.</Card>
                <Card title="Events + AMAs" accent="amber">Monthly founder AMA, topper interviews, weekly study jams.</Card>
                <Card title="AI Mentor Community">AI agents seeded in groups to answer doubts 24×7.</Card>
              </div>
            </Section>

            {/* 13 MONETIZATION */}
            <Section id="monetization" icon={DollarSign} title="Monetization" n="13">
              <Table
                headers={["Stream", "Pricing", "Notes"]}
                rows={[
                  ["ACRY Premium", "₹149/mo (15-day trial)", "Core SaaS revenue"],
                  ["Ambassador Pro tier", "₹49/mo", "Advanced AI tools + 2× payout multiplier"],
                  ["Brand sponsorships", "₹1L–10L / campaign", "Sponsored missions"],
                  ["Campus ads", "₹10k–50k / campus / month", "Targeted promos to college"],
                  ["Affiliate revenue share", "20% recurring", "YouTubers, coaches"],
                  ["Recruitment partnerships", "₹500 / qualified lead", "Coaching institutes"],
                  ["EdTech collabs", "Rev-share API", "B2B2C integrations"],
                ]}
              />
            </Section>

            {/* 14 ANALYTICS */}
            <Section id="analytics" icon={BarChart3} title="Analytics" n="14">
              <Table
                headers={["Metric", "Formula", "Target"]}
                rows={[
                  ["North Star", "Weekly Active Ambassadors × Avg Signups", "10k by M12"],
                  ["CAC (organic)", "Total spend / new signups", "< ₹40"],
                  ["LTV", "ARPU × avg lifetime months", "> ₹600"],
                  ["k (viral coeff)", "invites × conversion rate", "≥ 1.4"],
                  ["D30 retention", "D30 actives / D0 signups", "> 35%"],
                  ["Ambassador productivity", "signups / amb / week", "> 5"],
                  ["Campus penetration", "active / total students", "> 12%"],
                ]}
              />
            </Section>

            {/* 15 SECURITY */}
            <Section id="security" icon={Lock} title="Security & Fraud Detection" n="15">
              <Bullets items={[
                "Device fingerprint clustering — flag >3 signups/day from same fp",
                "IP velocity + ASN reputation (block hosting/VPN ranges for rewards)",
                "Email+phone dedup with disposable-domain blocklist",
                "Behavioral biometrics: time-to-onboard, mouse/touch patterns",
                "AI fraud score 0–1; >0.6 → manual review, >0.85 → auto-reject",
                "Append-only ledger, hash-chained payouts (audit trail)",
                "Razorpay payout 24h cool-down for new ambassadors",
              ]} />
            </Section>

            {/* 16 SCALABILITY */}
            <Section id="scalability" icon={Server} title="Scalability Plan" n="16">
              <Table
                headers={["Stage", "Users", "Architecture"]}
                rows={[
                  ["MVP", "10K", "Single Postgres + Edge Fns + Redis"],
                  ["Growth", "100K", "Read replicas, Redis cluster, CDN, queue workers"],
                  ["Scale", "1M", "Multi-region read replicas, partitioned event tables, Kafka-style event streaming"],
                  ["Global", "10M", "Active-active multi-region, sharded by state, edge compute, materialized LBs"],
                ]}
              />
            </Section>

            {/* 17 STACK */}
            <Section id="stack" icon={Code2} title="Tech Stack" n="17">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                <Card title="Frontend">React 18 · Vite · TS · Tailwind · Capacitor</Card>
                <Card title="Backend">Edge Functions (Deno) · Postgres + RLS</Card>
                <Card title="Realtime">Postgres Realtime · Redis Pub/Sub</Card>
                <Card title="AI">Lovable AI Gateway · Gemini 2.5 / GPT-5</Card>
                <Card title="Analytics">PostHog · Metabase · Custom event bus</Card>
                <Card title="Messaging">MSG91 (SMS/WA/Voice) · Resend (email)</Card>
                <Card title="Payments">Razorpay UPI Payouts · Smart Collect</Card>
                <Card title="Cloud">Lovable Cloud · Cloudflare CDN · S3-compat storage</Card>
                <Card title="Monitoring">Sentry · Better Stack · Custom incident log</Card>
              </div>
            </Section>

            {/* 18 FLOWS */}
            <Section id="flows" icon={GitBranch} title="Complete User Flows" n="18">
              <Card title="Ambassador Onboarding">
                <ASCII>{`Apply (phone OTP) ─▶ College + ID upload ─▶ AI-OCR verify
  ─▶ 2-min onboarding quiz (personality + reach)
  ─▶ Auto-tier: Bronze (default) ─▶ Welcome WA voice note
  ─▶ Dashboard unlock + first 3 missions`}</ASCII>
              </Card>
              <Card title="Referral → Activation">
                <ASCII>{`Friend clicks acry.ai/?ref=rahul123
  ─▶ Cookie + fp logged
  ─▶ Phone OTP signup
  ─▶ Onboarding complete = trigger 'activation'
  ─▶ Rahul gets +₹100 + 50XP instantly
  ─▶ Friend gets 7-day free Premium`}</ASCII>
              </Card>
            </Section>

            {/* 19 UIUX */}
            <Section id="uiux" icon={Palette} title="UI / UX Design Principles" n="19">
              <Bullets items={[
                "YC-clean: 1 primary action per screen, generous whitespace",
                "Gen Z energy: neon gradients, micro-animations, sticker-style badges",
                "Dark mode default, true black on OLED",
                "Mobile-first 430px max-width, safe-area aware",
                "Gamified feedback: confetti, haptic, sound on every win",
                "Viral share UX: 1-tap to WA with pre-generated visual",
                "Minimal friction onboarding: 3 screens max, OTP only",
              ]} />
            </Section>

            {/* 20 ROADMAP */}
            <Section id="roadmap" icon={Map} title="Execution Roadmap" n="20">
              <Table
                headers={["Window", "Goals", "Team"]}
                rows={[
                  ["MVP (Day 0–30)", "Referral engine, dashboard, WA share, UPI payouts", "2 eng + 1 design + founder"],
                  ["Day 30–60", "Gamification, leaderboards, AI captions", "+1 eng, +1 growth"],
                  ["Day 60–90", "Campus battles, AI DM gen, fraud engine, 10 pilot campuses", "+1 community manager"],
                  ["Day 90–180", "100 campuses live, regional leads, sponsored missions", "+1 ops + 1 finance"],
                ]}
              />
              <Card title="Budget (90-day MVP)" accent="amber">
                Engineering ₹12L · AI/infra ₹3L · MSG91/Razorpay ₹1L · Rewards pool ₹15L · Marketing ₹5L · <strong>Total ≈ ₹36L</strong>
              </Card>
            </Section>

            {/* 21 MARKETING */}
            <Section id="marketing" icon={Megaphone} title="Marketing Automation" n="21">
              <div className="grid md:grid-cols-2 gap-4">
                <Card title="Email Sequences">Welcome (D0) → Activation (D1) → First Reward (D3) → Streak (D7) → Win-back (D14, D21).</Card>
                <Card title="WhatsApp Sequences" accent="purple">11 lifecycle events, AI-personalized voice notes for top moments.</Card>
                <Card title="Push Notifications">Behavior-triggered (rank drop, friend signed up, mission expiring).</Card>
                <Card title="AI Campaigns">Gemini auto-writes 20 variants/week, A/B tested, winner auto-deployed.</Card>
                <Card title="Referral Campaigns" accent="amber">Seasonal: NEET-week double XP, JEE-result-day campus battle.</Card>
                <Card title="Dormant Activation">Day-7 inactivity → founder voice note → Day-14 ₹100 bonus offer.</Card>
              </div>
            </Section>

            {/* 22 ADVANCED */}
            <Section id="advanced" icon={Atom} title="Advanced Ideas (Moonshots)" n="22">
              <Bullets items={[
                "AI Study Battles — live 1v1 quiz duels with crowd watching & betting XP",
                "Campus AI Tournament — semester-long inter-college olympiad with brand sponsors",
                "AI-generated study reels — 30s vertical video summarizing today's revision, auto-posted to ambassador's Insta",
                "Viral Ranking System — ACRY Rank visible publicly like Strava segments",
                "Student Reputation Score — portable credential usable for internships",
                "AI Influencer Ambassadors — synthetic personalities seeded per state in regional languages",
                "Geo-based Campus Domination Map — Risk-style live map of India, colleges captured in color",
                "Offline → Online loops — physical fest QR scan → instant ambassador onboarding",
              ]} />
            </Section>

            {/* CTA */}
            <div className="mt-20 p-8 rounded-3xl bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-pink-500/10 border border-white/10 text-center">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-300 mb-3">
                <Rocket className="w-4 h-4" /> READY TO BUILD
              </div>
              <h3 className="text-2xl md:text-3xl font-black mb-3">
                This blueprint is execution-ready.
              </h3>
              <p className="text-slate-400 max-w-2xl mx-auto mb-6 text-sm">
                Every system above maps to ACRY's existing infrastructure: Lovable Cloud, MSG91, Razorpay,
                Gemini AI, and the Edge Function runtime. MVP can ship in 30 days.
              </p>
              <Link
                to="/admin"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-cyan-300 transition"
              >
                Open Admin Console <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </main>
        </div>
      </div>

      {/* Back to top */}
      {showTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-20 w-12 h-12 rounded-full bg-cyan-500 text-black flex items-center justify-center shadow-lg shadow-cyan-500/30 hover:scale-110 transition"
          aria-label="Back to top"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

export default CampusAmbassadorBlueprint;
