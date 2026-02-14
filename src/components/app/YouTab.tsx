import { motion } from "framer-motion";
import { User, Flame, Crown, Settings, Database, Shield, ChevronRight, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const YouTab = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const menuItems = [
    { icon: Crown, label: "Subscription Plan", value: "Free Brain" },
    { icon: Settings, label: "Settings", value: "" },
    { icon: Database, label: "Data Backup", value: "" },
    { icon: Shield, label: "Privacy & Security", value: "" },
  ];

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6 neural-border text-center"
      >
        <div className="w-20 h-20 rounded-full neural-gradient neural-border flex items-center justify-center mx-auto mb-4">
          <User className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">
          {user?.user_metadata?.display_name || "Student"}
        </h2>
        <p className="text-sm text-muted-foreground">{user?.email}</p>

        {/* Streak */}
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full neural-gradient neural-border">
          <Flame className="w-4 h-4 text-warning" />
          <span className="text-sm font-semibold text-foreground">7 Day Streak</span>
          <span className="text-xl">🔥</span>
        </div>
      </motion.div>

      {/* Brain Level */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-xl p-5 neural-border"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-foreground">Brain Level</span>
          <span className="text-xs text-primary font-medium">Level 4</span>
        </div>
        <div className="h-2 rounded-full bg-secondary mb-2">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-success"
            initial={{ width: 0 }}
            animate={{ width: "62%" }}
            transition={{ duration: 1 }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">620 / 1000 XP to Level 5</p>
      </motion.div>

      {/* Menu Items */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-1"
      >
        {menuItems.map((item, i) => (
          <button
            key={i}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-secondary/30 transition-all"
          >
            <item.icon className="w-5 h-5 text-muted-foreground" />
            <span className="flex-1 text-left text-sm text-foreground">{item.label}</span>
            {item.value && (
              <span className="text-xs text-muted-foreground">{item.value}</span>
            )}
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        ))}

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-destructive/10 transition-all"
        >
          <LogOut className="w-5 h-5 text-destructive" />
          <span className="flex-1 text-left text-sm text-destructive">Sign Out</span>
        </button>
      </motion.div>
    </div>
  );
};

export default YouTab;
