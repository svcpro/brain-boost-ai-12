import { motion } from "framer-motion";
import { Bell, BellOff } from "lucide-react";
import { useOneSignal } from "@/hooks/useOneSignal";
import { useToast } from "@/hooks/use-toast";

const PushNotificationToggle = () => {
  const { subscribed, supported, enable, disable } = useOneSignal();
  const { toast } = useToast();

  if (!supported) return null;

  const handleToggle = async () => {
    if (subscribed) {
      await disable();
      toast({ title: "Push notifications disabled" });
    } else {
      const ok = await enable();
      if (ok) {
        toast({ title: "🔔 Push notifications enabled!", description: "You'll get personalized study & exam alerts." });
      } else {
        toast({ title: "Couldn't enable notifications", description: "Allow notifications in your browser settings.", variant: "destructive" });
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-4 neural-border"
    >
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${subscribed ? "bg-primary/10" : "bg-secondary/50"}`}>
          {subscribed ? <Bell className="w-4 h-4 text-primary" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Push Notifications</p>
          <p className="text-[10px] text-muted-foreground">
            {subscribed ? "Smart alerts active across all moments" : "Get notified for streaks, missions, exams & more"}
          </p>
        </div>
        <button
          onClick={handleToggle}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            subscribed ? "bg-secondary text-foreground hover:bg-secondary/80" : "bg-primary/10 text-primary hover:bg-primary/20"
          }`}
        >
          {subscribed ? "Disable" : "Enable"}
        </button>
      </div>
    </motion.div>
  );
};

export default PushNotificationToggle;
