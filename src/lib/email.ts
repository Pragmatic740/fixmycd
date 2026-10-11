import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/** Escape text for safe interpolation into HTML (users control titles, names and comments). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Subjects are a single header line: strip CR/LF and cap the length. */
export function safeSubject(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim().slice(0, 200);
}

function quoteTitle(title: string): string {
  const t = title.replace(/[\r\n]+/g, ' ').trim();
  return t.length > 80 ? `${t.slice(0, 77)}...` : t;
}

const button = (url: string, label: string) =>
  `<p><a href="${escapeHtml(url)}" style="background: #8b5cf6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">${escapeHtml(label)}</a></p>`;

const reportUrl = (reportId: string) => `${BASE_URL}/dashboard/reports/${encodeURIComponent(reportId)}`;

function footer(unsubscribeUrl?: string): string {
  const settings = `${BASE_URL}/dashboard/profile`;
  const unsub = unsubscribeUrl
    ? ` or <a href="${escapeHtml(unsubscribeUrl)}">unsubscribe with one click</a>`
    : '';
  return `<p style="color: #888; font-size: 12px;">You can turn off email notifications in your <a href="${escapeHtml(settings)}">profile settings</a>${unsub}.</p>`;
}

export async function sendEmail({ to, subject, html, text }: EmailOptions): Promise<boolean> {
  if (!resend) {
    console.warn('⚠️ RESEND_API_KEY not set — skipping email');
    return false;
  }

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: safeSubject(subject),
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    });
    return true;
  } catch (error) {
    console.error('Email send failed:', error);
    return false;
  }
}

export async function sendCommentNotification({
  to,
  reportTitle,
  reportId,
  commenterName,
  commentBody,
  unsubscribeUrl,
}: {
  to: string;
  reportTitle: string;
  reportId: string;
  commenterName: string;
  commentBody: string;
  unsubscribeUrl?: string;
}): Promise<boolean> {
  return sendEmail({
    to,
    subject: `New comment on "${quoteTitle(reportTitle)}"`,
    html: `
      <h2>New comment on your report</h2>
      <p><strong>${escapeHtml(commenterName)}</strong> commented on <strong>${escapeHtml(reportTitle)}</strong>:</p>
      <blockquote style="border-left: 3px solid #8b5cf6; padding-left: 12px; color: #555; white-space: pre-wrap;">${escapeHtml(commentBody)}</blockquote>
      ${button(reportUrl(reportId), 'View Report')}
      ${footer(unsubscribeUrl)}
    `,
  });
}

export async function sendUpvoteNotification({
  to,
  reportTitle,
  reportId,
  upvoteCount,
  unsubscribeUrl,
}: {
  to: string;
  reportTitle: string;
  reportId: string;
  upvoteCount: number;
  unsubscribeUrl?: string;
}): Promise<boolean> {
  return sendEmail({
    to,
    subject: `Your report "${quoteTitle(reportTitle)}" got an upvote`,
    html: `
      <h2>Someone upvoted your report</h2>
      <p>Your report <strong>${escapeHtml(reportTitle)}</strong> now has <strong>${Number(upvoteCount)}</strong> upvote(s).</p>
      ${button(reportUrl(reportId), 'View Report')}
      ${footer(unsubscribeUrl)}
    `,
  });
}

export async function sendStatusChangeNotification({
  to,
  reportTitle,
  reportId,
  newStatus,
  unsubscribeUrl,
}: {
  to: string;
  reportTitle: string;
  reportId: string;
  newStatus: string;
  unsubscribeUrl?: string;
}): Promise<boolean> {
  return sendEmail({
    to,
    subject: `Your report "${quoteTitle(reportTitle)}" status changed`,
    html: `
      <h2>Your report status has changed</h2>
      <p>Your report <strong>${escapeHtml(reportTitle)}</strong> is now: <strong>${escapeHtml(newStatus.replace(/_/g, ' '))}</strong>.</p>
      ${button(reportUrl(reportId), 'View Report')}
      ${footer(unsubscribeUrl)}
    `,
  });
}

export async function sendEndorsementNotification({
  to,
  reportTitle,
  reportId,
  expertName,
  severityLevel,
  unsubscribeUrl,
}: {
  to: string;
  reportTitle: string;
  reportId: string;
  expertName: string;
  severityLevel: number;
  unsubscribeUrl?: string;
}): Promise<boolean> {
  return sendEmail({
    to,
    subject: `An expert reviewed "${quoteTitle(reportTitle)}"`,
    html: `
      <h2>Your report was endorsed by an expert</h2>
      <p><strong>${escapeHtml(expertName)}</strong> rated <strong>${escapeHtml(reportTitle)}</strong> at severity <strong>${Number(severityLevel)}/5</strong>.</p>
      ${button(reportUrl(reportId), 'View Report')}
      ${footer(unsubscribeUrl)}
    `,
  });
}

export async function sendAccountDecisionEmail({
  to,
  displayName,
  approved,
}: {
  to: string;
  displayName: string | null;
  approved: boolean;
}): Promise<boolean> {
  const name = escapeHtml(displayName || 'there');
  return approved
    ? sendEmail({
        to,
        subject: 'Your FixMyDistrict account is approved',
        html: `
          <h2>Welcome, ${name}!</h2>
          <p>Your account has been approved. You can now log in to report issues, comment and upvote.</p>
          ${button(`${BASE_URL}/login`, 'Log in')}
        `,
      })
    : sendEmail({
        to,
        subject: 'Your FixMyDistrict account request',
        html: `
          <h2>Hi ${name},</h2>
          <p>Unfortunately your account request was not approved. If you think this is a mistake, please contact the site administrators.</p>
        `,
      });
}

export async function sendBetaReleaseNotification({
  to,
}: {
  to: string;
}): Promise<boolean> {
  return sendEmail({
    to,
    subject: 'FixMyDistrict is now open!',
    html: `
      <h2>FixMyDistrict is now open!</h2>
      <p>Thanks for your interest. The platform is now live and you can create your account.</p>
      ${button(`${BASE_URL}/signup`, 'Sign Up')}
    `,
  });
}
