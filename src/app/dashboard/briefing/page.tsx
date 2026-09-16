'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Sun, RefreshCw, Calendar, Mail, Users, CheckSquare, Home,
  AlertTriangle, Loader2, Phone, Clock, ChevronRight,
} from 'lucide-react';

interface CalEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  location: string | null;
}

interface GmailMsg {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
}

interface ColdLead {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  last_contacted_at: string | null;
  lead_stars: number | null;
}

interface Task {
  id: number;
  label: string;
  category: string;
}

interface OpenHouse {
  id: number;
  address: string;
  city: string;
  start_time: string | null;
  end_time: string | null;
  total_attendees: number;
}

interface Briefing {
  date: string;
  generated_at: string;
  calendar: { connected: boolean; events: CalEvent[]; error?: boolean };
  emails: { connected: boolean; emails: GmailMsg[]; error?: boolean };
  cold_leads: { threshold_days: number; leads: ColdLead[]; error?: boolean };
  tasks: { tasks: Task[]; error?: boolean };
  open_houses: { openHouses: OpenHouse[]; error?: boolean };
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  // All-day events are plain dates like "2024-09-16"
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'All day';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function SectionHeader({ icon: Icon, title, count, error }: {
  icon: React.ElementType; title: string; count?: number; error?: boolean;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-gold-400" />
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">{title}</h2>
        {count !== undefined && (
          <span className="text-xs bg-gold-500/20 text-gold-400 px-2 py-0.5 rounded-full font-medium">{count}</span>
        )}
      </div>
      {error && <span title="Failed to load"><AlertTriangle className="w-4 h-4 text-amber-400" /></span>}
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return <p className="text-navy-400 text-sm py-3">{msg}</p>;
}

export default function BriefingPage() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await fetch(`/api/briefing${refresh ? '?refresh=1' : ''}`);
      if (res.ok) setBriefing(await res.json());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-64 gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-gold-400" />
        <p className="text-navy-400 text-sm">Building your morning briefing…</p>
      </div>
    );
  }

  if (!briefing) {
    return (
      <div className="p-8 text-center text-navy-400">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-400" />
        <p>Could not load briefing. <button onClick={() => load()} className="text-gold-400 underline">Retry</button></p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold-500/20 flex items-center justify-center">
            <Sun className="w-5 h-5 text-gold-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Morning Briefing</h1>
            <p className="text-navy-400 text-sm mt-0.5">{today}</p>
          </div>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 text-sm text-navy-300 hover:text-white border border-navy-600 hover:border-navy-400 px-3 py-2 rounded-lg transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Events', value: briefing.calendar.events.length, icon: Calendar },
          { label: 'Unread', value: briefing.emails.emails.length, icon: Mail },
          { label: 'Cold Leads', value: briefing.cold_leads.leads.length, icon: Users },
          { label: 'Tasks Left', value: briefing.tasks.tasks.length, icon: CheckSquare },
          { label: 'Open Houses', value: briefing.open_houses.openHouses.length, icon: Home },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-navy-800 border border-navy-700 rounded-xl px-4 py-3 text-center">
            <Icon className="w-4 h-4 text-gold-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-navy-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Calendar */}
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-5">
          <SectionHeader icon={Calendar} title="Today's Events" count={briefing.calendar.events.length} error={briefing.calendar.error} />
          {!briefing.calendar.connected ? (
            <div className="text-sm text-navy-400 py-3">
              <a href="/api/google-calendar/auth" className="text-gold-400 underline">Connect Google Calendar</a> to see events here.
            </div>
          ) : briefing.calendar.events.length === 0 ? (
            <EmptyState msg="No events scheduled today." />
          ) : (
            <ul className="space-y-2">
              {briefing.calendar.events.map((ev) => (
                <li key={ev.id} className="flex items-start gap-3 text-sm">
                  <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-gold-400 flex-shrink-0 mt-2" />
                  <div>
                    <p className="text-white font-medium leading-snug">{ev.summary}</p>
                    <p className="text-navy-400 text-xs">
                      {formatTime(ev.start)}{ev.end ? ` – ${formatTime(ev.end)}` : ''}
                      {ev.location ? ` · ${ev.location}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Open Houses Today */}
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-5">
          <SectionHeader icon={Home} title="Open Houses Today" count={briefing.open_houses.openHouses.length} error={briefing.open_houses.error} />
          {briefing.open_houses.openHouses.length === 0 ? (
            <EmptyState msg="No open houses scheduled today." />
          ) : (
            <ul className="space-y-2">
              {briefing.open_houses.openHouses.map((oh) => (
                <li key={oh.id} className="flex items-start gap-3 text-sm">
                  <Home className="w-4 h-4 text-navy-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white font-medium leading-snug">{oh.address}</p>
                    <p className="text-navy-400 text-xs">
                      {oh.city}
                      {oh.start_time ? ` · ${oh.start_time}${oh.end_time ? ` – ${oh.end_time}` : ''}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Unread Emails */}
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-5">
          <SectionHeader icon={Mail} title="Unread Emails" count={briefing.emails.emails.length} error={briefing.emails.error} />
          {!briefing.emails.connected ? (
            <div className="text-sm text-navy-400 py-3">
              <a href="/api/google-calendar/auth" className="text-gold-400 underline">Connect Google Account</a> to see inbox here.
            </div>
          ) : briefing.emails.emails.length === 0 ? (
            <EmptyState msg="Inbox is clear." />
          ) : (
            <ul className="space-y-3">
              {briefing.emails.emails.map((email) => (
                <li key={email.id} className="text-sm border-b border-navy-700 pb-3 last:border-0 last:pb-0">
                  <p className="text-white font-medium leading-snug truncate">{email.subject}</p>
                  <p className="text-navy-400 text-xs truncate">{email.from}</p>
                  <p className="text-navy-500 text-xs mt-1 line-clamp-2">{email.snippet}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Cold Leads */}
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-5">
          <SectionHeader icon={Users} title={`Cold Leads (${briefing.cold_leads.threshold_days}+ days)`} count={briefing.cold_leads.leads.length} error={briefing.cold_leads.error} />
          {briefing.cold_leads.leads.length === 0 ? (
            <EmptyState msg="No cold leads — all contacts touched recently." />
          ) : (
            <ul className="space-y-2">
              {briefing.cold_leads.leads.slice(0, 8).map((lead) => (
                <li key={lead.id} className="flex items-center justify-between text-sm gap-2">
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">{lead.name}</p>
                    <div className="flex items-center gap-2 text-navy-400 text-xs">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      {formatDate(lead.last_contacted_at)}
                      {lead.phone && (
                        <>
                          <span>·</span>
                          <Phone className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{lead.phone}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <a
                    href={`/dashboard/clients?id=${lead.id}`}
                    className="text-gold-400 hover:text-gold-300 flex-shrink-0"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </a>
                </li>
              ))}
              {briefing.cold_leads.leads.length > 8 && (
                <p className="text-xs text-navy-500 pt-1">+{briefing.cold_leads.leads.length - 8} more cold leads</p>
              )}
            </ul>
          )}
        </div>

        {/* Tasks */}
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-5 lg:col-span-2">
          <SectionHeader icon={CheckSquare} title="Incomplete Tasks Today" count={briefing.tasks.tasks.length} error={briefing.tasks.error} />
          {briefing.tasks.tasks.length === 0 ? (
            <EmptyState msg="All tasks completed for today." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {briefing.tasks.tasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2.5 text-sm bg-navy-900 rounded-lg px-3 py-2.5">
                  <div className="w-4 h-4 rounded border border-navy-500 flex-shrink-0" />
                  <span className="text-navy-200">{task.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-navy-600 text-center mt-5">
        Generated {new Date(briefing.generated_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · Refreshes automatically at 6am
      </p>
    </div>
  );
}
