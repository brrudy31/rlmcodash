import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    RESEND_API_KEY: process.env.RESEND_API_KEY ? `set (starts with: ${process.env.RESEND_API_KEY.slice(0, 6)}...)` : 'MISSING',
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || 'MISSING',
    SUMMARY_EMAIL_TO: process.env.SUMMARY_EMAIL_TO || 'MISSING (will fall back to RESEND_FROM_EMAIL)',
  });
}
