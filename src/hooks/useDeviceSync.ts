import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

function getDeviceId(): string {
  let id = localStorage.getItem("acry-device-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("acry-device-id", id);
  }
  return id;
}

function getDeviceType(): string {
  const w = window.innerWidth;
  if (w < 768) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown";
}

interface DeviceSession {
  id: string;
  device_id: string;
  device_name: string | null;
  device_type: string;
  last_active_at: string;
  is_current: boolean;
}

export function useDeviceSync() {
  const { user } = useAuth();
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const deviceId = getDeviceId();

  const registerDevice = useCallback(async () => {
    if (!user) return;
    await supabase.from("device_sessions").upsert({
      user_id: user.id,
      device_id: deviceId,
      device_name: getDeviceName(),
      device_type: getDeviceType(),
      last_active_at: new Date().toISOString(),
      is_current: true,
      user_agent: navigator.userAgent.slice(0, 200),
    }, { onConflict: "user_id,device_id" });
  }, [user, deviceId]);

  const loadDevices = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("device_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("last_active_at", { ascending: false });
    
    if (data) {
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;
      setDevices(data.map((d: any) => ({
        ...d,
        is_current: d.device_id === deviceId,
        _isOnline: new Date(d.last_active_at).getTime() > fiveMinAgo,
      })));
    }
  }, [user, deviceId]);

  const removeDevice = useCallback(async (targetDeviceId: string) => {
    if (!user) return;
    await supabase.from("device_sessions").delete()
      .eq("user_id", user.id)
      .eq("device_id", targetDeviceId);
    loadDevices();
  }, [user, loadDevices]);

  useEffect(() => {
    if (!user) return;
    registerDevice();
    loadDevices();

    // Heartbeat every 2 minutes
    intervalRef.current = setInterval(() => {
      registerDevice();
    }, 2 * 60 * 1000);

    // Realtime subscription for other device changes
    const channel = supabase
      .channel("device-sync")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "device_sessions",
        filter: `user_id=eq.${user.id}`,
      }, () => loadDevices())
      .subscribe();

    return () => {
      clearInterval(intervalRef.current);
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    devices,
    currentDeviceId: deviceId,
    removeDevice,
    activeCount: devices.filter((d: any) => {
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;
      return new Date(d.last_active_at).getTime() > fiveMinAgo;
    }).length,
  };
}
