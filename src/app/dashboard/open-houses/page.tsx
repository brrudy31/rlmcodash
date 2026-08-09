'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, QrCode, Users, Mail, RefreshCw, Radio, Link2, PhoneCall, Calendar, CalendarCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import { QRCodeSVG } from 'qrcode.react';

interface OpenHouse {
  id: number; date: string; address: string; neighborhood: string | null;
  city: string; start_time: string | null; end_time: string | null;
  total_attendees: number; neighbors: number; represented_buyers: number;
  unrepresented_buyers: number; notes: string | null; summary_sent_at: string | null;
  google_event_id: string | null; created_at: string;
}

interface SignIn {
  id: number; first_name: string; last_name: string; phone: string; email: string;
  has_home_to_buy: number; has_home_to_sell: number; is_pre_approved: number;
  working_with_agent: number;
  agent_name: string | null; agent_phone: string | null; agent_email: string | null; agent_brokerage: string | null;
  ghl_contact_id: string | null; lead_score: number; lead_source: string | null;
  buy_timeline: string | null; budget_range: string | null; created_at: string;
}

const emptyForm = {
  date: '', address: '', neighborhood: '', city: '', start_time: '', end_time: '',
  total_attendees: '', neighbors: '', represented_buyers: '', unrepresented_buyers: '', notes: '',
  price: '', beds: '', baths: '', sqft: '', description: '', list_date: '',
};

interface CanvassData {
  total_called: number;
  total_answered: number;
  total_engaged: number;
  notes: string | null;
}

type SortKey = keyof OpenHouse;

export default function OpenHousesPage() {
  const router = useRouter();
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
  const [signinsTab, setSigninsTab] = useState<'attendees' | 'analytics'>('attendees');
  const [sendingSummary, setSendingSummary] = useState<number | null>(null);
  const [syncingCrm, setSyncingCrm] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; failed: number; errors: string[] } | null>(null);
  const [zillowUrl, setZillowUrl] = useState('');
  const [zillowLoading, setZillowLoading] = useState(false);
  const [zillowError, setZillowError] = useState('');
  const [canvassHouse, setCanvassHouse] = useState<OpenHouse | null>(null);
  const [canvassForm, setCanvassForm] = useState({ total_called: '', total_answered: '', total_engaged: '', notes: '' });
  const [canvassData, setCanvassData] = useState<CanvassData | null>(null);
  const [canvassSaving, setCanvassSaving] = useState(false);
  const [gcalConnected, setGcalConnected] = useState<boolean | null>(null);
  const [gcalConfigured, setGcalConfigured] = useState(false);
  const [gcalBanner, setGcalBanner] = useState<'connected' | 'error' | null>(null);

  async function load() {
    const data = await fetch('/api/open-houses').then((r) => r.json());
    setHouses(data);
  }

  useEffect(() => {
    load();
    fetch('/api/google-calendar/status')
      .then((r) => r.json())
      .then((d) => { setGcalConnected(d.connected); setGcalConfigured(d.configured); });
    // Show banner if redirected back from Google OAuth
    const params = new URLSearchParams(window.location.search);
    const gcal = params.get('gcal');
    if (gcal === 'connected' || gcal === 'error') {
      setGcalBanner(gcal as 'connected' | 'error');
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => setGcalBanner(null), 5000);
    }
  }, []);

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

  async function openCanvass(h: OpenHouse) {
    const data = await fetch(`/api/open-houses/${h.id}/canvass`).then((r) => r.json());
    setCanvassData(data);
    setCanvassForm({
      total_called: data ? String(data.total_called) : '',
      total_answered: data ? String(data.total_answered) : '',
      total_engaged: data ? String(data.total_engaged) : '',
      notes: data?.notes || '',
    });
    setCanvassHouse(h);
  }

  async function saveCanvass() {
    if (!canvassHouse) return;
    setCanvassSaving(true);
    await fetch(`/api/open-houses/${canvassHouse.id}/canvass`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        total_called: Number(canvassForm.total_called) || 0,
        total_answered: Number(canvassForm.total_answered) || 0,
        total_engaged: Number(canvassForm.total_engaged) || 0,
        notes: canvassForm.notes,
      }),
    });
    setCanvassSaving(false);
    setCanvassHouse(null);
  }

  function openAdd() {
    setForm({ ...emptyForm, date: new Date().toISOString().split('T')[0] });
    setError(''); setZillowUrl(''); setZillowError(''); setModal('add');
  }

  function openEdit(h: OpenHouse) {
    setEditing(h);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hh = h as any;
    setForm({
      date: h.date, address: h.address, neighborhood: h.neighborhood || '',
      city: h.city, start_time: h.start_time || '', end_time: h.end_time || '',
      total_attendees: String(h.total_attendees), neighbors: String(h.neighbors),
      represented_buyers: String(h.represented_buyers), unrepresented_buyers: String(h.unrepresented_buyers),
      notes: h.notes || '',
      price: hh.price ? String(hh.price) : '',
      beds: hh.beds ? String(hh.beds) : '',
      baths: hh.baths ? String(hh.baths) : '',
      sqft: hh.sqft ? String(hh.sqft) : '',
      description: hh.description || '',
      list_date: hh.list_date || '',
    });
    setError(''); setZillowUrl(''); setZillowError(''); setModal('edit');
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
      price: form.price ? Number(form.price) : null,
      beds: form.beds ? Number(form.beds) : null,
      baths: form.baths ? Number(form.baths) : null,
      sqft: form.sqft ? Number(form.sqft) : null,
      description: form.description || null,
      list_date: form.list_date || null,
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
    setSyncResult(null);
    setSigninsTab('attendees');
  }

  async function syncCrm(h: OpenHouse) {
    setSyncingCrm(true);
    setSyncResult(null);
    const res = await fetch(`/api/open-houses/${h.id}/sync-crm`, { method: 'POST' });
    const data = await res.json();
    setSyncingCrm(false);
    if (!res.ok) {
      setSyncResult({ synced: 0, failed: 0, errors: [data.error || 'Unknown error'] });
    } else {
      setSyncResult({ synced: data.synced, failed: data.failed, errors: data.errors || [] });
      // Refresh signins to show updated GHL badges
      const updated = await fetch(`/api/open-houses/${h.id}/signins`).then((r) => r.json());
      setSignins(updated);
    }
  }

  async function importFromZillow() {
    if (!zillowUrl.trim()) return;
    setZillowLoading(true);
    setZillowError('');
    const res = await fetch('/api/zillow-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: zillowUrl.trim() }),
    });
    const data = await res.json();
    setZillowLoading(false);
    if (!res.ok) {
      setZillowError(data.error || 'Import failed');
      return;
    }
    setForm((p) => ({
      ...p,
      address: data.address || p.address,
      city: data.city || p.city,
      price: data.price ? String(data.price) : p.price,
      beds: data.beds ? String(data.beds) : p.beds,
      baths: data.baths ? String(data.baths) : p.baths,
      sqft: data.sqft ? String(data.sqft) : p.sqft,
      description: data.description || p.description,
      list_date: data.list_date || p.list_date,
    }));
    setZillowUrl('');
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

  async function disconnectGcal() {
    if (!confirm('Disconnect Google Calendar? Future open houses won\'t be added automatically.')) return;
    await fetch('/api/google-calendar/status', { method: 'DELETE' });
    setGcalConnected(false);
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

  function calcDom(listDate: string | null): number | null {
    if (!listDate) return null;
    const ms = Date.now() - new Date(listDate + 'T12:00:00').getTime();
    return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
  }

  function formatTime(hhmm: string): string {
    if (!hhmm) return '—';
    const [h, m] = hhmm.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  return (
    <div className="p-6 lg:p-8">
      {gcalBanner && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 ${gcalBanner === 'connected' ? 'bg-green-900/40 border border-green-700 text-green-300' : 'bg-red-900/40 border border-red-700 text-red-300'}`}>
          {gcalBanner === 'connected' ? <><CalendarCheck className="w-4 h-4" /> Google Calendar connected! New open houses will be added automatically.</> : <><Calendar className="w-4 h-4" /> Failed to connect Google Calendar. Please try again.</>}
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Open Houses</h2>
          <p className="text-navy-400 text-sm mt-1">{houses.length} recorded</p>
        </div>
        <div className="flex items-center gap-2">
          {gcalConfigured && (
            gcalConnected ? (
              <button onClick={disconnectGcal} title="Google Calendar connected — click to disconnect" className="flex items-center gap-1.5 bg-green-900/40 border border-green-700 text-green-300 hover:bg-green-900/60 px-3 py-2 rounded-lg text-xs font-medium transition-colors">
                <CalendarCheck className="w-3.5 h-3.5" /> Google Calendar
              </button>
            ) : (
              <a href="/api/google-calendar/auth" className="flex items-center gap-1.5 bg-navy-700 border border-navy-600 text-navy-300 hover:text-white hover:border-navy-500 px-3 py-2 rounded-lg text-xs font-medium transition-colors">
                <Calendar className="w-3.5 h-3.5" /> Connect Google Calendar
              </a>
            )
          )}
          <button onClick={openAdd} className="flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors">
            <Plus className="w-4 h-4" /> Log Open House
          </button>
        </div>
      </div>

      <div className="bg-navy-800 rounded-xl border border-navy-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-700">
                <Th label="Date" k="date" />
                <Th label="Address" k="address" />
                <th className="text-left px-4 py-3 text-navy-400 font-medium text-sm">DOM</th>
                <Th label="Neighborhood" k="neighborhood" />
                <Th label="City" k="city" />
                <Th label="Start" k="start_time" />
                <Th label="End" k="end_time" />
                <Th label="Total" k="total_attendees" />
                <Th label="Neighbors" k="neighbors" />
                <Th label="Rep. Buyers" k="represented_buyers" />
                <Th label="Unrep. Buyers" k="unrepresented_buyers" />
                <th className="px-4 py-3 text-center" title="Google Calendar"><CalendarCheck className="w-3.5 h-3.5 text-navy-500 inline" /></th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={13} className="text-center py-12 text-navy-500">No open houses logged yet.</td></tr>
              )}
              {sorted.map((h) => (
                <tr key={h.id} className="border-b border-navy-750 hover:bg-navy-750/50 transition-colors">
                  <td className="px-4 py-3 text-white whitespace-nowrap">{new Date(h.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td className="px-4 py-3 text-navy-300 max-w-xs truncate">{h.address}</td>
                  <td className="px-4 py-3 text-xs text-center">
                    {(() => { const dom = calcDom((h as any).list_date); return dom !== null ? <span className={`font-semibold ${dom > 30 ? 'text-red-400' : dom > 14 ? 'text-yellow-400' : 'text-green-400'}`}>{dom}d</span> : <span className="text-navy-600">—</span>; })()}
                  </td>
                  <td className="px-4 py-3 text-navy-300">{h.neighborhood || '—'}</td>
                  <td className="px-4 py-3 text-navy-300">{h.city}</td>
                  <td className="px-4 py-3 text-navy-300 whitespace-nowrap text-xs">{h.start_time ? formatTime(h.start_time) : '—'}</td>
                  <td className="px-4 py-3 text-navy-300 whitespace-nowrap text-xs">{h.end_time ? formatTime(h.end_time) : '—'}{h.summary_sent_at ? ' ✓' : ''}</td>
                  <td className="px-4 py-3 font-semibold text-white text-center">{h.total_attendees}</td>
                  <td className="px-4 py-3 text-navy-300 text-center">{h.neighbors}</td>
                  <td className="px-4 py-3 text-navy-300 text-center">{h.represented_buyers}</td>
                  <td className="px-4 py-3 text-gold-400 text-center font-medium">{h.unrepresented_buyers}</td>
                  <td className="px-4 py-3 text-center">
                    {h.google_event_id && <span title="Added to Google Calendar"><CalendarCheck className="w-3.5 h-3.5 text-green-500 inline" /></span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => router.push(`/dashboard/open-houses/${h.id}/live`)} title="Live hot-lead dashboard" className="p-1.5 text-navy-400 hover:text-green-400 hover:bg-green-400/10 rounded transition-colors">
                        <Radio className="w-4 h-4" />
                      </button>
                      <button onClick={() => openCanvass(h)} title="Neighbor canvassing" className="p-1.5 text-navy-400 hover:text-purple-400 hover:bg-purple-400/10 rounded transition-colors">
                        <PhoneCall className="w-4 h-4" />
                      </button>
                      <button onClick={() => setQrHouse(h)} title="Sign-in QR code" className="p-1.5 text-navy-400 hover:text-gold-400 hover:bg-navy-700 rounded transition-colors">
                        <QrCode className="w-4 h-4" />
                      </button>
                      <button onClick={() => openSignins(h)} title="View sign-ins" className="p-1.5 text-navy-400 hover:text-navy-300 hover:bg-navy-700 rounded transition-colors">
                        <Users className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => sendSummary(h)}
                        disabled={sendingSummary === h.id}
                        title={h.summary_sent_at ? 'Resend summary email' : 'Send summary email'}
                        className={`p-1.5 rounded transition-colors ${h.summary_sent_at ? 'text-white hover:text-navy-300 hover:bg-navy-700' : 'text-navy-400 hover:text-white hover:bg-navy-700'} disabled:opacity-40`}
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
            {/* Property details for visitor sign-in screen */}
            <div className="sm:col-span-2 border-t border-navy-700 pt-4">
              <p className="text-xs font-semibold text-navy-400 uppercase tracking-wide mb-3">Property Details <span className="text-navy-600 font-normal normal-case">(shown on visitor sign-in screen)</span></p>
              {/* Zillow import */}
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-navy-500" />
                  <input
                    type="url"
                    value={zillowUrl}
                    onChange={(e) => { setZillowUrl(e.target.value); setZillowError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && importFromZillow()}
                    placeholder="Paste Zillow or MLS Prospects URL to auto-fill…"
                    className="w-full bg-navy-750 border border-navy-600 rounded-lg pl-8 pr-3 py-2 text-white placeholder-navy-500 focus:outline-none focus:border-gold-500 text-xs"
                  />
                </div>
                <button
                  onClick={importFromZillow}
                  disabled={zillowLoading || !zillowUrl.trim()}
                  className="flex items-center gap-1.5 bg-navy-700 hover:bg-navy-600 disabled:opacity-40 text-navy-300 hover:text-white border border-navy-600 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                >
                  {zillowLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                  {zillowLoading ? 'Importing…' : 'Import'}
                </button>
              </div>
              {zillowError && <p className="text-red-400 text-xs mb-3">{zillowError}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-400 mb-1.5">List Date <span className="text-navy-600 font-normal">(for Days on Market)</span></label>
              <input type="date" value={form.list_date} onChange={(e) => f('list_date', e.target.value)}
                className="w-full bg-navy-750 border border-navy-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-gold-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-400 mb-1.5">List Price</label>
              <input type="number" min="0" value={form.price} onChange={(e) => f('price', e.target.value)}
                className="w-full bg-navy-750 border border-navy-600 rounded-lg px-3 py-2 text-white placeholder-navy-400 focus:outline-none focus:border-gold-500 text-sm"
                placeholder="450000" />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-400 mb-1.5">Sq Ft</label>
              <input type="number" min="0" value={form.sqft} onChange={(e) => f('sqft', e.target.value)}
                className="w-full bg-navy-750 border border-navy-600 rounded-lg px-3 py-2 text-white placeholder-navy-400 focus:outline-none focus:border-gold-500 text-sm"
                placeholder="1800" />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-400 mb-1.5">Beds</label>
              <input type="number" min="0" value={form.beds} onChange={(e) => f('beds', e.target.value)}
                className="w-full bg-navy-750 border border-navy-600 rounded-lg px-3 py-2 text-white placeholder-navy-400 focus:outline-none focus:border-gold-500 text-sm"
                placeholder="3" />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-400 mb-1.5">Baths</label>
              <input type="number" min="0" step="0.5" value={form.baths} onChange={(e) => f('baths', e.target.value)}
                className="w-full bg-navy-750 border border-navy-600 rounded-lg px-3 py-2 text-white placeholder-navy-400 focus:outline-none focus:border-gold-500 text-sm"
                placeholder="2.5" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-navy-400 mb-1.5">Property Description</label>
              <textarea value={form.description} onChange={(e) => f('description', e.target.value)} rows={3}
                className="w-full bg-navy-750 border border-navy-600 rounded-lg px-3 py-2 text-white placeholder-navy-400 focus:outline-none focus:border-gold-500 text-sm resize-none"
                placeholder="Charming 3BR colonial with updated kitchen, hardwood floors throughout…" />
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
      {/* Neighbor Canvass Modal */}
      {canvassHouse && (
        <Modal title={`Neighbor Canvassing — ${canvassHouse.address}`} onClose={() => setCanvassHouse(null)} size="sm">
          <div className="space-y-4">
            <p className="text-navy-400 text-xs">Track how many neighbors you called before/after this open house and who showed real interest.</p>
            {(['total_called', 'total_answered', 'total_engaged'] as const).map((key) => (
              <div key={key}>
                <label className="block text-xs font-medium text-navy-400 mb-1.5">
                  {key === 'total_called' ? 'Total Called' : key === 'total_answered' ? 'Total Answered' : 'Engaged (real interest)'}
                </label>
                <input type="number" min="0" value={canvassForm[key]}
                  onChange={(e) => setCanvassForm((p) => ({ ...p, [key]: e.target.value }))}
                  className="w-full bg-navy-750 border border-navy-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-gold-500 text-sm"
                  placeholder="0" />
              </div>
            ))}
            {canvassForm.total_answered && Number(canvassForm.total_answered) > 0 && (
              <div className="bg-navy-750 border border-navy-700 rounded-lg px-4 py-3 text-center">
                <p className="text-xs text-navy-400 mb-0.5">Engagement Rate</p>
                <p className="text-2xl font-bold text-gold-400">
                  {Math.round((Number(canvassForm.total_engaged) / Number(canvassForm.total_answered)) * 100)}%
                </p>
                <p className="text-xs text-navy-500">of those who answered showed real interest</p>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-navy-400 mb-1.5">Notes <span className="text-navy-600">(optional)</span></label>
              <textarea value={canvassForm.notes} onChange={(e) => setCanvassForm((p) => ({ ...p, notes: e.target.value }))} rows={2}
                className="w-full bg-navy-750 border border-navy-600 rounded-lg px-3 py-2 text-white placeholder-navy-400 focus:outline-none focus:border-gold-500 text-sm resize-none"
                placeholder="Notable conversations, interested neighbors, etc." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCanvassHouse(null)} className="flex-1 border border-navy-600 text-navy-300 hover:text-white py-2.5 rounded-lg text-sm transition-colors">Cancel</button>
              <button onClick={saveCanvass} disabled={canvassSaving} className="flex-1 bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-navy-900 font-semibold py-2.5 rounded-lg text-sm transition-colors">
                {canvassSaving ? 'Saving…' : 'Save Canvass'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {signinsHouse && (() => {
        const unrepresented = signins.filter(s => !s.working_with_agent);
        const sourceCounts: Record<string, number> = {};
        const timelineCounts: Record<string, number> = {};
        const budgetCounts: Record<string, number> = {};
        for (const s of unrepresented) {
          const src = s.lead_source || 'Not specified';
          sourceCounts[src] = (sourceCounts[src] || 0) + 1;
          const tl = s.buy_timeline || 'Not specified';
          timelineCounts[tl] = (timelineCounts[tl] || 0) + 1;
          const bg = s.budget_range || 'Not specified';
          budgetCounts[bg] = (budgetCounts[bg] || 0) + 1;
        }
        const maxSrc = Math.max(1, ...Object.values(sourceCounts));
        const maxTl = Math.max(1, ...Object.values(timelineCounts));
        const maxBg = Math.max(1, ...Object.values(budgetCounts));
        const hotLeads = signins.filter(s => s.lead_score >= 4).length;
        const preApproved = signins.filter(s => s.is_pre_approved).length;
        const totalUnrep = unrepresented.length;

        function MiniBar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
          return (
            <div className="flex items-center gap-2">
              <span className="text-navy-400 text-xs w-32 shrink-0 truncate" title={label}>{label}</span>
              <div className="flex-1 bg-navy-700 rounded-full h-2 overflow-hidden">
                <div className={`h-2 rounded-full ${color}`} style={{ width: `${(count / max) * 100}%` }} />
              </div>
              <span className="text-white text-xs font-semibold w-4 text-right">{count}</span>
            </div>
          );
        }

        return (
          <Modal title={`Sign-Ins — ${signinsHouse.address}`} onClose={() => { setSigninsHouse(null); setSyncResult(null); }} size="lg">
            {/* Tabs */}
            <div className="flex gap-1 mb-4 bg-navy-750 rounded-lg p-1">
              {(['attendees', 'analytics'] as const).map((tab) => (
                <button key={tab} onClick={() => setSigninsTab(tab)}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${signinsTab === tab ? 'bg-navy-600 text-white' : 'text-navy-400 hover:text-navy-300'}`}>
                  {tab === 'analytics' ? 'Analytics' : `Attendees (${signins.length})`}
                </button>
              ))}
            </div>

            {signinsTab === 'attendees' && (
              signins.length === 0 ? (
                <p className="text-navy-400 text-sm text-center py-8">No sign-ins yet for this open house.</p>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                  {signins.map((s) => {
                    const scoreColor = s.lead_score >= 4 ? 'text-red-400' : s.lead_score >= 2 ? 'text-yellow-400' : 'text-navy-500';
                    const isPlaceholderEmail = s.email?.includes('@placeholder.local');
                    const isPlaceholderPhone = s.phone === 'N/A';
                    return (
                      <div key={s.id} className="bg-navy-750 border border-navy-600 rounded-lg px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-white text-sm">{s.first_name} {s.last_name}</p>
                              <span className={`text-xs font-bold ${scoreColor}`}>★{s.lead_score ?? 0}</span>
                            </div>
                            {!isPlaceholderPhone && <p className="text-navy-400 text-xs mt-0.5">{s.phone}</p>}
                            {!isPlaceholderEmail && <p className="text-navy-400 text-xs">{s.email}</p>}
                          </div>
                          <div className="flex gap-1 flex-wrap justify-end">
                            {Boolean(s.has_home_to_buy) && <span className="text-xs bg-navy-700 text-navy-300 px-2 py-0.5 rounded-full">Buying</span>}
                            {Boolean(s.has_home_to_sell) && <span className="text-xs bg-navy-700 text-navy-300 px-2 py-0.5 rounded-full">Selling</span>}
                            {Boolean(s.is_pre_approved) && <span className="text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded-full">Pre-Approved</span>}
                            {Boolean(s.working_with_agent) && <span className="text-xs bg-navy-700 text-navy-300 px-2 py-0.5 rounded-full">Has Agent</span>}
                            {s.ghl_contact_id
                              ? <span className="text-xs bg-gold-500/20 text-gold-400 px-2 py-0.5 rounded-full">✓ In CRM</span>
                              : <span className="text-xs bg-navy-700 text-navy-500 px-2 py-0.5 rounded-full">Not synced</span>
                            }
                          </div>
                        </div>
                        {/* Intent answers */}
                        {!s.working_with_agent && (s.lead_source || s.buy_timeline || s.budget_range) && (
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5">
                            {s.lead_source && <p className="text-navy-400 text-xs"><span className="text-navy-500">Heard via:</span> <span className="text-navy-300">{s.lead_source}</span></p>}
                            {s.buy_timeline && <p className="text-navy-400 text-xs"><span className="text-navy-500">Timeline:</span> <span className="text-navy-300">{s.buy_timeline}</span></p>}
                            {s.budget_range && <p className="text-navy-400 text-xs"><span className="text-navy-500">Budget:</span> <span className="text-navy-300">{s.budget_range}</span></p>}
                          </div>
                        )}
                        {Boolean(s.working_with_agent) && (s.agent_name || s.agent_brokerage || s.agent_phone || s.agent_email) && (
                          <div className="mt-2 pl-3 border-l-2 border-navy-500 space-y-0.5">
                            {s.agent_name && <p className="text-navy-300 text-xs font-medium">{s.agent_name}{s.agent_brokerage ? ` · ${s.agent_brokerage}` : ''}</p>}
                            {s.agent_phone && <p className="text-navy-400 text-xs">{s.agent_phone}</p>}
                            {s.agent_email && <p className="text-navy-400 text-xs">{s.agent_email}</p>}
                          </div>
                        )}
                        <p className="text-navy-500 text-xs mt-1.5">{new Date(s.created_at).toLocaleString()}</p>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {signinsTab === 'analytics' && (
              <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
                {signins.length === 0 ? (
                  <p className="text-navy-400 text-sm text-center py-8">No sign-ins yet — analytics will appear once people sign in.</p>
                ) : (
                  <>
                    {/* KPI row */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Total Attendees', value: signins.length, sub: null },
                        { label: 'Unrepresented', value: totalUnrep, sub: signins.length ? `${Math.round((totalUnrep / signins.length) * 100)}% of total` : null },
                        { label: 'Hot Leads', value: hotLeads, sub: `score ≥ 4` },
                        { label: 'Pre-Approved', value: preApproved, sub: null },
                        { label: 'Has Home to Buy', value: signins.filter(s => s.has_home_to_buy).length, sub: null },
                        { label: 'Has Home to Sell', value: signins.filter(s => s.has_home_to_sell).length, sub: null },
                      ].map(({ label, value, sub }) => (
                        <div key={label} className="bg-navy-750 border border-navy-700 rounded-lg px-3 py-2.5 text-center">
                          <p className="text-xl font-bold text-white">{value}</p>
                          <p className="text-navy-400 text-xs leading-tight mt-0.5">{label}</p>
                          {sub && <p className="text-navy-600 text-xs mt-0.5">{sub}</p>}
                        </div>
                      ))}
                    </div>

                    {/* Where they heard about it */}
                    {Object.keys(sourceCounts).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-navy-400 uppercase tracking-wide mb-2">Where They Heard About It</p>
                        <div className="space-y-2">
                          {Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]).map(([label, count]) => (
                            <MiniBar key={label} label={label} count={count} max={maxSrc} color="bg-gold-500" />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Buy timeline */}
                    {Object.keys(timelineCounts).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-navy-400 uppercase tracking-wide mb-2">Buying Timeline</p>
                        <div className="space-y-2">
                          {Object.entries(timelineCounts).sort((a, b) => b[1] - a[1]).map(([label, count]) => (
                            <MiniBar key={label} label={label} count={count} max={maxTl} color="bg-blue-500" />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Budget range */}
                    {Object.keys(budgetCounts).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-navy-400 uppercase tracking-wide mb-2">Budget Range</p>
                        <div className="space-y-2">
                          {Object.entries(budgetCounts).sort((a, b) => b[1] - a[1]).map(([label, count]) => (
                            <MiniBar key={label} label={label} count={count} max={maxBg} color="bg-green-500" />
                          ))}
                        </div>
                      </div>
                    )}

                    {totalUnrep === 0 && (
                      <p className="text-navy-500 text-xs text-center">No unrepresented buyers — source/timeline/budget data comes from visitors without an agent.</p>
                    )}
                  </>
                )}
              </div>
            )}

            {syncResult && (
              <div className={`mt-4 rounded-lg px-4 py-3 text-sm ${syncResult.failed > 0 ? 'bg-red-900/30 border border-red-700 text-red-300' : 'bg-green-900/30 border border-green-700 text-green-300'}`}>
                {syncResult.errors.length > 0 && syncResult.synced === 0
                  ? syncResult.errors[0]
                  : `✓ Synced ${syncResult.synced} contact${syncResult.synced !== 1 ? 's' : ''} to CRM${syncResult.failed > 0 ? ` · ${syncResult.failed} failed` : ''}`
                }
                {syncResult.errors.length > 0 && syncResult.synced > 0 && (
                  <ul className="mt-1 text-xs opacity-80 space-y-0.5">{syncResult.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                )}
              </div>
            )}

            <div className="flex items-center justify-between mt-4">
              <p className="text-navy-500 text-xs">{signins.length} sign-in{signins.length !== 1 ? 's' : ''} · {signins.filter(s => s.ghl_contact_id).length} synced to CRM</p>
              {signins.some(s => !s.ghl_contact_id) && (
                <button
                  onClick={() => syncCrm(signinsHouse)}
                  disabled={syncingCrm}
                  className="flex items-center gap-1.5 bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-navy-900 font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${syncingCrm ? 'animate-spin' : ''}`} />
                  {syncingCrm ? 'Syncing...' : `Sync ${signins.filter(s => !s.ghl_contact_id).length} to CRM`}
                </button>
              )}
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
