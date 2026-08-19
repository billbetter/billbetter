export async function sendSMS({ to, body }: { to: string; body: string }) {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_PHONE_NUMBER');

  if (!accountSid) throw new Error('TWILIO_ACCOUNT_SID not configured');
  if (!authToken) throw new Error('TWILIO_AUTH_TOKEN not configured');
  if (!from) throw new Error('TWILIO_PHONE_NUMBER not configured');

  const auth = btoa(`${accountSid}:${authToken}`);

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: from,
        To: to,
        Body: body,
      }).toString(),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.message || `Twilio error: ${res.status}`);
  }

  return data;
}
