// Minimal email client. Uses Resend's HTTP API directly (no SDK dep required).
// If RESEND_API_KEY is unset, falls back to console logging so dev/Replit still works.

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export async function sendRawEmail(msg: EmailMessage): Promise<{ ok: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'Salesbuddy <no-reply@salesbuddy.dev>';

  if (!apiKey) {
    console.log('[email:stub] would send', { to: msg.to, subject: msg.subject });
    console.log('[email:stub] body (text):', msg.text || msg.html.replace(/<[^>]+>/g, '').slice(0, 400));
    return { ok: true, id: 'stub-' + Date.now() };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error('[email] send failed', res.status, errText);
      return { ok: false, error: errText };
    }
    const data = await res.json() as { id?: string };
    return { ok: true, id: data.id };
  } catch (err) {
    console.error('[email] send threw', err);
    return { ok: false, error: String(err) };
  }
}
