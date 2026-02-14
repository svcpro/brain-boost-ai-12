import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function sendReminderEmail(email: string, displayName: string, topicsCount: number, topicNames: string[], userId: string) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) { console.warn('RESEND_API_KEY not set'); return; }

  const topicList = topicNames.slice(0, 5).map(t => `<li style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; color: #334155; font-size: 14px;">📌 ${t}</li>`).join('');
  const html = `
    <div style="font-family: 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; background: #f8fffe; border-radius: 16px; overflow: hidden; border: 1px solid #e0f2f1;">
      <div style="background: linear-gradient(135deg, #0d9488, #065f46); padding: 32px 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">ACRY</h1>
        <p style="color: #a7f3d0; margin: 6px 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px;">Daily Study Reminder</p>
      </div>
      <div style="padding: 32px 28px;">
        <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 8px;">Hi ${displayName || 'there'},</p>
        <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">You have <strong style="color: #0d9488;">${topicsCount} topic${topicsCount > 1 ? 's' : ''}</strong> that need revision today based on your forgetting curve:</p>
        ${topicList ? `<ul style="list-style: none; padding: 0; margin: 0 0 8px; background: #ffffff; border-radius: 10px; border: 1px solid #e2e8f0; padding: 4px 16px;">${topicList}</ul>` : ''}
        ${topicsCount > 5 ? `<p style="color: #94a3b8; font-size: 13px; margin: 8px 0 0; text-align: center;">...and ${topicsCount - 5} more topics</p>` : ''}
        <div style="text-align: center; margin: 28px 0;">
          <a href="https://id-preview--d1ba6129-f715-4b5b-be21-b93a62f817dd.lovable.app/app" style="background: linear-gradient(135deg, #0d9488, #065f46); color: white; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 14px rgba(13,148,136,0.3);">Start Studying →</a>
        </div>
      </div>
      <div style="background: #f1f5f9; padding: 20px 28px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="color: #94a3b8; font-size: 12px; margin: 0 0 8px;">© ${new Date().getFullYear()} ACRY · Smart Study Companion</p>
        <a href="https://yvxrsujwgmzdjzsjyqfb.supabase.co/functions/v1/email-unsubscribe?uid=${userId}&type=reminders" style="color: #94a3b8; font-size: 11px; text-decoration: underline;">Unsubscribe from study reminders</a>
      </div>
    </div>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'ACRY <onboarding@resend.dev>',
      to: [email],
      subject: `📚 ${topicsCount} topic${topicsCount > 1 ? 's' : ''} need revision today`,
      html,
    }),
  });

  if (!res.ok) {
    console.error(`Failed to send reminder to ${email}: ${await res.text()}`);
  } else {
    await res.text();
    console.log(`Study reminder sent to ${email}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const now = new Date();
    // Find topics due for revision (predicted drop date is today or past)
    const { data: dueTopics } = await adminClient
      .from('topics')
      .select('user_id, name, next_predicted_drop_date')
      .lte('next_predicted_drop_date', now.toISOString())
      .gt('memory_strength', 0);

    if (!dueTopics?.length) {
      return new Response(JSON.stringify({ success: true, emails_sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Group by user
    const userTopics = new Map<string, string[]>();
    for (const t of dueTopics) {
      const list = userTopics.get(t.user_id) || [];
      list.push(t.name);
      userTopics.set(t.user_id, list);
    }

    let emailsSent = 0;
    let pushesSent = 0;

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
    const hasPushKeys = !!VAPID_PUBLIC_KEY && !!VAPID_PRIVATE_KEY;

    for (const [userId, topics] of userTopics) {
      // Check preference
      const { data: profile } = await adminClient
        .from('profiles')
        .select('email_study_reminders, display_name')
        .eq('id', userId)
        .maybeSingle();

      // Send email if enabled
      if (profile?.email_study_reminders !== false) {
        const { data: { user } } = await adminClient.auth.admin.getUserById(userId);
        if (user?.email) {
          await sendReminderEmail(user.email, profile?.display_name || '', topics.length, topics, userId);
          emailsSent++;
        }
      }

      // Send push notification
      if (hasPushKeys) {
        const { data: subs } = await adminClient
          .from('push_subscriptions')
          .select('id, endpoint, p256dh, auth')
          .eq('user_id', userId);

        if (subs && subs.length > 0) {
          const topicPreview = topics.slice(0, 3).join(', ');
          const extra = topics.length > 3 ? ` +${topics.length - 3} more` : '';
          const payload = JSON.stringify({
            title: `📚 ${topics.length} topic${topics.length > 1 ? 's' : ''} need revision`,
            body: topicPreview + extra,
            data: { type: 'study_reminder' },
          });

          // Call the send-push-notification internal function via HTTP
          try {
            const pushRes = await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`,
              },
              body: JSON.stringify({
                recipient_id: userId,
                title: `📚 ${topics.length} topic${topics.length > 1 ? 's' : ''} need revision`,
                body: topicPreview + extra,
                data: { type: 'study_reminder' },
              }),
            });
            if (pushRes.ok) pushesSent++;
            else await pushRes.text();
          } catch (e) {
            console.warn(`Push failed for ${userId}:`, e);
          }
        }
      }
    }

    console.log(`Sent ${emailsSent} emails, ${pushesSent} push notifications`);
    return new Response(JSON.stringify({ success: true, emails_sent: emailsSent, pushes_sent: pushesSent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Study reminder email error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
