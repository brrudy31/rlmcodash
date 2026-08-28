'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, QrCode, Users, ChevronDown, ChevronUp, RotateCcw, Gift } from 'lucide-react';
import Modal from '@/components/Modal';
import { QRCodeSVG } from 'qrcode.react';

interface RaffleEvent {
  id: number;
  name: string;
  description: string | null;
  entry_count: number;
  created_at: string;
}

interface Entry {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  heard_from: string | null;
  excluded: number;
  created_at: string;
}

const WHEEL_COLORS = [
  '#c5a84b', '#1e3d70', '#e05c5c', '#2d7a4f', '#8b5cf6',
  '#f59e0b', '#0891b2', '#dc2626', '#059669', '#7c3aed',
  '#d97706', '#0369a1', '#b91c1c', '#047857', '#6d28d9',
];

export default function EventsPage() {
  const [events, setEvents] = useState<RaffleEvent[]>([]);
  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [qrEvent, setQrEvent] = useState<RaffleEvent | null>(null);
  const [wheelEvent, setWheelEvent] = useState<RaffleEvent | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<Entry | null>(null);
  const [rotation, setRotation] = useState(0);
  const [showEntries, setShowEntries] = useState(false);
  const spinRef = useRef(rotation);
  spinRef.current = rotation;

  async function load() {
    const data = await fetch('/api/raffle-events').then((r) => r.json());
    setEvents(Array.isArray(data) ? data : []);
  }

  useEffect(() => { load(); }, []);

  async function openWheel(ev: RaffleEvent) {
    const data = await fetch(`/api/raffle-events/${ev.id}/entries`).then((r) => r.json());
    setEntries(Array.isArray(data) ? data : []);
    setWheelEvent(ev);
    setWinner(null);
    setRotation(0);
    setShowEntries(false);
  }

  async function saveEvent() {
    if (!form.name.trim()) return;
    setSaving(true);
    await fetch('/api/raffle-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setAddModal(false);
    setForm({ name: '', description: '' });
    load();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await fetch(`/api/raffle-events/${deleteId}`, { method: 'DELETE' });
    setDeleteId(null);
    load();
    if (wheelEvent?.id === deleteId) setWheelEvent(null);
  }

  async function excludeEntry(entryId: number, excluded: boolean) {
    if (!wheelEvent) return;
    await fetch(`/api/raffle-events/${wheelEvent.id}/entries`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryId, excluded }),
    });
    setEntries((prev) => prev.map((e) => e.id === entryId ? { ...e, excluded: excluded ? 1 : 0 } : e));
    if (winner?.id === entryId && excluded) setWinner(null);
  }

  function spin() {
    const eligible = entries.filter((e) => !e.excluded);
    if (eligible.length === 0) return;
    setSpinning(true);
    setWinner(null);

    const winnerEntry = eligible[Math.floor(Math.random() * eligible.length)];
    const winnerIdx = eligible.indexOf(winnerEntry);
    const sliceAngle = 360 / eligible.length;
    const winnerCenter = winnerIdx * sliceAngle + sliceAngle / 2;
    // Target: bring winner center to top (0°), pointer at top
    const targetDeg = -winnerCenter + 360 * 6 + spinRef.current;
    setRotation(targetDeg);

    setTimeout(() => {
      setSpinning(false);
      setWinner(winnerEntry);
    }, 4500);
  }

  // ── Wheel SVG ──────────────────────────────────────────────────────────────
  function WheelSVG() {
    const eligible = entries.filter((e) => !e.excluded);
    const n = eligible.length;
    if (n === 0) return (
      <div className="w-64 h-64 rounded-full bg-navy-700 border-4 border-navy-600 flex items-center justify-center">
        <p className="text-navy-400 text-sm text-center px-6">No eligible entries yet</p>
      </div>
    );
    if (n === 1) {
      return (
        <div className="w-64 h-64 rounded-full flex items-center justify-center border-4 border-gold-500" style={{ background: WHEEL_COLORS[0] }}>
          <p className="text-white text-sm font-bold text-center px-4">{eligible[0].name.split(' ')[0]}</p>
        </div>
      );
    }
    const sliceAngle = (2 * Math.PI) / n;
    const paths = eligible.map((entry, i) => {
      const start = i * sliceAngle - Math.PI / 2;
      const end = start + sliceAngle;
      const x1 = Math.cos(start), y1 = Math.sin(start);
      const x2 = Math.cos(end), y2 = Math.sin(end);
      const largeArc = sliceAngle > Math.PI ? 1 : 0;
      const d = `M 0 0 L ${x1} ${y1} A 1 1 0 ${largeArc} 1 ${x2} ${y2} Z`;
      const midAngle = start + sliceAngle / 2;
      const labelR = 0.65;
      const lx = Math.cos(midAngle) * labelR;
      const ly = Math.sin(midAngle) * labelR;
      const firstName = entry.name.split(' ')[0].slice(0, 9);
      return { d, fill: WHEEL_COLORS[i % WHEEL_COLORS.length], lx, ly, midAngle, label: firstName };
    });

    return (
      <div className="relative w-64 h-64">
        {/* Pointer */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10 w-0 h-0"
          style={{ borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '20px solid #c5a84b' }} />
        <svg
          viewBox="-1 -1 2 2"
          className="w-64 h-64 rounded-full border-4 border-navy-600 drop-shadow-lg"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? 'transform 4.2s cubic-bezier(0.17,0.67,0.08,1)' : 'none',
          }}
        >
          {paths.map((p, i) => (
            <g key={i}>
              <path d={p.d} fill={p.fill} stroke="#1e2d42" strokeWidth="0.01" />
              <text
                x={p.lx} y={p.ly}
                fill="white"
                fontSize={n > 12 ? '0.10' : '0.13'}
                fontWeight="600"
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${(p.midAngle * 180 / Math.PI) + 90}, ${p.lx}, ${p.ly})`}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {p.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Event Raffles</h2>
          <p className="text-navy-400 text-sm mt-1">{events.length} event{events.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setAddModal(true)} className="flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors">
          <Plus className="w-4 h-4" /> New Event
        </button>
      </div>

      {events.length === 0 ? (
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-12 text-center">
          <Gift className="w-10 h-10 text-navy-600 mx-auto mb-3" />
          <p className="text-navy-400 text-sm">No events yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {events.map((ev) => (
            <div key={ev.id} className="bg-navy-800 border border-navy-700 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white">{ev.name}</p>
                {ev.description && <p className="text-navy-400 text-xs mt-0.5 truncate">{ev.description}</p>}
                <p className="text-navy-500 text-xs mt-1">{ev.entry_count} entr{ev.entry_count !== 1 ? 'ies' : 'y'} · {new Date(ev.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setQrEvent(ev)} title="QR code / share link" className="p-2 text-navy-400 hover:text-gold-400 hover:bg-navy-700 rounded-lg transition-colors">
                  <QrCode className="w-4 h-4" />
                </button>
                <button onClick={() => openWheel(ev)} title="Spin the wheel" className="flex items-center gap-1.5 bg-gold-500/15 hover:bg-gold-500/25 border border-gold-500/30 text-gold-400 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                  <Gift className="w-3.5 h-3.5" /> Pick Winner
                </button>
                <button onClick={() => setDeleteId(ev.id)} className="p-2 text-navy-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Event Modal */}
      {addModal && (
        <Modal title="New Event Raffle" onClose={() => setAddModal(false)} size="sm">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-navy-400 mb-1.5">Event Name <span className="text-red-400">*</span></label>
              <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Holiday Open House Raffle"
                className="w-full bg-navy-750 border border-navy-600 rounded-lg px-3 py-2 text-white placeholder-navy-400 focus:outline-none focus:border-gold-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-400 mb-1.5">Description <span className="text-navy-600 font-normal">(optional — shown on sign-in page)</span></label>
              <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={2} placeholder="Enter to win a $50 gift card!"
                className="w-full bg-navy-750 border border-navy-600 rounded-lg px-3 py-2 text-white placeholder-navy-400 focus:outline-none focus:border-gold-500 text-sm resize-none" />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={() => setAddModal(false)} className="flex-1 border border-navy-600 text-navy-300 hover:text-white py-2.5 rounded-lg text-sm transition-colors">Cancel</button>
            <button onClick={saveEvent} disabled={saving || !form.name.trim()} className="flex-1 bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-navy-900 font-semibold py-2.5 rounded-lg text-sm transition-colors">
              {saving ? 'Creating…' : 'Create Event'}
            </button>
          </div>
        </Modal>
      )}

      {/* Delete Modal */}
      {deleteId && (
        <Modal title="Delete Event" onClose={() => setDeleteId(null)} size="sm">
          <p className="text-navy-300 text-sm mb-6">Delete this event and all its entries? This cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteId(null)} className="flex-1 border border-navy-600 text-navy-300 hover:text-white py-2.5 rounded-lg text-sm">Cancel</button>
            <button onClick={confirmDelete} className="flex-1 bg-red-500 hover:bg-red-400 text-white font-semibold py-2.5 rounded-lg text-sm">Delete</button>
          </div>
        </Modal>
      )}

      {/* QR Code Modal */}
      {qrEvent && (() => {
        const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/raffle/${qrEvent.id}`;
        return (
          <Modal title="Raffle Sign-In Link" onClose={() => setQrEvent(null)} size="sm">
            <div className="text-center space-y-4">
              <p className="text-navy-300 text-sm">{qrEvent.name}</p>
              <div className="bg-white rounded-xl p-4 inline-block mx-auto">
                <QRCodeSVG value={url} size={200} />
              </div>
              <div className="bg-navy-750 border border-navy-600 rounded-lg px-3 py-2">
                <p className="text-xs text-navy-400 mb-1">Sign-in URL</p>
                <p className="text-gold-400 text-sm font-mono break-all">{url}</p>
              </div>
              <button onClick={() => navigator.clipboard.writeText(url)}
                className="w-full border border-navy-600 text-navy-300 hover:text-white py-2.5 rounded-lg text-sm transition-colors">
                Copy Link
              </button>
            </div>
          </Modal>
        );
      })()}

      {/* Wheel Picker Modal */}
      {wheelEvent && (
        <Modal title={`Pick a Winner — ${wheelEvent.name}`} onClose={() => setWheelEvent(null)} size="lg">
          <div className="flex flex-col items-center gap-6">
            <WheelSVG />

            {winner && (
              <div className="text-center bg-gold-500/10 border border-gold-500/40 rounded-xl px-6 py-4 w-full">
                <p className="text-xs font-semibold text-gold-400 uppercase tracking-wide mb-1">🎉 Winner!</p>
                <p className="text-2xl font-bold text-white">{winner.name}</p>
                {winner.email && <p className="text-navy-300 text-sm mt-1">{winner.email}</p>}
                {winner.phone && <p className="text-navy-400 text-xs">{winner.phone}</p>}
                <div className="flex gap-2 mt-4">
                  <button onClick={() => excludeEntry(winner.id, true)}
                    className="flex-1 bg-navy-700 hover:bg-navy-600 text-navy-300 hover:text-white text-xs font-medium py-2 rounded-lg transition-colors">
                    Exclude &amp; Pick Again
                  </button>
                  <button onClick={() => { setWinner(null); spin(); }}
                    className="flex-1 bg-gold-500 hover:bg-gold-400 text-navy-900 text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5" /> Re-spin
                  </button>
                </div>
              </div>
            )}

            {!winner && (
              <button onClick={spin} disabled={spinning || entries.filter(e => !e.excluded).length === 0}
                className="bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-navy-900 font-bold px-8 py-3 rounded-xl text-sm transition-colors flex items-center gap-2">
                <Gift className="w-4 h-4" />
                {spinning ? 'Spinning…' : 'Spin the Wheel'}
              </button>
            )}

            {/* Entry list toggle */}
            <div className="w-full border-t border-navy-700 pt-4">
              <button onClick={() => setShowEntries((v) => !v)}
                className="flex items-center gap-2 text-navy-400 hover:text-white text-xs font-medium transition-colors w-full">
                <Users className="w-3.5 h-3.5" />
                {entries.length} total entr{entries.length !== 1 ? 'ies' : 'y'} · {entries.filter(e => !e.excluded).length} eligible
                {showEntries ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
              </button>
              {showEntries && (
                <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto">
                  {entries.map((entry) => (
                    <div key={entry.id} className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${entry.excluded ? 'opacity-40 bg-navy-800' : 'bg-navy-750'}`}>
                      <div>
                        <span className="font-medium text-white">{entry.name}</span>
                        {entry.heard_from && <span className="text-navy-500 ml-2">via {entry.heard_from}</span>}
                      </div>
                      <button onClick={() => excludeEntry(entry.id, !entry.excluded)}
                        className={`px-2 py-0.5 rounded text-xs transition-colors ${entry.excluded ? 'text-green-400 hover:text-green-300' : 'text-navy-500 hover:text-red-400'}`}>
                        {entry.excluded ? 'Restore' : 'Exclude'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
