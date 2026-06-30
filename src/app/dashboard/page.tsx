'use client';

import { useEffect, useState } from 'react';
import { Users, ListChecks, Send, Home, DoorOpen, TrendingUp, DollarSign, Clock, BarChart2 } from 'lucide-react';
import Link from 'next/link';

interface Stats {
  clients: number;
  vendorLists: number;
  emailsSent: number;
  openHouses: number;
  doorsKnocked: number;
}

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
  notes: string | null;
}

function fmt$(n: number | null) { return n == null ? '—' : '$' + n.toLocaleString(); }
function fmtN(n: number | null, d = 0) { return n == null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: d }); }
function fmtMonth(m: string) {
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ clients: 0, vendorLists: 0, emailsSent: 0, openHouses: 0, doorsKnocked: 0 });
  const [marketStats, setMarketStats] = useState<MarketStat[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/clients').then((r) => r.json()),
      fetch('/api/vendor-lists').then((r) => r.json()),
      fetch('/api/campaigns').then((r) => r.json()),
      fetch('/api/open-houses').then((r) => r.json()),
      fetch('/api/door-knocking').then((r) => r.json()),
      fetch('/api/market-stats').then((r) => r.json()),
    ]).then(([clients, lists, campaigns, houses, knocking, market]) => {
      const totalSent = campaigns.reduce((acc: number, c: { total_sent: number }) => acc + (c.total_sent || 0), 0);
      const totalDoors = knocking.reduce((acc: number, s: { total_doors: number }) => acc + (s.total_doors || 0), 0);
      setStats({ clients: clients.length, vendorLists: lists.length, emailsSent: totalSent, openHouses: houses.length, doorsKnocked: totalDoors });

      // Get latest snapshot per neighborhood
      const seen = new Set<string>();
      const latest: MarketStat[] = [];
      for (const s of market) {
        if (!seen.has(s.neighborhood)) { seen.add(s.neighborhood); latest.push(s); }
      }
      setMarketStats(latest.slice(0, 3));
    });
  }, []);

  const cards = [
    { label: 'Total Clients', value: stats.clients, icon: Users, color: 'text-navy-300', bg: 'bg-navy-700' },
    { label: 'Vendor Lists', value: stats.vendorLists, icon: ListChecks, color: 'text-navy-300', bg: 'bg-navy-700' },
    { label: 'Emails Sent', value: stats.emailsSent, icon: Send, color: 'text-gold-400', bg: 'bg-gold-400/10' },
    { label: 'Open Houses', value: stats.openHouses, icon: Home, color: 'text-white', bg: 'bg-navy-700' },
    { label: 'Doors Knocked', value: stats.doorsKnocked, icon: DoorOpen, color: 'text-orange-400', bg: 'bg-orange-400/10' },
  ];

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Overview</h2>
        <p className="text-navy-400 mt-1">Welcome back to your RLM&CO dashboard.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
        {cards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-navy-800 rounded-xl border border-navy-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-navy-400 text-sm font-medium">{label}</span>
              <div className={`${bg} p-2 rounded-lg`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Market Snapshot Widget */}
      <div className="bg-navy-800 rounded-xl border border-navy-700 mb-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-700">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-gold-500" />
            <h3 className="text-lg font-semibold text-white">Market Snapshot</h3>
          </div>
          <Link href="/dashboard/market" className="text-gold-400 hover:text-gold-300 text-sm font-medium transition-colors">
            View All →
          </Link>
        </div>

        {marketStats.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <p className="text-navy-500 text-sm mb-3">No market data logged yet.</p>
            <Link href="/dashboard/market" className="text-gold-400 hover:text-gold-300 text-sm font-medium">
              + Add your first market snapshot
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-navy-700">
            {marketStats.map(s => (
              <div key={s.id} className="px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-white">{s.neighborhood}</p>
                    <p className="text-navy-500 text-xs">{fmtMonth(s.month)}{s.zip_code ? ` · ${s.zip_code}` : ''}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { icon: DollarSign, label: 'Median Price', value: fmt$(s.median_price), color: 'text-white' },
                    { icon: Home, label: '$/Sq Ft', value: s.price_per_sqft ? `$${fmtN(s.price_per_sqft, 0)}` : '—', color: 'text-navy-300' },
                    { icon: Clock, label: 'Avg DOM', value: s.avg_days_on_market ? `${fmtN(s.avg_days_on_market, 0)}d` : '—', color: 'text-white' },
                    { icon: BarChart2, label: 'Homes Sold', value: fmtN(s.homes_sold), color: 'text-navy-300' },
                  ].map(({ icon: Icon, label, value, color }) => (
                    <div key={label} className="bg-navy-750/50 rounded-lg p-3">
                      <div className="flex items-center gap-1 mb-1">
                        <Icon className={`w-3 h-3 ${color}`} />
                        <span className="text-navy-500 text-xs">{label}</span>
                      </div>
                      <p className="text-white font-semibold text-sm">{value}</p>
                    </div>
                  ))}
                </div>
                {s.notes && <p className="text-navy-400 text-xs mt-2 italic">{s.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-navy-800 rounded-xl border border-navy-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-2">Quick Start</h3>
        <ul className="text-navy-300 text-sm space-y-2 list-disc list-inside">
          <li>Add your clients under the <strong className="text-gold-400">Clients</strong> tab</li>
          <li>Create vendor lists and add vendors under <strong className="text-gold-400">Vendor Lists</strong></li>
          <li>Send emails to clients via <strong className="text-gold-400">Send Emails</strong></li>
          <li>Log market stats from Matrix under <strong className="text-gold-400">Market Stats</strong> and send updates to clients</li>
          <li>Track open houses and door knocking sessions in their respective tabs</li>
        </ul>
      </div>
    </div>
  );
}
