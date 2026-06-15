import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { openHouseId, firstName, lastName, phone, email, hasHomeToBuy, hasHomeToSell, isPreApproved, workingWithAgent, agentName, agentPhone, agentEmail, agentBrokerage } = body;

  if (!openHouseId || !firstName?.trim() || !lastName?.trim() || !phone?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }

  await ensureSchema();
  const db = getDb();
  const { rows: houseRows } = await db.execute({ sql: 'SELECT * FROM open_houses WHERE id = ?', args: [openHouseId] });
  if (!houseRows[0]) {
    return NextResponse.json({ error: 'Open house not found' }, { status: 404 });
  }
  const house = houseRows[0];

  const result = await db.execute({
    sql: `INSERT INTO open_house_signins
            (open_house_id, first_name, last_name, phone, email,
             has_home_to_buy, has_home_to_sell, is_pre_approved, working_with_agent,
             agent_name, agent_phone, agent_email, agent_brokerage)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [openHouseId, firstName.trim(), lastName.trim(), phone.trim(), email.trim(), hasHomeToBuy ? 1 : 0, hasHomeToSell ? 1 : 0, isPreApproved ? 1 : 0, workingWithAgent ? 1 : 0, agentName?.trim() || null, agentPhone?.trim() || null, agentEmail?.trim() || null, agentBrokerage?.trim() || null],
  });

  // Upsert into contacts — insert new or update phone/agent info if email already exists
  await db.execute({
    sql: `INSERT INTO clients (name, email, phone, source, open_house_id, agent_name, agent_phone, agent_email, agent_brokerage, working_with_agent)
          VALUES (?, ?, ?, 'Open House', ?, ?, ?, ?, ?, ?)
          ON CONFLICT(email) DO UPDATE SET
            phone = COALESCE(excluded.phone, phone),
            source = COALESCE(source, 'Open House'),
            open_house_id = COALESCE(excluded.open_house_id, open_house_id),
            agent_name = COALESCE(excluded.agent_name, agent_name),
            agent_phone = COALESCE(excluded.agent_phone, agent_phone),
            agent_email = COALESCE(excluded.agent_email, agent_email),
            agent_brokerage = COALESCE(excluded.agent_brokerage, agent_brokerage),
            working_with_agent = COALESCE(excluded.working_with_agent, working_with_agent)`,
    args: [
      `${firstName.trim()} ${lastName.trim()}`,
      email.trim().toLowerCase(),
      phone.trim(),
      openHouseId,
      agentName?.trim() || null,
      agentPhone?.trim() || null,
      agentEmail?.trim() || null,
      agentBrokerage?.trim() || null,
      workingWithAgent ? 1 : 0,
    ],
  });

  // Auto-update open house represented/unrepresented counts from actual sign-in data
  await db.execute({
    sql: `UPDATE open_houses SET
            represented_buyers = (SELECT COUNT(*) FROM open_house_signins WHERE open_house_id = ? AND working_with_agent = 1),
            unrepresented_buyers = (SELECT COUNT(*) FROM open_house_signins WHERE open_house_id = ? AND working_with_agent = 0),
            total_attendees = (SELECT COUNT(*) FROM open_house_signins WHERE open_house_id = ?)
          WHERE id = ?`,
    args: [openHouseId, openHouseId, openHouseId, openHouseId],
  });

  let ghlContactId: string | null = null;
  if (GHL_API_KEY && GHL_LOCATION_ID) {
    try {
      const tags = ['Open House', `Property: ${house.address}`];
      if (hasHomeToBuy) tags.push('Looking To Buy');
      if (hasHomeToSell) tags.push('Has Home To Sell');
      if (!isPreApproved) tags.push('Not Pre-Approved');
      if (workingWithAgent) {
        tags.push('Working With Agent');
        tags.push('Represented Buyer');
      }

      const agentLines: string[] = [];
      if (workingWithAgent) {
        agentLines.push("--- Buyer's Agent ---");
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
          await db.execute({ sql: 'UPDATE open_house_signins SET ghl_contact_id = ? WHERE id = ?', args: [ghlContactId, Number(result.lastInsertRowid)] });
        }
      }
    } catch {
      // GHL push failed — sign-in still saved locally
    }
  }

  return NextResponse.json({ success: true, ghlContactId });
}
