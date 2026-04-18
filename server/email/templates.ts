import type { SalesTranscriptAnalysisResponse } from '../../shared/schema';

const BASE = (body: string, title: string) => `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1f2937;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:12px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <tr><td>
        <div style="font-size:14px;color:#6b7280;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px;">Salesbuddy</div>
        ${body}
      </td></tr>
    </table>
    <div style="font-size:12px;color:#9ca3af;margin-top:16px;">You're receiving this because you use Salesbuddy. <a href="{{UNSUB_URL}}" style="color:#9ca3af;">Manage preferences</a></div>
  </td></tr>
</table>
</body>
</html>`;

export function escapeHtml(s: string | undefined | null): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function button(url: string, label: string): string {
  return `<a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">${escapeHtml(label)}</a>`;
}

function secondaryButton(url: string, label: string): string {
  return `<a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 18px;background:#f3f4f6;color:#111827;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;border:1px solid #e5e7eb;">${escapeHtml(label)}</a>`;
}

export function gmailComposeUrl(to: string, subject: string, body: string): string {
  const q = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to,
    su: subject,
    body,
  });
  return `https://mail.google.com/mail/?${q.toString()}`;
}

export function outlookComposeUrl(to: string, subject: string, body: string): string {
  const q = new URLSearchParams({
    to,
    subject,
    body,
  });
  return `https://outlook.office.com/mail/deeplink/compose?${q.toString()}`;
}

function extractSubject(emailDraft: string): { subject: string; body: string } {
  const m = emailDraft.match(/^Subject:\s*(.+)$/im);
  if (!m) return { subject: 'Following up', body: emailDraft };
  const subject = m[1].trim();
  const body = emailDraft.replace(m[0], '').trim();
  return { subject, body };
}

export function renderMagicLink(params: { magicUrl: string; email: string }): { subject: string; html: string; text: string } {
  const subject = 'Sign in to Salesbuddy';
  const html = BASE(`
    <h2 style="font-size:22px;margin:0 0 12px 0;">Sign in to Salesbuddy</h2>
    <p style="font-size:15px;line-height:1.5;margin:0 0 16px 0;">Click the button below to sign in as <strong>${escapeHtml(params.email)}</strong>. This link expires in 15 minutes.</p>
    <p style="margin:24px 0;">${button(params.magicUrl, 'Sign in')}</p>
    <p style="font-size:13px;color:#6b7280;margin:12px 0 0 0;">If you didn't request this, you can ignore it.</p>
  `, subject);
  const text = `Sign in to Salesbuddy: ${params.magicUrl} (expires in 15 minutes)`;
  return { subject, html, text };
}

export function renderFollowUpReady(params: {
  analysis: SalesTranscriptAnalysisResponse;
  analysisUrl: string;
  recipientEmail?: string;
}): { subject: string; html: string; text: string } {
  const a = params.analysis;
  const { subject: emailSubject, body: emailBody } = extractSubject(a.followUp.emailDraft || '');
  const recipient = params.recipientEmail || '';
  const gmail = gmailComposeUrl(recipient, emailSubject, emailBody);
  const outlook = outlookComposeUrl(recipient, emailSubject, emailBody);
  const acct = a.accountName || 'your meeting';

  const subject = `Your follow-up for ${acct} is ready`;
  const blockers = (a.blockers || []).slice(0, 3);
  const nextSteps = (a.nextSteps || []).slice(0, 3);

  const html = BASE(`
    <h2 style="font-size:22px;margin:0 0 4px 0;">Follow-up ready for ${escapeHtml(acct)}</h2>
    <div style="font-size:13px;color:#6b7280;margin-bottom:16px;">Primary intent: <strong>${escapeHtml(a.intent.primary)}</strong> · recommended timing: ${escapeHtml(a.followUp.timing || 'soon')}</div>
    <p style="font-size:15px;line-height:1.5;margin:0 0 16px 0;">${escapeHtml(a.summary)}</p>
    ${nextSteps.length ? `<h3 style="font-size:14px;margin:16px 0 6px 0;">Next steps</h3><ul style="font-size:14px;line-height:1.5;padding-left:18px;margin:0 0 12px 0;">${nextSteps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>` : ''}
    ${blockers.length ? `<h3 style="font-size:14px;margin:16px 0 6px 0;">Open blockers</h3><ul style="font-size:14px;line-height:1.5;padding-left:18px;margin:0 0 12px 0;">${blockers.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>` : ''}
    <h3 style="font-size:14px;margin:16px 0 6px 0;">Drafted email</h3>
    <div style="font-size:14px;line-height:1.5;background:#f9fafb;border-radius:8px;padding:12px;white-space:pre-wrap;border:1px solid #e5e7eb;">${escapeHtml(a.followUp.emailDraft || '')}</div>
    <p style="margin:20px 0 8px 0;">${button(gmail, 'Send via Gmail')}&nbsp;&nbsp;${secondaryButton(outlook, 'Send via Outlook')}</p>
    <p style="margin:8px 0 0 0;">${secondaryButton(params.analysisUrl, 'Open full analysis')}</p>
  `, subject);

  const text = `Follow-up ready for ${acct}. Open full analysis: ${params.analysisUrl}\n\nDraft email:\n${a.followUp.emailDraft || ''}\n\nSend via Gmail: ${gmail}\nSend via Outlook: ${outlook}`;
  return { subject, html, text };
}

export interface DigestDataAnalysis {
  id: string;
  accountName?: string;
  createdAt: string;
  intent: { primary: string; buyNow: number; buySoon: number };
  sellerPct: number;
  questionScore: number;
}

export function renderWeeklyDigest(params: {
  firstName?: string;
  weekStart: Date;
  analyses: DigestDataAnalysis[];
  topBlocker?: string;
  topTip?: string;
  appUrl: string;
  avgTalkRatio: number;
  avgQuestionScore: number;
  weekOverWeekTalkDelta: number | null;
}): { subject: string; html: string; text: string } {
  const weekLabel = params.weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const subject = `Your Salesbuddy week in review — ${params.analyses.length} meeting${params.analyses.length === 1 ? '' : 's'}`;
  const deltaTxt =
    params.weekOverWeekTalkDelta === null
      ? ''
      : params.weekOverWeekTalkDelta === 0
      ? ' (unchanged)'
      : params.weekOverWeekTalkDelta > 0
      ? ` (▲ ${Math.abs(params.weekOverWeekTalkDelta)} pts vs last week)`
      : ` (▼ ${Math.abs(params.weekOverWeekTalkDelta)} pts vs last week)`;

  const rows = params.analyses.slice(0, 8).map(a => `
    <tr>
      <td style="padding:8px 4px;font-size:14px;color:#111827;">${escapeHtml(a.accountName || '—')}</td>
      <td style="padding:8px 4px;font-size:13px;color:#6b7280;">${escapeHtml(a.intent.primary)}</td>
      <td style="padding:8px 4px;font-size:13px;color:#6b7280;text-align:right;">${a.sellerPct}% talk</td>
      <td style="padding:8px 4px;font-size:13px;color:#6b7280;text-align:right;">${a.questionScore}% open Qs</td>
    </tr>`).join('');

  const html = BASE(`
    <h2 style="font-size:22px;margin:0 0 4px 0;">Your week in review</h2>
    <div style="font-size:13px;color:#6b7280;margin-bottom:16px;">Week of ${weekLabel}${params.firstName ? ` · hi ${escapeHtml(params.firstName)}` : ''}</div>

    <table role="presentation" width="100%" style="margin:12px 0 20px 0;">
      <tr>
        <td style="width:33%;padding:12px;background:#f9fafb;border-radius:8px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#111827;">${params.analyses.length}</div>
          <div style="font-size:12px;color:#6b7280;">Meetings analyzed</div>
        </td>
        <td style="width:8px;"></td>
        <td style="width:33%;padding:12px;background:#f9fafb;border-radius:8px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#111827;">${params.avgTalkRatio}%</div>
          <div style="font-size:12px;color:#6b7280;">Avg seller talk${deltaTxt}</div>
        </td>
        <td style="width:8px;"></td>
        <td style="width:33%;padding:12px;background:#f9fafb;border-radius:8px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#111827;">${params.avgQuestionScore}%</div>
          <div style="font-size:12px;color:#6b7280;">Avg open questions</div>
        </td>
      </tr>
    </table>

    ${params.analyses.length ? `
      <h3 style="font-size:14px;margin:16px 0 6px 0;">Meetings this week</h3>
      <table role="presentation" width="100%" style="border-collapse:collapse;margin-bottom:16px;">${rows}</table>
    ` : '<p style="font-size:14px;color:#6b7280;">No meetings analyzed this week.</p>'}

    ${params.topBlocker ? `<div style="background:#fef3c7;border-left:3px solid #f59e0b;padding:10px 12px;border-radius:6px;font-size:14px;margin:12px 0;"><strong>Open blocker to chase:</strong> ${escapeHtml(params.topBlocker)}</div>` : ''}
    ${params.topTip ? `<div style="background:#dbeafe;border-left:3px solid #2563eb;padding:10px 12px;border-radius:6px;font-size:14px;margin:12px 0;"><strong>Coaching tip:</strong> ${escapeHtml(params.topTip)}</div>` : ''}

    <p style="margin:20px 0 0 0;">${button(params.appUrl, 'Open Salesbuddy')}</p>
  `, subject);

  const text = `Your week in review — ${params.analyses.length} meetings. Avg talk: ${params.avgTalkRatio}%. Avg open Qs: ${params.avgQuestionScore}%. Open: ${params.appUrl}`;
  return { subject, html, text };
}

export function renderBlockerReminder(params: {
  accountName: string;
  blockerTitle: string;
  daysOpen: number;
  analysisUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `${params.accountName} blocker still open after ${params.daysOpen} days`;
  const html = BASE(`
    <h2 style="font-size:20px;margin:0 0 4px 0;">Open blocker · ${escapeHtml(params.accountName)}</h2>
    <div style="font-size:13px;color:#6b7280;margin-bottom:16px;">Still open after ${params.daysOpen} days</div>
    <div style="background:#fef3c7;border-left:3px solid #f59e0b;padding:12px;border-radius:6px;font-size:15px;margin:12px 0;">${escapeHtml(params.blockerTitle)}</div>
    <p style="font-size:14px;color:#374151;line-height:1.5;margin:0 0 16px 0;">If it's resolved, mark it done so we stop reminding. Otherwise, a short follow-up call or email is usually all it takes.</p>
    <p style="margin:20px 0 0 0;">${button(params.analysisUrl, 'Open analysis & follow up')}</p>
  `, subject);
  const text = `${params.accountName} blocker still open after ${params.daysOpen} days: ${params.blockerTitle}\n\nOpen: ${params.analysisUrl}`;
  return { subject, html, text };
}
