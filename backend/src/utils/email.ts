import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';

/**
 * Transactional email.
 *
 * Three things this module is careful about, each of which was a real defect
 * in the version it replaces:
 *
 *  1. Nothing secret is logged. Verification codes and password-reset links
 *     were previously printed to stdout on every send, which on Render means
 *     they are retained in the log stream — anyone with dashboard read access
 *     could take over any account that had just requested a reset.
 *  2. Every interpolated value is HTML-escaped. `name` and `message` come
 *     straight from untrusted form input and were dropped into the template
 *     raw, so a registration name could inject markup and links into the mail
 *     the operator receives.
 *  3. Send results are reported. Two of the four senders swallowed SMTP errors
 *     and returned `void`, so the caller told the user to check an inbox that
 *     nothing would ever arrive in.
 */

/* -------------------------------------------------------------------------- */
/* Transport                                                                  */
/* -------------------------------------------------------------------------- */

let transporter: Transporter | null = null;

/**
 * One pooled transport for the process, created lazily.
 *
 * The previous code built a fresh transport per message, which meant a full
 * TCP + TLS + SMTP AUTH handshake for every single email.
 */
function getTransporter(): Transporter | null {
  if (!env.mail.configured) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: env.mail.host,
    port: env.mail.port,
    secure: env.mail.port === 465,
    auth: { user: env.mail.user, pass: env.mail.pass },
    pool: true,
    maxConnections: 2,
    maxMessages: 50,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  return transporter;
}

/** Verifies SMTP credentials at boot so misconfiguration is visible early. */
export async function verifyMailTransport(): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) {
    console.warn('[email] SMTP is not configured — verification and reset emails are disabled.');
    return false;
  }
  try {
    await transport.verify();
    console.log(`[email] SMTP ready (${env.mail.host}:${env.mail.port})`);
    return true;
  } catch (error: any) {
    console.error(`[email] SMTP credentials rejected: ${error?.message || error}`);
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Templating                                                                 */
/* -------------------------------------------------------------------------- */

/** Escapes a value for interpolation into an HTML attribute or text node. */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const PALETTE = {
  bg: '#0f0f23',
  panel: 'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.10)',
  accent: '#a855f7',
  text: '#ffffff',
  muted: '#94a3b8',
  faint: '#64748b',
};

/**
 * Shared shell for every message. The four senders each carried their own copy
 * of this markup, so a change to the brand colour meant four edits and the
 * copies had already drifted apart.
 */
function layout(heading: string, intro: string, body: string, footer: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#07070f;">
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:${PALETTE.bg};color:${PALETTE.text};padding:40px;border-radius:12px;">
    <h1 style="color:${PALETTE.accent};margin:0 0 8px;font-size:24px;">${heading}</h1>
    <p style="color:${PALETTE.muted};margin:0 0 24px;line-height:1.6;">${intro}</p>
    ${body}
    <p style="color:${PALETTE.faint};font-size:12px;margin:24px 0 0;line-height:1.6;">${footer}</p>
  </div>
</body></html>`;
}

function panel(inner: string): string {
  return `<div style="background:${PALETTE.panel};border:1px solid ${PALETTE.border};padding:20px;border-radius:12px;margin-bottom:24px;">${inner}</div>`;
}

/* -------------------------------------------------------------------------- */
/* Delivery                                                                   */
/* -------------------------------------------------------------------------- */

interface Message {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  /** Short label used in logs. Never contains the message body. */
  kind: string;
}

/**
 * Sends one message and reports whether it left the building.
 *
 * Returns `false` rather than throwing, because for every caller here a failed
 * send is an expected outcome that needs a specific HTTP response, not an
 * exception to propagate.
 */
async function deliver({ to, subject, html, replyTo, kind }: Message): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) {
    console.error(`[email] cannot send ${kind}: SMTP is not configured`);
    return false;
  }

  try {
    await transport.sendMail({
      from: `"${env.mail.fromName}" <${env.mail.fromEmail}>`,
      to,
      replyTo,
      subject,
      html,
    });
    console.log(`[email] sent ${kind} to ${redact(to)}`);
    return true;
  } catch (error: any) {
    console.error(`[email] failed to send ${kind} to ${redact(to)}: ${error?.message || error}`);
    return false;
  }
}

/** `alice@gmail.com` -> `al***@gmail.com`, so logs stay useful but not a mailing list. */
function redact(email: string): string {
  const [local, domain] = String(email).split('@');
  if (!domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}

/* -------------------------------------------------------------------------- */
/* Senders                                                                    */
/* -------------------------------------------------------------------------- */

export async function sendVerificationEmail(
  email: string,
  name: string,
  code: string
): Promise<boolean> {
  return deliver({
    kind: 'verification code',
    to: email,
    subject: 'Verify your MediaTools account',
    html: layout(
      'Welcome to MediaTools',
      `Hi ${esc(name)}, use this six-digit code to verify your email address.`,
      panel(
        `<div style="text-align:center;font-size:32px;font-weight:700;letter-spacing:6px;">${esc(code)}</div>`
      ),
      'This code expires in 24 hours. If you did not create an account, you can safely ignore this email.'
    ),
  });
}

export async function sendPasswordResetEmail(
  email: string,
  name: string,
  token: string
): Promise<boolean> {
  // env.primaryFrontendUrl, not the raw FRONTEND_URL string. When that variable
  // held a comma-separated CORS list, the old code produced reset links like
  // "https://a.com,https://b.com/auth/reset-password?token=..." — every reset
  // email sent to a multi-origin deployment was a dead link.
  const resetUrl = `${env.primaryFrontendUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;

  return deliver({
    kind: 'password reset',
    to: email,
    subject: 'Reset your MediaTools password',
    html: layout(
      'Password reset',
      `Hi ${esc(name)}, use the button below to choose a new password.`,
      `<a href="${esc(resetUrl)}" style="background:${PALETTE.accent};color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;">Reset password</a>`,
      'This link expires in one hour and can be used once. If you did not request a reset, ignore this email — your password will not change.'
    ),
  });
}

export async function sendContactEmail(
  name: string,
  email: string,
  message: string
): Promise<boolean> {
  const operator = env.mail.fromEmail;
  if (!operator) {
    console.error('[email] cannot send contact message: FROM_EMAIL is not set');
    return false;
  }

  return deliver({
    kind: 'contact form',
    to: operator,
    replyTo: email,
    subject: `Contact form: ${name}`.slice(0, 120),
    html: layout(
      'New contact message',
      'Someone submitted the contact form.',
      panel(
        `<p style="margin:0 0 8px;"><strong>Name:</strong> ${esc(name)}</p>
         <p style="margin:0 0 8px;"><strong>Email:</strong> ${esc(email)}</p>
         <hr style="border:0;border-top:1px solid ${PALETTE.border};margin:16px 0;" />
         <p style="white-space:pre-wrap;line-height:1.6;margin:0;">${esc(message)}</p>`
      ),
      'Reply directly to this email to respond to the sender.'
    ),
  });
}

export async function sendFeedbackEmail(
  name: string,
  email: string,
  type: string,
  message: string
): Promise<boolean> {
  const operator = env.mail.fromEmail;
  if (!operator) {
    console.error('[email] cannot send feedback: FROM_EMAIL is not set');
    return false;
  }

  return deliver({
    kind: 'feedback',
    to: operator,
    replyTo: email,
    subject: `[${type.toUpperCase()}] Feedback from ${name}`.slice(0, 120),
    html: layout(
      'New feedback',
      'Someone submitted the feedback form.',
      panel(
        `<p style="margin:0 0 8px;"><strong>Name:</strong> ${esc(name)}</p>
         <p style="margin:0 0 8px;"><strong>Email:</strong> ${esc(email)}</p>
         <p style="margin:0 0 8px;"><strong>Type:</strong> ${esc(type)}</p>
         <hr style="border:0;border-top:1px solid ${PALETTE.border};margin:16px 0;" />
         <p style="white-space:pre-wrap;line-height:1.6;margin:0;">${esc(message)}</p>`
      ),
      'Reply directly to this email to respond to the sender.'
    ),
  });
}
