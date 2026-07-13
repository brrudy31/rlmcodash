'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Flame, Thermometer, Snowflake, Users, ArrowLeft, RefreshCw } from 'lucide-react';

interface SignIn {
  id: number;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  has_home_to_buy: number;
  has_home_to_sell: number;
  is_pre_approved: number;
  working_with_agent: number;
  agent_name: string | null;
  lead_score: number;
  created_at: string;
  ghl_contact_id: string | null;
}

interface OpenHouse {
  id: number;
  address: string;
  city: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
}

function scoreTier(score: number): { label: string; color: string; bg: string; border: string; Icon: React.ElementType } {
  if (score >= 4) return { label: 'Hot Lead', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/40', Icon: Flame };
  if (score >= 2) return { label: 'Warm Lead', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/40', Icon: Thermometer };
  return { label: 'Cold Lead', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/40', Icon: Snowflake };
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function LiveDashboardPage() {
  const { id } = useParams();
  const router = useRouter();
  const [signins, setSignins] = useState<SignIn[]>([]);
  const [house, setHouse] = useState<OpenHouse | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const [ohRes, siRes] = await Promise.all([
      fetch(`/api/open-houses`).then((r) => r.json()),
      fetch(`/api/open-houses/${id}/signins`).then((r) => r.json()),
    ]);
    const found = Array.isArray(ohRes) ? ohRes.find((h: OpenHouse) => String(h.id) === String(id)) : null;
    if (found) setHouse(found);
    if (Array.isArray(siRes)) setSignins(siRes);
    setLastRefresh(new Date());
    setRefreshing(false);
  }, [id]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  const hot = signins.filter((s) => s.lead_score >= 4);
  const warm = signins.filter((s) => s.lead_score >= 2 && s.lead_score < 4);
  const cold = signins.filter((s) => s.lead_score < 2);

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <button onClick={() => router.back()} className="flex items-center gap-1 text-navy-400 hover:text-white text-sm mb-2 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
            Live Dashboard
          </h1>
          {house && <p className="text-navy-400 text-sm mt-1">{house.address} · {new Date(house.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>}
        </div>
        <div className="text-right">
          <button onClick={refresh} disabled={refreshing} className="flex items-center gap-1.5 text-navy-400 hover:text-white text-xs transition-colors disabled:opacity-40">
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <p className="text-navy-600 text-xs mt-1">Last updated {timeAgo(lastRefresh.toISOString())} · auto every 15s</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Total', value: signins.length, color: 'text-white', bg: 'bg-navy-800 border-navy-700' },
          { label: 'Hot', value: hot.length, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' },
          { label: 'Warm', value: warm.length, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
          { label: 'Cold', value: cold.length, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} border rounded-xl p-4 text-center`}>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
            <p className="text-navy-400 text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Sign-in feed */}
      {signins.length === 0 ? (
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-12 text-center">
          <Users className="w-10 h-10 text-navy-600 mx-auto mb-3" />
          <p className="text-navy-400">Waiting for sign-ins…</p>
          <p className="text-navy-600 text-xs mt-1">This page refreshes automatically every 15 seconds</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Hot leads first */}
          {[...signins].sort((a, b) => b.lead_score - a.lead_score || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((s) => {
            const tier = scoreTier(s.lead_score);
            const { Icon } = tier;
            return (
              <div key={s.id} className={`${tier.bg} border ${tier.border} rounded-xl p-4 transition-all`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-full ${tier.bg} border ${tier.border} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-4 h-4 ${tier.color}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-semibold">{s.first_name} {s.last_name}</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${tier.bg} ${tier.border} ${tier.color}`}>
                          {tier.label}
                        </span>
                        {s.ghl_contact_id && <span className="text-xs bg-navy-700 text-navy-400 px-2 py-0.5 rounded-full">In CRM</span>}
                      </div>
                      <div className="flex gap-3 mt-1 flex-wrap">
                        {s.phone && <p className="text-navy-400 text-xs">{s.phone}</p>}
                        {s.email && <p className="text-navy-400 text-xs">{s.email}</p>}
                      </div>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {Boolean(s.has_home_to_buy) && <span className="text-xs bg-navy-700/60 text-navy-300 px-2 py-0.5 rounded-full">Buying</span>}
                        {Boolean(s.has_home_to_sell) && <span className="text-xs bg-navy-700/60 text-navy-300 px-2 py-0.5 rounded-full">Selling</span>}
                        {Boolean(s.is_pre_approved) && <span className="text-xs bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full">Pre-Approved</span>}
                        {Boolean(s.working_with_agent) && <span className="text-xs bg-navy-700/60 text-navy-400 px-2 py-0.5 rounded-full">Has Agent</span>}
                      </div>
                      {s.agent_name && (
                        <p className="text-navy-500 text-xs mt-1">Agent: {s.agent_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-lg font-bold ${tier.color}`}>{s.lead_score}/6</div>
                    <p className="text-navy-600 text-xs">{timeAgo(s.created_at)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
