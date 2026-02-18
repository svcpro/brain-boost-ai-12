import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { emitServerEvent } from "../_shared/eventBus.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature, x-razorpay-event-id',
};

async function verifyWebhookSignature(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return computed === signature;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const rawBody = await req.text();
  let eventPayload: any;

  try {
    // Use env var for webhook secret only - no DB lookup for secrets
    const webhookSecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!webhookSecret) throw new Error('Razorpay webhook secret not configured');

    const signature = req.headers.get('x-razorpay-signature') || '';
    if (!signature) {
      console.error('Missing webhook signature');
      return new Response(JSON.stringify({ error: 'Missing signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isValid = await verifyWebhookSignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      console.error('Invalid webhook signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    eventPayload = JSON.parse(rawBody);
    const eventType = eventPayload.event;
    const entity = eventPayload.payload?.payment?.entity || eventPayload.payload?.subscription?.entity || {};

    console.log(`Processing webhook event: ${eventType}`);

    // Log the event
    const logEntry = {
      event_type: eventType,
      payment_id: entity.id || null,
      order_id: entity.order_id || null,
      subscription_id: eventPayload.payload?.subscription?.entity?.id || null,
      status: entity.status || null,
      amount: entity.amount ? Math.round(entity.amount / 100) : null,
      currency: entity.currency || null,
      payload: eventPayload,
      processed: false,
      error_message: null,
    };

    switch (eventType) {
      case 'payment.captured': {
        const orderId = entity.order_id;
        if (orderId) {
          const { data: sub } = await adminClient
            .from('user_subscriptions')
            .select('*')
            .eq('razorpay_order_id', orderId)
            .maybeSingle();

          if (sub) {
            await adminClient.from('user_subscriptions').update({
              status: 'active',
              razorpay_payment_id: entity.id,
            }).eq('id', sub.id);
          }
        }
        logEntry.processed = true;

        // Emit omnichannel event for payment success
        if (sub?.user_id) {
          emitServerEvent("payment_success", sub.user_id, {
            amount: entity.amount ? Math.round(entity.amount / 100) : 0,
            payment_id: entity.id,
          }, { title: "Payment Successful!", body: "Your payment has been confirmed." });
        }
        break;
      }

      case 'payment.failed': {
        const orderId = entity.order_id;
        if (orderId) {
          const { data: sub } = await adminClient
            .from('user_subscriptions')
            .select('*')
            .eq('razorpay_order_id', orderId)
            .maybeSingle();

          if (sub) {
            await adminClient.from('user_subscriptions').update({
              status: 'payment_failed',
            }).eq('id', sub.id);
          }

          if (sub?.user_id) {
            await adminClient.from('notification_history').insert({
              user_id: sub.user_id,
              title: 'Payment Failed',
              body: 'Your payment for subscription could not be processed. Please retry or use a different payment method.',
              type: 'payment_failed',
            });
          }
        }
        logEntry.processed = true;

        // Emit omnichannel event for payment failure
        if (sub?.user_id) {
          emitServerEvent("payment_failure", sub.user_id, {
            order_id: orderId,
          }, { title: "Payment Failed", body: "Your payment could not be processed. Please retry." });
        }
        break;
      }

      case 'payment.authorized': {
        logEntry.processed = true;
        break;
      }

      case 'refund.created':
      case 'refund.processed': {
        const paymentId = eventPayload.payload?.refund?.entity?.payment_id;
        if (paymentId) {
          const { data: sub } = await adminClient
            .from('user_subscriptions')
            .select('*')
            .eq('razorpay_payment_id', paymentId)
            .maybeSingle();

          if (sub) {
            await adminClient.from('user_subscriptions').update({
              status: 'refunded',
            }).eq('id', sub.id);

            if (sub.user_id) {
              await adminClient.from('notification_history').insert({
                user_id: sub.user_id,
                title: 'Refund Processed',
                body: 'Your refund has been processed successfully.',
                type: 'refund',
              });
            }
          }
        }
        logEntry.processed = true;
        break;
      }

      case 'subscription.activated':
      case 'subscription.charged': {
        const subEntity = eventPayload.payload?.subscription?.entity;
        if (subEntity?.notes?.user_id) {
          const userId = subEntity.notes.user_id;
          const planId = subEntity.notes.plan_id || subEntity.plan_id;

          const expiresAt = new Date();
          expiresAt.setMonth(expiresAt.getMonth() + 1);

          const { data: existing } = await adminClient
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existing) {
            const base = existing.expires_at && new Date(existing.expires_at) > new Date()
              ? new Date(existing.expires_at) : new Date();
            base.setMonth(base.getMonth() + 1);
            await adminClient.from('user_subscriptions').update({
              expires_at: base.toISOString(),
              status: 'active',
            }).eq('id', existing.id);
          } else {
            await adminClient.from('user_subscriptions').insert({
              user_id: userId,
              plan_id: planId || 'unknown',
              status: 'active',
              amount: subEntity.amount ? Math.round(subEntity.amount / 100) : 0,
              currency: subEntity.currency || 'INR',
              expires_at: expiresAt.toISOString(),
            });
          }
        }
        logEntry.processed = true;
        break;
      }

      case 'subscription.cancelled':
      case 'subscription.halted':
      case 'subscription.paused': {
        const subEntity = eventPayload.payload?.subscription?.entity;
        if (subEntity?.notes?.user_id) {
          await adminClient.from('user_subscriptions').update({
            status: eventType === 'subscription.cancelled' ? 'cancelled' : 'paused',
          }).eq('user_id', subEntity.notes.user_id).eq('status', 'active');

          await adminClient.from('notification_history').insert({
            user_id: subEntity.notes.user_id,
            title: eventType === 'subscription.cancelled' ? 'Subscription Cancelled' : 'Subscription Paused',
            body: 'Your subscription status has changed. Please check your account.',
            type: 'subscription_status',
          });
        }
        logEntry.processed = true;
        break;
      }

      default:
        logEntry.processed = false;
        break;
    }

    // Save webhook event log
    await adminClient.from('razorpay_webhook_events').insert(logEntry);

    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Webhook processing error:', message);

    try {
      await adminClient.from('razorpay_webhook_events').insert({
        event_type: eventPayload?.event || 'unknown',
        payload: eventPayload || {},
        processed: false,
        error_message: message,
      });
    } catch (e) {
      console.error('Failed to log webhook error:', e);
    }

    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
