import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find all active subscriptions that have expired
    const now = new Date().toISOString();
    const { data: expired, error } = await adminClient
      .from('user_subscriptions')
      .update({ status: 'expired' })
      .eq('status', 'active')
      .neq('plan_id', 'free')
      .lt('expires_at', now)
      .select('id, user_id, plan_id');

    if (error) throw error;

    console.log(`Downgraded ${expired?.length ?? 0} expired subscriptions`);

    return new Response(JSON.stringify({ 
      success: true, 
      expired_count: expired?.length ?? 0,
      expired_subscriptions: expired ?? [] 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Subscription expiry check error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
