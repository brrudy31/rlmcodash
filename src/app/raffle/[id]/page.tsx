'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Gift } from 'lucide-react';

const HEARD_FROM_OPTIONS = [
  'Instagram',
  'Facebook',
  'Referral / Friend',
  'Sign / Flyer',
  'Email',
  'Other',
];

interface RaffleEvent {
  id: number;
  name: string;
  description: string | null;
}

export default function RaffleSignInPage() {
  const { id } = useParams();
  const [event, setEvent] = useState<RaffleEvent | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', heardFrom: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    fetch(`/api/raffle-events/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setEvent(d); else setNotFound(true); });
  }, [id]);

  // Auto-reset after confirmation
  useEffect(() => {
    if (winner === null) return;
    setCountdown(5);
    const tick = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(tick);
          setWinner(null);
          setForm({ name: '', email: '', phone: '', heardFrom: '' });
          return 5;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [winner]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Please enter your name.'); return; }
    if (!form.phone.trim()) { setError('Please enter your phone number.'); return; }
    if (!form.heardFrom) { setError('Please select how you heard about this event.'); return; }
    setLoading(true);
    setError('');
    const res = await fetch('/api/raffle-entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: id, ...form }),
    });
    setLoading(false);
    if (!res.ok) { setError('Something went wrong. Please try again.'); return; }
    setWinner(form.name.trim());
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-black p-6 text-center">
        <div>
          <p className="text-2xl font-bold mb-2">Event not found</p>
          <p className="text-gray-500 text-sm">This raffle link may have expired or been removed.</p>
        </div>
      </div>
    );
  }

  // Confirmation screen
  if (winner !== null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white p-6 text-center">
        <div className="space-y-4 max-w-sm w-full">
          <div className="w-20 h-20 rounded-full bg-gold-500 flex items-center justify-center mx-auto" style={{ background: '#c5a84b' }}>
            <Gift className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold">You&apos;re entered!</h1>
          <p className="text-xl text-gray-300">Good luck, <span className="text-white font-semibold">{winner}</span>! 🎉</p>
          <p className="text-gray-500 text-sm">Resetting in {countdown}s…</p>
        </div>
      </div>
    );
  }

  const inputClass = "w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-black placeholder-gray-400 focus:outline-none focus:border-black text-sm";

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="max-w-md mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-8 mt-4">
          <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center mx-auto mb-4">
            <Gift className="w-7 h-7 text-white" />
          </div>
          {event?.description ? (
            <>
              <h1 className="text-2xl font-bold leading-tight mb-2">{event.description}</h1>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">{event?.name || '…'}</p>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-widest mb-1">Event Raffle</p>
              <h1 className="text-2xl font-bold leading-tight">{event?.name || '…'}</h1>
            </>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              placeholder="Your full name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className={inputClass}
              autoComplete="name"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Phone <span className="text-red-500">*</span></label>
            <input
              type="tel"
              placeholder="(215) 555-0100"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              className={inputClass}
              autoComplete="tel"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Email <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
            <input
              type="email"
              placeholder="your@email.com"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className={inputClass}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">How did you hear about this event? <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-2">
              {HEARD_FROM_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, heardFrom: opt }))}
                  className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-all text-left ${
                    form.heardFrom === opt
                      ? 'border-black bg-black text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-500'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white font-bold py-4 rounded-xl text-base disabled:opacity-50 transition-opacity mt-2"
          >
            {loading ? 'Entering…' : 'Enter Raffle 🎉'}
          </button>
        </form>
      </div>
    </div>
  );
}
