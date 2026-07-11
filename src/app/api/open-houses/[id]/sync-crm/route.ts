import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  await ensureSchema();
  const db = getDb();

  // Verify open house belongs to user (or is legacy unassigned)
  const { rows: houseRows } = await db.execute({
    sql: 'SELECT * FROM open_houses WHERE id = ? AND (user_id = ? OR user_id IS NULL)',
    args: [id, userId],
  });
  if (!houseRows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const house = houseRows[0];

  // Get CRM settings for this user
  const { rows: crmRows } = await db.execute({
    sql: 'SELECT crm_type, api_key, location_id FROM user_crm_settings WHERE user_id = ?',
    args: [userId],
  });
  const crm = crmRows[0];
  if (!crm || crm.crm_type === 'none' || !crm.api_key) {
    return NextResponse.json({ error: 'No CRM configured. Go to Settings to set one up.' }, { status: 400 });
  }

  // Get all sign-ins for this open house that haven't been synced yet
  const { rows: signins } = await db.execute({
    sql: 'SELECT * FROM open_house_signins WHERE open_house_id = ? AND ghl_contact_id IS NULL ORDER BY created_at ASC',
    args: [id],
  });

  if (signins.length === 0) {
    return NextResponse.json({ synced: 0, failed: 0, message: 'All contacts already synced.' });
  }

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const s of signins) {
    const tags = ['Open House', `Property: ${house.address}`];
    if (s.has_home_to_buy) tags.push('Looking To Buy');
    if (s.has_home_to_sell) tags.push('Has Home To Sell');
    if (!s.is_pre_approved) tags.push('Not Pre-Approved');
    if (s.working_with_agent) { tags.push('Working With Agent'); tags.push('Represented Buyer'); }

    const agentNote = s.working_with_agent
      ? ["--- Buyer's Agent ---", s.agent_name && `Name: ${s.agent_name}`, s.agent_brokerage && `Brokerage: ${s.agent_brokerage}`, s.agent_phone && `Phone: ${s.agent_phone}`, s.agent_email && `Email: ${s.agent_email}`].filter(Boolean).join('\n')
      : null;

    try {
      let contactId: string | null = null;

      if (crm.crm_type === 'ghl' && crm.location_id) {
        const res = await fetch('https://services.leadconnectorhq.com/contacts/', {
          method: 'POST',
          headers: { Authorization: `Bearer ${crm.api_key}`, 'Content-Type': 'application/json', Version: '2021-07-28' },
          body: JSON.stringify({
            firstName: String(s.first_name),
            lastName: String(s.last_name),
            phone: s.phone ? String(s.phone) : undefined,
            email: s.email ? String(s.email) : undefined,
            locationId: crm.location_id,
            tags,
            source: 'Open House Sign-In',
            ...(agentNote && { notes: agentNote }),
          }),
        });
        if (res.ok) {
          contactId = (await res.json())?.contact?.id ?? null;
        } else {
          const e = await res.json().catch(() => ({}));
          errors.push(`${s.first_name} ${s.last_name}: GHL ${res.status} - ${JSON.stringify(e)}`);
          failed++;
          continue;
        }

      } else if (crm.crm_type === 'followupboss') {
        const res = await fetch('https://api.followupboss.com/v1/events', {
          method: 'POST',
          headers: { Authorization: `Basic ${Buffer.from(`${crm.api_key}:`).toString('base64')}`, 'Content-Type': 'application/json', 'X-System': 'RLM&CO Dashboard', 'X-System-Key': String(crm.api_key) },
          body: JSON.stringify({
            source: 'Open House', type: 'Registration',
            people: [{ firstName: String(s.first_name), lastName: String(s.last_name), emails: s.email ? [{ value: String(s.email) }] : [], phones: s.phone ? [{ value: String(s.phone) }] : [], tags }],
            ...(agentNote && { description: agentNote }),
          }),
        });
        if (res.ok) contactId = (await res.json())?.id?.toString() ?? null;
        else { const e = await res.json().catch(() => ({})); errors.push(`${s.first_name} ${s.last_name}: FUB ${res.status} - ${JSON.stringify(e)}`); failed++; continue; }

      } else if (crm.crm_type === 'hubspot') {
        const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
          method: 'POST',
          headers: { Authorization: `Bearer ${crm.api_key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ properties: { firstname: String(s.first_name), lastname: String(s.last_name), ...(s.email && { email: String(s.email) }), ...(s.phone && { phone: String(s.phone) }), hs_lead_status: 'NEW', lead_source: 'Open House' } }),
        });
        if (res.ok) contactId = (await res.json())?.id?.toString() ?? null;
        else { const e = await res.json().catch(() => ({})); errors.push(`${s.first_name} ${s.last_name}: HubSpot ${res.status} - ${JSON.stringify(e)}`); failed++; continue; }
      }

      if (contactId) {
        await db.execute({ sql: 'UPDATE open_house_signins SET ghl_contact_id = ? WHERE id = ?', args: [contactId, Number(s.id)] });
        synced++;
      }
    } catch (err) {
      errors.push(`${s.first_name} ${s.last_name}: ${String(err)}`);
      failed++;
    }
  }

  return NextResponse.json({ synced, failed, total: signins.length, errors });
}
