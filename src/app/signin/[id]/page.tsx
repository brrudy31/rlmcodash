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
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e] text-white p-6 text-center">
        <div className="space-y-3">
          <div className="w-16 h-16 rounded-full bg-[#c9a84c]/20 flex items-center justify-center mx-auto">
            <Home className="w-8 h-8 text-[#c9a84c]" />
          </div>
          <h1 className="text-2xl font-bold">Thanks for stopping by!</h1>
          <p className="text-[#8892a4]">
            You&apos;ll hear from Ben shortly. Keep an eye on your texts!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white p-6">
      <div className="max-w-md mx-auto">
        <div className="mb-8">
          <div className="w-10 h-10 rounded-lg bg-[#c9a84c] flex items-center justify-center mb-4">
            <Home className="w-5 h-5 text-[#0a0f1e]" />
          </div>
          <h1 className="text-2xl font-bold">Welcome!</h1>
          <p className="text-[#8892a4] text-sm mt-1">
            Sign in to get property details &amp; updates from Ben.
          </p>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              name="firstName"
              placeholder="First Name"
              value={form.firstName}
              onChange={handleText}
              className="bg-[#111827] border border-[#1e2a3a] rounded-lg px-4 py-3 text-white placeholder-[#4a5568] focus:outline-none focus:border-[#c9a84c] text-sm"
            />
            <input
              name="lastName"
              placeholder="Last Name"
              value={form.lastName}
              onChange={handleText}
              className="bg-[#111827] border border-[#1e2a3a] rounded-lg px-4 py-3 text-white placeholder-[#4a5568] focus:outline-none focus:border-[#c9a84c] text-sm"
            />
          </div>
          <input
            name="phone"
            placeholder="Phone Number"
            type="tel"
            value={form.phone}
            onChange={handleText}
            className="w-full bg-[#111827] border border-[#1e2a3a] rounded-lg px-4 py-3 text-white placeholder-[#4a5568] focus:outline-none focus:border-[#c9a84c] text-sm"
          />
          <input
            name="email"
            placeholder="Email Address"
            type="email"
            value={form.email}
            onChange={handleText}
            className="w-full bg-[#111827] border border-[#1e2a3a] rounded-lg px-4 py-3 text-white placeholder-[#4a5568] focus:outline-none focus:border-[#c9a84c] text-sm"
          />

          <div className="border border-[#1e2a3a] rounded-lg p-4 space-y-3 mt-1">
            <p className="text-xs font-semibold text-[#8892a4] uppercase tracking-wide">Quick questions</p>
            {CHECKBOXES.map(({ name, label }) => (
              <div key={name}>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div
                    onClick={() => handleCheck(name)}
                    className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                      form[name]
                        ? 'bg-[#c9a84c] border-[#c9a84c]'
                        : 'border-[#2d3a4a] group-hover:border-[#c9a84c]'
                    }`}
                  >
                    {form[name] && (
                      <svg className="w-3 h-3 text-[#0a0f1e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-[#d1d5db]">{label}</span>
                </label>

                {name === 'workingWithAgent' && form.workingWithAgent && (
                  <div className="mt-3 ml-8 space-y-2">
                    <p className="text-xs text-[#8892a4] mb-2">Agent&apos;s info (optional)</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        name="agentName"
                        placeholder="Agent Name"
                        value={form.agentName}
                        onChange={handleText}
                        className="bg-[#0d1525] border border-[#2d3a4a] rounded-lg px-3 py-2.5 text-white placeholder-[#4a5568] focus:outline-none focus:border-[#c9a84c] text-xs"
                      />
                      <input
                        name="agentBrokerage"
                        placeholder="Brokerage"
                        value={form.agentBrokerage}
                        onChange={handleText}
                        className="bg-[#0d1525] border border-[#2d3a4a] rounded-lg px-3 py-2.5 text-white placeholder-[#4a5568] focus:outline-none focus:border-[#c9a84c] text-xs"
                      />
                    </div>
                    <input
                      name="agentPhone"
                      placeholder="Agent Phone"
                      type="tel"
                      value={form.agentPhone}
                      onChange={handleText}
                      className="w-full bg-[#0d1525] border border-[#2d3a4a] rounded-lg px-3 py-2.5 text-white placeholder-[#4a5568] focus:outline-none focus:border-[#c9a84c] text-xs"
                    />
                    <input
                      name="agentEmail"
                      placeholder="Agent Email"
                      type="email"
                      value={form.agentEmail}
                      onChange={handleText}
                      className="w-full bg-[#0d1525] border border-[#2d3a4a] rounded-lg px-3 py-2.5 text-white placeholder-[#4a5568] focus:outline-none focus:border-[#c9a84c] text-xs"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-[#c9a84c] hover:bg-[#d4b862] disabled:opacity-60 text-[#0a0f1e] font-bold py-3.5 rounded-lg text-sm transition-colors mt-2"
          >
            {loading ? 'Submitting…' : 'Sign In'}
          </button>

          <p className="text-xs text-center text-[#4a5568] pb-4">
            Your info is only used to follow up about this property.
          </p>
        </div>
      </div>
    </div>
  );
}
