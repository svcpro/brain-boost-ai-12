import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function sendWeeklyReportEmail(email: string, displayName: string, stats: { totalMinutes: number; sessionsCount: number; topSubject: string; streakDays: number }, userId: string) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) { console.warn('RESEND_API_KEY not set'); return; }

  const hours = Math.floor(stats.totalMinutes / 60);
  const mins = stats.totalMinutes % 60;
  const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  const html = `
    <div style="font-family: 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; background: #f8fffe; border-radius: 16px; overflow: hidden; border: 1px solid #e0f2f1;">
      <div style="background: linear-gradient(135deg, #0d9488, #065f46); padding: 32px 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">ACRY</h1>
        <p style="color: #a7f3d0; margin: 6px 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px;">Weekly Progress Report</p>
      </div>
      <div style="padding: 32px 28px;">
        <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">Hi ${displayName || 'there'}, here's your study summary for the past week:</p>
        <div style="background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid #f1f5f9;">
            <span style="color: #64748b; font-size: 14px;">⏱️ Total Study Time</span>
            <span style="color: #0f172a; font-weight: 700; font-size: 14px;">${timeStr}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid #f1f5f9;">
            <span style="color: #64748b; font-size: 14px;">📖 Sessions Completed</span>
            <span style="color: #0f172a; font-weight: 700; font-size: 14px;">${stats.sessionsCount}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid #f1f5f9;">
            <span style="color: #64748b; font-size: 14px;">🏆 Top Subject</span>
            <span style="color: #0f172a; font-weight: 700; font-size: 14px;">${stats.topSubject || '—'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 14px 20px;">
            <span style="color: #64748b; font-size: 14px;">🔥 Current Streak</span>
            <span style="color: #0f172a; font-weight: 700; font-size: 14px;">${stats.streakDays} day${stats.streakDays !== 1 ? 's' : ''}</span>
          </div>
        </div>
        ${stats.totalMinutes === 0
          ? '<div style="background: #fff7ed; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px;"><p style="margin: 0; color: #92400e; font-size: 14px;">You didn\'t study this week. Even 5 minutes a day makes a difference! 💡</p></div>'
          : '<div style="background: #ecfdf5; border-left: 4px solid #10b981; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px;"><p style="margin: 0; color: #065f46; font-size: 14px;">Great work! Keep the momentum going this week. 💪</p></div>'}
        <div style="text-align: center; margin: 28px 0;">
          <a href="https://id-preview--d1ba6129-f715-4b5b-be21-b93a62f817dd.lovable.app/app" style="background: linear-gradient(135deg, #0d9488, #065f46); color: white; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 14px rgba(13,148,136,0.3);">View Full Report →</a>
        </div>
      </div>
      <div style="background: #f1f5f9; padding: 20px 28px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="color: #94a3b8; font-size: 12px; margin: 0 0 8px;">© ${new Date().getFullYear()} ACRY · Smart Study Companion</p>
        <a href="https://yvxrsujwgmzdjzsjyqfb.supabase.co/functions/v1/email-unsubscribe?uid=${userId}&type=reports" style="color: #94a3b8; font-size: 11px; text-decoration: underline;">Unsubscribe from weekly reports</a>
      </div>
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
        }, profile.id);
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
