import { motion } from "framer-motion";
import { Bell, BellOff } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useToast } from "@/hooks/use-toast";

const PushNotificationToggle = () => {
  const { permission, subscribed, supported, error, subscribe, unsubscribe } = usePushNotifications();
  const { toast } = useToast();

  if (!supported) return null;

  const handleToggle = async () => {
    if (subscribed) {
      await unsubscribe();
      toast({ title: "Push notifications disabled" });
    } else {
      const ok = await subscribe();
      if (ok) {
        toast({ title: "🔔 Push notifications enabled!", description: "You'll be notified about freeze gifts and more." });
      } else if (permission === "denied") {
        toast({ title: "Notifications blocked", description: "Please enable notifications in your browser settings.", variant: "destructive" });
      } else if (error) {
        toast({ title: "Could not enable notifications", description: error, variant: "destructive" });
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
          {subscribed ? (
            <Bell className="w-4 h-4 text-primary" />
          ) : (
            <BellOff className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Push Notifications</p>
          <p className="text-[10px] text-muted-foreground">
            {subscribed ? "You'll receive alerts for gifts, streaks & more" : "Get notified about freeze gifts and milestones"}
          </p>
        </div>
        <button
          onClick={handleToggle}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            subscribed
              ? "bg-secondary text-foreground hover:bg-secondary/80"
              : "bg-primary/10 text-primary hover:bg-primary/20"
          }`}
        >
          {subscribed ? "Disable" : "Enable"}
        </button>
      </div>
    </motion.div>
  );
};

export default PushNotificationToggle;
