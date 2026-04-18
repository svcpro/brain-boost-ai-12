import { useState, useEffect, createContext, useContext, lazy, Suspense } from "react";
import { Home, Zap, Brain, User, AlertTriangle, X, Shield, Users, Crosshair, Trophy } from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import ACRYLogo from "@/components/landing/ACRYLogo";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useFeatureFlags, FeatureFlagContext } from "@/hooks/useFeatureFlags";
import { usePlanGating, PlanGatingContext } from "@/hooks/usePlanGating";
import VoiceNotificationOverlay from "@/components/app/VoiceNotificationOverlay";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";


// Lazy load all tab components for fast initial load
const HomeTab = lazy(() => import("@/components/app/HomeTab"));
const ActionTab = lazy(() => import("@/components/app/ActionTab"));
const BrainTab = lazy(() => import("@/components/app/BrainTab"));
const ProgressTab = lazy(() => import("@/components/app/ProgressTab"));
const YouTab = lazy(() => import("@/components/app/YouTab"));
const CommunityPage = lazy(() => import("@/pages/CommunityPage"));
const MyRankInline = lazy(() => import("@/components/app/MyRankInline"));
const GlobalNotificationCenter = lazy(() => import("@/components/app/GlobalNotificationCenter"));
import NeuralBootLoader from "@/components/app/NeuralBootLoader";
import { useStudyReminder } from "@/hooks/useStudyReminder";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useVoiceNotification } from "@/hooks/useVoiceNotification";
import { useScheduledVoiceReminder } from "@/hooks/useScheduledVoiceReminder";
import { useWeakQuestionReminder } from "@/hooks/useWeakQuestionReminder";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAutoStudyTracker } from "@/hooks/useAutoStudyTracker";
import { useFocusShield } from "@/hooks/useFocusShield";
import FocusShieldOverlay from "@/components/app/FocusShieldOverlay";
import BrainLensButton from "@/components/app/BrainLensButton";


// Export voice context so child components can trigger voice
export const VoiceContext = createContext<ReturnType<typeof useVoiceNotification> | null>(null);
export const useVoice = () => useContext(VoiceContext);

const tabDefs = [
  { id: "home", label: "Home", icon: Home },
  { id: "action", label: "Action", icon: Zap },
  { id: "myrank", label: "MyRank", icon: Trophy },
  { id: "brain", label: "Brain", icon: Brain },
  // { id: "community", label: "Community", icon: Users }, // hidden per user request
  { id: "progress", label: "SureShot", icon: Crosshair },
  { id: "you", label: "You", icon: User },
];

const TAB_LOADER_MESSAGES: Record<string, string> = {
  action: "Loading Action Center",
  brain: "Booting Neural Brain",
  progress: "Calibrating SureShot Engine",
  you: "Syncing Your Identity Core",
};

const AppDashboard = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [tabLoading, setTabLoading] = useState<string | null>(null);
  const [autoOpenVoice, setAutoOpenVoice] = useState(false);
  const [autoOpenSubscription, setAutoOpenSubscription] = useState(false);
  const [autoOpenNotifHistory, setAutoOpenNotifHistory] = useState(false);
  
  
  const { user } = useAuth();
  // Fully autonomous silent study tracker — runs app-wide
  useAutoStudyTracker();
  const { isAdmin } = useAdminRole();
  const navigate = useNavigate();
  const { isEnabled: isTabEnabled, loading: flagsLoading } = useFeatureFlags();
  const planGating = usePlanGating();
  const [recCount, setRecCount] = useState(0);
  const [pendingGifts, setPendingGifts] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [expiryWarning, setExpiryWarning] = useState<{ plan: string; daysLeft: number } | null>(null);
  const [dismissedWarning, setDismissedWarning] = useState(false);
  const [currentPlan, setCurrentPlan] = useState("free");
  const voice = useVoiceNotification();
  
  const focusShield = useFocusShield();
  
  useStudyReminder();
  useOfflineSync();
  useScheduledVoiceReminder();
  useWeakQuestionReminder();

  // Track engagement for send-time optimization (non-blocking)
  useEffect(() => {
    import("@/lib/eventBus").then(({ trackEngagement }) => {
      trackEngagement("app_open");
    });
  }, []);

  // Preload all tab modules in the background after first paint so tab switches are instant.
  // Uses requestIdleCallback (with setTimeout fallback) to avoid blocking the active tab render.
  useEffect(() => {
    const preload = () => {
      import("@/components/app/HomeTab");
      import("@/components/app/ActionTab");
      import("@/components/app/BrainTab");
      import("@/components/app/ProgressTab");
      import("@/components/app/YouTab");
      import("@/components/app/MyRankInline");
      import("@/components/app/GlobalNotificationCenter");
    };
    const w = window as any;
    const id = w.requestIdleCallback
      ? w.requestIdleCallback(preload, { timeout: 2000 })
      : window.setTimeout(preload, 1200);
    return () => {
      if (w.cancelIdleCallback) w.cancelIdleCallback(id);
      else clearTimeout(id);
    };
  }, []);

  // Switch tabs instantly (loader removed per request)
  const switchTab = (tabId: string) => {
    if (tabId === activeTab) return;
    setActiveTab(tabId);
  };

  // Honor `?tab=action|brain|progress|you|home` from SMS / email deep-links
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const requested = searchParams.get("tab");
    if (requested && tabDefs.some((t) => t.id === requested) && requested !== activeTab) {
      switchTab(requested);
      // Clean the param so back-nav doesn't re-trigger
      const next = new URLSearchParams(searchParams);
      next.delete("tab");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Listen for tab switch events from notification clicks
  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail;
      if (tab && tabDefs.some((t) => t.id === tab)) {
        switchTab(tab);
      }
    };
    window.addEventListener("switch-dashboard-tab", handler);
    return () => window.removeEventListener("switch-dashboard-tab", handler);
  }, [activeTab]);

  useEffect(() => {
    if (!user) return;
    const fetchCount = async () => {
      try {
        const { count } = await supabase
          .from("ai_recommendations")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("completed", false);
        setRecCount(count ?? 0);
      } catch (e) { console.error("fetchCount error:", e); }
    };
    const fetchGifts = async () => {
      try {
        const { count } = await (supabase as any)
          .from("freeze_gifts")
          .select("*", { count: "exact", head: true })
          .eq("recipient_id", user.id)
          .eq("status", "pending");
        setPendingGifts(count ?? 0);
      } catch (e) { console.error("fetchGifts error:", e); }
    };
    const fetchUnreadNotifs = async () => {
      try {
        const { count } = await (supabase as any)
          .from("notification_history")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("read", false);
        setUnreadNotifs(count ?? 0);
      } catch (e) { console.error("fetchUnreadNotifs error:", e); }
    };
    fetchCount();
    fetchGifts();
    fetchUnreadNotifs();
  }, [user?.id, activeTab]);

  // Fetch current plan (resolve UUID to plan_key)
  useEffect(() => {
    if (!user) return;
    const fetchPlan = async () => {
      try {
        const { data } = await supabase.from("user_subscriptions").select("plan_id").eq("user_id", user.id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (!data?.plan_id) { setCurrentPlan("none"); return; }
        let planKey = data.plan_id;
        if (planKey.includes("-") && planKey.length > 10) {
          const { data: planData } = await supabase.from("subscription_plans").select("plan_key").eq("id", planKey).maybeSingle();
          planKey = planData?.plan_key || "none";
        }
        setCurrentPlan(planKey);
      } catch (e) { console.error("fetchPlan error:", e); setCurrentPlan("free"); }
    };
    fetchPlan();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const checkExpiry = async () => {
      try {
        const { data } = await supabase
          .from("user_subscriptions")
          .select("plan_id, expires_at")
          .eq("user_id", user.id)
          .eq("status", "active")
          .neq("plan_id", "free")
          .order("created_at", { ascending: false })
          .maybeSingle();
        if (data?.expires_at) {
          const daysLeft = Math.ceil((new Date(data.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysLeft <= 3 && daysLeft >= 0) {
            setExpiryWarning({ plan: data.plan_id, daysLeft });
          }
        }
      } catch (e) { console.error("checkExpiry error:", e); }
    };
    checkExpiry();
  }, [user?.id]);

  // Fix: move tab-fallback logic into an effect instead of calling setState during render
  useEffect(() => {
    if (flagsLoading) return;
    if (!isTabEnabled(`tab_${activeTab}`)) {
      const firstEnabled = tabDefs.find(t => isTabEnabled(`tab_${t.id}`));
      if (firstEnabled) {
        setActiveTab(firstEnabled.id);
      }
    }
  }, [activeTab, flagsLoading, isTabEnabled]);

  const renderTab = () => {
    if (flagsLoading) {
      return <div className="py-20" />;
    }
    if (!isTabEnabled(`tab_${activeTab}`)) {
      return <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">This section is currently disabled.</div>;
    }
    if (tabLoading && tabLoading === activeTab) {
      return (
        <div className="px-5 py-6 max-w-lg mx-auto overflow-x-hidden">
          <NeuralBootLoader
            message={TAB_LOADER_MESSAGES[tabLoading] || "Loading"}
            onComplete={() => setTabLoading(null)}
          />
        </div>
      );
    }
    switch (activeTab) {
      case "home": return <HomeTab onNavigateToEmergency={() => switchTab("action")} onRecommendationsSeen={() => setRecCount(0)} onOpenVoiceSettings={() => { setAutoOpenVoice(true); switchTab("you"); }} onNavigateToBrain={() => switchTab("brain")} onNavigateToYou={() => switchTab("you")} />;
      case "action": 
        return <ActionTab onNavigateToBrain={() => switchTab("brain")} />;
      case "brain": return <BrainTab />;
      case "myrank": return <MyRankInline />;
      case "community": return <CommunityPage inline />;
      case "progress": return <ProgressTab onUpgrade={() => { setAutoOpenSubscription(true); switchTab("you"); }} />;
      case "you": return <YouTab autoOpenVoiceSettings={autoOpenVoice} onVoiceSettingsOpened={() => setAutoOpenVoice(false)} autoOpenSubscription={autoOpenSubscription} onSubscriptionOpened={() => setAutoOpenSubscription(false)} autoOpenNotifHistory={autoOpenNotifHistory} onNotifHistoryOpened={() => setAutoOpenNotifHistory(false)} />;
      default: return null;
    }
  };

  return (
    <FeatureFlagContext.Provider value={{ isEnabled: isTabEnabled }}>
    <PlanGatingContext.Provider value={planGating}>
    <VoiceContext.Provider value={voice}>
      {/* Desktop ambient background */}
      <div className="app-shell-bg fixed inset-0 hidden md:block" />

      {/* Device Frame Container */}
      <div className="app-device-frame">
        <div className="app-device-inner">
          {/* Expiry Warning Banner */}
          {expiryWarning && !dismissedWarning && (
            <div className="bg-warning/15 border-b border-warning/30 px-4 py-2.5 flex items-center gap-2 text-sm z-50 relative">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
              <span className="text-warning font-medium flex-1">
                Your {expiryWarning.plan === "ultra" ? "Ultra Brain" : "Pro Brain"} plan expires
                {expiryWarning.daysLeft === 0 ? " today" : ` in ${expiryWarning.daysLeft} day${expiryWarning.daysLeft > 1 ? "s" : ""}`}!
                Renew to keep your benefits.
              </span>
              <button
                onClick={() => { setAutoOpenSubscription(true); switchTab("you"); setDismissedWarning(true); }}
                className="px-3 py-1 rounded-full bg-warning text-warning-foreground text-xs font-semibold whitespace-nowrap hover:bg-warning/90 transition-colors"
              >
                Renew Now
              </button>
              <button onClick={() => setDismissedWarning(true)} className="text-muted-foreground hover:text-foreground p-0.5">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Header */}
          <header className="glass-strong border-b border-border px-5 py-3 flex items-center justify-between sticky top-0 z-40">
            <ACRYLogo variant="navbar" animate={false} />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Suspense fallback={null}>
                <GlobalNotificationCenter
                  unreadCount={unreadNotifs}
                  setUnreadCount={setUnreadNotifs}
                />
              </Suspense>
              {isAdmin && (
                <button onClick={() => navigate("/admin")} className="p-2 rounded-lg hover:bg-secondary transition-colors" title="Admin Panel">
                  <Shield className="w-4 h-4 text-primary" />
                </button>
              )}
              <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                currentPlan === "none" ? "bg-destructive/15 text-destructive" : "neural-gradient neural-border text-primary"
              }`}>
                {currentPlan === "ultra" ? "Ultra" : currentPlan === "pro" ? "Pro" : currentPlan === "premium" ? "Premium" : currentPlan === "none" ? "No Plan" : "Free"}
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20">
            <Suspense fallback={<div className="py-20" />}>
              <SectionErrorBoundary name="active-tab">
                {renderTab()}
              </SectionErrorBoundary>
            </Suspense>
          </main>

          {/* Voice Notification Overlay */}
          <VoiceNotificationOverlay playing={voice.playing} subtitle={voice.subtitle} />

          {/* Focus Shield Overlay */}
          {focusShield.showWarning && (
            <FocusShieldOverlay
              type="warning"
              microRecallRequired={focusShield.microRecallRequired}
              onDismiss={(recallPassed) => focusShield.dismissWarning(recallPassed)}
            />
          )}
          {focusShield.showFreeze && (
            <FocusShieldOverlay
              type="freeze"
              microRecallRequired={false}
              freezeDurationSeconds={focusShield.config.freeze_duration_seconds}
              onDismiss={() => focusShield.dismissFreeze()}
            />
          )}


          {/* BrainLens Floating Button - Hidden */}
          {/* <BrainLensButton /> */}

          {/* Bottom Nav — contained inside device frame */}
          <nav className="absolute bottom-0 left-0 right-0 glass-strong border-t border-border z-40">
            <div className="flex items-center justify-around py-1.5 safe-area-bottom">
              {tabDefs.filter(tab => isTabEnabled(`tab_${tab.id}`)).map((tab) => {
                const active = activeTab === tab.id;
                const isSureShot = tab.id === "progress";
                const isMyRank = tab.id === "myrank";
                const handleClick = () => {
                  if ((tab as any).route) { navigate((tab as any).route); return; }
                  switchTab(tab.id);
                };
                return (
                  <button
                    key={tab.id}
                    onClick={handleClick}
                    className={`flex flex-col items-center gap-0.5 px-1.5 sm:px-3 py-1.5 rounded-xl transition-all duration-300 relative min-w-0 ${
                      isSureShot
                        ? "text-transparent"
                        : isMyRank
                        ? "text-transparent"
                        : active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="relative">
                      {isSureShot ? (
                        <div className="relative">
                          <div className="absolute inset-0 rounded-full animate-[glow-ring_2s_ease-in-out_infinite]" />
                          <tab.icon className={`w-5 h-5 sureshot-icon-glow animate-[flame-flicker_1.5s_ease-in-out_infinite]`} style={{ color: 'hsl(15, 100%, 55%)' }} />
                          <span className="absolute -top-2.5 -right-3.5 flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[6px] font-black leading-none animate-[hot-badge-pulse_1.5s_ease-in-out_infinite] sureshot-glow"
                            style={{ background: 'linear-gradient(135deg, hsl(0,85%,50%), hsl(330,100%,55%))', color: 'white' }}>
                            🔥
                          </span>
                        </div>
                      ) : isMyRank ? (
                        <div className="relative">
                          <tab.icon
                            className="w-5 h-5 animate-[flame-flicker_1.8s_ease-in-out_infinite]"
                            style={{ color: 'hsl(45, 100%, 55%)', filter: 'drop-shadow(0 0 6px hsl(45,100%,55%))' }}
                          />
                          <span
                            className="absolute -top-2 -right-3 px-1 py-0.5 rounded-full text-[6px] font-black leading-none animate-[pulse_2s_ease-in-out_infinite]"
                            style={{ background: 'linear-gradient(135deg, hsl(280,90%,55%), hsl(195,100%,50%))', color: 'white' }}
                          >
                            NEW
                          </span>
                        </div>
                      ) : (
                        <>
                          <tab.icon className={`w-5 h-5 ${active ? "drop-shadow-[0_0_6px_hsl(175,80%,50%)]" : ""} ${tab.id === "community" ? "animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]" : ""}`} />
                          {tab.id === "progress" && pendingGifts > 0 && (
                            <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-primary text-primary-foreground text-[8px] font-bold flex items-center justify-center px-0.5 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]">
                              {pendingGifts > 9 ? "9+" : pendingGifts}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <span
                      className={`text-[9px] ${
                        isSureShot
                          ? "font-bold sureshot-gradient-text"
                          : isMyRank
                          ? "font-bold bg-gradient-to-r from-amber-300 via-fuchsia-400 to-cyan-300 bg-clip-text"
                          : active
                          ? "font-bold"
                          : "font-medium"
                      }`}
                    >
                      {tab.label}
                    </span>
                    {active && !isSureShot && !isMyRank && (
                      <div className="w-1 h-1 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </VoiceContext.Provider>
    </PlanGatingContext.Provider>
    </FeatureFlagContext.Provider>
  );
};

export default AppDashboard;
