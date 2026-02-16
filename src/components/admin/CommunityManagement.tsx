import { useState } from "react";
import {
  Users, MessageSquare, BarChart3, MessageCircle, Shield, AlertTriangle, Settings
} from "lucide-react";
import CommunityOverviewDashboard from "./community/CommunityOverviewDashboard";
import CommunityListManager from "./community/CommunityListManager";
import PostManager from "./community/PostManager";
import CommentManager from "./community/CommentManager";
import AbuseDetectionPanel from "./community/AbuseDetectionPanel";
import UserModerationPanel from "./community/UserModerationPanel";
import ModerationRulesPanel from "./community/ModerationRulesPanel";

const tabs = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "communities", label: "Communities", icon: Users },
  { id: "posts", label: "Posts", icon: MessageSquare },
  { id: "comments", label: "Comments", icon: MessageCircle },
  { id: "abuse", label: "AI Abuse Detection", icon: AlertTriangle },
  { id: "moderation", label: "User Moderation", icon: Shield },
  { id: "rules", label: "Moderation Rules", icon: Settings },
] as const;

type TabId = typeof tabs[number]["id"];

const CommunityManagement = () => {
  const [tab, setTab] = useState<TabId>("overview");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center">
          <Users className="w-4 h-4 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Community Command Center</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              tab === t.id ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "overview" && <CommunityOverviewDashboard />}
      {tab === "communities" && <CommunityListManager />}
      {tab === "posts" && <PostManager />}
      {tab === "comments" && <CommentManager />}
      {tab === "abuse" && <AbuseDetectionPanel />}
      {tab === "moderation" && <UserModerationPanel />}
      {tab === "rules" && <ModerationRulesPanel />}
    </div>
  );
};

export default CommunityManagement;
