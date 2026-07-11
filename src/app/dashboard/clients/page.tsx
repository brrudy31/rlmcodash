'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, UserX, Search, Home, ChevronDown, ChevronUp } from 'lucide-react';
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
}

interface OpenHouse {
  id: number;
  address: string;
  date: string;
}

const empty = { name: '', email: '', phone: '', open_house_id: '' };

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [openHouses, setOpenHouses] = useState<OpenHouse[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  async function load() {
    const [contactData, ohData] = await Promise.all([
      fetch('/api/clients').then((r) => r.json()),
      fetch('/api/open-houses').then((r) => r.json()),
    ]);
    setContacts(contactData);
    setOpenHouses(ohData);
  }

  useEffect(() => { load(); }, []);

  const ohMap = Object.fromEntries(openHouses.map((h: OpenHouse) => [h.id, h]));

  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search)
  );

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
    await fetch(`/api/clients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    load();
  }

  function ContactCard({ c }: { c: Contact }) {
    const hasAgent = c.agent_name || c.agent_phone || c.agent_email || c.agent_brokerage;
    const isExpanded = expanded === c.id;
    const oh = c.open_house_id ? ohMap[c.open_house_id] : null;
    const st = statusLabel(c.status);

    return (
      <div className="hover:bg-navy-750/40 transition-colors">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-9 h-9 rounded-full bg-navy-700 flex items-center justify-center flex-shrink-0 text-sm font-semibold text-gold-400">
            {c.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-white font-medium text-sm">{c.name}</p>
              {oh && (
                <span className="flex items-center gap-1 text-xs bg-gold-500/15 text-gold-400 border border-gold-500/30 px-2 py-0.5 rounded-full">
                  <Home className="w-3 h-3" /> {oh.address}
                </span>
              )}
              {c.opted_out_at && (
                <span className="flex items-center gap-1 text-xs text-red-400">
                  <UserX className="w-3 h-3" /> Opted Out
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <p className="text-navy-400 text-xs">{c.email}</p>
              {c.phone && <p className="text-navy-400 text-xs">{c.phone}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <select
              value={c.status ?? ''}
              onChange={(e) => updateStatus(c.id, e.target.value)}
              className={`text-xs bg-navy-700 border border-navy-600 rounded-lg px-2 py-1 focus:outline-none focus:border-gold-500 cursor-pointer ${st.color}`}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
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

  return (
    <div className="p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Contacts</h2>
          <p className="text-navy-400 text-sm mt-1">
            {contacts.length} total &middot; {represented.length} represented &middot; {unrepresented.length} unrepresented &middot; {contacts.filter((c) => c.opted_out_at).length} opted out
          </p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors">
          <Plus className="w-4 h-4" /> Add Contact
        </button>
      </div>

      <div className="bg-navy-800 rounded-xl border border-navy-700 overflow-hidden mb-6">
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-navy-750 border border-navy-600 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-navy-400 focus:outline-none focus:border-gold-500"
            />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <Section title="Represented Buyers" accent="bg-navy-700/60 text-white" items={represented} emptyMsg="No represented buyers yet." />
        <Section title="Unrepresented Buyers" accent="bg-blue-500/15 text-navy-300" items={unrepresented} emptyMsg="No unrepresented buyers yet." />
        {manual.length > 0 && (
          <Section title="Other Contacts" accent="bg-navy-600 text-navy-300" items={manual} emptyMsg="No other contacts." />
        )}
      </div>

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
              <select
                value={form.open_house_id}
                onChange={(e) => setForm({ ...form, open_house_id: e.target.value })}
                className="w-full bg-navy-750 border border-navy-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-gold-500 text-sm"
              >
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
