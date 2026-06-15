'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, QrCode, Users, Mail } from 'lucide-react';
import Modal from '@/components/Modal';
import { QRCodeSVG } from 'qrcode.react';

interface OpenHouse {
  id: number; date: string; address: string; neighborhood: string | null;
  city: string; start_time: string | null; end_time: string | null;
  total_attendees: number; neighbors: number; represented_buyers: number;
  unrepresented_buyers: number; notes: string | null; summary_sent_at: string | null; created_at: string;
}

interface SignIn {
  id: number; first_name: string; last_name: string; phone: string; email: string;
  has_home_to_buy: number; has_home_to_sell: number; is_pre_approved: number;
  working_with_agent: number;
  agent_name: string | null; agent_phone: string | null; agent_email: string | null; agent_brokerage: string | null;
  ghl_contact_id: string | null; created_at: string;
}

const emptyForm = {
  date: '', address: '', neighborhood: '', city: '', start_time: '', end_time: '',
  total_attendees: '', neighbors: '', represented_buyers: '', unrepresented_buyers: '', notes: '',
};

type SortKey = keyof OpenHouse;

export default function OpenHousesPage() {
  const [houses, setHouses] = useState<OpenHouse[]>([]);
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<OpenHouse | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' });
  const [qrHouse, setQrHouse] = useState<OpenHouse | null>(null);
  const [signinsHouse, setSigninsHouse] = useState<OpenHouse | null>(null);
  const [signins, setSignins] = useState<SignIn[]>([]);
  const [sendingSummary, setSendingSummary] = useState<number | null>(null);

  async function load() {
    const data = await fetch('/api/open-houses').then((r) => r.json());
    setHouses(data);
  }

  useEffect(() => { load(); }, []);

  function sortBy(key: SortKey) {
    setSort((prev) => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
  }

  const sorted = [...houses].sort((a, b) => {
    const av = a[sort.key] ?? '';
    const bv = b[sort.key] ?? '';
    if (av < bv) return sort.dir === 'asc' ? -1 : 1;
    if (av > bv) return sort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  function openAdd() {
    setForm({ ...emptyForm, date: new Date().toISOString().split('T')[0] });
    setError(''); setModal('add');
  }

  function openEdit(h: OpenHouse) {
    setEditing(h);
    setForm({
      date: h.date, address: h.address, neighborhood: h.neighborhood || '',
      city: h.city, start_time: h.start_time || '', end_time: h.end_time || '',
      total_attendees: String(h.total_attendees), neighbors: String(h.neighbors),
      represented_buyers: String(h.represented_buyers), unrepresented_buyers: String(h.unrepresented_buyers),
      notes: h.notes || '',
    });
    setError(''); setModal('edit');
  }

  async function save() {
    setSaving(true); setError('');
    const url = modal === 'edit' ? `/api/open-houses/${editing!.id}` : '/api/open-houses';
    const method = modal === 'edit' ? 'PUT' : 'POST';
    const payload = {
      ...form,
      total_attendees: Number(form.total_attendees) || 0,
      neighbors: Number(form.neighbors) || 0,
      represented_buyers: Number(form.represented_buyers) || 0,
      unrepresented_buyers: Number(form.unrepresented_buyers) || 0,
    };
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSaving(false); return; }
    setModal(null); setSaving(false); load();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await fetch(`/api/open-houses/${deleteId}`, { method: 'DELETE' });
    setDeleteId(null); load();
  }

  async function openSignins(h: OpenHouse) {
    const data = await fetch(`/api/open-houses/${h.id}/signins`).then((r) => r.json());
    setSignins(data);
    setSigninsHouse(h);
  }

  async function sendSummary(h: OpenHouse) {
    setSendingSummary(h.id);
    const res = await fetch(`/api/open-houses/${h.id}/send-summary`, { method: 'POST' });
    setSendingSummary(null);
    if (res.ok) {
      alert(`Summary email sent for ${h.address}!`);
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(`Failed to send summary: ${data.error || 'Unknown error'}`);
    }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sort.key !== k) return <ChevronUp className="w-3 h-3 opacity-20" />;
    return sort.dir === 'asc' ? <ChevronUp className="w-3 h-3 text-gold-400" /> : <ChevronDown className="w-3 h-3 text-gold-400" />;
  }

  function Th({ label, k }: { label: string; k: SortKey }) {
    return (
      <th className="text-left px-4 py-3 text-navy-400 font-medium">
        <button onClick={() => sortBy(k)} className="flex items-center gap-1 hover:text-white transition-colors">
          {label} <SortIcon k={k} />
        </button>
      </th>
    );
  }

  const f = (key: keyof typeof form, value: string) => setForm((p) => ({ ...p, [key]: value }));

  function formatTime(hhmm: string): string {
    if (!hhmm) return '—';
    const [h, m] = hhmm.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Open Houses</h2>
          <p className="text-navy-400 text-sm mt-1">{houses.length} recorded</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors">
          <Plus className="w-4 h-4" /> Log Open House
        </button>
      </div>

      <div className="bg-navy-800 rounded-xl border border-navy-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-700">
                <Th label="Date" k="date" />
                <Th label="Address" k="address" />
                <Th label="Neighborhood" k="neighborhood" />
                <Th label="City" k="city" />
                <Th label="Start" k="start_time" />
                <Th label="End" k="end_time" />
                <Th label="Total" k="total_attendees" />
                <Th label="Neighbors" k="neighbors" />
                <Th label="Rep. Buyers" k="represented_buyers" />
                <Th label="Unrep. Buyers" k="unrepresented_buyers" />
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={11} className="text-center py-12 text-navy-500">No open houses logged yet.</td></tr>
              )}
              {sorted.map((h) => (
                <tr key={h.id} className="border-b border-navy-750 hover:bg-navy-750/50 transition-colors">
                  <td className="px-4 py-3 text-white whitespace-nowrap">{new Date(h.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td className="px-4 py-3 text-navy-300 max-w-xs truncate">{h.address}</td>
                  <td className="px-4 py-3 text-navy-300">{h.neighborhood || '—'}</td>
                  <td className="px-4 py-3 text-navy-300">{h.city}</td>
                  <td className="px-4 py-3 text-navy-300 whitespace-nowrap text-xs">{h.start_time ? formatTime(h.start_time) : '—'}</td>
                  <td className="px-4 py-3 text-navy-300 whitespace-nowrap text-xs">{h.end_time ? formatTime(h.end_time) : '—'}{h.summary_sent_at ? ' ✓' : ''}</td>
                  <td className="px-4 py-3 font-semibold text-white text-center">{h.total_attendees}</td>
                  <td className="px-4 py-3 text-blue-300 text-center">{h.neighbors}</td>
                  <td className="px-4 py-3 text-purple-300 text-center">{h.represented_buyers}</td>
                  <td className="px-4 py-3 text-gold-400 text-center font-medium">{h.unrepresented_buyers}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setQrHouse(h)} title="Sign-in QR code" className="p-1.5 text-navy-400 hover:text-gold-400 hover:bg-navy-700 rounded transition-colors">
                        <QrCode className="w-4 h-4" />
                      </button>
                      <button onClick={() => openSignins(h)} title="View sign-ins" className="p-1.5 text-navy-400 hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors">
                        <Users className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => sendSummary(h)}
                        disabled={sendingSummary === h.id}
                        title={h.summary_sent_at ? 'Resend summary email' : 'Send summary email'}
                        className={`p-1.5 rounded transition-colors ${h.summary_sent_at ? 'text-green-400 hover:text-green-300 hover:bg-green-400/10' : 'text-navy-400 hover:text-yellow-400 hover:bg-yellow-400/10'} disabled:opacity-40`}
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                      <button onClick={() => openEdit(h)} className="p-1.5 text-navy-400 hover:text-gold-400 hover:bg-navy-700 rounded transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteId(h.id)} className="p-1.5 text-navy-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <Modal title={modal === 'add' ? 'Log Open House' : 'Edit Open House'} onClose={() => setModal(null)} size="lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              ['date', 'Date', 'date'],
              ['address', 'Full Address', 'text'],
              ['neighborhood', 'Neighborhood', 'text'],
              ['city', 'City', 'text'],
            ] as [keyof typeof form, string, string][]).map(([key, label, type]) => (
              <div key={key} className={key === 'address' ? 'sm:col-span-2' : ''}>
                <label className="block text-xs font-medium text-navy-400 mb-1.5">{label}{(key === 'date' || key === 'address' || key === 'city') && <span className="text-red-400 ml-0.5">*</span>}</label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={(e) => f(key, e.target.value)}
                  className="w-full bg-navy-750 border border-navy-600 rounded-lg px-3 py-2 text-white placeholder-navy-400 focus:outline-none focus:border-gold-500 text-sm"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-navy-400 mb-1.5">Start Time</label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => f('start_time', e.target.value)}
                className="w-full bg-navy-750 border border-navy-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-gold-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-400 mb-1.5">End Time <span className="text-gold-400">*</span></label>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => f('end_time', e.target.value)}
                className="w-full bg-navy-750 border border-navy-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-gold-500 text-sm"
              />
              <p className="text-xs text-navy-500 mt-1">Summary email sends automatically when this time passes.</p>
            </div>
            {(['total_attendees', 'neighbors', 'represented_buyers', 'unrepresented_buyers'] as const).map((key) => (
              <div key={key}>
                <label className="block text-xs font-medium text-navy-400 mb-1.5">
                  {key === 'total_attendees' ? 'Total Attendees' : key === 'neighbors' ? 'Neighbors' : key === 'represented_buyers' ? 'Represented Buyers' : 'Unrepresented Buyers'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={form[key]}
                  onChange={(e) => f(key, e.target.value)}
                  className="w-full bg-navy-750 border border-navy-600 rounded-lg px-3 py-2 text-white placeholder-navy-400 focus:outline-none focus:border-gold-500 text-sm"
                  placeholder="0"
                />
              </div>
            ))}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-navy-400 mb-1.5">Notes (optional)</label>
              <textarea
                value={form.notes}
                onChange={(e) => f('notes', e.target.value)}
                rows={3}
                className="w-full bg-navy-750 border border-navy-600 rounded-lg px-3 py-2 text-white placeholder-navy-400 focus:outline-none focus:border-gold-500 text-sm resize-none"
                placeholder="Any additional notes about this open house..."
              />
            </div>
          </div>
          {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
          <div className="flex gap-3 mt-5">
            <button onClick={() => setModal(null)} className="flex-1 border border-navy-600 text-navy-300 hover:text-white py-2.5 rounded-lg text-sm transition-colors">Cancel</button>
            <button onClick={save} disabled={saving || !form.date || !form.address.trim() || !form.city.trim()} className="flex-1 bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-navy-900 font-semibold py-2.5 rounded-lg text-sm transition-colors">
              {saving ? 'Saving...' : modal === 'add' ? 'Log Open House' : 'Save Changes'}
            </button>
          </div>
        </Modal>
      )}

      {deleteId && (
        <Modal title="Delete Record" onClose={() => setDeleteId(null)} size="sm">
          <p className="text-navy-300 text-sm mb-6">Delete this open house record? This cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteId(null)} className="flex-1 border border-navy-600 text-navy-300 hover:text-white py-2.5 rounded-lg text-sm">Cancel</button>
            <button onClick={confirmDelete} className="flex-1 bg-red-500 hover:bg-red-400 text-white font-semibold py-2.5 rounded-lg text-sm">Delete</button>
          </div>
        </Modal>
      )}

      {/* QR Code Modal */}
      {qrHouse && (() => {
        const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/signin/${qrHouse.id}`;
        return (
          <Modal title="Sign-In Link & QR Code" onClose={() => setQrHouse(null)} size="sm">
            <div className="text-center space-y-4">
              <p className="text-navy-300 text-sm">{qrHouse.address}</p>
              <div className="bg-white rounded-xl p-4 inline-block mx-auto">
                <QRCodeSVG value={url} size={200} />
              </div>
              <div className="bg-navy-750 border border-navy-600 rounded-lg px-3 py-2">
                <p className="text-xs text-navy-400 mb-1">Sign-in URL</p>
                <p className="text-gold-400 text-sm font-mono break-all">{url}</p>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(url)}
                className="w-full border border-navy-600 text-navy-300 hover:text-white py-2.5 rounded-lg text-sm transition-colors"
              >
                Copy Link
              </button>
              <p className="text-xs text-navy-500">Display this QR code on a tablet or printed sheet at your open house.</p>
            </div>
          </Modal>
        );
      })()}

      {/* Sign-Ins Modal */}
      {signinsHouse && (
        <Modal title={`Sign-Ins — ${signinsHouse.address}`} onClose={() => setSigninsHouse(null)} size="lg">
          {signins.length === 0 ? (
            <p className="text-navy-400 text-sm text-center py-8">No sign-ins yet for this open house.</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {signins.map((s) => (
                <div key={s.id} className="bg-navy-750 border border-navy-600 rounded-lg px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-white text-sm">{s.first_name} {s.last_name}</p>
                      <p className="text-navy-400 text-xs mt-0.5">{s.phone} · {s.email}</p>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {Boolean(s.has_home_to_buy) && <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">Buying</span>}
                      {Boolean(s.has_home_to_sell) && <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">Selling</span>}
                      {Boolean(s.is_pre_approved) && <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">Pre-Approved</span>}
                      {Boolean(s.working_with_agent) && <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full">Has Agent</span>}
                      {s.ghl_contact_id && <span className="text-xs bg-gold-500/20 text-gold-400 px-2 py-0.5 rounded-full">In GHL</span>}
                    </div>
                  </div>
                  {Boolean(s.working_with_agent) && (s.agent_name || s.agent_brokerage || s.agent_phone || s.agent_email) && (
                    <div className="mt-2 pl-3 border-l-2 border-yellow-500/40 space-y-0.5">
                      {s.agent_name && <p className="text-yellow-300 text-xs font-medium">{s.agent_name}{s.agent_brokerage ? ` · ${s.agent_brokerage}` : ''}</p>}
                      {s.agent_phone && <p className="text-navy-400 text-xs">{s.agent_phone}</p>}
                      {s.agent_email && <p className="text-navy-400 text-xs">{s.agent_email}</p>}
                    </div>
                  )}
                  <p className="text-navy-500 text-xs mt-1.5">{new Date(s.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
          <p className="text-navy-500 text-xs mt-4 text-center">{signins.length} sign-in{signins.length !== 1 ? 's' : ''} recorded</p>
        </Modal>
      )}
    </div>
  );
}
