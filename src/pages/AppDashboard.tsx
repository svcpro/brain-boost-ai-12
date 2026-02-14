import { useState, useEffect, createContext, useContext } from "react";
import { Home, Zap, Brain, TrendingUp, User, AlertTriangle, X } from "lucide-react";
import HomeTab from "@/components/app/HomeTab";
import ActionTab from "@/components/app/ActionTab";
import BrainTab from "@/components/app/BrainTab";
import ProgressTab from "@/components/app/ProgressTab";
import YouTab from "@/components/app/YouTab";
import VoiceNotificationOverlay from "@/components/app/VoiceNotificationOverlay";
import { useStudyReminder } from "@/hooks/useStudyReminder";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useVoiceNotification } from "@/hooks/useVoiceNotification";
import { useScheduledVoiceReminder } from "@/hooks/useScheduledVoiceReminder";
import { useWeakQuestionReminder } from "@/hooks/useWeakQuestionReminder";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { notifyFeedback } from "@/lib/feedback";
import { useToast } from "@/hooks/use-toast";

// Export voice context so child components can trigger voice
export const VoiceContext = createContext<ReturnType<typeof useVoiceNotification> | null>(null);
export const useVoice = () => useContext(VoiceContext);

const tabs = [
  { id: "home", label: "Home", icon: Home },
  { id: "action", label: "Action", icon: Zap },
  { id: "brain", label: "Brain", icon: Brain },
  { id: "progress", label: "Progress", icon: TrendingUp },
  { id: "you", label: "You", icon: User },
];

const AppDashboard = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [autoOpenVoice, setAutoOpenVoice] = useState(false);
  const [autoOpenSubscription, setAutoOpenSubscription] = useState(false);
  const { user } = useAuth();
  const [recCount, setRecCount] = useState(0);
  const [pendingGifts, setPendingGifts] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [expiryWarning, setExpiryWarning] = useState<{ plan: string; daysLeft: number } | null>(null);
  const [dismissedWarning, setDismissedWarning] = useState(false);
  const voice = useVoiceNotification();
  const { toast } = useToast();
  useStudyReminder();
  useOfflineSync();
  useScheduledVoiceReminder();
  useWeakQuestionReminder();

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

  // Realtime updates for unread notification badge
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notif-badge-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notification_history',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setUnreadNotifs((c) => c + 1);
          notifyFeedback();
          const n = payload.new as any;
          toast({
            title: n.title || "🔔 New notification",
            description: n.body || undefined,
            duration: 5000,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notification_history',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if ((payload.new as any).read && !(payload.old as any).read) {
            setUnreadNotifs((c) => Math.max(0, c - 1));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notification_history',
        },
        () => setUnreadNotifs((c) => Math.max(0, c - 1))
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
    switch (activeTab) {
      case "home": return <HomeTab onNavigateToEmergency={() => setActiveTab("action")} onRecommendationsSeen={() => setRecCount(0)} onOpenVoiceSettings={() => { setAutoOpenVoice(true); setActiveTab("you"); }} />;
      case "action": return <ActionTab onNavigateToBrain={() => setActiveTab("brain")} />;
      case "brain": return <BrainTab />;
      case "progress": return <ProgressTab />;
      case "you": return <YouTab autoOpenVoiceSettings={autoOpenVoice} onVoiceSettingsOpened={() => setAutoOpenVoice(false)} autoOpenSubscription={autoOpenSubscription} onSubscriptionOpened={() => setAutoOpenSubscription(false)} />;
      default: return <HomeTab onNavigateToEmergency={() => setActiveTab("action")} />;
    }
  };

  return (
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
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-full neural-gradient neural-border text-xs text-primary font-medium">
              Free Brain
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
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-300 ${
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="relative">
                    <tab.icon className={`w-5 h-5 ${active ? "drop-shadow-[0_0_6px_hsl(175,80%,50%)]" : ""}`} />
                    {tab.id === "home" && recCount > 0 && (
                      <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold flex items-center justify-center px-0.5 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]">
                        {recCount > 9 ? "9+" : recCount}
                      </span>
                    )}
                    {tab.id === "progress" && pendingGifts > 0 && (
                      <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-primary text-primary-foreground text-[8px] font-bold flex items-center justify-center px-0.5 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]">
                        {pendingGifts > 9 ? "9+" : pendingGifts}
                      </span>
                    )}
                    {tab.id === "you" && unreadNotifs > 0 && (
                      <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-warning text-warning-foreground text-[8px] font-bold flex items-center justify-center px-0.5 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]">
                        {unreadNotifs > 9 ? "9+" : unreadNotifs}
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
  );
};

export default AppDashboard;
