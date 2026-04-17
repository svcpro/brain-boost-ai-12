import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, Brain, BookOpen, CreditCard,
  Bell, Shield, ScrollText, Settings, LogOut, ChevronRight,
  Loader2, AlertTriangle, Search, MoreVertical, Eye,
  Ban, Trash2, RefreshCw, Send, Clock, TrendingUp,
  Activity, Zap, Database, BarChart3, UserPlus, ChevronDown,
  CheckCircle2, XCircle, ArrowLeft, Home, User, Download, Upload, CalendarIcon, Check, Smartphone, HardDrive,
  Plus, Pencil, IndianRupee, ToggleLeft, ToggleRight, Star, GripVertical, Key, Sparkles, MessageSquare, Globe,
  Search as SearchIcon, Mail, Volume2, Menu, X, Workflow, Server, Wallet, Radio, Target, Rocket,
  Cpu, Building2, GraduationCap, Megaphone, Lock, Fingerprint, FileText, PanelLeftClose, PanelLeft, Swords
} from "lucide-react";
import AITopicManager from "@/components/app/AITopicManager";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole, type AppRole } from "@/hooks/useAdminRole";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import SubscriptionAnalytics from "@/components/app/SubscriptionAnalytics";
import ApiManagement from "@/components/app/ApiManagement";
import UserManagement from "@/components/app/UserManagement";
import AdminNotificationCenter from "@/components/app/AdminNotificationCenter";

import LeaderboardManagement from "@/components/app/LeaderboardManagement";
import PlanGatingManagement from "@/components/app/PlanGatingManagement";
import PermissionManagement from "@/components/admin/PermissionManagement";
import AICommandCenter from "@/components/admin/AICommandCenter";
import SystemMonitor from "@/components/admin/SystemMonitor";
import AdminProfile from "@/components/admin/AdminProfile";
import ChatManagement from "@/components/admin/ChatManagement";
import ThirdPartyServices from "@/components/admin/ThirdPartyServices";
import FinanceManagement from "@/components/admin/FinanceManagement";
import CommunityManagement from "@/components/admin/CommunityManagement";
import SEOManagement from "@/components/admin/SEOManagement";

import EmailManagement from "@/components/admin/EmailManagement";
import PushNotificationManagement from "@/components/admin/PushNotificationManagement";
import VoiceNotificationManagement from "@/components/admin/VoiceNotificationManagement";
import NotificationIntelligence from "@/components/admin/NotificationIntelligence";
import GrowthControlCenter from "@/components/admin/GrowthControlCenter";
import ExamCountdownConfig from "@/components/admin/ExamCountdownConfig";
import SureShotAdminPanel from "@/components/admin/SureShotAdminPanel";
import ComingSoonControlPanel from "@/components/admin/ComingSoonControlPanel";
import AutopilotAdminPanel from "@/components/admin/AutopilotAdminPanel";
import InstitutionManagement from "@/components/admin/InstitutionManagement";
import TeacherModeAdmin from "@/components/admin/TeacherModeAdmin";
import STQEngineAdmin from "@/components/admin/ai-command/STQEngineAdmin";
import ExamIntelligenceAdmin from "@/components/admin/ai-command/ExamIntelligenceAdmin";
import ExamIntelV10Admin from "@/components/admin/ai-command/ExamIntelV10Admin";
import CurrentAffairsAdmin from "@/components/admin/ai-command/CurrentAffairsAdmin";
import PolicyPredictorAdmin from "@/components/admin/ai-command/PolicyPredictorAdmin";
import DebateEngineAdmin from "@/components/admin/ai-command/DebateEngineAdmin";
import CompetitiveIntelAdmin from "@/components/admin/ai-command/CompetitiveIntelAdmin";
import AdminBackup from "@/components/admin/AdminBackup";
import SmsCommandCenter from "@/components/admin/SmsCommandCenter";
import WhatsAppCommandCenter from "@/components/admin/WhatsAppCommandCenter";
type AdminSection = "dashboard" | "users" | "ai" | "chat" | "knowledge" | "community" | "seo" | "leaderboard" | "subscriptions" | "plan_gating" | "exam_countdown" | "sureshot" | "stq" | "exam_intel" | "current_affairs" | "policy_predictor" | "debate_engine" | "competitive_intel" | "apis" | "services" | "finance" | "notifications" | "email" | "push" | "voice" | "sms" | "whatsapp" | "monitoring" | "admins" | "audit" | "settings" | "profile" | "notify_intelligence" | "growth_center" | "coming_soon" | "autopilot" | "institutions" | "teacher_mode" | "backup";

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  ai_admin: "AI Admin",
  support_admin: "Support",
  finance_admin: "Finance",
  api_admin: "API Admin",
};

const ROLE_COLORS: Record<AppRole, string> = {
  super_admin: "bg-destructive/15 text-destructive",
  admin: "bg-primary/15 text-primary",
  ai_admin: "bg-accent/15 text-accent",
  support_admin: "bg-warning/15 text-warning",
  finance_admin: "bg-success/15 text-success",
  api_admin: "bg-blue-500/15 text-blue-400",
};

interface NavGroup {
  label: string;
  icon: any;
  color: string;
  gradient: string;
  dotColor: string;
  items: { key: AdminSection; label: string; icon: any; roles: AppRole[]; badge?: string; badgeColor?: string }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    icon: LayoutDashboard,
    color: "text-primary",
    gradient: "from-primary/20 to-primary/5",
    dotColor: "bg-primary",
    items: [
      { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["super_admin", "admin", "ai_admin", "support_admin", "finance_admin"] },
    ],
  },
  {
    label: "AI & Intelligence",
    icon: Brain,
    color: "text-accent",
    gradient: "from-accent/20 to-accent/5",
    dotColor: "bg-accent",
    items: [
      { key: "ai", label: "AI Command Center", icon: Cpu, roles: ["super_admin", "admin", "ai_admin"] },
      { key: "autopilot", label: "Autopilot Engine", icon: Workflow, roles: ["super_admin", "admin", "ai_admin"], badge: "v5", badgeColor: "bg-accent/20 text-accent" },
      { key: "notify_intelligence", label: "AI Intelligence", icon: Brain, roles: ["super_admin", "admin"], badge: "NEW", badgeColor: "bg-accent/20 text-accent" },
      { key: "growth_center", label: "Growth Engine", icon: TrendingUp, roles: ["super_admin", "admin"], badge: "NEW", badgeColor: "bg-accent/20 text-accent" },
      { key: "sureshot", label: "SureShot AI Lab", icon: Target, roles: ["super_admin", "admin", "ai_admin"], badge: "ML", badgeColor: "bg-accent/20 text-accent" },
      { key: "exam_countdown", label: "Exam AI Control", icon: Brain, roles: ["super_admin", "admin"], badge: "AI", badgeColor: "bg-accent/20 text-accent" },
      { key: "stq", label: "STQ Engine v9.0", icon: Database, roles: ["super_admin", "admin", "ai_admin"], badge: "v9", badgeColor: "bg-accent/20 text-accent" },
      { key: "exam_intel", label: "Exam Intel v10.0", icon: Sparkles, roles: ["super_admin", "admin", "ai_admin"], badge: "v10", badgeColor: "bg-violet-500/20 text-violet-400" },
      { key: "current_affairs", label: "CA v3.0", icon: Globe, roles: ["super_admin", "admin", "ai_admin"], badge: "v3", badgeColor: "bg-cyan-500/20 text-cyan-400" },
      { key: "debate_engine", label: "CA 4.0 Debate Engine", icon: Swords, roles: ["super_admin", "admin", "ai_admin"], badge: "v4", badgeColor: "bg-orange-500/20 text-orange-400" },
      { key: "competitive_intel", label: "Competition v3.0", icon: Swords, roles: ["super_admin", "admin", "ai_admin"], badge: "v3", badgeColor: "bg-orange-500/20 text-orange-400" },
    ],
  },
  {
    label: "Users & Community",
    icon: Users,
    color: "text-blue-400",
    gradient: "from-blue-500/20 to-blue-500/5",
    dotColor: "bg-blue-400",
    items: [
      { key: "users", label: "User Management", icon: Users, roles: ["super_admin", "admin", "support_admin", "api_admin"] },
      { key: "community", label: "Community Hub", icon: Radio, roles: ["super_admin", "admin", "support_admin"] },
      { key: "knowledge", label: "Knowledge DB", icon: BookOpen, roles: ["super_admin", "admin"] },
      { key: "leaderboard", label: "Leaderboard", icon: Star, roles: ["super_admin", "admin"] },
    ],
  },
  {
    label: "Messaging & Growth",
    icon: Megaphone,
    color: "text-emerald-400",
    gradient: "from-emerald-500/20 to-emerald-500/5",
    dotColor: "bg-emerald-400",
    items: [
      { key: "chat", label: "Chat System", icon: MessageSquare, roles: ["super_admin", "admin", "ai_admin"] },
      { key: "email", label: "Email System", icon: Mail, roles: ["super_admin", "admin"] },
      { key: "push", label: "Push Notifications", icon: Smartphone, roles: ["super_admin", "admin"] },
      { key: "voice", label: "Voice Notifications", icon: Volume2, roles: ["super_admin", "admin"] },
      { key: "sms", label: "SMS Alerts Center", icon: Smartphone, roles: ["super_admin", "admin", "api_admin"], badge: "ULTRA", badgeColor: "bg-gradient-to-r from-blue-500/30 to-purple-500/30 text-blue-300" },
      { key: "whatsapp", label: "WhatsApp Center", icon: MessageSquare, roles: ["super_admin", "admin", "api_admin"], badge: "NEW", badgeColor: "bg-green-500/20 text-green-400" },
    ],
  },
  {
    label: "Revenue & Plans",
    icon: Wallet,
    color: "text-amber-400",
    gradient: "from-amber-500/20 to-amber-500/5",
    dotColor: "bg-amber-400",
    items: [
      { key: "subscriptions", label: "Subscriptions", icon: CreditCard, roles: ["super_admin", "admin", "finance_admin"] },
      { key: "plan_gating", label: "Plan Gating", icon: Shield, roles: ["super_admin", "admin"] },
      { key: "finance", label: "Finance & Costs", icon: IndianRupee, roles: ["super_admin", "admin", "finance_admin"] },
    ],
  },
  {
    label: "Platform & APIs",
    icon: Server,
    color: "text-sky-400",
    gradient: "from-sky-500/20 to-sky-500/5",
    dotColor: "bg-sky-400",
    items: [
      { key: "apis", label: "API & Keys", icon: Key, roles: ["super_admin", "admin", "api_admin"] },
      { key: "services", label: "3rd Party Services", icon: Globe, roles: ["super_admin", "admin", "api_admin"] },
      { key: "seo", label: "SEO Manager", icon: SearchIcon, roles: ["super_admin", "admin"] },
      { key: "monitoring", label: "System Monitor", icon: Activity, roles: ["super_admin", "admin"] },
      { key: "coming_soon", label: "Coming Soon", icon: Rocket, roles: ["super_admin", "admin"], badge: "🚀" },
    ],
  },
  {
    label: "Enterprise",
    icon: Building2,
    color: "text-rose-400",
    gradient: "from-rose-500/20 to-rose-500/5",
    dotColor: "bg-rose-400",
    items: [
      { key: "institutions", label: "Institutions", icon: Building2, roles: ["super_admin", "admin"], badge: "v6", badgeColor: "bg-rose-500/20 text-rose-400" },
      { key: "teacher_mode", label: "AI Teacher Mode", icon: GraduationCap, roles: ["super_admin", "admin", "ai_admin"], badge: "v6", badgeColor: "bg-rose-500/20 text-rose-400" },
    ],
  },
  {
    label: "Admin & Security",
    icon: Lock,
    color: "text-red-400",
    gradient: "from-red-500/20 to-red-500/5",
    dotColor: "bg-red-400",
    items: [
      { key: "admins", label: "Admin Roles", icon: Fingerprint, roles: ["super_admin"] },
      { key: "audit", label: "Audit Logs", icon: FileText, roles: ["super_admin", "admin"] },
      { key: "backup", label: "Full Backup", icon: HardDrive, roles: ["super_admin"], badge: "NEW", badgeColor: "bg-emerald-500/20 text-emerald-400" },
      { key: "profile", label: "My Profile", icon: User, roles: ["super_admin", "admin", "ai_admin", "support_admin", "finance_admin"] },
    ],
  },
];

const AdminPanel = () => {
  const { user, signOut } = useAuth();
  const { roles, isAdmin, isSuperAdmin, loading: roleLoading, hasAnyRole, refetch: refetchRoles } = useAdminRole();
  const { toast } = useToast();
  const navigate = useNavigate();
  const defaultSection: AdminSection = roles.length === 1 && roles[0] === "api_admin" ? "apis" : "dashboard";
  const [section, setSection] = useState<AdminSection>(defaultSection);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [navSearch, setNavSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(NAV_GROUPS.map(g => g.label)));

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  // Find which group the current section belongs to
  const currentGroupLabel = NAV_GROUPS.find(g => g.items.some(i => i.key === section))?.label;

  // Filter groups based on search and roles
  const filteredGroups = NAV_GROUPS.map(g => ({
    ...g,
    items: g.items.filter(item =>
      hasAnyRole(...item.roles) &&
      (!navSearch || item.label.toLowerCase().includes(navSearch.toLowerCase()))
    ),
  })).filter(g => g.items.length > 0);

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
            <div className="absolute -inset-1 rounded-2xl bg-primary/5 animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass rounded-2xl p-8 neural-border text-center max-w-sm">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-sm text-muted-foreground mb-4">You don't have admin privileges.</p>
          <button onClick={() => navigate("/app")} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
            Back to App
          </button>
        </motion.div>
      </div>
    );
  }

  const sectionLabel = NAV_GROUPS.flatMap(g => g.items).find(i => i.key === section)?.label || "Dashboard";

  // Shared sidebar content renderer
  const renderSidebarContent = (isMobile = false) => (
    <div className="flex flex-col h-full">
      {/* Logo / Brand Header */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-accent flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-card" />
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-extrabold text-foreground tracking-tight">ACRY Admin</h1>
              <p className="text-[10px] text-muted-foreground/70 font-medium">Control Center</p>
            </div>
          )}
          {!sidebarCollapsed && <ThemeToggle />}
          {!isMobile && (
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="ml-auto p-1.5 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors hidden md:flex"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          )}
          {isMobile && (
            <button onClick={() => setSidebarOpen(false)} className="ml-auto p-1.5 rounded-lg hover:bg-secondary/80 text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      {!sidebarCollapsed && (
        <div className="px-3 pb-2">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Search menu..."
              value={navSearch}
              onChange={e => setNavSearch(e.target.value)}
              className="w-full bg-secondary/40 border border-border/30 rounded-xl pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 focus:bg-secondary/60 transition-all"
            />
          </div>
        </div>
      )}

      {/* Role Badges */}
      {!sidebarCollapsed && (
        <div className="px-4 pb-2 flex flex-wrap gap-1">
          {roles.map(r => (
            <span key={r} className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${ROLE_COLORS[r]} border-current/10`}>
              {ROLE_LABELS[r]}
            </span>
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="mx-4 mb-2">
        <div className="h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5 scrollbar-thin">
        {filteredGroups.map((group) => {
          const isExpanded = expandedGroups.has(group.label);
          const hasActiveItem = group.items.some(i => i.key === section);
          const GroupIcon = group.icon;

          return (
            <div key={group.label} className="mb-0.5">
              {/* Group Header */}
              <button
                onClick={() => !sidebarCollapsed && toggleGroup(group.label)}
                className={cn(
                  "w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-200",
                  hasActiveItem
                    ? `bg-gradient-to-r ${group.gradient} ${group.color}`
                    : "text-muted-foreground/70 hover:text-muted-foreground hover:bg-secondary/40",
                  sidebarCollapsed ? "justify-center" : ""
                )}
              >
                <div className={cn(
                  "w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0",
                  hasActiveItem ? `${group.color} bg-current/10` : "text-muted-foreground/60"
                )}>
                  <GroupIcon className="w-3.5 h-3.5" />
                </div>
                {!sidebarCollapsed && (
                  <>
                    <span className="flex-1 text-left">{group.label}</span>
                    <div className="flex items-center gap-1.5">
                      {hasActiveItem && (
                        <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", group.dotColor)} />
                      )}
                      <ChevronDown className={cn(
                        "w-3 h-3 transition-transform duration-300",
                        isExpanded ? "rotate-0" : "-rotate-90"
                      )} />
                    </div>
                  </>
                )}
              </button>

              {/* Group Items */}
              <AnimatePresence initial={false}>
                {(isExpanded || sidebarCollapsed) && (
                  <motion.div
                    initial={sidebarCollapsed ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={sidebarCollapsed ? undefined : { height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className={cn(
                      "py-0.5 space-y-px",
                      !sidebarCollapsed && "ml-5 pl-3 border-l-2 border-border/20"
                    )}>
                      {group.items.map(item => {
                        const isActive = section === item.key;
                        const ItemIcon = item.icon;
                        return (
                          <button
                            key={item.key}
                            onClick={() => {
                              setSection(item.key);
                              if (isMobile) setSidebarOpen(false);
                            }}
                            title={sidebarCollapsed ? item.label : undefined}
                            className={cn(
                              "w-full flex items-center gap-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 group/item relative",
                              sidebarCollapsed ? "justify-center px-2 py-2.5" : "px-3 py-[7px]",
                              isActive
                                ? `bg-gradient-to-r ${group.gradient} ${group.color} shadow-sm`
                                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                            )}
                          >
                            {isActive && !sidebarCollapsed && (
                              <motion.div
                                layoutId="adminSidebarIndicator"
                                className={cn("absolute -left-3.5 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full", group.dotColor)}
                                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                              />
                            )}
                            <ItemIcon className={cn(
                              "w-4 h-4 shrink-0 transition-all duration-200",
                              isActive ? group.color : "group-hover/item:text-foreground"
                            )} />
                            {!sidebarCollapsed && (
                              <span className="truncate flex-1 text-left">{item.label}</span>
                            )}
                            {!sidebarCollapsed && item.badge && (
                              <span className={cn(
                                "text-[8px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wide",
                                item.badgeColor || "bg-primary/15 text-primary"
                              )}>
                                {item.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto p-3 space-y-1">
        <div className="mx-1 mb-2">
          <div className="h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />
        </div>
        <button
          onClick={() => navigate("/app")}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-xl transition-all duration-200"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          {!sidebarCollapsed && <span>Back to App</span>}
        </button>
        <button
          onClick={async () => { sessionStorage.removeItem("admin_login_time"); await signOut(); navigate("/admin/login"); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-destructive/80 hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all duration-200"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!sidebarCollapsed && <span>Sign Out</span>}
        </button>
        {!sidebarCollapsed && (
          <div className="px-3 pt-1 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <p className="text-[9px] text-muted-foreground/50 font-medium">Session auto-expires in 2h</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden md:flex flex-col bg-card/60 backdrop-blur-2xl border-r border-border/40 transition-all duration-300 shrink-0 relative",
        sidebarCollapsed ? "w-[68px]" : "w-[272px]"
      )}>
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.02] via-transparent to-accent/[0.02] pointer-events-none" />
        {renderSidebarContent()}
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl border-b border-border/60 px-4 py-3 flex items-center gap-3">
        <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors">
          <Menu className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Zap className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-bold text-foreground truncate">{sectionLabel}</span>
        </div>
        <button
          onClick={() => { localStorage.clear(); toast({ title: "Cache Cleared ✨", description: "All local cache has been cleared successfully." }); }}
          className="p-1.5 rounded-lg hover:bg-warning/10 text-warning transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          >
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-[280px] h-full bg-card border-r border-border/60 shadow-2xl shadow-background/80"
              onClick={e => e.stopPropagation()}
            >
              {renderSidebarContent(true)}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 min-w-0 mt-14 md:mt-0 overflow-auto">
        {/* Desktop top bar */}
        <div className="hidden md:flex items-center justify-between px-6 py-4 border-b border-border/30 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-2">
            {currentGroupLabel && (
              <span className="text-xs text-muted-foreground">{currentGroupLabel}</span>
            )}
            {currentGroupLabel && <ChevronRight className="w-3 h-3 text-muted-foreground/50" />}
            <h2 className="text-sm font-semibold text-foreground">{sectionLabel}</h2>
          </div>
          <button
            onClick={() => { localStorage.clear(); toast({ title: "Cache Cleared ✨", description: "All local cache has been cleared successfully." }); }}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-warning bg-warning/10 rounded-lg hover:bg-warning/20 border border-warning/20 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Clear Cache
          </button>
        </div>

        <div className="p-4 md:p-6">
          <AnimatePresence mode="wait">
            <motion.div key={section} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              {section === "dashboard" && <DashboardSection />}
              {section === "users" && <UserManagement />}
              {section === "ai" && <AICommandCenter />}
              {section === "chat" && <ChatManagement />}
              {section === "knowledge" && <KnowledgeSection />}
              {section === "leaderboard" && <LeaderboardManagement />}
              {section === "community" && <CommunityManagement />}
              {section === "seo" && <SEOManagement />}
              {section === "subscriptions" && <SubscriptionsSection />}
              {section === "plan_gating" && <PlanGatingManagement />}
              {section === "exam_countdown" && <ExamCountdownConfig />}
              {section === "sureshot" && <SureShotAdminPanel />}
              {section === "stq" && <STQEngineAdmin />}
              {section === "exam_intel" && <ExamIntelV10Admin />}
              {section === "current_affairs" && <CurrentAffairsAdmin />}
              {section === "policy_predictor" && <PolicyPredictorAdmin />}
              {section === "debate_engine" && <DebateEngineAdmin />}
              {section === "competitive_intel" && <CompetitiveIntelAdmin />}
              {section === "apis" && <ApiManagement />}
              {section === "services" && <ThirdPartyServices />}
              {section === "finance" && <FinanceManagement />}
              
              
              {section === "push" && <PushNotificationManagement />}
              {section === "voice" && <VoiceNotificationManagement />}
              {section === "email" && <EmailManagement />}
              {section === "sms" && <SmsCommandCenter />}
              {section === "whatsapp" && <WhatsAppCommandCenter />}
              {section === "notify_intelligence" && <NotificationIntelligence />}
              {section === "growth_center" && <GrowthControlCenter />}
              {section === "coming_soon" && <ComingSoonControlPanel />}
              {section === "autopilot" && <AutopilotAdminPanel />}
              {section === "institutions" && <InstitutionManagement />}
              {section === "teacher_mode" && <TeacherModeAdmin />}
              {section === "monitoring" && <SystemMonitor />}
              {section === "admins" && <AdminsSection isSuperAdmin={isSuperAdmin} refetchRoles={refetchRoles} toast={toast} />}
              {section === "audit" && <AuditSection />}
              {section === "settings" && <SettingsSection toast={toast} />}
              {section === "backup" && <AdminBackup />}
              {section === "profile" && <AdminProfile />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

// ─── Dashboard ───
const DashboardSection = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activityData, setActivityData] = useState<{ date: string; sessions: number; minutes: number; uniqueUsers: number }[]>([]);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [chartMode, setChartMode] = useState<"minutes" | "sessions" | "users">("minutes");
  const [engagementData, setEngagementData] = useState<{ avgSessionMin: number; dau: number; wau: number; mau: number; retentionPct: number; peakHour: number; totalHours: number; avgDailyHours: number }>({ avgSessionMin: 0, dau: 0, wau: 0, mau: 0, retentionPct: 0, peakHour: 0, totalHours: 0, avgDailyHours: 0 });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().split("T")[0];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [usersCountRes, newTodayRes, activeSubsRes, revenueRes, logsRes, predsRes, activityRes, txRes, studyActivityRes, auditRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", today),
        supabase.from("user_subscriptions").select("id", { count: "exact", head: true }).eq("status", "active").neq("plan_id", "free"),
        supabase.from("user_subscriptions").select("amount").eq("status", "active"),
        supabase.from("study_logs").select("id", { count: "exact", head: true }).gte("created_at", today),
        supabase.from("model_predictions").select("id", { count: "exact", head: true }).gte("created_at", today),
        supabase.from("study_logs").select("user_id, created_at, duration_minutes").gte("created_at", thirtyDaysAgo.toISOString()).limit(5000),
        supabase.from("user_subscriptions").select("*").order("created_at", { ascending: false }).limit(8),
        supabase.from("study_logs").select("id, user_id, created_at, duration_minutes, study_mode, confidence_level").order("created_at", { ascending: false }).limit(10),
        supabase.from("admin_audit_logs").select("*").order("created_at", { ascending: false }).limit(8),
      ]);
      const totalUsers = usersCountRes.count || 0;
      const activeSubs = activeSubsRes.count || 0;
      const revenue = (revenueRes.data || []).reduce((sum, s: any) => sum + (s.amount || 0), 0);
      const newToday = newTodayRes.count || 0;
      setStats({ totalUsers, activeSubs, revenue, newToday, studySessions: logsRes.count || 0, predictions: predsRes.count || 0 });
      setRecentTransactions(txRes.data || []);
      setRecentActivity(studyActivityRes.data || []);
      setRecentLogs(auditRes.data || []);

      const allLogs = activityRes.data || [];

      // Build 30-day activity map with unique users
      const dayMap: Record<string, { sessions: number; minutes: number; users: Set<string> }> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dayMap[format(d, "MMM d")] = { sessions: 0, minutes: 0, users: new Set() };
      }
      for (const log of allLogs) {
        const key = format(new Date(log.created_at), "MMM d");
        if (dayMap[key]) {
          dayMap[key].sessions++;
          dayMap[key].minutes += log.duration_minutes || 0;
          dayMap[key].users.add(log.user_id);
        }
      }
      setActivityData(Object.entries(dayMap).map(([date, v]) => ({ date, sessions: v.sessions, minutes: v.minutes, uniqueUsers: v.users.size })));

      // Engagement metrics
      const totalMinutes = allLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0);
      const totalHours = Math.round(totalMinutes / 60 * 10) / 10;
      const avgDailyHours = Math.round(totalHours / 30 * 10) / 10;
      const avgSessionMin = allLogs.length > 0 ? Math.round(totalMinutes / allLogs.length) : 0;

      // DAU (today), WAU (7d), MAU (30d)
      const todayUsers = new Set(allLogs.filter(l => l.created_at >= today).map(l => l.user_id));
      const weekUsers = new Set(allLogs.filter(l => l.created_at >= sevenDaysAgo.toISOString()).map(l => l.user_id));
      const monthUsers = new Set(allLogs.map(l => l.user_id));

      // Retention: users active in both first 15 days and last 15 days
      const mid = new Date();
      mid.setDate(mid.getDate() - 15);
      const midStr = mid.toISOString();
      const firstHalf = new Set(allLogs.filter(l => l.created_at < midStr).map(l => l.user_id));
      const secondHalf = new Set(allLogs.filter(l => l.created_at >= midStr).map(l => l.user_id));
      const retained = [...firstHalf].filter(u => secondHalf.has(u)).length;
      const retentionPct = firstHalf.size > 0 ? Math.round((retained / firstHalf.size) * 100) : 0;

      // Peak study hour
      const hourCounts = new Array(24).fill(0);
      for (const l of allLogs) hourCounts[new Date(l.created_at).getHours()]++;
      const peakHour = hourCounts.indexOf(Math.max(...hourCounts));

      setEngagementData({ avgSessionMin, dau: todayUsers.size, wau: weekUsers.size, mau: monthUsers.size, retentionPct, peakHour, totalHours, avgDailyHours });
      setLoading(false);
    })();
  }, []);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const auditActionMeta: Record<string, { label: string; color: string; icon: any }> = {
    subscription_cancelled: { label: "Sub Cancelled", color: "text-destructive", icon: Ban },
    subscription_extended: { label: "Sub Extended", color: "text-success", icon: Clock },
    subscription_plan_changed: { label: "Plan Changed", color: "text-primary", icon: RefreshCw },
    bulk_subscription_cancelled: { label: "Bulk Cancel", color: "text-destructive", icon: Ban },
    bulk_subscription_extended: { label: "Bulk Extend", color: "text-success", icon: Clock },
    bulk_plan_changed: { label: "Bulk Plan Change", color: "text-primary", icon: RefreshCw },
    user_banned: { label: "User Banned", color: "text-destructive", icon: Ban },
    user_unbanned: { label: "User Unbanned", color: "text-success", icon: CheckCircle2 },
    feature_flag_toggled: { label: "Feature Flag", color: "text-accent", icon: Settings },
    plan_gate_updated: { label: "Plan Gate", color: "text-accent", icon: Shield },
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const cards = [
    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-primary" },
    { label: "New Today", value: stats.newToday, icon: UserPlus, color: "text-success" },
    { label: "Active Subs", value: stats.activeSubs, icon: CreditCard, color: "text-accent" },
    { label: "Revenue", value: `₹${stats.revenue.toLocaleString()}`, icon: TrendingUp, color: "text-warning" },
    { label: "Study Sessions", value: stats.studySessions, icon: Activity, color: "text-primary" },
    { label: "AI Predictions", value: stats.predictions, icon: Zap, color: "text-accent" },
  ];

  const chartData = activityData.map(d => chartMode === "minutes" ? d.minutes : chartMode === "sessions" ? d.sessions : d.uniqueUsers);
  const maxVal = Math.max(...chartData, 1);
  const chartHeight = 160;

  const engagementCards = [
    { label: "Total Study Hours", value: engagementData.totalHours.toLocaleString(), sub: `${engagementData.avgDailyHours}h/day avg`, icon: Clock, color: "text-primary" },
    { label: "Daily Active Users", value: engagementData.dau, sub: `of ${stats.totalUsers} total`, icon: Users, color: "text-success" },
    { label: "Weekly Active", value: engagementData.wau, sub: `${stats.totalUsers > 0 ? Math.round((engagementData.wau / stats.totalUsers) * 100) : 0}% of users`, icon: Activity, color: "text-accent" },
    { label: "Monthly Active", value: engagementData.mau, sub: `${stats.totalUsers > 0 ? Math.round((engagementData.mau / stats.totalUsers) * 100) : 0}% of users`, icon: TrendingUp, color: "text-warning" },
    { label: "Avg Session", value: `${engagementData.avgSessionMin}m`, sub: "per study session", icon: Clock, color: "text-primary" },
    { label: "Retention Rate", value: `${engagementData.retentionPct}%`, sub: "15-day cohort", icon: Shield, color: engagementData.retentionPct >= 50 ? "text-success" : "text-warning" },
    { label: "Peak Hour", value: `${engagementData.peakHour}:00`, sub: "most study activity", icon: Zap, color: "text-accent" },
    { label: "Today's Sessions", value: stats.studySessions, sub: `${engagementData.dau} active users`, icon: BarChart3, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">Dashboard</h2>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass rounded-xl p-4 neural-border">
            <div className="flex items-center gap-2 mb-2">
              <c.icon className={`w-4 h-4 ${c.color}`} />
              <span className="text-xs text-muted-foreground">{c.label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{c.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Engagement metrics */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Engagement Overview</h3>
          <span className="text-[10px] text-muted-foreground ml-auto">Last 30 days</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {engagementCards.map((c, i) => (
            <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25 + i * 0.03 }} className="glass rounded-xl p-3.5 neural-border">
              <div className="flex items-center gap-1.5 mb-1.5">
                <c.icon className={`w-3.5 h-3.5 ${c.color}`} />
                <span className="text-[10px] text-muted-foreground">{c.label}</span>
              </div>
              <p className="text-lg font-bold text-foreground">{c.value}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{c.sub}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* 30-day Platform Activity Chart */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass rounded-xl p-5 neural-border">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Platform Study Activity</h3>
          </div>
          <div className="flex items-center gap-2">
            {(["minutes", "sessions", "users"] as const).map(m => (
              <button key={m} onClick={() => setChartMode(m)} className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors capitalize ${chartMode === m ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
                {m === "minutes" ? "Study Time" : m === "sessions" ? "Sessions" : "Active Users"}
              </button>
            ))}
          </div>
        </div>

        <div className="relative" style={{ height: chartHeight }}>
          {/* Horizontal grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(pct => (
            <div key={pct} className="absolute left-0 right-0 border-t border-border/30" style={{ bottom: `${pct * 100}%` }}>
              {pct > 0 && (
                <span className="absolute -top-2.5 -left-1 text-[8px] text-muted-foreground">{Math.round(maxVal * pct)}{chartMode === "minutes" ? "m" : ""}</span>
              )}
            </div>
          ))}

          {/* Bars */}
          <div className="flex items-end h-full gap-[1px] pl-6">
            {activityData.map((d, i) => {
              const val = chartData[i];
              const h = (val / maxVal) * 100;
              return (
                <div
                  key={i}
                  className="flex-1 relative group"
                  style={{ height: "100%" }}
                  onMouseEnter={() => setHoveredBar(i)}
                  onMouseLeave={() => setHoveredBar(null)}
                >
                  <div
                    className="absolute bottom-0 left-[10%] right-[10%] rounded-t-sm transition-all duration-200"
                    style={{
                      height: `${Math.max(h, val > 0 ? 2 : 0)}%`,
                      backgroundColor: hoveredBar === i ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.5)",
                    }}
                  />
                  {hoveredBar === i && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 bg-popover border border-border rounded-lg px-2.5 py-1.5 shadow-lg whitespace-nowrap pointer-events-none">
                      <p className="text-[10px] font-semibold text-foreground">{d.date}</p>
                      <p className="text-[9px] text-muted-foreground">{d.minutes} min · {d.sessions} sessions · {d.uniqueUsers} users</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* X-axis labels */}
        <div className="flex pl-6 mt-1">
          {activityData.map((d, i) => (
            <div key={i} className="flex-1 text-center">
              {(i % 5 === 0 || i === activityData.length - 1) && (
                <span className="text-[7px] text-muted-foreground">{d.date.split(" ")[1]}</span>
              )}
            </div>
          ))}
        </div>

        {/* Summary strip */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
          <span className="text-[10px] text-muted-foreground">
            30-day total: <span className="font-semibold text-foreground">{activityData.reduce((s, d) => s + d.minutes, 0).toLocaleString()} min</span> across <span className="font-semibold text-foreground">{activityData.reduce((s, d) => s + d.sessions, 0).toLocaleString()} sessions</span>
          </span>
          <span className="text-[10px] text-muted-foreground">
            Avg: <span className="font-semibold text-foreground">{Math.round(activityData.reduce((s, d) => s + d.uniqueUsers, 0) / 30)} users/day</span>
          </span>
        </div>
      </motion.div>

      {/* Recent Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Transactions */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass rounded-xl neural-border overflow-hidden">
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
            <CreditCard className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Recent Transactions</h3>
            <span className="ml-auto text-[10px] text-muted-foreground">{recentTransactions.length} latest</span>
          </div>
          <div className="divide-y divide-border/40">
            {recentTransactions.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No transactions yet</p>}
            {recentTransactions.map(tx => (
              <div key={tx.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-secondary/30 transition-colors">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tx.status === "active" ? "bg-success/15" : tx.status === "expired" ? "bg-warning/15" : "bg-muted"}`}>
                  <CreditCard className={`w-3.5 h-3.5 ${tx.status === "active" ? "text-success" : tx.status === "expired" ? "text-warning" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium text-foreground capitalize">{tx.plan_id}</p>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${tx.status === "active" ? "bg-success/15 text-success" : tx.status === "expired" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"}`}>{tx.status}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">₹{tx.amount || 0} · {tx.user_id?.slice(0, 8)}...</p>
                </div>
                <span className="text-[9px] text-muted-foreground shrink-0">{timeAgo(tx.created_at)}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent Study Activity */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass rounded-xl neural-border overflow-hidden">
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
            <Activity className="w-4 h-4 text-success" />
            <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
            <span className="ml-auto text-[10px] text-muted-foreground">{recentActivity.length} latest</span>
          </div>
          <div className="divide-y divide-border/40">
            {recentActivity.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No study activity yet</p>}
            {recentActivity.map(a => {
              const modeColors: Record<string, string> = { focus: "bg-primary/15 text-primary", lazy: "bg-accent/15 text-accent", passive: "bg-warning/15 text-warning" };
              const modeClass = modeColors[a.study_mode || ""] || "bg-secondary text-muted-foreground";
              return (
                <div key={a.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-secondary/30 transition-colors">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${modeClass.split(" ")[0]}`}>
                    <Zap className={`w-3.5 h-3.5 ${modeClass.split(" ")[1]}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium text-foreground">{a.duration_minutes}m session</p>
                      {a.study_mode && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium capitalize ${modeClass}`}>{a.study_mode}</span>}
                      {a.confidence_level && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">{a.confidence_level}</span>}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">User: {a.user_id?.slice(0, 8)}...</p>
                  </div>
                  <span className="text-[9px] text-muted-foreground shrink-0">{timeAgo(a.created_at)}</span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Recent Audit Logs */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="glass rounded-xl neural-border overflow-hidden">
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
            <ScrollText className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">Recent Audit Logs</h3>
            <span className="ml-auto text-[10px] text-muted-foreground">{recentLogs.length} latest</span>
          </div>
          <div className="divide-y divide-border/40">
            {recentLogs.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No audit logs yet</p>}
            {recentLogs.map(log => {
              const meta = auditActionMeta[log.action] || { label: log.action.replace(/_/g, " "), color: "text-muted-foreground", icon: ScrollText };
              const IconComp = meta.icon;
              return (
                <div key={log.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-secondary/30 transition-colors">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-secondary">
                    <IconComp className={`w-3.5 h-3.5 ${meta.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground capitalize">{meta.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {log.target_type}{log.target_id ? ` · ${log.target_id.slice(0, 8)}...` : ""} · by {log.admin_id?.slice(0, 8)}...
                    </p>
                  </div>
                  <span className="text-[9px] text-muted-foreground shrink-0">{timeAgo(log.created_at)}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

// UsersSection replaced by UserManagement component


// ─── Knowledge DB ───
const KnowledgeSection = () => {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "ai-manager" | "brain-updates">("overview");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<{ id: string; display_name: string | null; exam_type: string | null; last_brain_update_at: string | null }[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userSubjects, setUserSubjects] = useState<Record<string, { id: string; name: string; topics: { id: string; name: string; memory_strength: number; marks_impact_weight: number | null; last_revision_date: string | null; next_predicted_drop_date: string | null }[] }[]>>({});
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [globalStats, setGlobalStats] = useState({ totalSubjects: 0, totalTopics: 0, avgStrength: 0, atRisk: 0, usersWithTopics: 0 });
  const [brainUpdates, setBrainUpdates] = useState<{ user_id: string; display_name: string | null; last_brain_update_at: string | null; topic_count: number; avg_strength: number }[]>([]);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [userRes, subRes, topicRes] = await Promise.all([
      supabase.from("profiles").select("id, display_name, exam_type, last_brain_update_at").limit(500),
      supabase.from("subjects").select("id, name, user_id").is("deleted_at", null).limit(1000),
      supabase.from("topics").select("id, name, memory_strength, marks_impact_weight, last_revision_date, next_predicted_drop_date, subject_id, user_id").is("deleted_at", null).limit(1000),
    ]);

    const allUsers = userRes.data || [];
    const allSubjects = subRes.data || [];
    const allTopics = topicRes.data || [];

    setUsers(allUsers);

    // Build organized structure: user -> subjects -> topics
    const organized: Record<string, { id: string; name: string; topics: any[] }[]> = {};
    for (const sub of allSubjects) {
      if (!organized[sub.user_id]) organized[sub.user_id] = [];
      const subTopics = allTopics.filter(t => t.subject_id === sub.id && t.user_id === sub.user_id);
      organized[sub.user_id].push({ id: sub.id, name: sub.name, topics: subTopics });
    }
    // Sort subjects alphabetically per user and topics by strength ascending
    for (const uid of Object.keys(organized)) {
      organized[uid].sort((a, b) => a.name.localeCompare(b.name));
      for (const s of organized[uid]) {
        s.topics.sort((a: any, b: any) => a.memory_strength - b.memory_strength);
      }
    }
    setUserSubjects(organized);

    // Global stats
    const totalSubjects = allSubjects.length;
    const totalTopics = allTopics.length;
    const avgStrength = totalTopics > 0 ? Math.round(allTopics.reduce((s, t) => s + Number(t.memory_strength), 0) / totalTopics) : 0;
    const now = new Date();
    const atRisk = allTopics.filter(t => t.next_predicted_drop_date && new Date(t.next_predicted_drop_date) <= now).length;
    const usersWithTopics = new Set(allTopics.map(t => t.user_id)).size;
    setGlobalStats({ totalSubjects, totalTopics, avgStrength, atRisk, usersWithTopics });

    // Brain update leaderboard
    const brainData = allUsers.map(u => {
      const uTopics = allTopics.filter(t => t.user_id === u.id);
      return {
        user_id: u.id,
        display_name: u.display_name,
        last_brain_update_at: u.last_brain_update_at,
        topic_count: uTopics.length,
        avg_strength: uTopics.length > 0 ? Math.round(uTopics.reduce((s, t) => s + Number(t.memory_strength), 0) / uTopics.length) : 0,
      };
    }).filter(u => u.topic_count > 0).sort((a, b) => (b.last_brain_update_at || "").localeCompare(a.last_brain_update_at || ""));
    setBrainUpdates(brainData);

    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredUsers = users.filter(u =>
    !userSearch || (u.display_name || "").toLowerCase().includes(userSearch.toLowerCase()) || u.id.includes(userSearch)
  );

  const toggleUser = (id: string) => setExpandedUsers(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSubject = (key: string) => setExpandedSubjects(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const getStrengthColor = (s: number) => s > 70 ? "text-success" : s > 50 ? "text-warning" : "text-destructive";
  const getStrengthBg = (s: number) => s > 70 ? "bg-success" : s > 50 ? "bg-warning" : "bg-destructive";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          Knowledge Database
        </h2>
        <button onClick={fetchData} disabled={loading} className="p-2 rounded-lg hover:bg-secondary transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Global Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Users", value: globalStats.usersWithTopics, icon: Users, color: "text-primary" },
          { label: "Subjects", value: globalStats.totalSubjects, icon: BookOpen, color: "text-primary" },
          { label: "Topics", value: globalStats.totalTopics, icon: Brain, color: "text-primary" },
          { label: "Avg Strength", value: `${globalStats.avgStrength}%`, icon: TrendingUp, color: getStrengthColor(globalStats.avgStrength) },
          { label: "At Risk", value: globalStats.atRisk, icon: AlertTriangle, color: "text-destructive" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass rounded-xl p-4 neural-border text-center">
            <stat.icon className={`w-4 h-4 mx-auto mb-1.5 ${stat.color}`} />
            <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-[10px] text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: "overview" as const, label: "Subjects & Topics", icon: BookOpen },
          { key: "brain-updates" as const, label: "Brain Updates", icon: Brain },
          { key: "ai-manager" as const, label: "AI Topic Manager", icon: Sparkles },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>}

      {/* ── Subjects & Topics Overview ── */}
      {!loading && tab === "overview" && (
        <div className="space-y-3">
          <input
            type="text" placeholder="Search users..." value={userSearch} onChange={e => setUserSearch(e.target.value)}
            className="w-full px-3 py-2 bg-secondary rounded-lg text-sm text-foreground border border-border focus:border-primary outline-none"
          />

          {filteredUsers.filter(u => userSubjects[u.id]?.length > 0).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No subjects found</p>
          )}

          {filteredUsers.filter(u => userSubjects[u.id]?.length > 0).map(u => {
            const subs = userSubjects[u.id] || [];
            const totalTopics = subs.reduce((a, s) => a + s.topics.length, 0);
            const avgStr = totalTopics > 0 ? Math.round(subs.reduce((a, s) => a + s.topics.reduce((b: number, t: any) => b + Number(t.memory_strength), 0), 0) / totalTopics) : 0;
            const isExpanded = expandedUsers.has(u.id);

            return (
              <motion.div key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-xl neural-border overflow-hidden">
                <button onClick={() => toggleUser(u.id)} className="w-full p-4 flex items-center gap-3 text-left hover:bg-secondary/20 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{u.display_name || "Unnamed"}</p>
                      {u.exam_type && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent-foreground">{u.exam_type}</span>}
                    </div>
                    <p className="text-[10px] text-muted-foreground">{subs.length} subjects · {totalTopics} topics · Avg: <span className={getStrengthColor(avgStr)}>{avgStr}%</span></p>
                  </div>
                  <motion.div animate={{ rotate: isExpanded ? 90 : 0 }}>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </motion.div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 space-y-2">
                        {subs.map(sub => {
                          const subKey = `${u.id}:${sub.id}`;
                          const subExpanded = expandedSubjects.has(subKey);
                          const subAvg = sub.topics.length > 0 ? Math.round(sub.topics.reduce((a, t) => a + Number(t.memory_strength), 0) / sub.topics.length) : 0;
                          const subAtRisk = sub.topics.filter(t => t.next_predicted_drop_date && new Date(t.next_predicted_drop_date) <= new Date()).length;

                          return (
                            <div key={sub.id} className="rounded-lg border border-border/50 overflow-hidden">
                              <button onClick={() => toggleSubject(subKey)} className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-secondary/30 transition-colors">
                                <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
                                <span className="text-xs font-semibold text-foreground flex-1 text-left truncate">{sub.name}</span>
                                <span className="text-[10px] text-muted-foreground">{sub.topics.length} topics</span>
                                {subAtRisk > 0 && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive">{subAtRisk} at risk</span>
                                )}
                                <span className={`text-[10px] font-bold ${getStrengthColor(subAvg)}`}>{subAvg}%</span>
                                <motion.div animate={{ rotate: subExpanded ? 90 : 0 }}>
                                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                </motion.div>
                              </button>

                              <AnimatePresence>
                                {subExpanded && (
                                  <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                                    <div className="px-3 pb-3 space-y-1">
                                      {sub.topics.length === 0 && <p className="text-[10px] text-muted-foreground py-2 text-center">No topics</p>}
                                      {sub.topics.map(topic => {
                                        const str = Number(topic.memory_strength);
                                        const isAtRisk = topic.next_predicted_drop_date && new Date(topic.next_predicted_drop_date) <= new Date();
                                        return (
                                          <div key={topic.id} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg ${isAtRisk ? "bg-destructive/5 border border-destructive/20" : "bg-secondary/20"}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStrengthBg(str)}`} />
                                            <span className="text-[11px] text-foreground flex-1 truncate">{topic.name}</span>
                                            {topic.marks_impact_weight != null && (
                                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">w:{topic.marks_impact_weight}</span>
                                            )}
                                            <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                                              <div className={`h-full rounded-full ${getStrengthBg(str)}`} style={{ width: `${str}%` }} />
                                            </div>
                                            <span className={`text-[10px] font-bold min-w-[28px] text-right ${getStrengthColor(str)}`}>{str}%</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Brain Updates Tab ── */}
      {!loading && tab === "brain-updates" && (
        <div className="space-y-3">
          <div className="glass rounded-xl p-4 neural-border">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-primary" />
              Daily Brain Update Activity
            </h3>
            <p className="text-[10px] text-muted-foreground mb-3">Users who have updated their brain, sorted by most recent activity.</p>

            {brainUpdates.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No brain updates recorded</p>}

            <div className="space-y-2">
              {brainUpdates.map((bu, i) => {
                const lastUpdate = bu.last_brain_update_at ? new Date(bu.last_brain_update_at) : null;
                const hoursAgo = lastUpdate ? Math.round((Date.now() - lastUpdate.getTime()) / 3600000) : null;
                const isRecent = hoursAgo !== null && hoursAgo < 24;
                const isStale = hoursAgo !== null && hoursAgo > 72;

                return (
                  <motion.div key={bu.user_id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      isRecent ? "bg-success/5 border-success/20" : isStale ? "bg-destructive/5 border-destructive/20" : "bg-secondary/20 border-border/50"
                    }`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isRecent ? "bg-success/15" : isStale ? "bg-destructive/15" : "bg-secondary"
                    }`}>
                      <Brain className={`w-3.5 h-3.5 ${isRecent ? "text-success" : isStale ? "text-destructive" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{bu.display_name || "Unnamed"}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {bu.topic_count} topics · Avg: <span className={getStrengthColor(bu.avg_strength)}>{bu.avg_strength}%</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {lastUpdate ? (
                        <>
                          <p className={`text-[10px] font-medium ${isRecent ? "text-success" : isStale ? "text-destructive" : "text-muted-foreground"}`}>
                            {hoursAgo! < 1 ? "Just now" : hoursAgo! < 24 ? `${hoursAgo}h ago` : `${Math.floor(hoursAgo! / 24)}d ago`}
                          </p>
                          <p className="text-[9px] text-muted-foreground">{format(lastUpdate, "MMM d, HH:mm")}</p>
                        </>
                      ) : (
                        <p className="text-[10px] text-muted-foreground">Never</p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── AI Topic Manager Tab ── */}
      {!loading && tab === "ai-manager" && (
        <div className="space-y-4">
          <div className="glass rounded-xl p-4 neural-border space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Select User
            </h3>
            <input
              type="text" placeholder="Search by name or ID..." value={userSearch} onChange={e => setUserSearch(e.target.value)}
              className="w-full px-3 py-2 bg-secondary rounded-lg text-sm text-foreground border border-border focus:border-primary outline-none"
            />
            <div className="max-h-40 overflow-y-auto space-y-1">
              {filteredUsers.slice(0, 20).map(u => (
                <button key={u.id} onClick={() => setSelectedUserId(u.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                    selectedUserId === u.id ? "bg-primary/15 text-primary" : "text-foreground hover:bg-secondary"
                  }`}>
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="flex-1 truncate">{u.display_name || "Unnamed"}</span>
                  <span className="text-[10px] text-muted-foreground">{u.exam_type || "No exam"}</span>
                </button>
              ))}
            </div>
          </div>

          {selectedUserId && (
            <AITopicManager
              mode="admin"
              targetUserId={selectedUserId}
              examType={users.find(u => u.id === selectedUserId)?.exam_type || undefined}
              onDone={() => fetchData()}
            />
          )}
        </div>
      )}
    </div>
  );
};

// ─── Subscriptions & Plans ───
const SubscriptionsSection = () => {
  const { toast } = useToast();
  const [tab, setTab] = useState<"plans" | "payments" | "analytics" | "webhooks" | "gateway">("plans");

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-foreground">Subscription Management</h2>
      <div className="flex gap-2 flex-wrap">
        {([
          { key: "plans" as const, label: "Plan Management" },
          { key: "payments" as const, label: "Payment History" },
          { key: "analytics" as const, label: "Analytics" },
          { key: "webhooks" as const, label: "Webhook Events" },
          { key: "gateway" as const, label: "Gateway Config" },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "plans" ? <PlanManagement toast={toast} /> : tab === "payments" ? <PaymentManagement /> : tab === "analytics" ? <SubscriptionAnalytics /> : tab === "webhooks" ? <WebhookEvents /> : <GatewayConfig />}
    </div>
  );
};

// ─── Plan Management ───
const PlanManagement = ({ toast }: { toast: any }) => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fetchPlans = useCallback(async () => {
    const { data } = await supabase.from("subscription_plans").select("*").order("sort_order");
    setPlans(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const deletePlan = async (id: string, key: string) => {
    if (key === "free") { toast({ title: "Cannot delete the free plan", variant: "destructive" }); return; }
    await supabase.from("subscription_plans").delete().eq("id", id);
    toast({ title: "Plan deleted" });
    fetchPlans();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("subscription_plans").update({ is_active: !current } as any).eq("id", id);
    toast({ title: !current ? "Plan activated" : "Plan deactivated" });
    fetchPlans();
  };

  const togglePopular = async (id: string, current: boolean) => {
    if (!current) {
      await supabase.from("subscription_plans").update({ is_popular: false } as any).neq("id", id);
    }
    await supabase.from("subscription_plans").update({ is_popular: !current } as any).eq("id", id);
    fetchPlans();
  };

  const openEdit = (plan: any) => { setEditing(plan); setShowForm(true); };
  const openCreate = () => { setEditing(null); setShowForm(true); };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{plans.length} plan(s)</p>
        <button onClick={openCreate} className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Add Plan
        </button>
      </div>

      <div className="space-y-3">
        {plans.map(plan => (
          <div key={plan.id} className="glass rounded-xl p-4 neural-border space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{plan.plan_key}</span>
                  {plan.is_popular && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium">POPULAR</span>}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${plan.is_active ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                    {plan.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ₹{plan.price} / {plan.billing_period} · {(plan.features as string[])?.length || 0} features
                </p>
                {plan.razorpay_plan_id && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">Razorpay ID: {plan.razorpay_plan_id}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => togglePopular(plan.id, plan.is_popular)} className="p-1.5 hover:bg-primary/10 rounded-lg transition-colors" title="Toggle popular">
                  <Star className={`w-3.5 h-3.5 ${plan.is_popular ? "text-primary fill-primary" : "text-muted-foreground"}`} />
                </button>
                <button onClick={() => toggleActive(plan.id, plan.is_active)} className="p-1.5 hover:bg-secondary rounded-lg transition-colors" title="Toggle active">
                  {plan.is_active ? <ToggleRight className="w-4 h-4 text-success" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                </button>
                <button onClick={() => openEdit(plan)} className="p-1.5 hover:bg-secondary rounded-lg transition-colors">
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                {plan.plan_key !== "free" && (
                  <button onClick={() => deletePlan(plan.id, plan.plan_key)} className="p-1.5 hover:bg-destructive/15 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {(plan.features as string[])?.map((f: string, i: number) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{f}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showForm && (
          <PlanFormModal plan={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchPlans(); toast({ title: editing ? "Plan updated" : "Plan created" }); }} />
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Plan Form Modal ───
const PlanFormModal = ({ plan, onClose, onSaved }: { plan: any | null; onClose: () => void; onSaved: () => void }) => {
  const isEdit = !!plan;
  const [name, setName] = useState(plan?.name || "");
  const [planKey, setPlanKey] = useState(plan?.plan_key || "");
  const [description, setDescription] = useState(plan?.description || "");
  const [price, setPrice] = useState(plan?.price?.toString() || "0");
  const [billingPeriod, setBillingPeriod] = useState(plan?.billing_period || "monthly");
  const [features, setFeatures] = useState<string[]>(plan?.features || []);
  const [newFeature, setNewFeature] = useState("");
  const [razorpayPlanId, setRazorpayPlanId] = useState(plan?.razorpay_plan_id || "");
  const [sortOrder, setSortOrder] = useState(plan?.sort_order?.toString() || "0");
  const [saving, setSaving] = useState(false);

  const addFeature = () => {
    if (newFeature.trim()) { setFeatures(prev => [...prev, newFeature.trim()]); setNewFeature(""); }
  };

  const removeFeature = (idx: number) => setFeatures(prev => prev.filter((_, i) => i !== idx));

  const save = async () => {
    if (!name.trim() || !planKey.trim()) return;
    setSaving(true);
    const payload = {
      name: name.trim(),
      plan_key: planKey.trim(),
      description: description.trim() || null,
      price: parseInt(price) || 0,
      billing_period: billingPeriod,
      features,
      razorpay_plan_id: razorpayPlanId.trim() || null,
      sort_order: parseInt(sortOrder) || 0,
    };

    if (isEdit) {
      await supabase.from("subscription_plans").update(payload as any).eq("id", plan.id);
    } else {
      await supabase.from("subscription_plans").insert(payload as any);
    }
    setSaving(false);
    onSaved();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-md glass rounded-2xl neural-border p-5 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-foreground">{isEdit ? "Edit Plan" : "Create Plan"}</h3>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Plan Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 bg-secondary rounded-lg text-sm text-foreground border border-border focus:border-primary outline-none" placeholder="Pro Brain" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Plan Key *</label>
              <select value={planKey} onChange={e => setPlanKey(e.target.value)} disabled={isEdit} className="w-full px-3 py-2 rounded-lg text-sm text-foreground border border-border focus:border-primary outline-none disabled:opacity-50 appearance-none cursor-pointer" style={{ backgroundColor: 'hsl(var(--secondary))' }}>
                <option value="" style={{ backgroundColor: 'hsl(var(--secondary))', color: 'hsl(var(--muted-foreground))' }}>Select plan key</option>
                <option value="free" style={{ backgroundColor: 'hsl(var(--secondary))', color: 'hsl(var(--foreground))' }}>Free</option>
                <option value="pro" style={{ backgroundColor: 'hsl(var(--secondary))', color: 'hsl(var(--foreground))' }}>Pro</option>
                <option value="ultra" style={{ backgroundColor: 'hsl(var(--secondary))', color: 'hsl(var(--foreground))' }}>Ultra</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2 bg-secondary rounded-lg text-sm text-foreground border border-border focus:border-primary outline-none" placeholder="Short description..." />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Price (₹)</label>
              <input value={price} onChange={e => setPrice(e.target.value)} type="number" className="w-full px-3 py-2 bg-secondary rounded-lg text-sm text-foreground border border-border focus:border-primary outline-none" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Billing</label>
              <select value={billingPeriod} onChange={e => setBillingPeriod(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm text-foreground border border-border focus:border-primary outline-none cursor-pointer" style={{ backgroundColor: 'hsl(var(--secondary))' }}>
                <option value="forever" style={{ backgroundColor: 'hsl(var(--secondary))', color: 'hsl(var(--foreground))' }}>Forever</option>
                <option value="monthly" style={{ backgroundColor: 'hsl(var(--secondary))', color: 'hsl(var(--foreground))' }}>Monthly</option>
                <option value="yearly" style={{ backgroundColor: 'hsl(var(--secondary))', color: 'hsl(var(--foreground))' }}>Yearly</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Sort Order</label>
              <input value={sortOrder} onChange={e => setSortOrder(e.target.value)} type="number" className="w-full px-3 py-2 bg-secondary rounded-lg text-sm text-foreground border border-border focus:border-primary outline-none" />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Razorpay Plan ID (optional)</label>
            <input value={razorpayPlanId} onChange={e => setRazorpayPlanId(e.target.value)} className="w-full px-3 py-2 bg-secondary rounded-lg text-sm text-foreground border border-border focus:border-primary outline-none" placeholder="plan_xxxxx" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Features (select from list)</label>
            <div className="max-h-48 overflow-y-auto space-y-1 mb-2 p-2 bg-secondary/50 rounded-lg border border-border">
              {[
                "5 subjects & 20 topics",
                "Basic memory tracking",
                "Daily study reminders",
                "Community leaderboard",
                "Unlimited subjects & topics",
                "AI exam simulator",
                "Advanced analytics",
                "Voice notifications",
                "Priority support",
                "Weekly AI reports",
                "Everything in Pro",
                "AI study coach (1-on-1)",
                "Custom study plans",
                "Peer competition insights",
                "Offline mode",
                "Data export & backup",
                "Early access to features",
              ].map((f) => {
                const isSelected = features.includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setFeatures(prev => prev.filter(x => x !== f));
                      } else {
                        setFeatures(prev => [...prev, f]);
                      }
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors ${
                      isSelected
                        ? "bg-primary/15 text-primary border border-primary/30"
                        : "text-foreground hover:bg-secondary border border-transparent"
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${isSelected ? "bg-primary border-primary" : "border-muted-foreground"}`}>
                      {isSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                    </div>
                    {f}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input value={newFeature} onChange={e => setNewFeature(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addFeature())} className="flex-1 px-3 py-2 bg-secondary rounded-lg text-sm text-foreground border border-border focus:border-primary outline-none" placeholder="Add custom feature..." />
              <button onClick={addFeature} className="px-3 py-2 bg-secondary rounded-lg text-sm text-foreground hover:bg-secondary/80 border border-border">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {features.filter(f => ![
              "5 subjects & 20 topics", "Basic memory tracking", "Daily study reminders", "Community leaderboard",
              "Unlimited subjects & topics", "AI exam simulator", "Advanced analytics", "Voice notifications",
              "Priority support", "Weekly AI reports", "Everything in Pro", "AI study coach (1-on-1)",
              "Custom study plans", "Peer competition insights", "Offline mode", "Data export & backup", "Early access to features",
            ].includes(f)).length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-[10px] text-muted-foreground">Custom features:</p>
                {features.filter(f => ![
                  "5 subjects & 20 topics", "Basic memory tracking", "Daily study reminders", "Community leaderboard",
                  "Unlimited subjects & topics", "AI exam simulator", "Advanced analytics", "Voice notifications",
                  "Priority support", "Weekly AI reports", "Everything in Pro", "AI study coach (1-on-1)",
                  "Custom study plans", "Peer competition insights", "Offline mode", "Data export & backup", "Early access to features",
                ].includes(f)).map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="flex-1 text-foreground bg-secondary px-2 py-1 rounded">{f}</span>
                    <button onClick={() => removeFeature(features.indexOf(f))} className="text-destructive hover:text-destructive/80"><XCircle className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button onClick={save} disabled={!name.trim() || !planKey.trim() || saving} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? "Save Changes" : "Create Plan"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
// ─── Gateway Config ───
const GatewayConfig = () => {
  const { toast } = useToast();
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({
    mode: "test",
    test_key_id: "",
    test_key_secret: "",
    live_key_id: "",
    live_key_secret: "",
    webhook_secret: "",
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("razorpay_config").select("*").limit(1).maybeSingle();
      if (data) {
        setConfig(data);
        setForm({
          mode: (data as any).mode || "test",
          test_key_id: (data as any).test_key_id || "",
          test_key_secret: (data as any).test_key_secret || "",
          live_key_id: (data as any).live_key_id || "",
          live_key_secret: (data as any).live_key_secret || "",
          webhook_secret: (data as any).webhook_secret || "",
        });
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const userId = (await supabase.auth.getUser()).data.user?.id;
    const updateData = { ...form, updated_at: new Date().toISOString(), updated_by: userId };

    if (config?.id) {
      await supabase.from("razorpay_config").update(updateData as any).eq("id", config.id);
    } else {
      await supabase.from("razorpay_config").insert(updateData as any);
    }

    if (userId) {
      await supabase.from("admin_audit_logs").insert({
        admin_id: userId,
        action: "razorpay_config_updated",
        target_type: "razorpay_config",
        target_id: config?.id || "new",
        details: { mode: form.mode, keys_updated: true },
      } as any);
    }

    toast({ title: `Razorpay config saved (${form.mode} mode)` });
    setSaving(false);
  };

  const toggleSecret = (key: string) => setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));

  const KeyField = ({ label, field, placeholder }: { label: string; field: keyof typeof form; placeholder: string }) => (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <div className="relative">
        <input
          type={showSecrets[field] ? "text" : "password"}
          value={form[field]}
          onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
          placeholder={placeholder}
          className="w-full px-3 py-2.5 pr-16 bg-secondary rounded-lg text-sm text-foreground border border-border focus:border-primary outline-none font-mono"
        />
        <button onClick={() => toggleSecret(field)} className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-primary font-medium px-2 py-1 rounded hover:bg-primary/10 transition-colors">
          {showSecrets[field] ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="glass rounded-xl p-4 neural-border space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Payment Gateway Mode</h3>
        <div className="flex gap-2">
          {(["test", "live"] as const).map(m => (
            <button
              key={m}
              onClick={() => setForm(prev => ({ ...prev, mode: m }))}
              className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium border-2 transition-all ${
                form.mode === m
                  ? m === "live"
                    ? "border-success bg-success/10 text-success"
                    : "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-muted-foreground/50"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <div className={`w-2 h-2 rounded-full ${form.mode === m ? (m === "live" ? "bg-success animate-pulse" : "bg-primary") : "bg-muted-foreground/30"}`} />
                {m === "test" ? "Test Mode" : "Live Mode"}
              </div>
              <p className="text-[10px] mt-1 opacity-70">
                {m === "test" ? "No real charges" : "Real transactions"}
              </p>
            </button>
          ))}
        </div>
        {form.mode === "live" && (
          <div className="flex items-start gap-2 bg-warning/10 rounded-lg p-2.5">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <p className="text-[10px] text-warning">Live mode will process real payments. Ensure your keys are correct before enabling.</p>
          </div>
        )}
      </div>

      {/* Test Keys */}
      <div className="glass rounded-xl p-4 neural-border space-y-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${form.mode === "test" ? "bg-primary animate-pulse" : "bg-muted-foreground/30"}`} />
          <h3 className="text-sm font-semibold text-foreground">Test Keys</h3>
          {form.mode === "test" && <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">Active</span>}
        </div>
        <KeyField label="Test Key ID" field="test_key_id" placeholder="rzp_test_..." />
        <KeyField label="Test Key Secret" field="test_key_secret" placeholder="Enter test secret key" />
      </div>

      {/* Live Keys */}
      <div className="glass rounded-xl p-4 neural-border space-y-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${form.mode === "live" ? "bg-success animate-pulse" : "bg-muted-foreground/30"}`} />
          <h3 className="text-sm font-semibold text-foreground">Live Keys</h3>
          {form.mode === "live" && <span className="text-[10px] bg-success/15 text-success px-2 py-0.5 rounded-full font-medium">Active</span>}
        </div>
        <KeyField label="Live Key ID" field="live_key_id" placeholder="rzp_live_..." />
        <KeyField label="Live Key Secret" field="live_key_secret" placeholder="Enter live secret key" />
      </div>

      {/* Webhook Secret */}
      <div className="glass rounded-xl p-4 neural-border space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Webhook Secret</h3>
        <p className="text-[10px] text-muted-foreground">Optional. Used to verify webhook signatures from Razorpay Dashboard.</p>
        <KeyField label="Webhook Secret" field="webhook_secret" placeholder="Enter webhook secret" />
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        Save Gateway Configuration
      </button>

      {config?.updated_at && (
        <p className="text-[10px] text-muted-foreground text-center">
          Last updated: {new Date(config.updated_at).toLocaleString()}
        </p>
      )}
    </div>
  );
};

// ─── Webhook Events ───
const WebhookEvents = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("razorpay_webhook_events").select("*").order("created_at", { ascending: false }).limit(100);
      setEvents(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const webhookUrl = `https://yvxrsujwgmzdjzsjyqfb.supabase.co/functions/v1/razorpay-webhook`;

  const eventColor = (type: string) => {
    if (type.includes("captured") || type.includes("activated") || type.includes("charged")) return "text-success bg-success/15";
    if (type.includes("failed") || type.includes("halted")) return "text-destructive bg-destructive/15";
    if (type.includes("refund")) return "text-warning bg-warning/15";
    return "text-muted-foreground bg-muted";
  };

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-4 neural-border space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Razorpay Webhook Setup</h3>
        <p className="text-xs text-muted-foreground">Add this URL in your Razorpay Dashboard → Settings → Webhooks:</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-secondary rounded-lg px-3 py-2 text-foreground break-all select-all">{webhookUrl}</code>
          <button onClick={() => { navigator.clipboard.writeText(webhookUrl); }} className="px-3 py-2 bg-primary/15 text-primary rounded-lg text-xs font-medium hover:bg-primary/25 transition-colors shrink-0">
            Copy
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground">Events to enable: payment.captured, payment.failed, payment.authorized, refund.created, refund.processed, subscription.activated, subscription.charged, subscription.cancelled, subscription.halted, subscription.paused</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="glass rounded-xl p-3 neural-border">
          <p className="text-[10px] text-muted-foreground">Total Events</p>
          <p className="text-lg font-bold text-foreground">{events.length}</p>
        </div>
        <div className="glass rounded-xl p-3 neural-border">
          <p className="text-[10px] text-muted-foreground">Processed</p>
          <p className="text-lg font-bold text-success">{events.filter(e => e.processed).length}</p>
        </div>
        <div className="glass rounded-xl p-3 neural-border">
          <p className="text-[10px] text-muted-foreground">Failed</p>
          <p className="text-lg font-bold text-destructive">{events.filter(e => e.error_message).length}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No webhook events received yet</p>
      ) : (
        <div className="space-y-2">
          {events.map(e => (
            <div key={e.id} className="glass rounded-xl p-3 neural-border">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${eventColor(e.event_type)}`}>{e.event_type}</span>
                {e.processed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                ) : e.error_message ? (
                  <XCircle className="w-3.5 h-3.5 text-destructive" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <span className="text-[10px] text-muted-foreground ml-auto">{new Date(e.created_at).toLocaleString()}</span>
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground space-x-3">
                {e.payment_id && <span>Pay: {e.payment_id}</span>}
                {e.order_id && <span>Order: {e.order_id}</span>}
                {e.amount && <span>₹{e.amount}</span>}
              </div>
              {e.error_message && <p className="text-[10px] text-destructive mt-1">{e.error_message}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Payment Management ───
const PaymentManagement = () => {
  const { toast } = useToast();
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired" | "cancelled">("all");
  const [actionTarget, setActionTarget] = useState<any | null>(null);
  const [actionType, setActionType] = useState<"cancel" | "extend" | "change_plan" | null>(null);
  const [extendDays, setExtendDays] = useState("30");
  const [actionLoading, setActionLoading] = useState(false);
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"cancel" | "extend" | "change_plan" | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchSubs = useCallback(async () => {
    const { data } = await supabase.from("user_subscriptions").select("*").order("created_at", { ascending: false }).limit(200);
    setSubs(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);

  useEffect(() => {
    const fetchPlans = async () => {
      const { data } = await supabase.from("subscription_plans").select("*").eq("is_active", true).order("sort_order");
      setAvailablePlans(data || []);
    };
    fetchPlans();
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filtered = subs.filter(s => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (search && !s.user_id.includes(search) && !(s.razorpay_order_id || "").includes(search) && !(s.razorpay_payment_id || "").includes(search)) return false;
    return true;
  });

  const selectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(s => s.id)));
    }
  };

  // Single actions (existing)
  const handleCancel = async () => {
    if (!actionTarget) return;
    setActionLoading(true);
    await supabase.from("user_subscriptions").update({ status: "cancelled" } as any).eq("id", actionTarget.id);
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (userId) {
      await supabase.from("admin_audit_logs").insert({
        admin_id: userId, action: "subscription_cancelled", target_type: "user_subscriptions",
        target_id: actionTarget.id, details: { user_id: actionTarget.user_id, plan_id: actionTarget.plan_id },
      } as any);
    }
    toast({ title: "Subscription cancelled" });
    setActionTarget(null); setActionType(null); setActionLoading(false);
    fetchSubs();
  };

  const handleExtend = async () => {
    if (!actionTarget) return;
    setActionLoading(true);
    const days = parseInt(extendDays) || 30;
    const currentExpiry = actionTarget.expires_at ? new Date(actionTarget.expires_at) : new Date();
    const base = currentExpiry > new Date() ? currentExpiry : new Date();
    base.setDate(base.getDate() + days);
    await supabase.from("user_subscriptions").update({ expires_at: base.toISOString(), status: "active" } as any).eq("id", actionTarget.id);
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (userId) {
      await supabase.from("admin_audit_logs").insert({
        admin_id: userId, action: "subscription_extended", target_type: "user_subscriptions",
        target_id: actionTarget.id, details: { user_id: actionTarget.user_id, plan_id: actionTarget.plan_id, days_added: days, new_expiry: base.toISOString() },
      } as any);
    }
    toast({ title: `Subscription extended by ${days} days` });
    setActionTarget(null); setActionType(null); setActionLoading(false);
    fetchSubs();
  };

  const handleChangePlan = async () => {
    if (!actionTarget || !selectedPlanId) return;
    setActionLoading(true);
    const oldPlanId = actionTarget.plan_id;
    await supabase.from("user_subscriptions").update({ plan_id: selectedPlanId, status: "active" } as any).eq("id", actionTarget.id);
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (userId) {
      await supabase.from("admin_audit_logs").insert({
        admin_id: userId, action: "subscription_plan_changed", target_type: "user_subscriptions",
        target_id: actionTarget.id, details: { user_id: actionTarget.user_id, old_plan_id: oldPlanId, new_plan_id: selectedPlanId },
      } as any);
    }
    await supabase.from("notification_history").insert({
      user_id: actionTarget.user_id, title: "Plan Changed",
      body: `Your subscription has been changed to ${selectedPlanId}.`, type: "plan_change",
    } as any);
    toast({ title: `Plan changed to ${selectedPlanId}` });
    setActionTarget(null); setActionType(null); setSelectedPlanId(""); setActionLoading(false);
    fetchSubs();
  };

  // Bulk actions
  const handleBulkAction = async () => {
    if (selectedIds.size === 0 || !bulkAction) return;
    setBulkLoading(true);
    const userId = (await supabase.auth.getUser()).data.user?.id;
    const targets = subs.filter(s => selectedIds.has(s.id));
    let successCount = 0;

    for (const target of targets) {
      try {
        if (bulkAction === "cancel") {
          await supabase.from("user_subscriptions").update({ status: "cancelled" } as any).eq("id", target.id);
          if (userId) {
            await supabase.from("admin_audit_logs").insert({
              admin_id: userId, action: "bulk_subscription_cancelled", target_type: "user_subscriptions",
              target_id: target.id, details: { user_id: target.user_id, plan_id: target.plan_id, bulk_count: targets.length },
            } as any);
          }
        } else if (bulkAction === "extend") {
          const days = parseInt(extendDays) || 30;
          const currentExpiry = target.expires_at ? new Date(target.expires_at) : new Date();
          const base = currentExpiry > new Date() ? currentExpiry : new Date();
          base.setDate(base.getDate() + days);
          await supabase.from("user_subscriptions").update({ expires_at: base.toISOString(), status: "active" } as any).eq("id", target.id);
          if (userId) {
            await supabase.from("admin_audit_logs").insert({
              admin_id: userId, action: "bulk_subscription_extended", target_type: "user_subscriptions",
              target_id: target.id, details: { user_id: target.user_id, days_added: days, new_expiry: base.toISOString(), bulk_count: targets.length },
            } as any);
          }
        } else if (bulkAction === "change_plan" && selectedPlanId) {
          await supabase.from("user_subscriptions").update({ plan_id: selectedPlanId, status: "active" } as any).eq("id", target.id);
          if (userId) {
            await supabase.from("admin_audit_logs").insert({
              admin_id: userId, action: "bulk_plan_changed", target_type: "user_subscriptions",
              target_id: target.id, details: { user_id: target.user_id, old_plan_id: target.plan_id, new_plan_id: selectedPlanId, bulk_count: targets.length },
            } as any);
          }
          await supabase.from("notification_history").insert({
            user_id: target.user_id, title: "Plan Changed",
            body: `Your subscription has been changed to ${selectedPlanId}.`, type: "plan_change",
          } as any);
        }
        successCount++;
      } catch (e) {
        console.error("Bulk action failed for", target.id, e);
      }
    }

    toast({ title: `Bulk ${bulkAction === "cancel" ? "cancellation" : bulkAction === "extend" ? "extension" : "plan change"} complete`, description: `${successCount}/${targets.length} subscriptions updated` });
    setSelectedIds(new Set());
    setBulkAction(null);
    setSelectedPlanId("");
    setBulkLoading(false);
    fetchSubs();
  };

  const totalRevenue = subs.filter(s => s.status === "active").reduce((sum, s) => sum + (s.amount || 0), 0);
  const activeCount = subs.filter(s => s.status === "active" && s.plan_id !== "free").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="glass rounded-xl p-3 neural-border">
          <p className="text-[10px] text-muted-foreground">Total Revenue</p>
          <p className="text-lg font-bold text-foreground">₹{totalRevenue.toLocaleString()}</p>
        </div>
        <div className="glass rounded-xl p-3 neural-border">
          <p className="text-[10px] text-muted-foreground">Active Paid Subs</p>
          <p className="text-lg font-bold text-foreground">{activeCount}</p>
        </div>
        <div className="glass rounded-xl p-3 neural-border">
          <p className="text-[10px] text-muted-foreground">Total Transactions</p>
          <p className="text-lg font-bold text-foreground">{subs.length}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by user ID, order ID, payment ID..." className="w-full pl-10 pr-4 py-2.5 bg-secondary rounded-lg text-sm text-foreground placeholder:text-muted-foreground border border-border focus:border-primary outline-none" />
        </div>
        <div className="flex gap-1.5">
          {(["all", "active", "expired", "cancelled"] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors capitalize ${statusFilter === s ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="glass rounded-xl p-3 neural-border flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <p className="text-sm font-medium text-foreground shrink-0">
                <span className="bg-primary/15 text-primary px-2 py-0.5 rounded-full text-xs font-bold mr-2">{selectedIds.size}</span>
                selected
              </p>
              <div className="flex gap-1.5 flex-wrap flex-1">
                <button onClick={() => setBulkAction("cancel")} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors flex items-center gap-1">
                  <Ban className="w-3 h-3" /> Cancel All
                </button>
                <button onClick={() => { setBulkAction("extend"); setExtendDays("30"); }} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-success/10 text-success hover:bg-success/20 transition-colors flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Extend All
                </button>
                <button onClick={() => { setBulkAction("change_plan"); setSelectedPlanId(""); }} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Change Plan
                </button>
              </div>
              <button onClick={() => setSelectedIds(new Set())} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Clear</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {/* Select all header */}
          {filtered.length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <button onClick={selectAll} className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${selectedIds.size === filtered.length && filtered.length > 0 ? "bg-primary border-primary" : "border-border hover:border-muted-foreground"}`}>
                {selectedIds.size === filtered.length && filtered.length > 0 && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
              </button>
              <p className="text-[10px] text-muted-foreground">Select all ({filtered.length})</p>
            </div>
          )}
          {filtered.map(s => (
            <div key={s.id} className={`glass rounded-xl p-3 neural-border flex items-center gap-3 transition-colors ${selectedIds.has(s.id) ? "ring-1 ring-primary/50 bg-primary/5" : ""}`}>
              <button onClick={() => toggleSelect(s.id)} className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${selectedIds.has(s.id) ? "bg-primary border-primary" : "border-border hover:border-muted-foreground"}`}>
                {selectedIds.has(s.id) && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
              </button>
              <CreditCard className={`w-4 h-4 shrink-0 ${s.status === "active" ? "text-success" : s.status === "expired" ? "text-warning" : "text-muted-foreground"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-foreground">{s.plan_id}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${s.status === "active" ? "bg-success/15 text-success" : s.status === "expired" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"}`}>{s.status}</span>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">
                  ₹{s.amount || 0} · User: {s.user_id.slice(0, 8)}...
                  {s.razorpay_payment_id && ` · Pay: ${s.razorpay_payment_id.slice(0, 12)}...`}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(s.created_at).toLocaleString()}
                  {s.expires_at && ` · Expires: ${new Date(s.expires_at).toLocaleDateString()}`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {s.status === "active" && (
                  <button onClick={() => { setActionTarget(s); setActionType("cancel"); }} className="p-1.5 hover:bg-destructive/15 rounded-lg transition-colors" title="Cancel subscription">
                    <Ban className="w-3.5 h-3.5 text-destructive" />
                  </button>
                )}
                <button onClick={() => { setActionTarget(s); setActionType("extend"); setExtendDays("30"); }} className="p-1.5 hover:bg-success/15 rounded-lg transition-colors" title="Extend subscription">
                  <Clock className="w-3.5 h-3.5 text-success" />
                </button>
                <button onClick={() => { setActionTarget(s); setActionType("change_plan"); setSelectedPlanId(""); }} className="p-1.5 hover:bg-primary/15 rounded-lg transition-colors" title="Change plan">
                  <RefreshCw className="w-3.5 h-3.5 text-primary" />
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No payments found</p>}
        </div>
      )}

      {/* Single Action Modal */}
      <AnimatePresence>
        {actionTarget && actionType && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setActionTarget(null); setActionType(null); }}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-sm glass rounded-2xl neural-border p-5 space-y-4" onClick={e => e.stopPropagation()}>
              {actionType === "cancel" ? (
                <>
                  <div className="flex items-center gap-2"><Ban className="w-5 h-5 text-destructive" /><h3 className="text-lg font-bold text-foreground">Cancel Subscription</h3></div>
                  <div className="glass rounded-lg p-3 neural-border text-sm space-y-1">
                    <p className="text-foreground font-medium">{actionTarget.plan_id} plan</p>
                    <p className="text-[10px] text-muted-foreground">User: {actionTarget.user_id.slice(0, 16)}...</p>
                    {actionTarget.expires_at && <p className="text-[10px] text-muted-foreground">Expires: {new Date(actionTarget.expires_at).toLocaleDateString()}</p>}
                  </div>
                  <p className="text-xs text-muted-foreground">This will immediately set the subscription status to cancelled.</p>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setActionTarget(null); setActionType(null); }} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Back</button>
                    <button onClick={handleCancel} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 transition-colors">
                      {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />} Confirm Cancel
                    </button>
                  </div>
                </>
              ) : actionType === "extend" ? (
                <>
                  <div className="flex items-center gap-2"><Clock className="w-5 h-5 text-success" /><h3 className="text-lg font-bold text-foreground">Extend Subscription</h3></div>
                  <div className="glass rounded-lg p-3 neural-border text-sm space-y-1">
                    <p className="text-foreground font-medium">{actionTarget.plan_id} plan</p>
                    <p className="text-[10px] text-muted-foreground">User: {actionTarget.user_id.slice(0, 16)}...</p>
                    <p className="text-[10px] text-muted-foreground">Current expiry: {actionTarget.expires_at ? new Date(actionTarget.expires_at).toLocaleDateString() : "None"}</p>
                    {actionTarget.status !== "active" && <p className="text-[10px] text-success">Status will be set back to active</p>}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Extend by (days)</label>
                    <div className="flex gap-2">
                      {["7", "15", "30", "90"].map(d => (
                        <button key={d} onClick={() => setExtendDays(d)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${extendDays === d ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>{d}d</button>
                      ))}
                      <input value={extendDays} onChange={e => setExtendDays(e.target.value)} type="number" className="w-16 px-2 py-1.5 bg-secondary rounded-lg text-sm text-foreground border border-border focus:border-primary outline-none text-center" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    New expiry: {(() => { const days = parseInt(extendDays) || 30; const base = actionTarget.expires_at && new Date(actionTarget.expires_at) > new Date() ? new Date(actionTarget.expires_at) : new Date(); base.setDate(base.getDate() + days); return base.toLocaleDateString(); })()}
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setActionTarget(null); setActionType(null); }} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Back</button>
                    <button onClick={handleExtend} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                      {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />} Extend
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2"><RefreshCw className="w-5 h-5 text-primary" /><h3 className="text-lg font-bold text-foreground">Change Plan</h3></div>
                  <div className="glass rounded-lg p-3 neural-border text-sm space-y-1">
                    <p className="text-foreground font-medium">Current: {actionTarget.plan_id}</p>
                    <p className="text-[10px] text-muted-foreground">User: {actionTarget.user_id.slice(0, 16)}...</p>
                    {actionTarget.expires_at && <p className="text-[10px] text-muted-foreground">Expires: {new Date(actionTarget.expires_at).toLocaleDateString()}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Select new plan</label>
                    <div className="space-y-1.5">
                      {availablePlans.filter(p => p.plan_key !== actionTarget.plan_id).map(p => (
                        <button key={p.id} onClick={() => setSelectedPlanId(p.plan_key)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm border transition-colors ${selectedPlanId === p.plan_key ? "border-primary bg-primary/15 text-primary" : "border-border text-foreground hover:bg-secondary"}`}>
                          <div className="text-left"><p className="font-medium">{p.name}</p><p className="text-[10px] text-muted-foreground">₹{p.price}/{p.billing_period}</p></div>
                          {selectedPlanId === p.plan_key && <CheckCircle2 className="w-4 h-4 text-primary" />}
                        </button>
                      ))}
                      {availablePlans.filter(p => p.plan_key !== actionTarget.plan_id).length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No other plans available</p>}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Expiry date remains unchanged.</p>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setActionTarget(null); setActionType(null); }} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Back</button>
                    <button onClick={handleChangePlan} disabled={actionLoading || !selectedPlanId} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                      {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />} Change Plan
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Action Modal */}
      <AnimatePresence>
        {bulkAction && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setBulkAction(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-sm glass rounded-2xl neural-border p-5 space-y-4" onClick={e => e.stopPropagation()}>
              {bulkAction === "cancel" ? (
                <>
                  <div className="flex items-center gap-2"><Ban className="w-5 h-5 text-destructive" /><h3 className="text-lg font-bold text-foreground">Bulk Cancel</h3></div>
                  <div className="glass rounded-lg p-3 neural-border">
                    <p className="text-sm text-foreground font-medium">{selectedIds.size} subscription{selectedIds.size > 1 ? "s" : ""} will be cancelled</p>
                    <p className="text-[10px] text-muted-foreground mt-1">This will immediately cancel all selected subscriptions. Users will lose access to premium features.</p>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setBulkAction(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Back</button>
                    <button onClick={handleBulkAction} disabled={bulkLoading} className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 transition-colors">
                      {bulkLoading && <Loader2 className="w-4 h-4 animate-spin" />} Cancel {selectedIds.size} Subs
                    </button>
                  </div>
                </>
              ) : bulkAction === "extend" ? (
                <>
                  <div className="flex items-center gap-2"><Clock className="w-5 h-5 text-success" /><h3 className="text-lg font-bold text-foreground">Bulk Extend</h3></div>
                  <div className="glass rounded-lg p-3 neural-border">
                    <p className="text-sm text-foreground font-medium">{selectedIds.size} subscription{selectedIds.size > 1 ? "s" : ""} will be extended</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Extend each by (days)</label>
                    <div className="flex gap-2">
                      {["7", "15", "30", "90"].map(d => (
                        <button key={d} onClick={() => setExtendDays(d)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${extendDays === d ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>{d}d</button>
                      ))}
                      <input value={extendDays} onChange={e => setExtendDays(e.target.value)} type="number" className="w-16 px-2 py-1.5 bg-secondary rounded-lg text-sm text-foreground border border-border focus:border-primary outline-none text-center" />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setBulkAction(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Back</button>
                    <button onClick={handleBulkAction} disabled={bulkLoading} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                      {bulkLoading && <Loader2 className="w-4 h-4 animate-spin" />} Extend {selectedIds.size} Subs
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2"><RefreshCw className="w-5 h-5 text-primary" /><h3 className="text-lg font-bold text-foreground">Bulk Change Plan</h3></div>
                  <div className="glass rounded-lg p-3 neural-border">
                    <p className="text-sm text-foreground font-medium">{selectedIds.size} subscription{selectedIds.size > 1 ? "s" : ""} will be changed</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Select new plan for all</label>
                    <div className="space-y-1.5">
                      {availablePlans.map(p => (
                        <button key={p.id} onClick={() => setSelectedPlanId(p.plan_key)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm border transition-colors ${selectedPlanId === p.plan_key ? "border-primary bg-primary/15 text-primary" : "border-border text-foreground hover:bg-secondary"}`}>
                          <div className="text-left"><p className="font-medium">{p.name}</p><p className="text-[10px] text-muted-foreground">₹{p.price}/{p.billing_period}</p></div>
                          {selectedPlanId === p.plan_key && <CheckCircle2 className="w-4 h-4 text-primary" />}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setBulkAction(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Back</button>
                    <button onClick={handleBulkAction} disabled={bulkLoading || !selectedPlanId} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                      {bulkLoading && <Loader2 className="w-4 h-4 animate-spin" />} Change {selectedIds.size} Subs
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Notifications (moved to AdminNotificationCenter component) ───

// ─── Admin Roles ───
const AdminsSection = ({ isSuperAdmin, refetchRoles, toast }: { isSuperAdmin: boolean; refetchRoles: () => Promise<void>; toast: any }) => {
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("admin");
  const [adding, setAdding] = useState(false);

  const fetchAdmins = useCallback(async () => {
    const { data } = await supabase.from("user_roles").select("*").order("created_at", { ascending: false });
    setAdmins(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  const addAdmin = async () => {
    if (!newEmail.trim()) return;
    setAdding(true);
    try {
      // Look up user by email from profiles — we can't query auth.users directly
      // Instead, we look up all profiles and match. For a real system you'd use an edge function.
      // For now, we'll let the super admin paste a user_id
      const userId = newEmail.trim();
      await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
      await supabase.from("admin_audit_logs").insert({ admin_id: userId, action: "role_assigned", target_type: "user_roles", target_id: userId, details: { role: newRole } });
      toast({ title: "✅ Role assigned" });
      setNewEmail("");
      fetchAdmins();
      refetchRoles();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const removeAdmin = async (id: string) => {
    await supabase.from("user_roles").delete().eq("id", id);
    toast({ title: "Role removed" });
    fetchAdmins();
    refetchRoles();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-foreground">Admin Role Management</h2>
      {isSuperAdmin && (
        <div className="glass rounded-xl p-4 neural-border space-y-3">
          <p className="text-sm font-medium text-foreground">Add Admin Role</p>
          <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="User ID..." className="w-full px-3 py-2.5 bg-secondary rounded-lg text-sm text-foreground placeholder:text-muted-foreground border border-border focus:border-primary outline-none" />
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(ROLE_LABELS) as AppRole[]).map(r => (
              <button key={r} onClick={() => setNewRole(r)} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${newRole === r ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
          <button onClick={addAdmin} disabled={!newEmail.trim() || adding} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Assign Role
          </button>
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {admins.map(a => (
            <div key={a.id} className="glass rounded-xl p-3 neural-border flex items-center gap-3">
              <Shield className="w-4 h-4 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{a.user_id}</p>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[a.role as AppRole] || "bg-muted text-muted-foreground"}`}>
                  {ROLE_LABELS[a.role as AppRole] || a.role}
                </span>
              </div>
              {isSuperAdmin && (
                <button onClick={() => removeAdmin(a.id)} className="p-1.5 hover:bg-destructive/15 rounded-lg transition-colors">
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              )}
            </div>
          ))}
          {admins.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No admin roles assigned</p>}
        </div>
      )}

      {/* Permission Matrix */}
      {isSuperAdmin && (
        <div className="mt-8 pt-6 border-t border-border">
          <PermissionManagement />
        </div>
      )}
    </div>
  );
};

// ─── Audit Logs ───
const AuditSection = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("admin_audit_logs").select("*").order("created_at", { ascending: false }).limit(50);
      setLogs(data || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-foreground">Audit Logs</h2>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {logs.map(l => (
            <div key={l.id} className="glass rounded-xl p-3 neural-border flex items-center gap-3">
              <ScrollText className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{l.action}</p>
                <p className="text-[10px] text-muted-foreground">{l.target_type} · {l.target_id || "N/A"}</p>
              </div>
              <span className="text-[10px] text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span>
            </div>
          ))}
          {logs.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No audit logs yet</p>}
        </div>
      )}
    </div>
  );
};

// ─── Settings (Feature Flags) ───
const TAB_GROUPS = [
  { key: "tab_home", label: "Home Tab", icon: Home, prefix: "home_" },
  { key: "tab_action", label: "Action Tab", icon: Zap, prefix: "action_" },
  { key: "tab_brain", label: "Brain Tab", icon: Brain, prefix: "brain_" },
  { key: "tab_community", label: "Community Tab", icon: Users, prefix: "community_" },
  { key: "tab_progress", label: "Progress Tab", icon: TrendingUp, prefix: "progress_" },
  { key: "tab_you", label: "You Tab", icon: User, prefix: "you_" },
];

const SettingsSection = ({ toast }: { toast: any }) => {
  const [flags, setFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTab, setExpandedTab] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [importDiff, setImportDiff] = useState<{ flag_key: string; label: string; from: boolean; to: boolean }[] | null>(null);
  const [pendingImport, setPendingImport] = useState<{ flag_key: string; enabled: boolean }[] | null>(null);
  const [lastToggle, setLastToggle] = useState<{ key: string; previousEnabled: boolean } | null>(null);
  const [changelog, setChangelog] = useState<any[]>([]);
  const [showChangelog, setShowChangelog] = useState(false);
  const [changelogHasMore, setChangelogHasMore] = useState(true);
  const [changelogFilter, setChangelogFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [changelogLoading, setChangelogLoading] = useState(false);
  const CHANGELOG_PAGE_SIZE = 20;
  const nameMapRef = useRef(new Map<string, string>());

  const fetchChangelog = useCallback(async (offset = 0, append = false) => {
    setChangelogLoading(true);
    const { data } = await supabase
      .from("admin_audit_logs")
      .select("*")
      .eq("target_type", "feature_flags")
      .order("created_at", { ascending: false })
      .range(offset, offset + CHANGELOG_PAGE_SIZE - 1);
    if (!data) { setChangelogLoading(false); return; }
    // Fetch any new admin names
    const newIds = data.map(d => d.admin_id).filter(id => !nameMapRef.current.has(id));
    if (newIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", [...new Set(newIds)]);
      (profiles || []).forEach(p => nameMapRef.current.set(p.id, p.display_name || "Admin"));
    }
    const mapped = data.map(d => ({ ...d, admin_name: nameMapRef.current.get(d.admin_id) || "Unknown" }));
    setChangelog(prev => append ? [...prev, ...mapped] : mapped);
    setChangelogHasMore(data.length === CHANGELOG_PAGE_SIZE);
    setChangelogLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("feature_flags").select("*").order("flag_key");
      setFlags((data as any[]) || []);
      setLoading(false);
    })();
  }, []);

  // Ctrl+Z undo last toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && lastToggle) {
        e.preventDefault();
        toggleFlag(lastToggle.key, lastToggle.previousEnabled, true);
        setLastToggle(null);
        toast({ title: "↩️ Last toggle undone" });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lastToggle]);

  const toggleFlag = async (key: string, enabled: boolean, isUndo = false) => {
    if (!isUndo) {
      const prev = flags.find(f => f.flag_key === key);
      if (prev) setLastToggle({ key, previousEnabled: prev.enabled });
    }
    await supabase
      .from("feature_flags")
      .update({ enabled, updated_at: new Date().toISOString() } as any)
      .eq("flag_key", key);
    setFlags(prev => prev.map(f => f.flag_key === key ? { ...f, enabled } : f));
    await supabase.from("admin_audit_logs").insert({
      admin_id: (await supabase.auth.getUser()).data.user?.id,
      action: enabled ? "feature_enabled" : "feature_disabled",
      target_type: "feature_flags",
      target_id: key,
      details: { flag_key: key, enabled },
    } as any);
    if (!isUndo) toast({ title: enabled ? "✅ Enabled" : "🚫 Disabled", description: (flags.find(f => f.flag_key === key)?.label || key) });
    if (showChangelog) fetchChangelog();
  };

  // Bulk toggle all section flags under a tab
  const toggleAllSections = async (prefix: string, enabled: boolean) => {
    const sectionFlags = flags.filter(f => f.flag_key.startsWith(prefix));
    for (const f of sectionFlags) {
      await supabase.from("feature_flags").update({ enabled, updated_at: new Date().toISOString() } as any).eq("flag_key", f.flag_key);
    }
    setFlags(prev => prev.map(f => f.flag_key.startsWith(prefix) ? { ...f, enabled } : f));
    toast({ title: enabled ? "✅ All sections enabled" : "🚫 All sections disabled" });
  };

  const resetAllFlags = async () => {
    const disabledFlags = flags.filter(f => !f.enabled);
    if (disabledFlags.length === 0) {
      toast({ title: "All flags are already enabled" });
      return;
    }
    const previousStates = disabledFlags.map(f => ({ key: f.flag_key, enabled: f.enabled }));
    for (const f of disabledFlags) {
      await supabase.from("feature_flags").update({ enabled: true, updated_at: new Date().toISOString() } as any).eq("flag_key", f.flag_key);
    }
    setFlags(prev => prev.map(f => ({ ...f, enabled: true })));

    const undoReset = async () => {
      for (const s of previousStates) {
        await supabase.from("feature_flags").update({ enabled: s.enabled, updated_at: new Date().toISOString() } as any).eq("flag_key", s.key);
      }
      setFlags(prev => prev.map(f => {
        const prev_state = previousStates.find(s => s.key === f.flag_key);
        return prev_state ? { ...f, enabled: prev_state.enabled } : f;
      }));
      toast({ title: "↩️ Reset undone" });
    };

    toast({
      title: "✅ All flags reset to enabled",
      description: `${disabledFlags.length} flag(s) were enabled`,
      action: (
        <ToastAction altText="Undo reset" onClick={undoReset} className="text-xs font-semibold text-primary hover:text-primary/80 underline underline-offset-2 border-0">
          Undo
        </ToastAction>
      ),
      duration: 6000,
    });
  };

  const exportFlags = () => {
    const config = {
      exported_at: new Date().toISOString(),
      total: flags.length,
      enabled: flags.filter(f => f.enabled).length,
      disabled: flags.filter(f => !f.enabled).length,
      flags: flags.map(f => ({ flag_key: f.flag_key, enabled: f.enabled })),
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `feature-flags-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "📦 Flags exported" });
  };

  const importFlags = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const imported: { flag_key: string; enabled: boolean }[] = Array.isArray(parsed) ? parsed : parsed?.flags;
        if (!Array.isArray(imported) || !imported.every(f => typeof f.flag_key === "string" && typeof f.enabled === "boolean")) {
          toast({ title: "❌ Invalid file format", description: "Expected { flags: [...] } or an array of { flag_key, enabled }" });
          return;
        }
        const changes = imported
          .map(item => {
            const existing = flags.find(f => f.flag_key === item.flag_key);
            if (existing && existing.enabled !== item.enabled) {
              return { flag_key: item.flag_key, label: existing.label || item.flag_key, from: existing.enabled, to: item.enabled };
            }
            return null;
          })
          .filter(Boolean) as { flag_key: string; label: string; from: boolean; to: boolean }[];
        if (changes.length === 0) {
          toast({ title: "No changes", description: "All flags already match the imported file" });
          return;
        }
        setImportDiff(changes);
        setPendingImport(imported);
      } catch {
        toast({ title: "❌ Failed to parse file" });
      }
    };
    input.click();
  };

  const applyImport = async () => {
    if (!pendingImport || !importDiff) return;
    for (const change of importDiff) {
      await supabase.from("feature_flags").update({ enabled: change.to, updated_at: new Date().toISOString() } as any).eq("flag_key", change.flag_key);
    }
    setFlags(prev => prev.map(f => {
      const match = pendingImport.find(i => i.flag_key === f.flag_key);
      return match ? { ...f, enabled: match.enabled } : f;
    }));
    toast({ title: "📥 Flags imported", description: `${importDiff.length} flag(s) updated` });
    setImportDiff(null);
    setPendingImport(null);
  };

  const cancelImport = () => {
    setImportDiff(null);
    setPendingImport(null);
  };

  const query = searchQuery.toLowerCase().trim();

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">App Section Controls</h2>
        {!loading && (
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary px-2.5 py-1 font-medium">
              {flags.filter(f => f.enabled).length} enabled
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2.5 py-1 font-medium">
              {flags.filter(f => !f.enabled).length} disabled
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Enable or disable tabs and their individual sections for all users.</p>
        {!loading && flags.some(f => !f.enabled) && (
          <AnimatePresence mode="wait">
            {confirmReset ? (
              <motion.div key="confirm" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex items-center gap-2">
                <span className="text-xs text-destructive font-medium">Reset all?</span>
                <button onClick={() => { resetAllFlags(); setConfirmReset(false); }} className="text-xs font-semibold text-destructive hover:text-destructive/80 transition-colors">Yes</button>
                <button onClick={() => setConfirmReset(false)} className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              </motion.div>
            ) : (
              <motion.button key="trigger" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setConfirmReset(true)}
                className="shrink-0 text-xs font-medium text-primary hover:text-primary/80 transition-colors underline underline-offset-2"
              >
                Reset all
              </motion.button>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search flags..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full rounded-xl bg-secondary border border-border pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <XCircle className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground/60">{"💡 Press "}<kbd className="px-1 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-mono">Ctrl+Z</kbd>{" to undo last toggle"}</p>
        {!loading && (
          <div className="flex items-center gap-1.5">
            <button onClick={exportFlags} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              <Download className="w-3 h-3" /> Export
            </button>
            <span className="text-muted-foreground/40">|</span>
            <button onClick={importFlags} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              <Upload className="w-3 h-3" /> Import
            </button>
          </div>
        )}
      </div>

      {/* Import diff preview */}
      <AnimatePresence>
        {importDiff && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="glass rounded-xl neural-border p-4 space-y-3 overflow-hidden"
          >
            <p className="text-sm font-semibold text-foreground">Review changes ({importDiff.length})</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {importDiff.map(d => (
                <div key={d.flag_key} className="flex items-center justify-between text-xs py-1">
                  <span className="text-foreground truncate mr-2">{d.label}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`px-1.5 py-0.5 rounded-full font-medium ${d.from ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {d.from ? "ON" : "OFF"}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className={`px-1.5 py-0.5 rounded-full font-medium ${d.to ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {d.to ? "ON" : "OFF"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button onClick={applyImport} className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                Apply {importDiff.length} change{importDiff.length > 1 ? "s" : ""}
              </button>
              <button onClick={cancelImport} className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : query ? (
        /* Flat search results */
        <div className="space-y-2">
          {(() => {
            const matched = flags.filter(f =>
              (f.label || f.flag_key).toLowerCase().includes(query) || f.flag_key.toLowerCase().includes(query)
            );
            if (matched.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">No flags matching "{searchQuery}"</p>;
            return matched.map(flag => (
              <div key={flag.id} className="glass rounded-xl neural-border p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-foreground">{flag.label || flag.flag_key}</p>
                  <p className="text-[9px] text-muted-foreground">{flag.flag_key} · {flag.enabled ? "Visible" : "Hidden"}</p>
                </div>
                <button
                  onClick={() => toggleFlag(flag.flag_key, !flag.enabled)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${flag.enabled ? "bg-primary" : "bg-muted"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${flag.enabled ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>
            ));
          })()}
        </div>
      ) : (
        <div className="space-y-3">
          {TAB_GROUPS.map(group => {
            const tabFlag = flags.find(f => f.flag_key === group.key);
            const sectionFlags = flags.filter(f => f.flag_key.startsWith(group.prefix));
            const isExpanded = expandedTab === group.key;
            const enabledCount = sectionFlags.filter(f => f.enabled).length;

            return (
              <div key={group.key} className="glass rounded-xl neural-border overflow-hidden">
                {/* Tab-level toggle */}
                <div className="p-4 flex items-center gap-3">
                  <group.icon className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{group.label}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {tabFlag?.enabled ? `${enabledCount}/${sectionFlags.length} sections active` : "Tab disabled"}
                    </p>
                  </div>
                  {tabFlag && (
                    <button
                      onClick={() => toggleFlag(tabFlag.flag_key, !tabFlag.enabled)}
                      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${tabFlag.enabled ? "bg-primary" : "bg-muted"}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${tabFlag.enabled ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedTab(isExpanded ? null : group.key)}
                    className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                  >
                    <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </motion.div>
                  </button>
                </div>

                {/* Section-level toggles */}
                <AnimatePresence>
                  {isExpanded && sectionFlags.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border px-4 pb-3 pt-2 space-y-2">
                        {/* Bulk actions */}
                        <div className="flex gap-2 mb-2">
                          <button
                            onClick={() => toggleAllSections(group.prefix, true)}
                            className="text-[10px] text-primary font-medium px-2 py-1 rounded-md hover:bg-primary/10 transition-colors"
                          >
                            Enable All
                          </button>
                          <button
                            onClick={() => toggleAllSections(group.prefix, false)}
                            className="text-[10px] text-destructive font-medium px-2 py-1 rounded-md hover:bg-destructive/10 transition-colors"
                          >
                            Disable All
                          </button>
                        </div>
                        {sectionFlags.map(flag => (
                          <div key={flag.id} className="flex items-center justify-between py-1.5">
                            <div>
                              <p className="text-xs font-medium text-foreground">{flag.label || flag.flag_key}</p>
                              <p className="text-[9px] text-muted-foreground">
                                {flag.enabled ? "Visible" : "Hidden"}
                              </p>
                            </div>
                            <button
                              onClick={() => toggleFlag(flag.flag_key, !flag.enabled)}
                              className={`relative w-9 h-5 rounded-full transition-colors ${flag.enabled ? "bg-primary" : "bg-muted"}`}
                            >
                              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${flag.enabled ? "translate-x-4" : "translate-x-0"}`} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* Changelog */}
      <div className="pt-2">
        <button
          onClick={() => { setShowChangelog(!showChangelog); if (!showChangelog && changelog.length === 0) fetchChangelog(); }}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ScrollText className="w-3.5 h-3.5" />
          {showChangelog ? "Hide changelog" : "Show changelog"}
        </button>
        <AnimatePresence>
          {showChangelog && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mt-2 space-y-2"
            >
              {/* Filter */}
              <div className="flex flex-wrap items-center gap-1.5">
                {(["all", "enabled", "disabled"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setChangelogFilter(f)}
                    className={`text-[10px] px-2 py-1 rounded-full font-medium transition-colors ${changelogFilter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                  >
                    {f === "all" ? "All" : f === "enabled" ? "Enabled" : "Disabled"}
                  </button>
                ))}
                <span className="text-muted-foreground/30">|</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className={cn("inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-medium transition-colors", dateFrom ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground hover:text-foreground")}>
                      <CalendarIcon className="w-3 h-3" />
                      {dateFrom ? format(dateFrom, "MMM d") : "From"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className={cn("inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-medium transition-colors", dateTo ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground hover:text-foreground")}>
                      <CalendarIcon className="w-3 h-3" />
                      {dateTo ? format(dateTo, "MMM d") : "To"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
                {(dateFrom || dateTo) && (
                  <button onClick={() => { setDateFrom(undefined); setDateTo(undefined); }} className="text-[10px] text-muted-foreground hover:text-foreground">
                    <XCircle className="w-3 h-3" />
                  </button>
                )}
              </div>
              {changelog.length === 0 && !changelogLoading ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No changes recorded yet</p>
              ) : (
                <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                  {changelog.filter(log => {
                    if (changelogFilter !== "all") {
                      if (changelogFilter === "enabled" && log.action !== "feature_enabled") return false;
                      if (changelogFilter === "disabled" && log.action !== "feature_disabled") return false;
                    }
                    const logDate = new Date(log.created_at);
                    if (dateFrom) { const start = new Date(dateFrom); start.setHours(0,0,0,0); if (logDate < start) return false; }
                    if (dateTo) { const end = new Date(dateTo); end.setHours(23,59,59,999); if (logDate > end) return false; }
                    return true;
                  }).map(log => {
                    const isEnabled = log.action === "feature_enabled";
                    const flagLabel = (log.details as any)?.flag_key || log.target_id || "unknown";
                    const time = new Date(log.created_at);
                    const timeStr = time.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " + time.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
                    return (
                      <div key={log.id} className="flex items-start gap-2 py-1.5 border-b border-border/50 last:border-0">
                        <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${isEnabled ? "bg-primary" : "bg-muted-foreground"}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-foreground">
                            <span className="font-medium">{log.admin_name}</span>
                            {" "}
                            <span className={isEnabled ? "text-primary" : "text-muted-foreground"}>
                              {isEnabled ? "enabled" : "disabled"}
                            </span>
                            {" "}
                            <span className="font-mono text-muted-foreground">{flagLabel}</span>
                          </p>
                          <p className="text-[9px] text-muted-foreground">{timeStr}</p>
                        </div>
                      </div>
                    );
                  })}
                  {changelogLoading && (
                    <div className="flex justify-center py-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {!changelogLoading && changelogHasMore && changelog.length > 0 && (
                    <button
                      onClick={() => fetchChangelog(changelog.length, true)}
                      className="w-full text-center text-[11px] text-primary hover:text-primary/80 py-2 transition-colors"
                    >
                      Load more
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AdminPanel;
