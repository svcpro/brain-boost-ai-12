import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Globe, GitBranch, Fingerprint, Users, Activity,
  IndianRupee, HeartPulse, FlaskConical, Database, Brain, Cpu, Swords
} from "lucide-react";
import AgentControlCenter from "./ai-command/AgentControlCenter";
import GlobalBrainDashboard from "./ai-command/GlobalBrainDashboard";
import AIModelManagement from "./AIModelManagement";
import PersonalizationEngine from "./ai-command/PersonalizationEngine";
import CollectiveIntelDashboard from "./ai-command/CollectiveIntelDashboard";
import RealTimeActivityStream from "./ai-command/RealTimeActivityStream";
import AICostMonitoring from "./ai-command/AICostMonitoring";
import SystemHealthMonitor from "./ai-command/SystemHealthMonitor";
import AISimulationLab from "./ai-command/AISimulationLab";
import TrainingDataControl from "./ai-command/TrainingDataControl";
import CognitiveProfileViewer from "./ai-command/CognitiveProfileViewer";
import CompetitiveIntelAdmin from "./ai-command/CompetitiveIntelAdmin";

type CommandTab =
  | "agents"
  | "brain"
  | "models"
  | "personalization"
  | "cognitive"
  | "competitive"
  | "collective"
  | "activity"
  | "costs"
  | "health"
  | "simulation"
  | "training";

const TABS: { key: CommandTab; label: string; icon: any; color: string }[] = [
  { key: "agents", label: "Agent Control", icon: Bot, color: "text-primary" },
  { key: "brain", label: "Global Brain", icon: Brain, color: "text-accent" },
  { key: "models", label: "Model Versions", icon: GitBranch, color: "text-success" },
  { key: "cognitive", label: "Cognitive v2.0", icon: Cpu, color: "text-blue-400" },
  { key: "competitive", label: "Competition v3.0", icon: Swords, color: "text-orange-400" },
  { key: "personalization", label: "Personalization", icon: Fingerprint, color: "text-warning" },
  { key: "collective", label: "Collective Intel", icon: Globe, color: "text-primary" },
  { key: "activity", label: "Live Activity", icon: Activity, color: "text-success" },
  { key: "costs", label: "AI Costs", icon: IndianRupee, color: "text-warning" },
  { key: "health", label: "System Health", icon: HeartPulse, color: "text-destructive" },
  { key: "simulation", label: "Simulation Lab", icon: FlaskConical, color: "text-accent" },
  { key: "training", label: "Training Data", icon: Database, color: "text-muted-foreground" },
];

export default function AICommandCenter() {
  const [activeTab, setActiveTab] = useState<CommandTab>("agents");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <Cpu className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">AI Command Center</h2>
          <p className="text-xs text-muted-foreground">Monitor, control, and optimize all AI systems</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.key
                ? "bg-primary/15 text-primary shadow-sm"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
          {activeTab === "agents" && <AgentControlCenter />}
          {activeTab === "brain" && <GlobalBrainDashboard />}
          {activeTab === "models" && <AIModelManagement />}
          {activeTab === "cognitive" && <CognitiveProfileViewer />}
          {activeTab === "competitive" && <CompetitiveIntelAdmin />}
          {activeTab === "personalization" && <PersonalizationEngine />}
          {activeTab === "collective" && <CollectiveIntelDashboard />}
          {activeTab === "activity" && <RealTimeActivityStream />}
          {activeTab === "costs" && <AICostMonitoring />}
          {activeTab === "health" && <SystemHealthMonitor />}
          {activeTab === "simulation" && <AISimulationLab />}
          {activeTab === "training" && <TrainingDataControl />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
