import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    openHouseId,
    firstName,
    lastName,
    phone,
    email,
    hasHomeToBuy,
    hasHomeToSell,
    isPreApproved,
    workingWithAgent,
    agentName,
    agentPhone,
    agentEmail,
    agentBrokerage,
  } = body;

  if (!openHouseId || !firstName?.trim() || !lastName?.trim() || !phone?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }

  const db = getDb();
  const house = db.prepare('SELECT * FROM open_houses WHERE id = ?').get(openHouseId);
  if (!house) {
    return NextResponse.json({ error: 'Open house not found' }, { status: 404 });
  }

  // Save to local DB first
  const result = db.prepare(`
    INSERT INTO open_house_signins
      (open_house_id, first_name, last_name, phone, email,
       has_home_to_buy, has_home_to_sell, is_pre_approved, working_with_agent,
       agent_name, agent_phone, agent_email, agent_brokerage)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    openHouseId,
    firstName.trim(),
    lastName.trim(),
    phone.trim(),
    email.trim(),
    hasHomeToBuy ? 1 : 0,
    hasHomeToSell ? 1 : 0,
    isPreApproved ? 1 : 0,
    workingWithAgent ? 1 : 0,
    agentName?.trim() || null,
    agentPhone?.trim() || null,
    agentEmail?.trim() || null,
    agentBrokerage?.trim() || null,
  );

  // Push to GHL if configured
  let ghlContactId: string | null = null;
  if (GHL_API_KEY && GHL_LOCATION_ID) {
    try {
      const tags = ['Open House', `Property: ${house.address}`];
      if (hasHomeToBuy) tags.push('Looking To Buy');
      if (hasHomeToSell) tags.push('Has Home To Sell');
      if (!isPreApproved) tags.push('Not Pre-Approved');
      if (workingWithAgent) tags.push('Working With Agent');

      const agentLines: string[] = [];
      if (workingWithAgent) {
        agentLines.push('--- Buyer\'s Agent ---');
        if (agentName) agentLines.push(`Name: ${agentName}`);
        if (agentBrokerage) agentLines.push(`Brokerage: ${agentBrokerage}`);
        if (agentPhone) agentLines.push(`Phone: ${agentPhone}`);
        if (agentEmail) agentLines.push(`Email: ${agentEmail}`);
      }

      const ghlRes = await fetch('https://services.leadconnectorhq.com/contacts/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
          Version: '2021-07-28',
        },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          locationId: GHL_LOCATION_ID,
          tags,
          source: 'Open House Sign-In',
          ...(agentLines.length > 0 && { notes: agentLines.join('\n') }),
        }),
      });

      if (ghlRes.ok) {
        const ghlData = await ghlRes.json();
        ghlContactId = ghlData?.contact?.id ?? null;
        if (ghlContactId) {
          db.prepare('UPDATE open_house_signins SET ghl_contact_id = ? WHERE id = ?')
            .run(ghlContactId, result.lastInsertRowid);
        }
      }
    } catch {
      // GHL push failed — sign-in is still saved locally
    }
  }

  return NextResponse.json({ success: true, ghlContactId });
}
