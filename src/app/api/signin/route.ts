import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { openHouseId, firstName, lastName, phone, email, hasHomeToBuy, hasHomeToSell, isPreApproved, workingWithAgent, agentName, agentPhone, agentEmail, agentBrokerage, leadSource } = body;

  if (!openHouseId || !firstName?.trim() || !lastName?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  if (!workingWithAgent && (!phone?.trim() || !email?.trim())) {
    return NextResponse.json({ error: 'Phone and email are required' }, { status: 400 });
  }

  await ensureSchema();
  const db = getDb();
  const { rows: houseRows } = await db.execute({ sql: 'SELECT * FROM open_houses WHERE id = ?', args: [openHouseId] });
  if (!houseRows[0]) {
    return NextResponse.json({ error: 'Open house not found' }, { status: 404 });
  }
  const house = houseRows[0];

  // Calculate lead score
  let leadScore = 0;
  if (isPreApproved) leadScore += 2;
  if (!workingWithAgent) leadScore += 2;
  if (hasHomeToBuy) leadScore += 1;
  if (hasHomeToSell) leadScore += 1;
  const leadTier = leadScore >= 4 ? 'Hot Lead' : leadScore >= 2 ? 'Warm Lead' : 'Cold Lead';

  const result = await db.execute({
    sql: `INSERT INTO open_house_signins
            (open_house_id, first_name, last_name, phone, email,
             has_home_to_buy, has_home_to_sell, is_pre_approved, working_with_agent,
             agent_name, agent_phone, agent_email, agent_brokerage, lead_score, lead_source)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [openHouseId, firstName.trim(), lastName.trim(), phone?.trim() || null, email?.trim() || null, hasHomeToBuy ? 1 : 0, hasHomeToSell ? 1 : 0, isPreApproved ? 1 : 0, workingWithAgent ? 1 : 0, agentName?.trim() || null, agentPhone?.trim() || null, agentEmail?.trim() || null, agentBrokerage?.trim() || null, leadScore, leadSource?.trim() || null],
  });

  // Upsert into contacts scoped to the open house owner
  const ownerUserId = house.user_id ?? null;

  await db.execute({
    sql: `INSERT INTO clients (name, email, phone, source, open_house_id, agent_name, agent_phone, agent_email, agent_brokerage, working_with_agent, user_id)
          VALUES (?, ?, ?, 'Open House', ?, ?, ?, ?, ?, ?, ?)
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
      email?.trim().toLowerCase() || `noemail_${Date.now()}@placeholder.local`,
      phone?.trim() || null,
      openHouseId,
      agentName?.trim() || null,
      agentPhone?.trim() || null,
      agentEmail?.trim() || null,
      agentBrokerage?.trim() || null,
      workingWithAgent ? 1 : 0,
      ownerUserId,
    ],
  });

  // Auto-update open house represented/unrepresented counts from actual sign-in data
  await db.execute({
    sql: `UPDATE open_houses SET
            represented_buyers   = (SELECT COUNT(*) FROM clients WHERE open_house_id = ? AND working_with_agent = 1),
            unrepresented_buyers = (SELECT COUNT(*) FROM clients WHERE open_house_id = ? AND working_with_agent = 0),
            total_attendees      = neighbors + (SELECT COUNT(*) FROM clients WHERE open_house_id = ?)
          WHERE id = ?`,
    args: [openHouseId, openHouseId, openHouseId, openHouseId],
  });

  // Push to CRM — look up settings by house owner, or fall back to first configured user
  let crmContactId: string | null = null;
  let crmError: string | null = null;
  const { rows: crmRows } = await db.execute({
    sql: house.user_id
      ? 'SELECT crm_type, api_key, location_id FROM user_crm_settings WHERE user_id = ?'
      : 'SELECT crm_type, api_key, location_id FROM user_crm_settings WHERE crm_type != ? LIMIT 1',
    args: house.user_id ? [house.user_id] : ['none'],
  });
  const crm = crmRows[0];
  if (crm && crm.crm_type !== 'none' && crm.api_key) {
    const tags = ['Open House', `Property: ${house.address}`, 'Just Signed In', leadTier];
    if (hasHomeToBuy) tags.push('Looking To Buy');
    if (hasHomeToSell) tags.push('Has Home To Sell');
    if (isPreApproved) tags.push('Pre-Approved');
    if (!isPreApproved) tags.push('Not Pre-Approved');
    if (workingWithAgent) { tags.push('Working With Agent'); tags.push('Represented Buyer'); }

    const agentNote = workingWithAgent
      ? ["--- Buyer's Agent ---", agentName && `Name: ${agentName}`, agentBrokerage && `Brokerage: ${agentBrokerage}`, agentPhone && `Phone: ${agentPhone}`, agentEmail && `Email: ${agentEmail}`].filter(Boolean).join('\n')
      : null;

    try {
      if (crm.crm_type === 'ghl' && crm.location_id) {
        const res = await fetch('https://services.leadconnectorhq.com/contacts/', {
          method: 'POST',
          headers: { Authorization: `Bearer ${crm.api_key}`, 'Content-Type': 'application/json', Version: '2021-07-28' },
          body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phone?.trim() || undefined, email: email?.trim() || undefined, locationId: crm.location_id, tags, source: 'Open House Sign-In', ...(agentNote && { notes: agentNote }) }),
        });
        if (res.ok) {
          crmContactId = (await res.json())?.contact?.id ?? null;
        } else {
          const errBody = await res.json().catch(() => ({}));
          crmError = `GHL ${res.status}: ${JSON.stringify(errBody)}`;
        }

      } else if (crm.crm_type === 'followupboss') {
        const res = await fetch('https://api.followupboss.com/v1/events', {
          method: 'POST',
          headers: { Authorization: `Basic ${Buffer.from(`${crm.api_key}:`).toString('base64')}`, 'Content-Type': 'application/json', 'X-System': 'RLM&CO Dashboard', 'X-System-Key': crm.api_key as string },
          body: JSON.stringify({
            source: 'Open House', type: 'Registration',
            people: [{ firstName: firstName.trim(), lastName: lastName.trim(), emails: email ? [{ value: email.trim() }] : [], phones: phone ? [{ value: phone.trim() }] : [], tags }],
            ...(agentNote && { description: agentNote }),
          }),
        });
        if (res.ok) crmContactId = (await res.json())?.id?.toString() ?? null;
        else { const e = await res.json().catch(() => ({})); crmError = `FUB ${res.status}: ${JSON.stringify(e)}`; }

      } else if (crm.crm_type === 'hubspot') {
        const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
          method: 'POST',
          headers: { Authorization: `Bearer ${crm.api_key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ properties: { firstname: firstName.trim(), lastname: lastName.trim(), ...(email && { email: email.trim() }), ...(phone && { phone: phone.trim() }), hs_lead_status: 'NEW', lead_source: 'Open House', ...(agentNote && { notes_last_activity: agentNote }) } }),
        });
        if (res.ok) crmContactId = (await res.json())?.id?.toString() ?? null;
        else { const e = await res.json().catch(() => ({})); crmError = `HubSpot ${res.status}: ${JSON.stringify(e)}`; }
      }

      if (crmContactId) {
        await db.execute({ sql: 'UPDATE open_house_signins SET ghl_contact_id = ? WHERE id = ?', args: [crmContactId, Number(result.lastInsertRowid)] });
      }
    } catch (err) {
      crmError = String(err);
    }
  }

  return NextResponse.json({ success: true, crmContactId, crmError, leadScore, leadTier });
}
