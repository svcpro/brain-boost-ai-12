import { motion } from "framer-motion";
import { Swords, PenTool, Eye, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function DebateEngineWidget() {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-4 cursor-pointer hover:border-primary/30 transition-all group"
      onClick={() => navigate("/debate")}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shrink-0">
          <Swords className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground text-sm">Debate & Writing Lab</h3>
          <p className="text-[10px] text-muted-foreground">AI-powered UPSC answer practice</p>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
      </div>
      <div className="flex gap-2">
        {[
          { icon: PenTool, label: "Practice Writing" },
          { icon: Eye, label: "View Analyses" },
        ].map((item, i) => (
          <span key={i} className="flex items-center gap-1 text-[10px] text-muted-foreground bg-secondary/50 px-2 py-1 rounded-lg">
            <item.icon className="w-3 h-3" /> {item.label}
          </span>
        ))}
      </div>
    </motion.div>
  );
}
