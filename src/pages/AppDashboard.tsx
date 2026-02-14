import { useState, useEffect } from "react";
import { Home, Zap, Brain, TrendingUp, User } from "lucide-react";
import HomeTab from "@/components/app/HomeTab";
import ActionTab from "@/components/app/ActionTab";
import BrainTab from "@/components/app/BrainTab";
import ProgressTab from "@/components/app/ProgressTab";
import YouTab from "@/components/app/YouTab";
import { useStudyReminder } from "@/hooks/useStudyReminder";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const tabs = [
  { id: "home", label: "Home", icon: Home },
  { id: "action", label: "Action", icon: Zap },
  { id: "brain", label: "Brain", icon: Brain },
  { id: "progress", label: "Progress", icon: TrendingUp },
  { id: "you", label: "You", icon: User },
];

const AppDashboard = () => {
  const [activeTab, setActiveTab] = useState("home");
  const { user } = useAuth();
  const [recCount, setRecCount] = useState(0);
  useStudyReminder();
  useOfflineSync();

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
    fetchCount();
  }, [user, activeTab]);

  const renderTab = () => {
    switch (activeTab) {
      case "home": return <HomeTab onNavigateToEmergency={() => setActiveTab("action")} />;
      case "action": return <ActionTab onNavigateToBrain={() => setActiveTab("brain")} />;
      case "brain": return <BrainTab />;
      case "progress": return <ProgressTab />;
      case "you": return <YouTab />;
      default: return <HomeTab onNavigateToEmergency={() => setActiveTab("action")} />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
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
                    <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold flex items-center justify-center px-0.5">
                      {recCount > 9 ? "9+" : recCount}
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
  );
};

export default AppDashboard;
