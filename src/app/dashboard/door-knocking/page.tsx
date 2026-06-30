'use client';

import { useEffect, useState } from 'react';
import { DoorOpen, Plus, Trash2, HandshakeIcon, Mailbox, FileText, ClipboardList } from 'lucide-react';

interface Session {
  id: number;
  date: string;
  area: string;
  total_doors: number;
  answered: number;
  left_at_door: number;
  gave_flyer: number;
  gave_my_info: number;
  gave_vendor_list: number;
  notes: string | null;
  created_at: string;
}

const empty = {
  date: new Date().toISOString().slice(0, 10),
  area: '',
  total_doors: '',
  answered: '',
  left_at_door: '',
  gave_flyer: '',
  gave_my_info: '',
  gave_vendor_list: '',
  notes: '',
};

export default function DoorKnockingPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/door-knocking').then((r) => r.json()).then(setSessions);
  }, []);

  function field(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function save() {
    if (!form.date || !form.area) return;
    setSaving(true);
    const body = {
      date: form.date,
      area: form.area,
      total_doors: Number(form.total_doors) || 0,
      answered: Number(form.answered) || 0,
      left_at_door: Number(form.left_at_door) || 0,
      gave_flyer: Number(form.gave_flyer) || 0,
      gave_my_info: Number(form.gave_my_info) || 0,
      gave_vendor_list: Number(form.gave_vendor_list) || 0,
      notes: form.notes || null,
    };
    const res = await fetch('/api/door-knocking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const created = await res.json();
    setSessions((s) => [created, ...s]);
    setForm(empty);
    setShowForm(false);
    setSaving(false);
  }

  async function remove(id: number) {
    if (!confirm('Delete this session?')) return;
    await fetch(`/api/door-knocking/${id}`, { method: 'DELETE' });
    setSessions((s) => s.filter((x) => x.id !== id));
  }

  const totals = sessions.reduce(
    (acc, s) => ({
      doors: acc.doors + s.total_doors,
      answered: acc.answered + s.answered,
      left: acc.left + s.left_at_door,
      flyer: acc.flyer + s.gave_flyer,
      info: acc.info + s.gave_my_info,
      vendor: acc.vendor + s.gave_vendor_list,
    }),
    { doors: 0, answered: 0, left: 0, flyer: 0, info: 0, vendor: 0 }
  );

  const answerRate = totals.doors ? Math.round((totals.answered / totals.doors) * 100) : 0;

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Door Knocking</h2>
          <p className="text-navy-400 text-sm mt-1">{sessions.length} session{sessions.length !== 1 ? 's' : ''} logged</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Log Session
        </button>
      </div>

      {/* Summary cards */}
      {sessions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
          {[
            { label: 'Total Doors', value: totals.doors, icon: DoorOpen, color: 'text-navy-300', bg: 'bg-navy-700' },
            { label: 'Answered', value: `${totals.answered} (${answerRate}%)`, icon: HandshakeIcon, color: 'text-white', bg: 'bg-navy-700' },
            { label: 'Left at Door', value: totals.left, icon: Mailbox, color: 'text-white', bg: 'bg-navy-700' },
            { label: 'Flyers Given', value: totals.flyer, icon: FileText, color: 'text-navy-300', bg: 'bg-navy-700' },
            { label: 'My Info Given', value: totals.info, icon: FileText, color: 'text-gold-400', bg: 'bg-gold-400/10' },
            { label: 'Vendor Lists', value: totals.vendor, icon: ClipboardList, color: 'text-pink-400', bg: 'bg-pink-400/10' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-navy-800 rounded-xl border border-navy-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-navy-400 text-xs font-medium">{label}</span>
                <div className={`${bg} p-1.5 rounded-lg`}>
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                </div>
              </div>
              <p className="text-xl font-bold text-white">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="bg-navy-800 rounded-xl border border-navy-700 p-6 mb-6">
          <h3 className="text-white font-semibold mb-4">New Door Knocking Session</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-navy-400 text-xs mb-1">Date *</label>
              <input type="date" value={form.date} onChange={field('date')} className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-500" />
            </div>
            <div>
              <label className="block text-navy-400 text-xs mb-1">Area / Neighborhood *</label>
              <input type="text" placeholder="e.g. Maple Street block" value={form.area} onChange={field('area')} className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-500 placeholder-navy-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
            {([
              { key: 'total_doors', label: 'Total Doors Knocked' },
              { key: 'answered', label: 'Doors Answered' },
              { key: 'left_at_door', label: 'Left at Door' },
              { key: 'gave_flyer', label: 'Flyers Given' },
              { key: 'gave_my_info', label: 'My Info Given' },
              { key: 'gave_vendor_list', label: 'Vendor Lists Given' },
            ] as { key: keyof typeof form; label: string }[]).map(({ key, label }) => (
              <div key={key}>
                <label className="block text-navy-400 text-xs mb-1">{label}</label>
                <input type="number" min="0" value={form[key]} onChange={field(key)} placeholder="0" className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-500 placeholder-navy-500" />
              </div>
            ))}
          </div>

          <div className="mb-4">
            <label className="block text-navy-400 text-xs mb-1">Notes</label>
            <textarea value={form.notes} onChange={field('notes')} rows={2} placeholder="Any observations..." className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-500 placeholder-navy-500 resize-none" />
          </div>

          <div className="flex gap-3">
            <button onClick={save} disabled={saving || !form.date || !form.area} className="bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-navy-900 font-semibold px-5 py-2 rounded-lg text-sm transition-colors">
              {saving ? 'Saving...' : 'Save Session'}
            </button>
            <button onClick={() => { setShowForm(false); setForm(empty); }} className="text-navy-400 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Sessions list */}
      {sessions.length === 0 && !showForm && (
        <div className="bg-navy-800 rounded-xl border border-navy-700 p-12 text-center text-navy-500">
          No sessions logged yet. Click "Log Session" to get started.
        </div>
      )}

      <div className="space-y-3">
        {sessions.map((s) => {
          const rate = s.total_doors ? Math.round((s.answered / s.total_doors) * 100) : 0;
          return (
            <div key={s.id} className="bg-navy-800 rounded-xl border border-navy-700 px-5 py-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-white">{s.area}</p>
                    <span className="text-navy-500 text-xs">{new Date(s.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <span className="text-navy-300"><span className="font-medium text-white">{s.total_doors}</span> doors knocked</span>
                    <span className="text-navy-300"><span className="font-medium text-white">{s.answered}</span> answered <span className="text-navy-500 text-xs">({rate}%)</span></span>
                    <span className="text-navy-300"><span className="font-medium text-white">{s.left_at_door}</span> left at door</span>
                    <span className="text-navy-300"><span className="font-medium text-navy-300">{s.gave_flyer}</span> flyers</span>
                    <span className="text-navy-300"><span className="font-medium text-gold-400">{s.gave_my_info}</span> my info</span>
                    <span className="text-navy-300"><span className="font-medium text-pink-400">{s.gave_vendor_list}</span> vendor lists</span>
                  </div>
                  {s.notes && <p className="text-navy-400 text-xs mt-1.5 italic">{s.notes}</p>}
                </div>
                <button onClick={() => remove(s.id)} className="text-navy-600 hover:text-red-400 transition-colors flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
