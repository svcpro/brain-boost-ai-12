// Client helper to fire Meta CAPI events server-side.
import { supabase } from "@/integrations/supabase/client";

export type MetaCapiUserData = {
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  city?: string;
  country?: string;
  external_id?: string;
  fbc?: string;
  fbp?: string;
  client_user_agent?: string;
};

export type MetaCapiPayload = {
  event_name: string;
  event_id?: string;
  event_source_url?: string;
  user_data?: MetaCapiUserData;
  custom_data?: Record<string, unknown>;
  user_id?: string | null;
};

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : undefined;
}

export async function trackMetaEvent(p: MetaCapiPayload): Promise<void> {
  try {
    const enriched: MetaCapiPayload = {
      ...p,
      event_source_url: p.event_source_url ?? (typeof window !== "undefined" ? `https://acry.ai${window.location.pathname}${window.location.search}` : "https://acry.ai"),
      user_data: {
        client_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        fbc: getCookie("_fbc"),
        fbp: getCookie("_fbp"),
        ...p.user_data,
      },
    };
    // Fire and forget
    void supabase.functions.invoke("meta-capi-track", { body: enriched });
  } catch {
    /* swallow */
  }
}
