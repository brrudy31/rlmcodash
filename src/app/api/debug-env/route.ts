import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    RESEND_API_KEY: process.env.RESEND_API_KEY ? `set (starts with: ${process.env.RESEND_API_KEY.slice(0, 6)}...)` : 'MISSING',
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || 'MISSING',
    SUMMARY_EMAIL_TO: process.env.SUMMARY_EMAIL_TO || 'MISSING (will fall back to RESEND_FROM_EMAIL)',
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN ? `set (starts with: ${process.env.BLOB_READ_WRITE_TOKEN.slice(0, 10)}...)` : 'MISSING — file uploads will fail',
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 'set' : 'MISSING',
    GMAIL_USER: process.env.GMAIL_USER || 'MISSING',
  });
}
