import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${request.headers.get('host')}`;
  const res = await fetch(`${appUrl}/api/briefing`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ''}` },
  });
  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to generate briefing' }, { status: 500 });
  }
  const data = await res.json();
  return NextResponse.json(data);
}
