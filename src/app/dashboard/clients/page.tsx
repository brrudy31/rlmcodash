'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, UserX, Search, Home, ChevronDown, ChevronUp, Phone, MessageSquare, Flame, Thermometer, Snowflake, CheckCircle, Home as HomeIcon } from 'lucide-react';
import Modal from '@/components/Modal';

const STATUS_OPTIONS = [
  { value: '', label: 'No Status', color: 'text-navy-400' },
  { value: 'converted_buyer', label: 'Converted — Buyer', color: 'text-white' },
  { value: 'converted_seller', label: 'Converted — Seller', color: 'text-white' },
  { value: 'in_progress', label: 'In Progress', color: 'text-navy-300' },
  { value: 'lost', label: 'Lost', color: 'text-red-400' },
];

function statusLabel(val: string | null) {
  return STATUS_OPTIONS.find((s) => s.value === (val ?? '')) ?? STATUS_OPTIONS[0];
}

function TempBadge({ temp }: { temp: string | null }) {
  if (!temp) return null;
  const map: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
    hot:  { label: 'Hot',  icon: Flame,       cls: 'text-orange-400 bg-orange-400/10 border-orange-400/30' },
    warm: { label: 'Warm', icon: Thermometer, cls: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' },
    cold: { label: 'Cold', icon: Snowflake,   cls: 'text-blue-400 bg-blue-400/10 border-blue-400/30'   },
  };
  const m = map[temp];
  if (!m) return null;
  const Icon = m.icon;
  return (
    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-semibold ${m.cls}`}>
      <Icon className="w-3 h-3" /> {m.label}
    </span>
  );
}

interface Contact {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  source: string | null;
  open_house_id: number | null;
  working_with_agent: number | null;
  status: string | null;
  agent_name: string | null;
  agent_phone: string | null;
  agent_email: string | null;
  agent_brokerage: string | null;
  opted_out_at: string | null;
  created_at: string;
  contact_count: number;
  last_contacted_at: string | null;
  met_in_person: number;
  homes_shown_count: number;
  temperature: string | null;
  temperature_override: number;
}

interface ContactLogEntry {
  id: number;
  type: string;
  outcome: string;
  notes: string | null;
  logged_at: string;
}

interface OpenHouse {
  id: number;
  address: string;
  date: string;
}

const SOURCES = ['All', 'Open House', 'Team Referral', 'Other'] as const;
type SourceFilter = (typeof SOURCES)[number];

const empty = { name: '', email: '', phone: '', open_house_id: '' };

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [openHouses, setOpenHouses] = useState<OpenHouse[]>([]);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('All');
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  // Contact log modal
  const [logContact, setLogContact] = useState<Contact | null>(null);
  const [logEntries, setLogEntries] = useState<ContactLogEntry[]>([]);
  const [logForm, setLogForm] = useState({ type: 'call', outcome: 'no_answer', notes: '' });
  const [logSaving, setLogSaving] = useState(false);

  async function load() {
    const [contactData, ohData] = await Promise.all([
      fetch('/api/clients').then((r) => r.json()),
      fetch('/api/open-houses').then((r) => r.json()),
    ]);
    setContacts(contactData);
    setOpenHouses(ohData);
  }

  useEffect(() => { load(); }, []);

  async function openLog(c: Contact) {
    const data = await fetch(`/api/clients/${c.id}/contacts`).then((r) => r.json());
    setLogEntries(Array.isArray(data) ? data : []);
    setLogContact(c);
    setLogForm({ type: 'call', outcome: 'no_answer', notes: '' });
  }

  async function addLogEntry() {
    if (!logContact) return;
    setLogSaving(true);
    await fetch(`/api/clients/${logContact.id}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logForm),
    });
    const data = await fetch(`/api/clients/${logContact.id}/contacts`).then((r) => r.json());
    setLogEntries(Array.isArray(data) ? data : []);
    setLogForm({ type: 'call', outcome: 'no_answer', notes: '' });
    setLogSaving(false);
    load(); // refresh temperature
  }

  async function setTemperature(c: Contact, temp: string | null) {
    if (temp) {
      await fetch(`/api/clients/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ temperature: temp }) });
    } else {
      await fetch(`/api/clients/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ temperature_override: false }) });
    }
    load();
  }

  async function toggleMet(c: Contact) {
    await fetch(`/api/clients/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ met_in_person: !c.met_in_person }) });
    load();
  }

  async function updateHomesShown(c: Contact, n: number) {
    await fetch(`/api/clients/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ homes_shown_count: n }) });
    load();
  }

  const ohMap = Object.fromEntries(openHouses.map((h: OpenHouse) => [h.id, h]));

  // Filter by search + source tab
  const filtered = contacts.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search);
    if (!matchesSearch) return false;
    if (sourceFilter === 'All') return true;
    if (sourceFilter === 'Open House') return c.source === 'Open House';
    if (sourceFilter === 'Team Referral') return c.source === 'team_referral';
    if (sourceFilter === 'Other') return c.source !== 'Open House' && c.source !== 'team_referral';
    return true;
  });

  const fromOpenHouse = filtered.filter((c) => c.source === 'Open House');
  const represented = fromOpenHouse.filter((c) => c.working_with_agent);
  const unrepresented = fromOpenHouse.filter((c) => !c.working_with_agent);
  const manual = filtered.filter((c) => c.source !== 'Open House');

  function openAdd() { setForm(empty); setError(''); setModal('add'); }

  function openEdit(c: Contact) {
    setEditing(c);
    setForm({ name: c.name, email: c.email, phone: c.phone || '', open_house_id: c.open_house_id ? String(c.open_house_id) : '' });
    setError(''); setModal('edit');
  }

  async function save() {
    setSaving(true); setError('');
    if (modal === 'edit') {
      const res = await fetch(`/api/clients/${editing!.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setSaving(false); return; }
      await fetch(`/api/clients/${editing!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ open_house_id: form.open_house_id ? Number(form.open_house_id) : null }),
      });
    } else {
      const res = await fetch('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone, open_house_id: form.open_house_id ? Number(form.open_house_id) : null }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setSaving(false); return; }
    }
    setModal(null); setSaving(false); load();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await fetch(`/api/clients/${deleteId}`, { method: 'DELETE' });
    setDeleteId(null); load();
  }

  async function updateStatus(id: number, status: string) {
    await fetch(`/api/clients/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    load();
  }

  function timeAgo(iso: string) {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  function ContactCard({ c }: { c: Contact }) {
    const hasAgent = c.agent_name || c.agent_phone || c.agent_email || c.agent_brokerage;
    const isExpanded = expanded === c.id;
    const oh = c.open_house_id ? ohMap[c.open_house_id] : null;
    const st = statusLabel(c.status);

    return (
      <div className="hover:bg-navy-750/40 transition-colors">
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="w-9 h-9 rounded-full bg-navy-700 flex items-center justify-center flex-shrink-0 text-sm font-semibold text-gold-400 mt-0.5">
            {c.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-white font-medium text-sm">{c.name}</p>
              <TempBadge temp={c.temperature} />
              {oh && (
                <span className="flex items-center gap-1 text-xs bg-gold-500/15 text-gold-400 border border-gold-500/30 px-2 py-0.5 rounded-full">
                  <Home className="w-3 h-3" /> {oh.address}
                </span>
              )}
              {c.met_in_person ? (
                <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle className="w-3 h-3" /> Met</span>
              ) : null}
              {c.opted_out_at && (
                <span className="flex items-center gap-1 text-xs text-red-400"><UserX className="w-3 h-3" /> Opted Out</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <p className="text-navy-400 text-xs">{c.email}</p>
              {c.phone && <p className="text-navy-400 text-xs">{c.phone}</p>}
              {c.contact_count > 0 && (
                <p className="text-navy-500 text-xs">{c.contact_count} contact{c.contact_count !== 1 ? 's' : ''}{c.last_contacted_at ? ` · last ${timeAgo(c.last_contacted_at)}` : ''}</p>
              )}
              {c.homes_shown_count > 0 && (
                <p className="text-navy-500 text-xs flex items-center gap-1"><HomeIcon className="w-3 h-3" /> {c.homes_shown_count} shown</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
            {/* Homes shown quick +/- */}
            <div className="flex items-center gap-0.5 bg-navy-750 border border-navy-600 rounded-lg px-1.5 py-1 text-xs">
              <button onClick={() => updateHomesShown(c, Math.max(0, c.homes_shown_count - 1))} className="text-navy-400 hover:text-white w-4 h-4 flex items-center justify-center">−</button>
              <span className="text-navy-300 w-5 text-center">{c.homes_shown_count}</span>
              <button onClick={() => updateHomesShown(c, c.homes_shown_count + 1)} className="text-navy-400 hover:text-white w-4 h-4 flex items-center justify-center">+</button>
            </div>
            <select
              value={c.status ?? ''}
              onChange={(e) => updateStatus(c.id, e.target.value)}
              className={`text-xs bg-navy-700 border border-navy-600 rounded-lg px-2 py-1 focus:outline-none focus:border-gold-500 cursor-pointer ${st.color}`}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              onClick={() => openLog(c)}
              title="Log contact attempt"
              className="p-1.5 text-navy-400 hover:text-gold-400 hover:bg-navy-700 rounded transition-colors"
            >
              <Phone className="w-4 h-4" />
            </button>
            {hasAgent && (
              <button
                onClick={() => setExpanded(isExpanded ? null : c.id)}
                className="p-1.5 text-navy-400 hover:text-white hover:bg-navy-700 rounded transition-colors"
                title="View agent info"
              >
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
            <button onClick={() => openEdit(c)} className="p-1.5 text-navy-400 hover:text-gold-400 hover:bg-navy-700 rounded transition-colors">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={() => setDeleteId(c.id)} className="p-1.5 text-navy-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        {hasAgent && isExpanded && (
          <div className="px-4 pb-3 pl-16">
            <div className="bg-navy-750 border border-navy-600 rounded-lg p-3 space-y-1">
              <p className="text-xs font-semibold text-white uppercase tracking-wide mb-2">Buyer&apos;s Agent</p>
              {c.agent_name && <p className="text-sm text-white font-medium">{c.agent_name}{c.agent_brokerage ? ` · ${c.agent_brokerage}` : ''}</p>}
              {c.agent_phone && <p className="text-xs text-navy-300">{c.agent_phone}</p>}
              {c.agent_email && <p className="text-xs text-navy-300">{c.agent_email}</p>}
            </div>
          </div>
        )}
      </div>
    );
  }

  function Section({ title, accent, items, emptyMsg }: { title: string; accent: string; items: Contact[]; emptyMsg: string }) {
    return (
      <div className="bg-navy-800 rounded-xl border border-navy-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-navy-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${accent}`}>{items.length}</span>
        </div>
        <div className="divide-y divide-navy-750">
          {items.length === 0
            ? <p className="text-center py-8 text-navy-500 text-sm">{emptyMsg}</p>
            : items.map((c) => <ContactCard key={c.id} c={c} />)
          }
        </div>
      </div>
    );
  }

  const outcomeColor = (o: string) =>
    o === 'responded' ? 'text-green-400' : o === 'answered' ? 'text-yellow-400' : 'text-navy-500';

  return (
    <div className="p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Contacts</h2>
          <p className="text-navy-400 text-sm mt-1">
            {contacts.length} total &middot; {contacts.filter((c) => c.source === 'Open House' && !c.working_with_agent).length} unrepresented &middot; {contacts.filter((c) => c.opted_out_at).length} opted out
          </p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors">
          <Plus className="w-4 h-4" /> Add Contact
        </button>
      </div>

      {/* Search + Source filter */}
      <div className="bg-navy-800 rounded-xl border border-navy-700 overflow-hidden mb-6">
        <div className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-navy-750 border border-navy-600 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-navy-400 focus:outline-none focus:border-gold-500"
            />
          </div>
          <div className="flex gap-1">
            {SOURCES.map((s) => (
              <button key={s} onClick={() => setSourceFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${sourceFilter === s ? 'bg-gold-500 text-navy-900' : 'bg-navy-750 text-navy-400 hover:text-white border border-navy-600'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {(sourceFilter === 'All' || sourceFilter === 'Open House') && (
          <>
            <Section title="Represented Buyers" accent="bg-navy-700/60 text-white" items={represented} emptyMsg="No represented buyers yet." />
            <Section title="Unrepresented Buyers" accent="bg-blue-500/15 text-navy-300" items={unrepresented} emptyMsg="No unrepresented buyers yet." />
          </>
        )}
        {(sourceFilter === 'All' || sourceFilter === 'Team Referral' || sourceFilter === 'Other') && manual.length > 0 && (
          <Section title="Other Contacts" accent="bg-navy-600 text-navy-300" items={manual} emptyMsg="No other contacts." />
        )}
        {filtered.length === 0 && (
          <div className="bg-navy-800 rounded-xl border border-navy-700 p-12 text-center">
            <p className="text-navy-500 text-sm">No contacts match your filters.</p>
          </div>
        )}
      </div>

      {/* Contact Log Modal */}
      {logContact && (
        <Modal title={`Contact Log — ${logContact.name}`} onClose={() => setLogContact(null)} size="lg">
          <div className="space-y-5">
            {/* Temperature control */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-navy-400 text-xs font-medium">Temperature:</span>
              {(['hot', 'warm', 'cold'] as const).map((t) => (
                <button key={t} onClick={() => setTemperature(logContact, logContact.temperature === t && logContact.temperature_override ? null : t)}
                  className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border transition-all font-semibold capitalize
                    ${logContact.temperature === t ? (t === 'hot' ? 'bg-orange-400/15 border-orange-400/50 text-orange-400' : t === 'warm' ? 'bg-yellow-400/15 border-yellow-400/50 text-yellow-400' : 'bg-blue-400/15 border-blue-400/50 text-blue-400') : 'bg-navy-750 border-navy-600 text-navy-400 hover:text-white'}`}>
                  {t}
                </button>
              ))}
              {logContact.temperature_override ? <span className="text-xs text-gold-400 italic">Manual override active</span> : <span className="text-xs text-navy-500 italic">Auto-calculated</span>}
            </div>

            {/* Met in person + homes shown */}
            <div className="flex items-center gap-4 flex-wrap text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => { toggleMet(logContact); setLogContact((prev) => prev ? { ...prev, met_in_person: prev.met_in_person ? 0 : 1 } : prev); }}
                  className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${logContact.met_in_person ? 'bg-white border-white' : 'border-navy-500'}`}>
                  {Boolean(logContact.met_in_person) && <svg className="w-3 h-3 text-navy-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className="text-navy-300">Met in person</span>
              </label>
              <div className="flex items-center gap-2 text-navy-300">
                <HomeIcon className="w-4 h-4 text-navy-400" />
                <span className="text-xs text-navy-400">Homes shown:</span>
                <button onClick={() => { const n = Math.max(0, logContact.homes_shown_count - 1); updateHomesShown(logContact, n); setLogContact((p) => p ? { ...p, homes_shown_count: n } : p); }} className="text-navy-400 hover:text-white">−</button>
                <span className="font-semibold">{logContact.homes_shown_count}</span>
                <button onClick={() => { const n = logContact.homes_shown_count + 1; updateHomesShown(logContact, n); setLogContact((p) => p ? { ...p, homes_shown_count: n } : p); }} className="text-navy-400 hover:text-white">+</button>
              </div>
            </div>

            {/* New log entry form */}
            <div className="bg-navy-750 border border-navy-600 rounded-xl p-4">
              <p className="text-xs font-semibold text-navy-400 uppercase tracking-wide mb-3">Log New Contact</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-navy-400 mb-1 block">Type</label>
                  <select value={logForm.type} onChange={(e) => setLogForm((p) => ({ ...p, type: e.target.value }))}
                    className="w-full bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-500">
                    <option value="call">📞 Call</option>
                    <option value="text">💬 Text</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-navy-400 mb-1 block">Outcome</label>
                  <select value={logForm.outcome} onChange={(e) => setLogForm((p) => ({ ...p, outcome: e.target.value }))}
                    className="w-full bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-500">
                    <option value="no_answer">No Answer</option>
                    <option value="answered">Answered</option>
                    <option value="responded">Responded ✓</option>
                  </select>
                </div>
              </div>
              <textarea value={logForm.notes} onChange={(e) => setLogForm((p) => ({ ...p, notes: e.target.value }))} rows={2}
                placeholder="Notes (optional)..."
                className="w-full bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-white placeholder-navy-500 text-sm focus:outline-none focus:border-gold-500 resize-none mb-3" />
              <button onClick={addLogEntry} disabled={logSaving}
                className="w-full bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-navy-900 font-semibold py-2 rounded-lg text-sm transition-colors">
                {logSaving ? 'Logging…' : 'Log Contact'}
              </button>
            </div>

            {/* Timeline */}
            {logEntries.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-navy-400 uppercase tracking-wide mb-3">History ({logEntries.length})</p>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {logEntries.map((e) => (
                    <div key={e.id} className="flex items-start gap-3 bg-navy-750 border border-navy-700 rounded-lg px-3 py-2.5">
                      <div className="flex-shrink-0 mt-0.5">
                        {e.type === 'call' ? <Phone className="w-3.5 h-3.5 text-navy-400" /> : <MessageSquare className="w-3.5 h-3.5 text-navy-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-xs font-medium capitalize">{e.type}</span>
                          <span className={`text-xs font-semibold capitalize ${outcomeColor(e.outcome)}`}>{e.outcome.replace('_', ' ')}</span>
                        </div>
                        {e.notes && <p className="text-navy-400 text-xs mt-0.5">{e.notes}</p>}
                      </div>
                      <span className="text-navy-600 text-xs flex-shrink-0">{new Date(e.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {logEntries.length === 0 && (
              <p className="text-navy-500 text-xs text-center py-2">No contact history yet.</p>
            )}
          </div>
        </Modal>
      )}

      {modal && (
        <Modal title={modal === 'add' ? 'Add Contact' : 'Edit Contact'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1.5">Full Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-navy-750 border border-navy-600 rounded-lg px-4 py-2.5 text-white placeholder-navy-400 focus:outline-none focus:border-gold-500 text-sm"
                placeholder="Jane Smith" autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1.5">Email Address</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-navy-750 border border-navy-600 rounded-lg px-4 py-2.5 text-white placeholder-navy-400 focus:outline-none focus:border-gold-500 text-sm"
                placeholder="jane@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1.5">Phone <span className="text-navy-500">(optional)</span></label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full bg-navy-750 border border-navy-600 rounded-lg px-4 py-2.5 text-white placeholder-navy-400 focus:outline-none focus:border-gold-500 text-sm"
                placeholder="215-555-0100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1.5">Open House <span className="text-navy-500">(where you met them)</span></label>
              <select value={form.open_house_id} onChange={(e) => setForm({ ...form, open_house_id: e.target.value })}
                className="w-full bg-navy-750 border border-navy-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-gold-500 text-sm">
                <option value="">— Not from an open house —</option>
                {openHouses.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.address} ({new Date(h.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})
                  </option>
                ))}
              </select>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="flex-1 border border-navy-600 text-navy-300 hover:text-white hover:border-navy-500 py-2.5 rounded-lg text-sm transition-colors">Cancel</button>
              <button onClick={save} disabled={saving || !form.name.trim() || !form.email.trim()}
                className="flex-1 bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-navy-900 font-semibold py-2.5 rounded-lg text-sm transition-colors">
                {saving ? 'Saving...' : modal === 'add' ? 'Add Contact' : 'Save Changes'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && (
        <Modal title="Delete Contact" onClose={() => setDeleteId(null)} size="sm">
          <p className="text-navy-300 text-sm mb-6">Are you sure you want to delete this contact? This cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteId(null)} className="flex-1 border border-navy-600 text-navy-300 hover:text-white py-2.5 rounded-lg text-sm transition-colors">Cancel</button>
            <button onClick={confirmDelete} className="flex-1 bg-red-500 hover:bg-red-400 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
