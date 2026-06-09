'use client';

import { useEffect, useState } from 'react';
import { Trophy, TrendingUp, Users, Home } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts';

interface OpenHouse {
  id: number; date: string; address: string; neighborhood: string | null;
  city: string; time_of_day: string | null; total_attendees: number;
  neighbors: number; represented_buyers: number; unrepresented_buyers: number;
}

const GOLD = '#ffffff';
const BLUE = '#cccccc';
const PURPLE = '#999999';
const GREEN = '#e0e0e0';
const NAVY_LIGHT = '#505050';

const COLORS = ['#ffffff', '#d0d0d0', '#a0a0a0', '#707070', '#505050', '#353535'];

const TOOLTIP_STYLE = {
  backgroundColor: '#141414',
  border: '1px solid #383838',
  borderRadius: '8px',
  color: '#ffffff',
};

export default function AnalyticsPage() {
  const [houses, setHouses] = useState<OpenHouse[]>([]);

  useEffect(() => {
    fetch('/api/open-houses').then((r) => r.json()).then(setHouses);
  }, []);

  if (houses.length === 0) {
    return (
      <div className="p-6 lg:p-8">
        <h2 className="text-2xl font-bold text-white mb-2">Analytics</h2>
        <p className="text-navy-400 text-sm mb-8">Open house performance insights.</p>
        <div className="bg-navy-800 rounded-xl border border-navy-700 p-12 text-center text-navy-500">
          No open houses logged yet. Add some open houses to see analytics.
        </div>
      </div>
    );
  }

  // --- Top 3 Locations ---
  const locationMap: Record<string, { address: string; city: string; total: number; unrep: number; count: number }> = {};
  for (const h of houses) {
    const key = h.address;
    if (!locationMap[key]) locationMap[key] = { address: h.address, city: h.city, total: 0, unrep: 0, count: 0 };
    locationMap[key].total += h.total_attendees;
    locationMap[key].unrep += h.unrepresented_buyers;
    locationMap[key].count += 1;
  }
  const top3 = Object.values(locationMap)
    .sort((a, b) => b.total - a.total || b.unrep - a.unrep)
    .slice(0, 3);

  // --- Attendance Over Time ---
  const timelineData = [...houses]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((h) => ({
      date: new Date(h.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      attendees: h.total_attendees,
    }));

  // --- Avg Attendance by Neighborhood ---
  const neighborhoodMap: Record<string, { total: number; count: number }> = {};
  for (const h of houses) {
    const key = h.neighborhood || h.city;
    if (!neighborhoodMap[key]) neighborhoodMap[key] = { total: 0, count: 0 };
    neighborhoodMap[key].total += h.total_attendees;
    neighborhoodMap[key].count += 1;
  }
  const neighborhoodData = Object.entries(neighborhoodMap)
    .map(([name, { total, count }]) => ({ name, avg: Math.round(total / count) }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 10);

  // --- Traffic Breakdown ---
  const totalNeighbors = houses.reduce((s, h) => s + h.neighbors, 0);
  const totalRep = houses.reduce((s, h) => s + h.represented_buyers, 0);
  const totalUnrep = houses.reduce((s, h) => s + h.unrepresented_buyers, 0);
  const pieData = [
    { name: 'Neighbors', value: totalNeighbors },
    { name: 'Represented Buyers', value: totalRep },
    { name: 'Unrepresented Buyers', value: totalUnrep },
  ].filter((d) => d.value > 0);

  // --- Best Days ---
  const dayMap: Record<string, { total: number; count: number }> = {};
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (const h of houses) {
    const day = DAYS[new Date(h.date + 'T12:00:00').getDay()];
    if (!dayMap[day]) dayMap[day] = { total: 0, count: 0 };
    dayMap[day].total += h.total_attendees;
    dayMap[day].count += 1;
  }
  const daysData = DAYS.map((day) => ({
    day: day.slice(0, 3),
    avg: dayMap[day] ? Math.round(dayMap[day].total / dayMap[day].count) : 0,
    count: dayMap[day]?.count || 0,
  })).filter((d) => d.count > 0);

  // --- Best Times ---
  const timeMap: Record<string, { total: number; count: number }> = {};
  for (const h of houses) {
    if (!h.time_of_day) continue;
    if (!timeMap[h.time_of_day]) timeMap[h.time_of_day] = { total: 0, count: 0 };
    timeMap[h.time_of_day].total += h.total_attendees;
    timeMap[h.time_of_day].count += 1;
  }
  const timesData = Object.entries(timeMap)
    .map(([time, { total, count }]) => ({ time: time.split(' ')[0], avg: Math.round(total / count), count }))
    .sort((a, b) => b.avg - a.avg);

  // --- Unrepresented Buyer Rate by Location ---
  const unrepRate = Object.values(locationMap)
    .map((l) => ({
      name: l.address.length > 25 ? l.address.slice(0, 25) + '…' : l.address,
      rate: l.total > 0 ? Math.round((l.unrep / l.total) * 100) : 0,
      count: l.count,
    }))
    .filter((l) => l.count >= 1)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 8);

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Analytics</h2>
        <p className="text-navy-400 text-sm mt-1">Open house performance insights across {houses.length} events.</p>
      </div>

      {/* Top 3 Locations */}
      <div className="mb-8">
        <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-gold-500" /> Top 3 Best-Performing Locations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {top3.map((loc, i) => (
            <div key={loc.address} className="bg-navy-800 rounded-xl border border-navy-700 p-5 relative overflow-hidden">
              <div className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i === 0 ? 'bg-gold-500/20 text-gold-400' : i === 1 ? 'bg-navy-600/50 text-navy-300' : 'bg-orange-500/20 text-orange-400'}`}>
                #{i + 1}
              </div>
              <p className="font-semibold text-white pr-10 text-sm leading-snug">{loc.address}</p>
              <p className="text-navy-400 text-xs mt-0.5">{loc.city}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xl font-bold text-white">{loc.total}</p>
                  <p className="text-xs text-navy-400">Total</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-gold-400">{loc.unrep}</p>
                  <p className="text-xs text-navy-400">Unrep.</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-blue-400">{loc.count}</p>
                  <p className="text-xs text-navy-400">Events</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Attendance over time */}
        <div className="bg-navy-800 rounded-xl border border-navy-700 p-5 xl:col-span-2">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gold-400" /> Attendance Over Time
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#162d57" />
              <XAxis dataKey="date" tick={{ fill: '#8ba3c0', fontSize: 11 }} />
              <YAxis tick={{ fill: '#8ba3c0', fontSize: 11 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="attendees" stroke={GOLD} strokeWidth={2} dot={{ fill: GOLD, r: 4 }} name="Attendees" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Avg attendance by neighborhood */}
        <div className="bg-navy-800 rounded-xl border border-navy-700 p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Home className="w-4 h-4 text-blue-400" /> Avg Attendance by Neighborhood
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={neighborhoodData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#162d57" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#8ba3c0', fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fill: '#8ba3c0', fontSize: 10 }} width={90} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="avg" fill={BLUE} name="Avg Attendance" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Traffic breakdown pie */}
        <div className="bg-navy-800 rounded-xl border border-navy-700 p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" /> Overall Traffic Breakdown
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value">
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: '12px', color: '#8ba3c0' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Best days */}
        <div className="bg-navy-800 rounded-xl border border-navy-700 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Best Performing Days</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={daysData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#162d57" />
              <XAxis dataKey="day" tick={{ fill: '#8ba3c0', fontSize: 11 }} />
              <YAxis tick={{ fill: '#8ba3c0', fontSize: 11 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [v, 'Avg Attendance']} />
              <Bar dataKey="avg" fill={GOLD} name="Avg Attendance" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Best times */}
        {timesData.length > 0 && (
          <div className="bg-navy-800 rounded-xl border border-navy-700 p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Best Performing Times</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={timesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#162d57" />
                <XAxis dataKey="time" tick={{ fill: '#8ba3c0', fontSize: 11 }} />
                <YAxis tick={{ fill: '#8ba3c0', fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [v, 'Avg Attendance']} />
                <Bar dataKey="avg" fill={PURPLE} name="Avg Attendance" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Unrepresented buyer rate */}
        {unrepRate.length > 0 && (
          <div className="bg-navy-800 rounded-xl border border-navy-700 p-5 xl:col-span-2">
            <h3 className="text-sm font-semibold text-white mb-4">Unrepresented Buyer Rate by Location</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={unrepRate} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#162d57" horizontal={false} />
                <XAxis type="number" unit="%" tick={{ fill: '#8ba3c0', fontSize: 11 }} domain={[0, 100]} />
                <YAxis dataKey="name" type="category" tick={{ fill: '#8ba3c0', fontSize: 10 }} width={140} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, 'Unrep. Buyer Rate']} />
                <Bar dataKey="rate" fill={NAVY_LIGHT} name="Unrep. Buyer Rate %" radius={[0, 4, 4, 0]}
                  label={{ position: 'right', fill: '#c9a84c', fontSize: 11, formatter: (v: number) => `${v}%` }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
