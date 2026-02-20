import { useState, useEffect, createContext, useContext, lazy, Suspense } from "react";
import { Home, Zap, Brain, User, AlertTriangle, X, Shield, Users, Crosshair } from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { useNavigate } from "react-router-dom";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useFeatureFlags, FeatureFlagContext } from "@/hooks/useFeatureFlags";
import { usePlanGating, PlanGatingContext } from "@/hooks/usePlanGating";
import HomeTab from "@/components/app/HomeTab";
import ActionTab from "@/components/app/ActionTab";
import BrainTab from "@/components/app/BrainTab";
import ProgressTab from "@/components/app/ProgressTab";
import YouTab from "@/components/app/YouTab";
import VoiceNotificationOverlay from "@/components/app/VoiceNotificationOverlay";

import GlobalNotificationCenter from "@/components/app/GlobalNotificationCenter";
import CommunityPage from "@/pages/CommunityPage";
import { useStudyReminder } from "@/hooks/useStudyReminder";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useVoiceNotification } from "@/hooks/useVoiceNotification";
import { useScheduledVoiceReminder } from "@/hooks/useScheduledVoiceReminder";
import { useWeakQuestionReminder } from "@/hooks/useWeakQuestionReminder";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";


// Export voice context so child components can trigger voice
export const VoiceContext = createContext<ReturnType<typeof useVoiceNotification> | null>(null);
export const useVoice = () => useContext(VoiceContext);

const tabs = [
  { id: "home", label: "Home", icon: Home },
  { id: "action", label: "Action", icon: Zap },
  { id: "brain", label: "Brain", icon: Brain },
  { id: "community", label: "Community", icon: Users },
  { id: "progress", label: "SureShot", icon: Crosshair },
  { id: "you", label: "You", icon: User },
];

const AppDashboard = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [autoOpenVoice, setAutoOpenVoice] = useState(false);
  const [autoOpenSubscription, setAutoOpenSubscription] = useState(false);
  const [autoOpenNotifHistory, setAutoOpenNotifHistory] = useState(false);
  
  const { user } = useAuth();
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

  // Listen for tab switch events from notification clicks
  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail;
      if (tab && tabs.some((t) => t.id === tab)) {
        setActiveTab(tab);
      }
    };
    window.addEventListener("switch-dashboard-tab", handler);
    return () => window.removeEventListener("switch-dashboard-tab", handler);
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchCount = async () => {
      const { count } = await supabase
        .from("ai_recommendations")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("completed", false);
      setRecCount(count ?? 0);
    };
    const fetchGifts = async () => {
      const { count } = await (supabase as any)
        .from("freeze_gifts")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .eq("status", "pending");
      setPendingGifts(count ?? 0);
    };
    const fetchUnreadNotifs = async () => {
      const { count } = await (supabase as any)
        .from("notification_history")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      setUnreadNotifs(count ?? 0);
    };
    fetchCount();
    fetchGifts();
    fetchUnreadNotifs();
  }, [user, activeTab]);

  // Fetch current plan (resolve UUID to plan_key)
  useEffect(() => {
    if (!user) return;
    supabase.from("user_subscriptions").select("plan_id").eq("user_id", user.id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle().then(async ({ data }) => {
      if (!data?.plan_id) { setCurrentPlan("none"); return; }
      let planKey = data.plan_id;
      if (planKey.includes("-") && planKey.length > 10) {
        const { data: planData } = await supabase.from("subscription_plans").select("plan_key").eq("id", planKey).maybeSingle();
        planKey = planData?.plan_key || "none";
      }
      setCurrentPlan(planKey);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const checkExpiry = async () => {
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
    };
    checkExpiry();
  }, [user]);

  const renderTab = () => {
    if (!isTabEnabled(`tab_${activeTab}`)) {
      // Fallback to first enabled tab
      const firstEnabled = tabs.find(t => isTabEnabled(`tab_${t.id}`));
      if (firstEnabled && firstEnabled.id !== activeTab) {
        setActiveTab(firstEnabled.id);
        return null;
      }
      return <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">This section is currently disabled.</div>;
    }
    switch (activeTab) {
      case "home": return <HomeTab onNavigateToEmergency={() => setActiveTab("action")} onRecommendationsSeen={() => setRecCount(0)} onOpenVoiceSettings={() => { setAutoOpenVoice(true); setActiveTab("you"); }} onNavigateToBrain={() => setActiveTab("brain")} onNavigateToYou={() => setActiveTab("you")} />;
      case "action": 
        return <ActionTab onNavigateToBrain={() => setActiveTab("brain")} />;
      case "brain": return <BrainTab />;
      case "community": return <CommunityPage inline />;
      case "progress": return <ProgressTab />;
      case "you": return <YouTab autoOpenVoiceSettings={autoOpenVoice} onVoiceSettingsOpened={() => setAutoOpenVoice(false)} autoOpenSubscription={autoOpenSubscription} onSubscriptionOpened={() => setAutoOpenSubscription(false)} autoOpenNotifHistory={autoOpenNotifHistory} onNotifHistoryOpened={() => setAutoOpenNotifHistory(false)} />;
      default: return null;
    }
  };

  return (
    <FeatureFlagContext.Provider value={{ isEnabled: isTabEnabled }}>
    <PlanGatingContext.Provider value={planGating}>
    <VoiceContext.Provider value={voice}>
      <div className="min-h-screen bg-background flex flex-col">
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
              onClick={() => { setAutoOpenSubscription(true); setActiveTab("you"); setDismissedWarning(true); }}
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
        <header className="glass-strong border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg neural-gradient neural-border flex items-center justify-center">
              <span className="text-primary font-bold text-sm">A</span>
            </div>
            <span className="font-display font-bold text-lg text-foreground">ACRY</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <GlobalNotificationCenter
              unreadCount={unreadNotifs}
              setUnreadCount={setUnreadNotifs}
            />
            {isAdmin && (
              <button onClick={() => navigate("/admin")} className="p-2 rounded-lg hover:bg-secondary transition-colors" title="Admin Panel">
                <Shield className="w-4 h-4 text-primary" />
              </button>
            )}
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              currentPlan === "none" ? "bg-destructive/15 text-destructive" : "neural-gradient neural-border text-primary"
            }`}>
              {currentPlan === "ultra" ? "Ultra Brain" : currentPlan === "pro" ? "Pro Brain" : "No Plan"}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto pb-24">
          {renderTab()}
        </main>

        {/* Voice Notification Overlay */}
        <VoiceNotificationOverlay playing={voice.playing} subtitle={voice.subtitle} />

        {/* Bottom Nav */}
        <nav className="fixed bottom-0 left-0 right-0 glass-strong border-t border-border z-40">
          <div className="flex items-center justify-around py-2 max-w-lg mx-auto">
            {tabs.filter(tab => isTabEnabled(`tab_${tab.id}`)).map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); }}
                  className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-300 ${
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="relative">
                    <tab.icon className={`w-5 h-5 ${active ? "drop-shadow-[0_0_6px_hsl(175,80%,50%)]" : ""} ${tab.id === "community" ? "animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]" : ""}`} />
                    {tab.id === "progress" && pendingGifts > 0 && (
                      <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-primary text-primary-foreground text-[8px] font-bold flex items-center justify-center px-0.5 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]">
                        {pendingGifts > 9 ? "9+" : pendingGifts}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium">{tab.label}</span>
                  {active && (
                    <div className="w-1 h-1 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </VoiceContext.Provider>
    </PlanGatingContext.Provider>
    </FeatureFlagContext.Provider>
  );
};

export default AppDashboard;
