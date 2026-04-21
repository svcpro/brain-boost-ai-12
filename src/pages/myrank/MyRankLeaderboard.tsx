import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Trophy, ArrowLeft, Crown, MapPin, Calendar, Globe, Flame, Sparkles, Zap, TrendingUp, Info, Clock, ChevronRight } from "lucide-react";

const formatRelative = (iso: string | null | undefined): string => {
  if (!iso) return "just now";
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.max(1, Math.floor(diffMs / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const CATEGORIES = ["ALL", "UPSC", "SSC", "JEE", "NEET", "IQ"];
const SCOPES: { key: string; label: string; icon: typeof Globe }[] = [
  { key: "india", label: "India", icon: Globe },
  { key: "weekly", label: "Weekly", icon: Calendar },
  { key: "city", label: "My City", icon: MapPin },
];

interface Row {
  position: number;
  name: string;
  avatar_url?: string | null;
  category: string;
  score: number;
  percentile: number;
  rank: number;
  ai_tag: string;
  city: string | null;
  is_me: boolean;
}

const getInitials = (name: string) =>
  (name || "?")
    .split(" ")
    .map(n => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

// SECURITY: Only render the real profile name on the row that the backend
// flagged as is_me. Every other row gets a generic, non-identifying label so
// a user can never accidentally see another user's name attached to a rank.
const displayNameFor = (row: { is_me: boolean; name: string; position: number }) =>
  row.is_me ? (row.name || "You") : `Rank #${row.position}`;

const MyRankLeaderboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  // Auto-select the exam category the user just completed (passed via ?category=)
  const initialCategory = (() => {
    const raw = (searchParams.get("category") || "ALL").toUpperCase();
    return CATEGORIES.includes(raw) ? raw : "ALL";
  })();
  const [category, setCategory] = useState(initialCategory);
  const [scope, setScope] = useState<"india" | "weekly" | "city">("india");
  const [rows, setRows] = useState<Row[]>([]);
  const [myPos, setMyPos] = useState<number | null>(null);
  const [myCity, setMyCity] = useState<string | null>(null);
  const [citySource, setCitySource] = useState<"explicit" | "profile" | "last_test" | null>(null);
  const [cityCapturedAt, setCityCapturedAt] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoDetecting, setAutoDetecting] = useState(false);
  const [noCompletedTests, setNoCompletedTests] = useState(false);

  // Cached IP-detected city (per browser session) — avoids re-hitting ipapi
  const getCachedDetectedCity = () => {
    try {
      const raw = localStorage.getItem("myrank_detected_city");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // 24h cache
      if (Date.now() - parsed.t > 24 * 60 * 60 * 1000) return null;
      return parsed.city as string;
    } catch { return null; }
  };

  const detectAndPersistCity = async (): Promise<string | null> => {
    let detected = getCachedDetectedCity();
    if (!detected) {
      try {
        const res = await fetch("https://ipapi.co/json/");
        if (!res.ok) return null;
        const data = await res.json();
        detected = (data.city || "").toString().slice(0, 60) || null;
        if (detected) {
          localStorage.setItem("myrank_detected_city", JSON.stringify({ city: detected, t: Date.now() }));
          // Persist to profile if logged in & profile city empty
          if (user?.id) {
            const { data: prof } = await supabase.from("profiles").select("city").eq("id", user.id).maybeSingle();
            if (!prof?.city) {
              await supabase.from("profiles").update({ city: detected, country: data.country_name || null }).eq("id", user.id);
            }
          }
        }
      } catch { return null; }
    }
    return detected;
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const anonId = localStorage.getItem("myrank_anon_id");
      setLoading(true);

      // For city scope, pre-detect to guarantee we have a value
      let cityOverride: string | null = null;
      if (scope === "city") {
        setAutoDetecting(true);
        cityOverride = await detectAndPersistCity();
        setAutoDetecting(false);
      }

      const { data } = await supabase.functions.invoke("myrank-engine", {
        body: {
          action: "leaderboard",
          category,
          scope,
          user_id: user?.id || null,
          anon_session_id: anonId,
          city: cityOverride || undefined,
        },
      });
      if (cancelled) return;
      const d = data as any;
      setRows(d?.leaderboard || []);
      setMyPos(d?.my_position || null);
      setMyCity(d?.my_city || cityOverride || null);
      setCitySource(d?.city_source || (cityOverride ? "explicit" : null));
      setCityCapturedAt(d?.city_captured_at || null);
      setLastUpdatedAt(d?.last_updated_at || null);
      setNoCompletedTests(!!d?.no_completed_tests);
      setLoading(false);
    };
    run();
    return () => { cancelled = true; };
  }, [category, scope, user?.id]);

  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated ambient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-primary/20 blur-3xl animate-pulse" />
        <div className="absolute top-1/3 -right-24 w-80 h-80 rounded-full bg-accent/20 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute bottom-0 left-1/4 w-64 h-64 rounded-full bg-warning/15 blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />
      </div>

      <div className="relative max-w-md mx-auto px-4 py-5 space-y-5">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <Button variant="ghost" size="icon" onClick={() => navigate("/myrank")} className="shrink-0 hover:bg-primary/10">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <span className="relative">
                <Trophy className="w-6 h-6 text-warning drop-shadow-[0_0_8px_hsl(var(--warning)/0.6)]" />
                <Sparkles className="w-3 h-3 text-warning absolute -top-1 -right-1 animate-pulse" />
              </span>
              <span className="bg-gradient-to-r from-warning via-primary to-accent bg-clip-text text-transparent">
                Hall of Fame
              </span>
            </h1>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Flame className="w-3 h-3 text-destructive" />
              Live rankings · Top 100 minds
            </p>
          </div>
        </motion.div>

        {/* Scope tabs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-3 gap-2"
        >
          {SCOPES.map((s, idx) => {
            const Icon = s.icon;
            const active = scope === s.key;
            return (
              <motion.button
                key={s.key}
                onClick={() => setScope(s.key as any)}
                whileTap={{ scale: 0.95 }}
                className={`relative flex flex-col items-center gap-1 p-2.5 rounded-xl text-xs font-semibold transition-all overflow-hidden ${
                  active
                    ? "text-primary-foreground shadow-lg shadow-primary/30"
                    : "bg-card/50 backdrop-blur-sm text-muted-foreground border border-border/50 hover:border-primary/30"
                }`}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                {active && (
                  <motion.div
                    layoutId="scope-bg"
                    className="absolute inset-0 bg-gradient-to-br from-primary to-accent"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon className="w-4 h-4 relative z-10" />
                <span className="relative z-10">{s.label}</span>
              </motion.button>
            );
          })}
        </motion.div>

        {/* Category chips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none"
        >
          {CATEGORIES.map(c => {
            const active = category === c;
            return (
              <motion.button
                key={c}
                onClick={() => setCategory(c)}
                whileTap={{ scale: 0.92 }}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all relative ${
                  active
                    ? "bg-foreground text-background shadow-md shadow-foreground/20"
                    : "bg-card/50 backdrop-blur-sm text-muted-foreground border border-border/50 hover:border-foreground/30"
                }`}
              >
                {c}
                {active && (
                  <motion.span
                    layoutId="cat-glow"
                    className="absolute inset-0 rounded-full ring-2 ring-primary/40"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </motion.button>
            );
          })}
        </motion.div>

        {/* My City transparency banner */}
        <AnimatePresence>
          {scope === "city" && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="relative p-3 rounded-2xl bg-gradient-to-r from-accent/10 via-primary/5 to-accent/10 border border-accent/30 backdrop-blur-md overflow-hidden"
            >
              <div className="flex items-start gap-2.5">
                <div className="shrink-0 w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-accent" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  {myCity ? (
                    <>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-bold text-foreground">{myCity}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-accent/20 text-accent font-semibold">
                          {citySource === "profile" ? "From Profile" : citySource === "explicit" ? "Manual" : "Auto-detected"}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Info className="w-2.5 h-2.5" />
                        {citySource === "profile"
                          ? "Set from your profile city — update it anytime in Settings."
                          : citySource === "explicit"
                          ? "Set manually for this session."
                          : "Detected from your last test attempt's IP geolocation."}
                      </p>
                      {cityCapturedAt && citySource === "last_test" && (
                        <p className="text-[10px] text-muted-foreground/80">
                          Location captured {formatRelative(cityCapturedAt)}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-bold text-foreground">City unknown</span>
                      <p className="text-[10px] text-muted-foreground">
                        Take a test to auto-detect your city, or update your profile to set it manually.
                      </p>
                    </>
                  )}
                  {lastUpdatedAt && (
                    <p className="text-[10px] text-muted-foreground/80 flex items-center gap-1 pt-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      Leaderboard updated {formatRelative(lastUpdatedAt)}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty-state CTA: user has 0 completed tests for this category/scope.
            Hide the pinned rank/name card and prompt them to take the test. */}
        {!loading && noCompletedTests && (
          <motion.button
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => navigate(`/myrank/test?category=${category}`)}
            className="w-full text-left p-4 rounded-2xl bg-gradient-to-r from-primary/15 via-accent/10 to-primary/15 border border-primary/40 backdrop-blur-md flex items-center gap-3"
          >
            <Trophy className="w-6 h-6 text-warning shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold">Get your India rank</div>
              <div className="text-[11px] text-muted-foreground">
                Take a 60-second AI test in {category === "ALL" ? "any category" : category} to appear on the leaderboard.
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-primary shrink-0" />
          </motion.button>
        )}

        <AnimatePresence>
          {(() => {
            if (noCompletedTests) return null;
            const meRow = rows.find(r => r.is_me);
            const showPinned = meRow && meRow.position > 3;
            if (!showPinned && !(myPos && myPos > 100)) return null;
            return (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative p-3 rounded-2xl bg-gradient-to-r from-primary/15 via-accent/10 to-primary/15 border border-primary/40 backdrop-blur-md overflow-hidden shadow-lg shadow-primary/10"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.25),transparent_60%)]" />
                {meRow ? (
                  <div className="relative flex items-center gap-3">
                    <div className="w-9 text-center shrink-0">
                      <span className="text-base font-extrabold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent tabular-nums">
                        #{meRow.position}
                      </span>
                    </div>
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-primary/30 to-accent/20 border border-primary/60 ring-2 ring-primary/30 flex items-center justify-center">
                        {meRow.avatar_url ? (
                          <img src={meRow.avatar_url} alt={meRow.name} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <span className="text-[11px] font-bold text-primary">{getInitials(meRow.name)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate flex items-center gap-1.5">
                        {meRow.name}
                        <span className="text-[9px] bg-gradient-to-r from-primary to-accent text-primary-foreground px-1.5 py-0.5 rounded-md font-bold shadow shadow-primary/30">
                          YOU
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                        <TrendingUp className="w-2.5 h-2.5 text-primary" />
                        Pinned for quick access · {meRow.category}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold tabular-nums bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                        {meRow.percentile}%
                      </div>
                      <div className="text-[9px] text-muted-foreground">percentile</div>
                    </div>
                  </div>
                ) : (
                  <div className="relative flex justify-between items-center text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      Your position
                    </span>
                    <span className="font-bold text-lg bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                      #{myPos!.toLocaleString("en-IN")}
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* Loading */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-primary/20" />
              <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <Trophy className="absolute inset-0 m-auto w-5 h-5 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground animate-pulse">Loading champions...</p>
          </div>
        ) : rows.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-10 text-center rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50"
          >
            <Trophy className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No champions yet.<br/>Be the first to take this test!</p>
          </motion.div>
        ) : (
          <>
            {/* Podium for Top 3 */}
            {top3.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="relative grid grid-cols-3 gap-2 items-end pt-4"
              >
                {/* 2nd place */}
                {top3[1] && (
                  <PodiumCard
                    row={top3[1]}
                    place={2}
                    height="h-32"
                    gradient="from-slate-400 to-slate-600"
                    medal="🥈"
                    delay={0.25}
                  />
                )}
                {/* 1st place */}
                {top3[0] && (
                  <PodiumCard
                    row={top3[0]}
                    place={1}
                    height="h-40"
                    gradient="from-warning via-yellow-400 to-warning"
                    medal="🥇"
                    delay={0.2}
                    isFirst
                  />
                )}
                {/* 3rd place */}
                {top3[2] && (
                  <PodiumCard
                    row={top3[2]}
                    place={3}
                    height="h-28"
                    gradient="from-orange-500 to-amber-700"
                    medal="🥉"
                    delay={0.3}
                  />
                )}
              </motion.div>
            )}

            {/* Rest of leaderboard */}
            {rest.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2 px-1">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent to-border" />
                  <span className="text-[10px] font-semibold text-muted-foreground tracking-wider">RANKED CHALLENGERS</span>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent to-border" />
                </div>
                <AnimatePresence>
                  {rest.map((r, idx) => (
                    <motion.div
                      key={`${r.position}-${r.name}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.35 + idx * 0.03, duration: 0.3 }}
                      whileHover={{ scale: 1.02, x: 4 }}
                      className={`relative flex items-center gap-3 p-3 rounded-xl backdrop-blur-sm overflow-hidden transition-all ${
                        r.is_me
                          ? "bg-gradient-to-r from-primary/15 via-accent/10 to-transparent border border-primary/40 shadow-lg shadow-primary/10"
                          : "bg-card/40 border border-border/50 hover:border-primary/20"
                      }`}
                    >
                      {r.is_me && (
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_left,hsl(var(--primary)/0.15),transparent_60%)]" />
                      )}
                      <div className="relative w-7 text-center shrink-0">
                        <span className="text-sm font-bold text-muted-foreground tabular-nums">#{r.position}</span>
                      </div>
                      {/* Avatar — only show profile picture for the matched is_me row.
                          For everyone else, render anonymous initials so the photo
                          can never be associated with the wrong identity. */}
                      <div className="relative shrink-0">
                        <div className={`w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-primary/30 to-accent/20 border ${r.is_me ? "border-primary/60 ring-2 ring-primary/30" : "border-border/60"} flex items-center justify-center`}>
                          {r.is_me && r.avatar_url ? (
                            <img src={r.avatar_url} alt={displayNameFor(r)} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <span className="text-[10px] font-bold text-primary">{getInitials(displayNameFor(r))}</span>
                          )}
                        </div>
                      </div>
                      <div className="relative flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate flex items-center gap-1.5">
                          {displayNameFor(r)}
                          {r.is_me && (
                            <span className="text-[9px] bg-gradient-to-r from-primary to-accent text-primary-foreground px-1.5 py-0.5 rounded-md font-bold shadow shadow-primary/30">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                          <Zap className="w-2.5 h-2.5 text-accent" />
                          {r.category} · {r.ai_tag}
                        </div>
                      </div>
                      <div className="relative text-right shrink-0">
                        <div className="text-sm font-bold tabular-nums bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                          {r.percentile}%
                        </div>
                        <div className="text-[9px] text-muted-foreground">percentile</div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </>
        )}

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="pt-2 pb-4"
        >
          <Button
            onClick={() => navigate("/myrank")}
            className="w-full h-12 bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] hover:bg-[position:100%_0] text-primary-foreground font-bold shadow-lg shadow-primary/30 transition-all duration-500 group"
          >
            <Flame className="w-4 h-4 mr-2 group-hover:scale-125 transition-transform" />
            Take a test to climb the ranks
            <Sparkles className="w-4 h-4 ml-2 group-hover:rotate-12 transition-transform" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

// Podium Card Component
interface PodiumCardProps {
  row: Row;
  place: number;
  height: string;
  gradient: string;
  medal: string;
  delay: number;
  isFirst?: boolean;
}

const PodiumCard = ({ row, place, height, gradient, medal, delay, isFirst }: PodiumCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 200, damping: 15 }}
      className="flex flex-col items-center gap-2"
    >
      {/* Avatar circle */}
      <motion.div
        animate={isFirst ? { y: [0, -4, 0] } : {}}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        className="relative"
      >
        {isFirst && (
          <Crown className="absolute -top-5 left-1/2 -translate-x-1/2 w-5 h-5 text-warning drop-shadow-[0_0_6px_hsl(var(--warning)/0.8)] animate-pulse" />
        )}
        <div className={`relative w-14 h-14 rounded-full bg-gradient-to-br ${gradient} p-0.5 shadow-xl ${isFirst ? "shadow-warning/50" : ""}`}>
          <div className="w-full h-full rounded-full bg-card flex items-center justify-center overflow-hidden">
            {row.is_me && row.avatar_url ? (
              <img src={row.avatar_url} alt={displayNameFor(row)} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <span className="text-sm font-extrabold text-foreground">{getInitials(displayNameFor(row))}</span>
            )}
          </div>
          {/* Medal overlay */}
          <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-sm shadow-md">
            {medal}
          </span>
          {row.is_me && (
            <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[8px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-md font-bold whitespace-nowrap">
              YOU
            </span>
          )}
        </div>
      </motion.div>

      {/* Name + percentile */}
      <div className="text-center w-full px-1">
        <div className="text-[11px] font-bold truncate">{displayNameFor(row)}</div>
        <div className={`text-sm font-extrabold bg-gradient-to-r ${gradient} bg-clip-text text-transparent tabular-nums`}>
          {row.percentile}%
        </div>
      </div>

      {/* Podium block */}
      <div className={`relative w-full ${height} rounded-t-xl bg-gradient-to-b ${gradient} flex items-start justify-center pt-2 overflow-hidden shadow-lg`}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-px bg-white/40" />
        <span className="relative text-2xl font-black text-white drop-shadow-md">#{place}</span>
        {isFirst && (
          <motion.div
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 bg-gradient-to-t from-warning/40 to-transparent"
          />
        )}
      </div>
    </motion.div>
  );
};

export default MyRankLeaderboard;
