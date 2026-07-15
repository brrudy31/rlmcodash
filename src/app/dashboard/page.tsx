'use client';

import { useEffect, useState, useCallback } from 'react';
import { Users, ListChecks, Send, Home, DoorOpen, TrendingUp, DollarSign, Clock, BarChart2, CheckCircle2, Circle, Flame, Zap, Sun, Moon, Calendar, AlertCircle } from 'lucide-react';
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

interface ChecklistItem {
  id: number;
  category: string;
  label: string;
  description: string | null;
  is_dynamic: boolean;
  dynamic_count: number;
  dynamic_label: string | null;
  dynamic_link: string | null;
  frequency: string;
  completed: boolean;
}

interface ChecklistData {
  date: string;
  items: ChecklistItem[];
  streak: number;
  completedCount: number;
  totalCount: number;
}

function fmt$(n: number | null) { return n == null ? '—' : '$' + n.toLocaleString(); }
function fmtN(n: number | null, d = 0) { return n == null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: d }); }
function fmtMonth(m: string) {
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  morning:        { label: 'Morning',        icon: Sun,      color: 'text-yellow-400' },
  daily_leadgen:  { label: 'Daily Lead-Gen', icon: Zap,      color: 'text-gold-400'   },
  open_house_day: { label: 'Open House Day', icon: Home,     color: 'text-green-400'  },
  end_of_day:     { label: 'End of Day',     icon: Moon,     color: 'text-blue-400'   },
  weekly:         { label: 'Weekly',         icon: Calendar, color: 'text-purple-400' },
};

function ChecklistWidget() {
  const [data, setData] = useState<ChecklistData | null>(null);
  const [toggling, setToggling] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    const res = await fetch('/api/checklist/today');
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggle(item: ChecklistItem) {
    if (toggling.has(item.id)) return;
    setToggling((s) => new Set(s).add(item.id));
    const next = !item.completed;
    // Optimistic update
    setData((d) => d ? { ...d, items: d.items.map((i) => i.id === item.id ? { ...i, completed: next } : i), completedCount: d.completedCount + (next ? 1 : -1) } : d);
    await fetch(`/api/checklist/${item.id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: next }),
    });
    setToggling((s) => { const n = new Set(s); n.delete(item.id); return n; });
  }

  if (!data) {
    return (
      <div className="bg-navy-800 rounded-xl border border-navy-700 p-6 animate-pulse">
        <div className="h-5 bg-navy-700 rounded w-40 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-10 bg-navy-700 rounded" />)}
        </div>
      </div>
    );
  }

  // Group items by category
  const grouped: Record<string, ChecklistItem[]> = {};
  for (const item of data.items) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }

  const pct = data.totalCount > 0 ? Math.round((data.completedCount / data.totalCount) * 100) : 0;
  const allDone = data.completedCount === data.totalCount && data.totalCount > 0;

  return (
    <div className="bg-navy-800 rounded-xl border border-navy-700">
      {/* Header */}
      <div className="px-6 py-4 border-b border-navy-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ListChecks className="w-5 h-5 text-gold-500" />
            <h3 className="text-lg font-semibold text-white">Today&apos;s Checklist</h3>
            <span className="text-navy-500 text-xs">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
          </div>
          {/* Streak badge */}
          {data.streak > 0 && (
            <div className="flex items-center gap-1.5 bg-orange-500/15 border border-orange-500/30 rounded-full px-3 py-1">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-orange-400 text-xs font-semibold">{data.streak} day streak</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-navy-400 text-xs">{data.completedCount} of {data.totalCount} done</span>
            <span className={`text-xs font-semibold ${allDone ? 'text-green-400' : 'text-navy-400'}`}>{pct}%</span>
          </div>
          <div className="h-1.5 bg-navy-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-green-400' : 'bg-gold-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Items by category */}
      <div className="divide-y divide-navy-700/50">
        {Object.entries(grouped).map(([cat, items]) => {
          const meta = CATEGORY_META[cat] ?? { label: cat, icon: ListChecks, color: 'text-navy-400' };
          const CatIcon = meta.icon;
          const catDone = items.every((i) => i.completed);
          return (
            <div key={cat} className="px-6 py-4">
              <div className="flex items-center gap-2 mb-3">
                <CatIcon className={`w-3.5 h-3.5 ${catDone ? 'text-green-400' : meta.color}`} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${catDone ? 'text-green-400' : meta.color}`}>
                  {meta.label}
                </span>
                {catDone && <span className="text-green-400 text-xs">✓</span>}
              </div>
              <div className="space-y-2">
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => toggle(item)}
                    disabled={toggling.has(item.id)}
                    className={`w-full flex items-start gap-3 text-left rounded-lg px-3 py-2.5 transition-all group
                      ${item.completed
                        ? 'bg-green-500/8 border border-green-500/20 opacity-70'
                        : 'bg-navy-750/40 border border-navy-600/50 hover:border-navy-500 hover:bg-navy-700/60'
                      }`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {item.completed
                        ? <CheckCircle2 className="w-4.5 h-4.5 text-green-400" />
                        : <Circle className={`w-4.5 h-4.5 text-navy-600 group-hover:text-navy-400 transition-colors`} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium leading-snug ${item.completed ? 'line-through text-navy-500' : 'text-white'}`}>
                        {item.label}
                      </p>
                      {item.is_dynamic && item.dynamic_label ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <AlertCircle className={`w-3 h-3 flex-shrink-0 ${item.dynamic_count > 0 ? 'text-gold-400' : 'text-navy-500'}`} />
                          {item.dynamic_link ? (
                            <Link
                              href={item.dynamic_link}
                              onClick={(e) => e.stopPropagation()}
                              className={`text-xs hover:underline ${item.dynamic_count > 0 ? 'text-gold-400' : 'text-navy-500'}`}
                            >
                              {item.dynamic_label}
                            </Link>
                          ) : (
                            <span className={`text-xs ${item.dynamic_count > 0 ? 'text-gold-400' : 'text-navy-500'}`}>{item.dynamic_label}</span>
                          )}
                        </div>
                      ) : item.description ? (
                        <p className="text-navy-500 text-xs mt-0.5 leading-snug">{item.description}</p>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {data.totalCount === 0 && (
          <div className="px-6 py-10 text-center">
            <CheckCircle2 className="w-8 h-8 text-navy-600 mx-auto mb-2" />
            <p className="text-navy-500 text-sm">No tasks for today.</p>
          </div>
        )}

        {allDone && data.totalCount > 0 && (
          <div className="px-6 py-4 text-center">
            <p className="text-green-400 text-sm font-semibold">All done for today! 🎉</p>
            <p className="text-navy-500 text-xs mt-0.5">Streak: {data.streak} day{data.streak !== 1 ? 's' : ''} in a row</p>
          </div>
        )}
      </div>
    </div>
  );
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

      const seen = new Set<string>();
      const latest: MarketStat[] = [];
      for (const s of market) {
        if (!seen.has(s.neighborhood)) { seen.add(s.neighborhood); latest.push(s); }
      }
      setMarketStats(latest.slice(0, 3));
    });
  }, []);

  const cards = [
    { label: 'Total Clients',  value: stats.clients,      icon: Users,     color: 'text-navy-300',   bg: 'bg-navy-700'        },
    { label: 'Vendor Lists',   value: stats.vendorLists,  icon: ListChecks,color: 'text-navy-300',   bg: 'bg-navy-700'        },
    { label: 'Emails Sent',    value: stats.emailsSent,   icon: Send,      color: 'text-gold-400',   bg: 'bg-gold-400/10'     },
    { label: 'Open Houses',    value: stats.openHouses,   icon: Home,      color: 'text-white',      bg: 'bg-navy-700'        },
    { label: 'Doors Knocked',  value: stats.doorsKnocked, icon: DoorOpen,  color: 'text-orange-400', bg: 'bg-orange-400/10'   },
  ];

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Overview</h2>
        <p className="text-navy-400 mt-1">Welcome back to your RLM&amp;CO dashboard.</p>
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

      {/* Daily Checklist */}
      <div className="mb-6">
        <ChecklistWidget />
      </div>

      {/* Market Snapshot */}
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
            {marketStats.map((s) => (
              <div key={s.id} className="px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-white">{s.neighborhood}</p>
                    <p className="text-navy-500 text-xs">{fmtMonth(s.month)}{s.zip_code ? ` · ${s.zip_code}` : ''}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { icon: DollarSign, label: 'Median Price', value: fmt$(s.median_price),                                              color: 'text-white'      },
                    { icon: Home,       label: '$/Sq Ft',       value: s.price_per_sqft ? `$${fmtN(s.price_per_sqft, 0)}` : '—',        color: 'text-navy-300'   },
                    { icon: Clock,      label: 'Avg DOM',        value: s.avg_days_on_market ? `${fmtN(s.avg_days_on_market, 0)}d` : '—', color: 'text-white'      },
                    { icon: BarChart2,  label: 'Homes Sold',     value: fmtN(s.homes_sold),                                               color: 'text-navy-300'   },
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
    </div>
  );
}
