import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function sendExpiryEmail(email: string, planName: string, daysLeft: number, userId: string) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    console.warn('RESEND_API_KEY not set, skipping email');
    return;
  }

  const subject = daysLeft === 0
    ? `Your ${planName} plan expires today!`
    : `Your ${planName} plan expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`;

  const html = `
    <div style="font-family: 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; background: #f8fffe; border-radius: 16px; overflow: hidden; border: 1px solid #e0f2f1;">
      <div style="background: linear-gradient(135deg, #0d9488, #065f46); padding: 32px 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">ACRY</h1>
        <p style="color: #a7f3d0; margin: 6px 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px;">Subscription Notice</p>
      </div>
      <div style="padding: 32px 28px;">
        <div style="background: #fff7ed; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
          <p style="margin: 0; color: #92400e; font-weight: 600; font-size: 15px;">⚠️ ${daysLeft === 0 ? 'Your plan expires today!' : `Your plan expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`}</p>
        </div>
        <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 8px;">Hi there,</p>
        <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">Your <strong style="color: #0d9488;">${planName}</strong> plan ${daysLeft === 0 ? 'expires <strong>today</strong>' : `will expire in <strong>${daysLeft} day${daysLeft > 1 ? 's' : ''}</strong>`}. Renew now to keep your premium features.</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="https://id-preview--d1ba6129-f715-4b5b-be21-b93a62f817dd.lovable.app/app" style="background: linear-gradient(135deg, #0d9488, #065f46); color: white; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 14px rgba(13,148,136,0.3);">Renew Now →</a>
        </div>
      </div>
      <div style="background: #f1f5f9; padding: 20px 28px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="color: #94a3b8; font-size: 12px; margin: 0 0 8px;">© ${new Date().getFullYear()} ACRY · Smart Study Companion</p>
        <a href="https://yvxrsujwgmzdjzsjyqfb.supabase.co/functions/v1/email-unsubscribe?uid=${userId}&type=expiry" style="color: #94a3b8; font-size: 11px; text-decoration: underline;">Unsubscribe from these emails</a>
      </div>
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
        // Check if user has email notifications enabled
        const { data: profile } = await adminClient
          .from('profiles')
          .select('email_notifications_enabled')
          .eq('id', sub.user_id)
          .maybeSingle();

        if (profile && profile.email_notifications_enabled === false) {
          console.log(`Skipping email for user ${sub.user_id} (opted out)`);
          continue;
        }

        const { data: { user } } = await adminClient.auth.admin.getUserById(sub.user_id);
        if (user?.email) {
          const daysLeft = Math.ceil((new Date(sub.expires_at!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const planName = sub.plan_id === 'ultra' ? 'Ultra Brain' : 'Pro Brain';
          await sendExpiryEmail(user.email, planName, daysLeft, sub.user_id);
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
