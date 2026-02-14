import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function sendExpiryEmail(email: string, planName: string, daysLeft: number) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    console.warn('RESEND_API_KEY not set, skipping email');
    return;
  }

  const subject = daysLeft === 0
    ? `Your ${planName} plan expires today!`
    : `Your ${planName} plan expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`;

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #0d9488;">ACRY – Subscription Expiring</h2>
      <p>Hi there,</p>
      <p>Your <strong>${planName}</strong> plan ${daysLeft === 0 ? 'expires <strong>today</strong>' : `will expire in <strong>${daysLeft} day${daysLeft > 1 ? 's' : ''}</strong>`}.</p>
      <p>Renew now to keep your premium features and avoid losing access.</p>
      <p style="margin-top: 24px;">
        <a href="https://id-preview--d1ba6129-f715-4b5b-be21-b93a62f817dd.lovable.app/app" style="background: #0d9488; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Renew Now</a>
      </p>
      <p style="color: #888; font-size: 12px; margin-top: 32px;">— The ACRY Team</p>
    </div>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'ACRY <onboarding@resend.dev>',
      to: [email],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Failed to send email to ${email}: ${errText}`);
  } else {
    await res.text();
    console.log(`Expiry warning email sent to ${email}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Send warning emails for subscriptions expiring within 3 days
    const { data: expiringSoon } = await adminClient
      .from('user_subscriptions')
      .select('user_id, plan_id, expires_at')
      .eq('status', 'active')
      .neq('plan_id', 'free')
      .gt('expires_at', now.toISOString())
      .lte('expires_at', threeDaysFromNow);

    let emailsSent = 0;
    if (expiringSoon?.length) {
      for (const sub of expiringSoon) {
        // Get user email from auth
        const { data: { user } } = await adminClient.auth.admin.getUserById(sub.user_id);
        if (user?.email) {
          const daysLeft = Math.ceil((new Date(sub.expires_at!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const planName = sub.plan_id === 'ultra' ? 'Ultra Brain' : 'Pro Brain';
          await sendExpiryEmail(user.email, planName, daysLeft);
          emailsSent++;
        }
      }
    }
    console.log(`Sent ${emailsSent} expiry warning emails`);

    // 2. Downgrade expired subscriptions
    const { data: expired, error } = await adminClient
      .from('user_subscriptions')
      .update({ status: 'expired' })
      .eq('status', 'active')
      .neq('plan_id', 'free')
      .lt('expires_at', now.toISOString())
      .select('id, user_id, plan_id');

    if (error) throw error;

    console.log(`Downgraded ${expired?.length ?? 0} expired subscriptions`);

    return new Response(JSON.stringify({ 
      success: true, 
      emails_sent: emailsSent,
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
