import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function sendWeeklyReportEmail(email: string, displayName: string, stats: { totalMinutes: number; sessionsCount: number; topSubject: string; streakDays: number }) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) { console.warn('RESEND_API_KEY not set'); return; }

  const hours = Math.floor(stats.totalMinutes / 60);
  const mins = stats.totalMinutes % 60;
  const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #0d9488;">ACRY – Your Weekly Progress Report</h2>
      <p>Hi ${displayName || 'there'},</p>
      <p>Here's your study summary for the past week:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px 0; color: #888;">⏱️ Total Study Time</td>
          <td style="padding: 10px 0; text-align: right; font-weight: 600;">${timeStr}</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px 0; color: #888;">📖 Sessions Completed</td>
          <td style="padding: 10px 0; text-align: right; font-weight: 600;">${stats.sessionsCount}</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px 0; color: #888;">🏆 Top Subject</td>
          <td style="padding: 10px 0; text-align: right; font-weight: 600;">${stats.topSubject || '—'}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #888;">🔥 Current Streak</td>
          <td style="padding: 10px 0; text-align: right; font-weight: 600;">${stats.streakDays} day${stats.streakDays !== 1 ? 's' : ''}</td>
        </tr>
      </table>
      ${stats.totalMinutes === 0 
        ? '<p style="color: #e67e22;">You didn\'t study this week. Even 5 minutes a day makes a difference!</p>'
        : '<p style="color: #0d9488;">Great work! Keep the momentum going this week. 💪</p>'}
      <p style="margin-top: 24px;">
        <a href="https://id-preview--d1ba6129-f715-4b5b-be21-b93a62f817dd.lovable.app/app" style="background: #0d9488; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">View Full Report</a>
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
      subject: `📊 Your Weekly Study Report – ${timeStr} studied`,
      html,
    }),
  });

  if (!res.ok) {
    console.error(`Failed to send weekly report to ${email}: ${await res.text()}`);
  } else {
    await res.text();
    console.log(`Weekly report sent to ${email}`);
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
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Get all profiles that have weekly reports enabled
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('id, display_name, email_weekly_reports');

    if (!profiles?.length) {
      return new Response(JSON.stringify({ success: true, emails_sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let emailsSent = 0;
    for (const profile of profiles) {
      if (profile.email_weekly_reports === false) continue;

      // Get study logs for the past week
      const { data: logs } = await adminClient
        .from('study_logs')
        .select('duration_minutes, subject_id')
        .eq('user_id', profile.id)
        .gte('created_at', weekAgo);

      const totalMinutes = logs?.reduce((sum, l) => sum + (l.duration_minutes || 0), 0) ?? 0;
      const sessionsCount = logs?.length ?? 0;

      // Find top subject
      let topSubject = '—';
      if (logs?.length) {
        const subjectMins = new Map<string, number>();
        for (const l of logs) {
          if (l.subject_id) {
            subjectMins.set(l.subject_id, (subjectMins.get(l.subject_id) || 0) + (l.duration_minutes || 0));
          }
        }
        if (subjectMins.size > 0) {
          const topId = [...subjectMins.entries()].sort((a, b) => b[1] - a[1])[0][0];
          const { data: subj } = await adminClient.from('subjects').select('name').eq('id', topId).maybeSingle();
          if (subj) topSubject = subj.name;
        }
      }

      // Count streak (consecutive days with logs)
      let streakDays = 0;
      for (let i = 0; i < 30; i++) {
        const dayStart = new Date(now.getTime() - (i + 1) * 24 * 60 * 60 * 1000);
        const dayEnd = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const { count } = await adminClient
          .from('study_logs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .gte('created_at', dayStart.toISOString())
          .lt('created_at', dayEnd.toISOString());
        if ((count ?? 0) > 0) streakDays++;
        else break;
      }

      const { data: { user } } = await adminClient.auth.admin.getUserById(profile.id);
      if (user?.email) {
        await sendWeeklyReportEmail(user.email, profile.display_name || '', {
          totalMinutes, sessionsCount, topSubject, streakDays,
        });
        emailsSent++;
      }
    }

    console.log(`Sent ${emailsSent} weekly report emails`);
    return new Response(JSON.stringify({ success: true, emails_sent: emailsSent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Weekly report email error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
