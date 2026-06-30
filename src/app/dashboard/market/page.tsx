'use client';

import { useEffect, useState } from 'react';
import {
  TrendingUp, Plus, Trash2, Send, ChevronDown, ChevronUp,
  DollarSign, Clock, Home, BarChart2, FileText,
} from 'lucide-react';

interface MarketStat {
  id: number;
  neighborhood: string;
  zip_code: string | null;
  month: string;
  median_price: number | null;
  price_per_sqft: number | null;
  avg_days_on_market: number | null;
  homes_sold: number | null;
  active_listings: number | null;
  list_to_sale_ratio: number | null;
  notes: string | null;
}

interface Client { id: number; name: string; email: string; opted_out_at: string | null; }

const emptyForm = {
  neighborhood: '',
  zip_code: '',
  month: new Date().toISOString().slice(0, 7),
  median_price: '',
  price_per_sqft: '',
  avg_days_on_market: '',
  homes_sold: '',
  active_listings: '',
  list_to_sale_ratio: '',
  notes: '',
};

function fmt$( n: number | null ) {
  if (n == null) return '—';
  return '$' + n.toLocaleString();
}
function fmtN( n: number | null, decimals = 0 ) {
  if (n == null) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}
function fmtMonth( m: string ) {
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function MarketPage() {
  const [stats, setStats] = useState<MarketStat[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Email composer
  const [showEmail, setShowEmail] = useState(false);
  const [emailStat, setEmailStat] = useState<MarketStat | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClients, setSelectedClients] = useState<number[]>([]);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sending, setSending] = useState(false);
  const [emailResult, setEmailResult] = useState('');

  useEffect(() => {
    fetch('/api/market-stats').then(r => r.json()).then(setStats);
    fetch('/api/clients').then(r => r.json()).then((c: Client[]) => setClients(c.filter(x => !x.opted_out_at)));
  }, []);

  function field(k: keyof typeof emptyForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));
  }

  async function save() {
    if (!form.neighborhood || !form.month) return;
    setSaving(true);
    const body = {
      neighborhood: form.neighborhood,
      zip_code: form.zip_code || null,
      month: form.month,
      median_price: form.median_price ? Number(form.median_price) : null,
      price_per_sqft: form.price_per_sqft ? Number(form.price_per_sqft) : null,
      avg_days_on_market: form.avg_days_on_market ? Number(form.avg_days_on_market) : null,
      homes_sold: form.homes_sold ? Number(form.homes_sold) : null,
      active_listings: form.active_listings ? Number(form.active_listings) : null,
      list_to_sale_ratio: form.list_to_sale_ratio ? Number(form.list_to_sale_ratio) : null,
      notes: form.notes || null,
    };
    const res = await fetch('/api/market-stats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const created = await res.json();
    setStats(s => [created, ...s]);
    setForm(emptyForm);
    setShowForm(false);
    setSaving(false);
  }

  async function remove(id: number) {
    if (!confirm('Delete this market snapshot?')) return;
    await fetch(`/api/market-stats/${id}`, { method: 'DELETE' });
    setStats(s => s.filter(x => x.id !== id));
  }

  function openEmailComposer(stat: MarketStat) {
    setEmailStat(stat);
    setSelectedClients(clients.map(c => c.id));
    const subject = `📊 ${stat.neighborhood} Market Update — ${fmtMonth(stat.month)}`;
    const body = buildEmailBody(stat);
    setEmailSubject(subject);
    setEmailBody(body);
    setEmailResult('');
    setShowEmail(true);
  }

  function buildEmailBody(s: MarketStat) {
    const lines: string[] = [];
    lines.push(`Hi [First Name],`);
    lines.push('');
    lines.push(`Here's your ${fmtMonth(s.month)} market update for ${s.neighborhood}${s.zip_code ? ` (${s.zip_code})` : ''}:`);
    lines.push('');
    if (s.median_price) lines.push(`🏠 Median Sale Price: ${fmt$(s.median_price)}`);
    if (s.price_per_sqft) lines.push(`📐 Price Per Sq Ft: $${fmtN(s.price_per_sqft, 0)}`);
    if (s.avg_days_on_market) lines.push(`⏱️ Avg Days on Market: ${fmtN(s.avg_days_on_market, 0)} days`);
    if (s.homes_sold) lines.push(`✅ Homes Sold: ${fmtN(s.homes_sold)}`);
    if (s.active_listings) lines.push(`🔑 Active Listings: ${fmtN(s.active_listings)}`);
    if (s.list_to_sale_ratio) lines.push(`💡 List-to-Sale Ratio: ${fmtN(s.list_to_sale_ratio, 1)}%`);
    lines.push('');
    if (s.notes) {
      lines.push(`My Take: ${s.notes}`);
      lines.push('');
    }
    lines.push(`Whether you're thinking about buying, selling, or just keeping an eye on the market — I'm always here to help. Feel free to reply to this email or give me a call anytime.`);
    lines.push('');
    lines.push('Best,');
    lines.push('Ben Rudy');
    lines.push('RLM&CO Real Estate');
    return lines.join('\n');
  }

  async function sendEmail() {
    if (!emailStat || selectedClients.length === 0) return;
    setSending(true);
    setEmailResult('');
    const chosen = clients.filter(c => selectedClients.includes(c.id));
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: emailSubject,
          message: emailBody,
          clientIds: chosen.map(c => c.id),
          listName: `Market Update — ${emailStat.neighborhood}`,
        }),
      });
      if (res.ok) {
        setEmailResult(`✅ Market update sent to ${chosen.length} client${chosen.length !== 1 ? 's' : ''}!`);
        setTimeout(() => { setShowEmail(false); setEmailResult(''); }, 2500);
      } else {
        setEmailResult('❌ Failed to send. Check your email settings.');
      }
    } catch {
      setEmailResult('❌ Network error.');
    }
    setSending(false);
  }

  // Group stats by neighborhood for the summary view
  const neighborhoods = Array.from(new Set(stats.map(s => s.neighborhood)));
  const latest: Record<string, MarketStat> = {};
  for (const s of stats) {
    if (!latest[s.neighborhood]) latest[s.neighborhood] = s;
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Market Stats</h2>
          <p className="text-navy-400 text-sm mt-1">{neighborhoods.length} neighborhood{neighborhoods.length !== 1 ? 's' : ''} tracked</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Snapshot
        </button>
      </div>

      {/* How to use tip */}
      {stats.length === 0 && !showForm && (
        <div className="bg-navy-800 rounded-xl border border-navy-700 p-8 text-center mb-6">
          <TrendingUp className="w-10 h-10 text-gold-500 mx-auto mb-3" />
          <h3 className="text-white font-semibold mb-2">Track Your Local Market</h3>
          <p className="text-navy-400 text-sm max-w-md mx-auto">
            Pull stats from your Matrix reports each month — median price, price/sqft, days on market — and log them here. Then send polished market update emails to your clients in one click.
          </p>
          <button onClick={() => setShowForm(true)} className="mt-4 bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold px-5 py-2 rounded-lg text-sm transition-colors">
            Log Your First Snapshot
          </button>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="bg-navy-800 rounded-xl border border-navy-700 p-6 mb-6">
          <h3 className="text-white font-semibold mb-1">New Market Snapshot</h3>
          <p className="text-navy-500 text-xs mb-4">Pull these numbers from your Matrix reports or Bright MLS market stats.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-navy-400 text-xs mb-1">Neighborhood / Area *</label>
              <input type="text" placeholder="e.g. Fishtown, Center City, Ardmore" value={form.neighborhood} onChange={field('neighborhood')}
                className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-500 placeholder-navy-500" />
            </div>
            <div>
              <label className="block text-navy-400 text-xs mb-1">Zip Code</label>
              <input type="text" placeholder="e.g. 19125" value={form.zip_code} onChange={field('zip_code')}
                className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-500 placeholder-navy-500" />
            </div>
            <div>
              <label className="block text-navy-400 text-xs mb-1">Month *</label>
              <input type="month" value={form.month} onChange={field('month')}
                className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-500" />
            </div>
            <div>
              <label className="block text-navy-400 text-xs mb-1">Median Sale Price ($)</label>
              <input type="number" placeholder="e.g. 385000" value={form.median_price} onChange={field('median_price')}
                className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-500 placeholder-navy-500" />
            </div>
            <div>
              <label className="block text-navy-400 text-xs mb-1">Price Per Sq Ft ($)</label>
              <input type="number" placeholder="e.g. 245" value={form.price_per_sqft} onChange={field('price_per_sqft')}
                className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-500 placeholder-navy-500" />
            </div>
            <div>
              <label className="block text-navy-400 text-xs mb-1">Avg Days on Market</label>
              <input type="number" placeholder="e.g. 18" value={form.avg_days_on_market} onChange={field('avg_days_on_market')}
                className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-500 placeholder-navy-500" />
            </div>
            <div>
              <label className="block text-navy-400 text-xs mb-1">Homes Sold</label>
              <input type="number" placeholder="e.g. 42" value={form.homes_sold} onChange={field('homes_sold')}
                className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-500 placeholder-navy-500" />
            </div>
            <div>
              <label className="block text-navy-400 text-xs mb-1">Active Listings</label>
              <input type="number" placeholder="e.g. 15" value={form.active_listings} onChange={field('active_listings')}
                className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-500 placeholder-navy-500" />
            </div>
            <div>
              <label className="block text-navy-400 text-xs mb-1">List-to-Sale Ratio (%)</label>
              <input type="number" step="0.1" placeholder="e.g. 102.5" value={form.list_to_sale_ratio} onChange={field('list_to_sale_ratio')}
                className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-500 placeholder-navy-500" />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-navy-400 text-xs mb-1">Your Take / Notes (used in email)</label>
            <textarea rows={2} placeholder="e.g. Multiple offer situations are back. Sellers are seeing strong activity under $400k." value={form.notes} onChange={field('notes')}
              className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-500 placeholder-navy-500 resize-none" />
          </div>
          <div className="flex gap-3">
            <button onClick={save} disabled={saving || !form.neighborhood || !form.month}
              className="bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-navy-900 font-semibold px-5 py-2 rounded-lg text-sm transition-colors">
              {saving ? 'Saving…' : 'Save Snapshot'}
            </button>
            <button onClick={() => { setShowForm(false); setForm(emptyForm); }} className="text-navy-400 hover:text-white px-4 py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Latest snapshot summary cards */}
      {neighborhoods.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
          {neighborhoods.map(n => {
            const s = latest[n];
            return (
              <div key={n} className="bg-navy-800 rounded-xl border border-navy-700 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-white">{s.neighborhood}</p>
                    <p className="text-navy-500 text-xs">{fmtMonth(s.month)}{s.zip_code ? ` · ${s.zip_code}` : ''}</p>
                  </div>
                  <button onClick={() => openEmailComposer(s)} title="Send market update email"
                    className="flex items-center gap-1.5 text-xs text-gold-400 hover:text-gold-300 font-medium bg-gold-400/10 hover:bg-gold-400/20 px-2.5 py-1.5 rounded-lg transition-colors">
                    <Send className="w-3 h-3" /> Email
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: DollarSign, label: 'Median Price', value: fmt$(s.median_price), color: 'text-white' },
                    { icon: Home, label: '$/Sq Ft', value: s.price_per_sqft ? `$${fmtN(s.price_per_sqft, 0)}` : '—', color: 'text-navy-300' },
                    { icon: Clock, label: 'Avg DOM', value: s.avg_days_on_market ? `${fmtN(s.avg_days_on_market, 0)}d` : '—', color: 'text-white' },
                    { icon: BarChart2, label: 'Homes Sold', value: fmtN(s.homes_sold), color: 'text-navy-300' },
                  ].map(({ icon: Icon, label, value, color }) => (
                    <div key={label} className="bg-navy-750/50 rounded-lg p-2.5">
                      <div className="flex items-center gap-1 mb-1">
                        <Icon className={`w-3 h-3 ${color}`} />
                        <span className="text-navy-500 text-xs">{label}</span>
                      </div>
                      <p className="text-white font-semibold text-sm">{value}</p>
                    </div>
                  ))}
                </div>
                {s.notes && <p className="text-navy-400 text-xs mt-3 italic border-t border-navy-700 pt-2">{s.notes}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* Full history */}
      {stats.length > 0 && (
        <div className="bg-navy-800 rounded-xl border border-navy-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-navy-700">
            <h3 className="font-semibold text-white">Full History</h3>
          </div>
          <div className="divide-y divide-navy-700">
            {stats.map(s => (
              <div key={s.id}>
                <button className="w-full text-left px-5 py-3 flex items-center justify-between hover:bg-navy-750/30 transition-colors"
                  onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-gold-500 flex-shrink-0" />
                    <div>
                      <span className="text-white font-medium text-sm">{s.neighborhood}</span>
                      {s.zip_code && <span className="text-navy-500 text-xs ml-2">{s.zip_code}</span>}
                    </div>
                    <span className="text-navy-400 text-xs">{fmtMonth(s.month)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={(e) => { e.stopPropagation(); openEmailComposer(s); }}
                      className="text-gold-400 hover:text-gold-300 p-1 rounded transition-colors" title="Send email">
                      <Send className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); remove(s.id); }}
                      className="text-navy-600 hover:text-red-400 p-1 rounded transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {expandedId === s.id ? <ChevronUp className="w-4 h-4 text-navy-400" /> : <ChevronDown className="w-4 h-4 text-navy-400" />}
                  </div>
                </button>
                {expandedId === s.id && (
                  <div className="px-5 pb-4 grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-navy-750">
                    <div className="pt-3" />
                    {[
                      ['Median Price', fmt$(s.median_price)],
                      ['Price/Sq Ft', s.price_per_sqft ? `$${fmtN(s.price_per_sqft, 0)}` : '—'],
                      ['Avg Days on Market', s.avg_days_on_market ? `${fmtN(s.avg_days_on_market, 0)} days` : '—'],
                      ['Homes Sold', fmtN(s.homes_sold)],
                      ['Active Listings', fmtN(s.active_listings)],
                      ['List-to-Sale Ratio', s.list_to_sale_ratio ? `${fmtN(s.list_to_sale_ratio, 1)}%` : '—'],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-navy-500 text-xs">{label}</p>
                        <p className="text-white font-medium text-sm">{value}</p>
                      </div>
                    ))}
                    {s.notes && (
                      <div className="col-span-full">
                        <p className="text-navy-500 text-xs">Notes</p>
                        <p className="text-navy-300 text-sm">{s.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Email Composer Modal */}
      {showEmail && emailStat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowEmail(false)} />
          <div className="relative bg-navy-800 rounded-xl border border-navy-600 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-navy-700">
              <h2 className="text-lg font-semibold text-white">Send Market Update Email</h2>
              <button onClick={() => setShowEmail(false)} className="text-navy-400 hover:text-white p-1 rounded hover:bg-navy-700">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

              {/* Recipients */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-navy-300">Recipients ({selectedClients.length} selected)</label>
                  <div className="flex gap-3">
                    <button onClick={() => setSelectedClients(clients.map(c => c.id))} className="text-xs text-gold-400 hover:text-gold-300">All</button>
                    <button onClick={() => setSelectedClients([])} className="text-xs text-navy-400 hover:text-white">None</button>
                  </div>
                </div>
                <div className="max-h-32 overflow-y-auto bg-navy-750 rounded-lg border border-navy-600 p-2 space-y-1">
                  {clients.map(c => (
                    <label key={c.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-navy-700 cursor-pointer">
                      <input type="checkbox" checked={selectedClients.includes(c.id)}
                        onChange={() => setSelectedClients(p => p.includes(c.id) ? p.filter(x => x !== c.id) : [...p, c.id])}
                        className="accent-gold-500" />
                      <span className="text-white text-sm">{c.name}</span>
                      <span className="text-navy-400 text-xs">{c.email}</span>
                    </label>
                  ))}
                  {clients.length === 0 && <p className="text-navy-500 text-sm text-center py-2">No clients added yet.</p>}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-navy-300 mb-1.5">Subject</label>
                <input type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                  className="w-full bg-navy-750 border border-navy-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-gold-500" />
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-medium text-navy-300 mb-1.5">Message</label>
                <textarea rows={12} value={emailBody} onChange={e => setEmailBody(e.target.value)}
                  className="w-full bg-navy-750 border border-navy-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-gold-500 resize-none font-mono" />
              </div>

              {emailResult && (
                <p className={`text-sm font-medium ${emailResult.startsWith('✅') ? 'text-white' : 'text-red-400'}`}>{emailResult}</p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-navy-700 flex gap-3">
              <button onClick={() => setShowEmail(false)} className="border border-navy-600 text-navy-300 hover:text-white px-4 py-2.5 rounded-lg text-sm">Cancel</button>
              <button onClick={sendEmail} disabled={sending || selectedClients.length === 0 || !emailSubject}
                className="flex-1 flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-navy-900 font-semibold py-2.5 rounded-lg text-sm transition-colors">
                {sending ? 'Sending…' : <><Send className="w-4 h-4" /> Send to {selectedClients.length} Client{selectedClients.length !== 1 ? 's' : ''}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
