import nodemailer from 'nodemailer';
import { Resend } from 'resend';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string; // display name override
}

/**
 * Sends an email. Uses Gmail SMTP if GMAIL_USER + GMAIL_APP_PASSWORD are set,
 * otherwise falls back to Resend.
 */
export async function sendEmail({ to, subject, html, from }: SendEmailOptions): Promise<void> {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (gmailUser && gmailPass) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    });
    await transporter.sendMail({
      from: from ? `"${from}" <${gmailUser}>` : `"RLM&CO Dashboard" <${gmailUser}>`,
      to,
      subject,
      html,
    });
    return;
  }

  // Fallback: Resend
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) throw new Error('No email provider configured. Set GMAIL_USER + GMAIL_APP_PASSWORD or RESEND_API_KEY.');

  const resend = new Resend(resendKey);
  const fromAddr = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  await resend.emails.send({
    from: from ? `${from} <${fromAddr}>` : `RLM&CO Dashboard <${fromAddr}>`,
    to,
    subject,
    html,
  });
}
