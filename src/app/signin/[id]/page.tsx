'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Home } from 'lucide-react';

const CHECKBOXES = [
  { name: 'hasHomeToBuy', label: "I'm looking to buy a home" },
  { name: 'hasHomeToSell', label: 'I have a home to sell' },
  { name: 'isPreApproved', label: "I'm pre-approved for a mortgage" },
  { name: 'workingWithAgent', label: "I'm currently working with an agent" },
] as const;

type CheckboxKey = (typeof CHECKBOXES)[number]['name'];

export default function SignInPage() {
  const { id } = useParams();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    hasHomeToBuy: false,
    hasHomeToSell: false,
    isPreApproved: false,
    workingWithAgent: false,
    agentName: '',
    agentPhone: '',
    agentEmail: '',
    agentBrokerage: '',
  });

  function handleText(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  function handleCheck(name: CheckboxKey) {
    setForm((p) => ({ ...p, [name]: !p[name] }));
  }

  async function handleSubmit() {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.phone.trim() || !form.email.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (form.workingWithAgent && !form.agentName.trim()) {
      setError("Please enter your agent's name.");
      return;
    }
    setLoading(true);
    setError('');
    const res = await fetch('/api/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, openHouseId: id }),
    });
    setLoading(false);
    if (!res.ok) {
      setError('Something went wrong. Please try again.');
      return;
    }
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
          <p className="text-gray-500">
            You&apos;ll hear from Ben shortly. Keep an eye on your texts!
          </p>
        </div>
      </div>
    );
  }

  const inputClass = "w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-black placeholder-gray-400 focus:outline-none focus:border-black text-sm";
  const agentInputClass = "w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-black placeholder-gray-400 focus:outline-none focus:border-black text-xs";

  return (
    <div className="min-h-screen bg-white text-black p-6">
      <div className="max-w-md mx-auto">
        <div className="mb-8">
          <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center mb-4">
            <Home className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Welcome!</h1>
          <p className="text-gray-500 text-sm mt-1">
            Sign in to get property details &amp; updates from Ben.
          </p>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input name="firstName" placeholder="First Name" value={form.firstName} onChange={handleText} className={inputClass} />
            <input name="lastName" placeholder="Last Name" value={form.lastName} onChange={handleText} className={inputClass} />
          </div>
          <input name="phone" placeholder="Phone Number" type="tel" value={form.phone} onChange={handleText} className={inputClass} />
          <input name="email" placeholder="Email Address" type="email" value={form.email} onChange={handleText} className={inputClass} />

          <div className="border border-gray-200 rounded-lg p-4 space-y-3 mt-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Quick questions</p>
            {CHECKBOXES.map(({ name, label }) => (
              <div key={name}>
                <label className="flex items-center gap-3 cursor-pointer group">
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

                {name === 'workingWithAgent' && form.workingWithAgent && (
                  <div className="mt-3 ml-8 space-y-2">
                    <p className="text-xs text-gray-400 mb-2">Agent&apos;s info <span className="text-black font-semibold">(required)</span></p>
                    <div className="grid grid-cols-2 gap-2">
                      <input name="agentName" placeholder="Agent Name" value={form.agentName} onChange={handleText} className={agentInputClass} />
                      <input name="agentBrokerage" placeholder="Brokerage" value={form.agentBrokerage} onChange={handleText} className={agentInputClass} />
                    </div>
                    <input name="agentPhone" placeholder="Agent Phone" type="tel" value={form.agentPhone} onChange={handleText} className={agentInputClass} />
                    <input name="agentEmail" placeholder="Agent Email" type="email" value={form.agentEmail} onChange={handleText} className={agentInputClass} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 mt-1">
            <p className="text-xs text-gray-500 leading-relaxed">
              <span className="font-semibold text-gray-700">Privacy Notice:</span> The personal information you provide on this sign-in sheet is collected solely for the purpose of property follow-up and visitor log compliance. Your contact details will be shared only with the homeowner and listing agent as required for the security and documentation of this showing. Your information will not be sold, distributed, or used for any purpose unrelated to this property.
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
