import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function getRazorpayKeys() {
  const keyId = Deno.env.get('RAZORPAY_KEY_ID');
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
  if (!keyId || !keySecret) {
    throw new Error('Razorpay keys not configured');
  }
  return { keyId, keySecret };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    const { keyId: RAZORPAY_KEY_ID, keySecret: RAZORPAY_KEY_SECRET } = getRazorpayKeys();

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { action, plan_id, amount, order_id, payment_id, signature, billing_cycle } = await req.json();

    if (action === 'create_order') {
      if (!amount || typeof amount !== 'number' || amount <= 0 || amount > 100000) {
        throw new Error('Invalid amount');
      }

      const credentials = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
      const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amount * 100,
          currency: 'INR',
          receipt: `sub_${user.id.slice(0, 8)}_${Date.now()}`,
          notes: { plan_id, user_id: user.id, billing_cycle: billing_cycle || 'monthly' },
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error('Razorpay order creation failed');
      }

      adminClient.rpc("increment_api_usage", { p_service_name: "razorpay" }).then(() => {}).catch(() => {});

      return new Response(JSON.stringify({ order: orderData, key_id: RAZORPAY_KEY_ID }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'verify_payment') {
      if (!order_id || !payment_id || !signature) {
        throw new Error('Missing payment verification parameters');
      }

      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(RAZORPAY_KEY_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const data = encoder.encode(`${order_id}|${payment_id}`);
      const sig = await crypto.subtle.sign('HMAC', key, data);
      const generatedSignature = Array.from(new Uint8Array(sig))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      if (generatedSignature !== signature) {
        throw new Error('Payment signature verification failed');
      }

      const cycle = billing_cycle || 'monthly';
      const expiresAt = new Date();
      if (cycle === 'yearly') {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      } else {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      }

      // Cancel any existing active subscriptions for this user
      await adminClient
        .from('user_subscriptions')
        .update({ status: 'superseded' })
        .eq('user_id', user.id)
        .eq('status', 'active');

      await adminClient.from('user_subscriptions').insert({
        user_id: user.id,
        plan_id,
        billing_cycle: cycle,
        razorpay_order_id: order_id,
        razorpay_payment_id: payment_id,
        razorpay_signature: signature,
        status: 'active',
        amount,
        currency: 'INR',
        expires_at: expiresAt.toISOString(),
        is_trial: false,
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Razorpay order error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
