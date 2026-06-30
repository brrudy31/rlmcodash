'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, User, KeyRound } from 'lucide-react';
import Link from 'next/link';

export default function SignupPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', inviteCode: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, [k]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        router.push('/dashboard');
      } else {
        const data = await res.json();
        setError(data.error || 'Something went wrong');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full bg-navy-750 border border-navy-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-navy-400 focus:outline-none focus:border-gold-500 transition-colors";

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-navy-800 rounded-2xl border border-navy-700 shadow-2xl overflow-hidden">
          <div className="bg-navy-750 px-8 py-10 text-center border-b border-navy-700">
            <h1 className="text-4xl font-bold text-gold-500 tracking-widest">RLM&CO</h1>
            <p className="text-navy-300 mt-2 text-sm tracking-wide uppercase">Create Your Account</p>
          </div>
          <div className="px-8 py-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-navy-300 mb-2">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400 w-4 h-4" />
                  <input type="text" value={form.name} onChange={set('name')} className={inputClass} placeholder="Jane Smith" required autoFocus />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-300 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400 w-4 h-4" />
                  <input type="email" value={form.email} onChange={set('email')} className={inputClass} placeholder="you@example.com" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-300 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400 w-4 h-4" />
                  <input type="password" value={form.password} onChange={set('password')} className={inputClass} placeholder="Min. 8 characters" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-300 mb-2">Invite Code</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400 w-4 h-4" />
                  <input type="text" value={form.inviteCode} onChange={set('inviteCode')} className={inputClass} placeholder="Enter the invite code" required />
                </div>
                <p className="text-navy-500 text-xs mt-1.5">Ask your team admin for the invite code.</p>
              </div>
              {error && (
                <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gold-500 hover:bg-gold-400 disabled:opacity-60 text-navy-900 font-semibold py-3 rounded-lg transition-colors text-sm tracking-wide mt-2"
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
            <p className="text-center text-navy-500 text-sm mt-6">
              Already have an account?{' '}
              <Link href="/" className="text-gold-400 hover:text-gold-300 font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
