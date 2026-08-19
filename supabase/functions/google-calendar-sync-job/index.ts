import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { getValidAccessTokenForUser } from '../_shared/google.ts';
import { db, getUserFromAuthHeader } from '../_shared/supabase-admin.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) throw new Error('Not authenticated');

    const { job_id } = await req.json();
    if (!job_id) throw new Error('job_id is required');

    const job = await db.getOne('Job', job_id);
    if (!job) throw new Error('Job not found');
    if (job.user_id !== user.id) throw new Error('Not authorized');

    const start = job.scheduled_start_time || job.start_date;
    const end = job.scheduled_end_time || job.completion_date || start;
    if (!start) throw new Error('Job has no scheduled_start_time or start_date');

    const accessToken = await getValidAccessTokenForUser(user.id);

    const event = {
      summary: job.job_title || 'Job',
      description: job.description || '',
      location: job.location || '',
      start: { dateTime: new Date(start).toISOString() },
      end: { dateTime: new Date(end).toISOString() },
    };

    const method = job.google_calendar_event_id ? 'PATCH' : 'POST';
    const path = job.google_calendar_event_id
      ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${job.google_calendar_event_id}`
      : `https://www.googleapis.com/calendar/v3/calendars/primary/events`;

    const res = await fetch(path, {
      method,
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Calendar API ${res.status}`);

    await db.update('Job', job.id, { google_calendar_event_id: data.id });

    return new Response(JSON.stringify({ success: true, event_id: data.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('google-calendar-sync-job error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
