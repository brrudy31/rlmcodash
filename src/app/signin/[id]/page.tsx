'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Home, Bed, Bath, Ruler, ChevronRight } from 'lucide-react';

const CHECKBOXES = [
  { name: 'hasHomeToBuy', label: "I'm looking to buy a home" },
  { name: 'hasHomeToSell', label: 'I have a home to sell' },
  { name: 'isPreApproved', label: "I'm pre-approved for a mortgage" },
  { name: 'workingWithAgent', label: "I'm currently working with an agent" },
] as const;

type CheckboxKey = (typeof CHECKBOXES)[number]['name'];

interface HouseInfo {
  id: number;
  address: string;
  city: string;
  neighborhood: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  description: string | null;
}

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function SignInPage() {
  const { id } = useParams();
  const [house, setHouse] = useState<HouseInfo | null>(null);
  const [step, setStep] = useState<'property' | 'form'>('property');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', email: '',
    hasHomeToBuy: false, hasHomeToSell: false,
    isPreApproved: false, workingWithAgent: false,
    agentName: '', agentPhone: '', agentEmail: '', agentBrokerage: '',
    leadSource: '', buyTimeline: '', budgetRange: '',
  });

  useEffect(() => {
    fetch(`/api/open-house-info/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then(setHouse);
  }, [id]);

  function handleText(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  function handleCheck(name: CheckboxKey) {
    setForm((p) => ({ ...p, [name]: !p[name] }));
  }

  async function handleSubmit() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('Please enter your first and last name.');
      return;
    }
    if (!form.leadSource) {
      setError('Please select how you heard about this open house.');
      return;
    }
    if (form.workingWithAgent) {
      if (!form.agentName.trim() || !form.agentPhone.trim() || !form.agentEmail.trim()) {
        setError("Please enter your agent's name, phone, and email.");
        return;
      }
    } else {
      if (!form.phone.trim() || !form.email.trim()) {
        setError('Please enter your phone number and email.');
        return;
      }
    }
    setLoading(true);
    setError('');
    const res = await fetch('/api/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, openHouseId: id, leadSource: form.leadSource, buyTimeline: form.buyTimeline, budgetRange: form.budgetRange }),
    });
    setLoading(false);
    if (!res.ok) { setError('Something went wrong. Please try again.'); return; }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-black p-6 text-center">
        <div className="space-y-3">
          <div className="w-16 h-16 rounded-full bg-black flex items-center justify-center mx-auto">
            <Home className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Thanks for stopping by!</h1>
          <p className="text-gray-500">You&apos;ll hear from Ben shortly. Keep an eye on your texts!</p>
        </div>
      </div>
    );
  }

  const inputClass = "w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-black placeholder-gray-400 focus:outline-none focus:border-black text-sm";
  const agentInputClass = "w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-black placeholder-gray-400 focus:outline-none focus:border-black text-xs";

  // ── Property Info Screen ──────────────────────────────────────────────────
  if (step === 'property') {
    return (
      <div className="min-h-screen bg-white text-black">
        <div className="max-w-md mx-auto p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center flex-shrink-0">
              <Home className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Open House</p>
              <h1 className="text-lg font-bold leading-tight">{house?.address || '…'}</h1>
            </div>
          </div>

          {house && (
            <>
              {/* Date/time bar */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-5 flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">
                  {new Date(house.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })}
                </span>
                {(house.start_time || house.end_time) && (
                  <span className="text-gray-500">
                    {house.start_time ? formatTime(house.start_time) : ''}{house.end_time ? ` – ${formatTime(house.end_time)}` : ''}
                  </span>
                )}
              </div>

              {/* Price & stats */}
              {(house.price || house.beds || house.baths || house.sqft) && (
                <div className="mb-5">
                  {house.price && (
                    <p className="text-3xl font-bold mb-3">${house.price.toLocaleString()}</p>
                  )}
                  <div className="flex gap-4">
                    {house.beds && (
                      <div className="flex items-center gap-1.5 text-gray-700 text-sm">
                        <Bed className="w-4 h-4 text-gray-400" />
                        <span className="font-semibold">{house.beds}</span>
                        <span className="text-gray-400">bed{house.beds !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {house.baths && (
                      <div className="flex items-center gap-1.5 text-gray-700 text-sm">
                        <Bath className="w-4 h-4 text-gray-400" />
                        <span className="font-semibold">{house.baths}</span>
                        <span className="text-gray-400">bath{house.baths !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {house.sqft && (
                      <div className="flex items-center gap-1.5 text-gray-700 text-sm">
                        <Ruler className="w-4 h-4 text-gray-400" />
                        <span className="font-semibold">{house.sqft.toLocaleString()}</span>
                        <span className="text-gray-400">sq ft</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Description */}
              {house.description && (
                <div className="mb-6">
                  <p className="text-sm text-gray-700 leading-relaxed">{house.description}</p>
                </div>
              )}
            </>
          )}

          {/* CTA */}
          <button
            onClick={() => setStep('form')}
            className="w-full bg-black hover:bg-gray-800 text-white font-bold py-4 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            Sign In to Get Updates
            <ChevronRight className="w-4 h-4" />
          </button>
          <p className="text-xs text-center text-gray-400 mt-3">
            Takes 30 seconds · Your info stays private
          </p>
        </div>
      </div>
    );
  }

  // ── Sign-In Form ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white text-black p-6">
      <div className="max-w-md mx-auto">
        <div className="mb-6">
          <button onClick={() => setStep('property')} className="text-xs text-gray-400 hover:text-black mb-4 flex items-center gap-1">
            ← Back to property
          </button>
          <h1 className="text-2xl font-bold">Sign In</h1>
          <p className="text-gray-500 text-sm mt-1">{house?.address}</p>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input name="firstName" placeholder="First Name *" value={form.firstName} onChange={handleText} className={inputClass} />
            <input name="lastName" placeholder="Last Name *" value={form.lastName} onChange={handleText} className={inputClass} />
          </div>
          {!form.workingWithAgent && (
            <>
              <input name="phone" placeholder="Phone Number *" type="tel" value={form.phone} onChange={handleText} className={inputClass} />
              <input name="email" placeholder="Email Address *" type="email" value={form.email} onChange={handleText} className={inputClass} />
            </>
          )}

          {/* How did you hear about this open house — required, prominent */}
          <div className={`rounded-xl border-2 p-4 transition-colors ${form.leadSource ? 'border-black bg-gray-50' : 'border-black bg-black/5'}`}>
            <p className="text-sm font-bold text-black mb-3">
              How did you hear about this open house?
              <span className="text-red-500 ml-1">*</span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              {['Zillow', 'Redfin', 'Sign', 'Flyer', 'Agent', 'Other'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, leadSource: s }))}
                  className={`py-2.5 px-3 rounded-lg text-sm font-semibold border-2 transition-all ${
                    form.leadSource === s
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Working with agent — standalone prominent card */}
          <button
            type="button"
            onClick={() => handleCheck('workingWithAgent')}
            className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
              form.workingWithAgent
                ? 'border-black bg-black text-white'
                : 'border-gray-300 bg-white text-gray-800 hover:border-gray-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`font-bold text-base ${form.workingWithAgent ? 'text-white' : 'text-black'}`}>
                  I&apos;m already working with a real estate agent
                </p>
                <p className={`text-xs mt-0.5 ${form.workingWithAgent ? 'text-gray-300' : 'text-gray-400'}`}>
                  Tap here if you have your own buyer&apos;s agent
                </p>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-3 transition-colors ${
                form.workingWithAgent ? 'bg-white border-white' : 'border-gray-300'
              }`}>
                {form.workingWithAgent && (
                  <svg className="w-3.5 h-3.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
          </button>

          {form.workingWithAgent && (
            <div className="border border-gray-200 rounded-xl p-4 space-y-2 bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Your Agent&apos;s Info <span className="text-black normal-case font-bold">(required)</span></p>
              <div className="grid grid-cols-2 gap-2">
                <input name="agentName" placeholder="Agent Name *" value={form.agentName} onChange={handleText} className={agentInputClass} />
                <input name="agentBrokerage" placeholder="Brokerage" value={form.agentBrokerage} onChange={handleText} className={agentInputClass} />
              </div>
              <input name="agentPhone" placeholder="Agent Phone *" type="tel" value={form.agentPhone} onChange={handleText} className={agentInputClass} />
              <input name="agentEmail" placeholder="Agent Email *" type="email" value={form.agentEmail} onChange={handleText} className={agentInputClass} />
            </div>
          )}

          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Quick questions</p>
            {CHECKBOXES.filter((c) => c.name !== 'workingWithAgent').map(({ name, label }) => (
              <label key={name} className="flex items-center gap-3 cursor-pointer group">
                <div
                  onClick={() => handleCheck(name)}
                  className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                    form[name] ? 'bg-black border-black' : 'border-gray-300 group-hover:border-black'
                  }`}
                >
                  {form[name] && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>

          {/* Buyer intent questions — only for unrepresented visitors */}
          {!form.workingWithAgent && (
            <>
              <div className="border border-gray-200 rounded-xl p-4">
                <p className="text-sm font-bold text-black mb-3">When are you looking to buy?</p>
                <div className="grid grid-cols-2 gap-2">
                  {['ASAP / Under 3 months', '3–6 months', '6–12 months', 'Just browsing'].map((t) => (
                    <button key={t} type="button"
                      onClick={() => setForm((p) => ({ ...p, buyTimeline: p.buyTimeline === t ? '' : t }))}
                      className={`py-2.5 px-3 rounded-lg text-sm font-medium border-2 transition-all text-left ${
                        form.buyTimeline === t ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-4">
                <p className="text-sm font-bold text-black mb-3">What&apos;s your budget range?</p>
                <div className="grid grid-cols-2 gap-2">
                  {['Under $300K', '$300K–$500K', '$500K–$750K', '$750K+', 'Not sure'].map((b) => (
                    <button key={b} type="button"
                      onClick={() => setForm((p) => ({ ...p, budgetRange: p.budgetRange === b ? '' : b }))}
                      className={`py-2.5 px-3 rounded-lg text-sm font-medium border-2 transition-all text-left ${
                        form.budgetRange === b ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                      }`}>
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 mt-1">
            <p className="text-xs text-gray-500 leading-relaxed">
              <span className="font-semibold text-gray-700">Privacy Notice:</span> The personal information you provide is collected solely for property follow-up and visitor log compliance. Your contact details will be shared only with the homeowner and listing agent. Your information will not be sold or used for any unrelated purpose.
            </p>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-black hover:bg-gray-800 disabled:opacity-50 text-white font-bold py-3.5 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Submitting…' : 'Sign In'}
          </button>
          <p className="text-xs text-center text-gray-400 pb-4">
            By signing in you acknowledge the privacy notice above.
          </p>
        </div>
      </div>
    </div>
  );
}
