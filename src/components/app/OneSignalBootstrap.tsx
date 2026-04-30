import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { initOneSignal, setOneSignalUser } from "@/lib/onesignal";

const OneSignalBootstrap = () => {
  const { user } = useAuth();
  useEffect(() => {
    initOneSignal().then(ok => {
      if (ok && user) setOneSignalUser(user.id);
    });
  }, [user]);
  return null;
};

export default OneSignalBootstrap;
