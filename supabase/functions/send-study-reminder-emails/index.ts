import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function sendReminderEmail(email: string, displayName: string, topicsCount: number, topicNames: string[]) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) { console.warn('RESEND_API_KEY not set'); return; }

  const topicList = topicNames.slice(0, 5).map(t => `<li>${t}</li>`).join('');
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #0d9488;">ACRY – Daily Study Reminder</h2>
      <p>Hi ${displayName || 'there'},</p>
      <p>You have <strong>${topicsCount} topic${topicsCount > 1 ? 's' : ''}</strong> that need revision today based on your forgetting curve:</p>
      ${topicList ? `<ul style="color: #444;">${topicList}</ul>` : ''}
      ${topicsCount > 5 ? `<p style="color: #888; font-size: 13px;">...and ${topicsCount - 5} more</p>` : ''}
      <p style="margin-top: 24px;">
        <a href="https://id-preview--d1ba6129-f715-4b5b-be21-b93a62f817dd.lovable.app/app" style="background: #0d9488; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Start Studying</a>
      </p>
      <p style="color: #888; font-size: 12px; margin-top: 32px;">— The ACRY Team</p>
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
    for (const [userId, topics] of userTopics) {
      // Check preference
      const { data: profile } = await adminClient
        .from('profiles')
        .select('email_study_reminders, display_name')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.email_study_reminders === false) continue;

      const { data: { user } } = await adminClient.auth.admin.getUserById(userId);
      if (user?.email) {
        await sendReminderEmail(user.email, profile?.display_name || '', topics.length, topics);
        emailsSent++;
      }
    }

    console.log(`Sent ${emailsSent} study reminder emails`);
    return new Response(JSON.stringify({ success: true, emails_sent: emailsSent }), {
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
