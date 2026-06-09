'use client';

import { useEffect, useState } from 'react';
import { Mail, Eye, UserX, ChevronDown, ChevronUp } from 'lucide-react';

interface Campaign {
  id: number;
  vendor_list_name: string;
  subject: string;
  sent_at: string;
  total_sent: number;
  total_opened: number;
  total_opted_out: number;
}

interface Send {
  id: number;
  client_name: string;
  client_email: string;
  opened_at: string | null;
  opted_out_at: string | null;
  created_at: string;
}

export default function TrackingPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [sends, setSends] = useState<Record<number, Send[]>>({});
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/campaigns').then((r) => r.json()).then(setCampaigns);
  }, []);

  async function toggleExpand(id: number) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!sends[id]) {
      const data = await fetch(`/api/campaigns/${id}/sends`).then((r) => r.json());
      setSends((prev) => ({ ...prev, [id]: data }));
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Email Tracking</h2>
        <p className="text-navy-400 text-sm mt-1">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} sent</p>
      </div>

      {campaigns.length === 0 && (
        <div className="bg-navy-800 rounded-xl border border-navy-700 p-12 text-center text-navy-500">
          No campaigns sent yet. Use the Send Emails page to get started.
        </div>
      )}

      <div className="space-y-3">
        {campaigns.map((c) => {
          const openRate = c.total_sent ? Math.round((c.total_opened / c.total_sent) * 100) : 0;
          return (
            <div key={c.id} className="bg-navy-800 rounded-xl border border-navy-700 overflow-hidden">
              <button
                className="w-full text-left"
                onClick={() => toggleExpand(c.id)}
              >
                <div className="px-5 py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate">{c.subject}</p>
                      <p className="text-navy-400 text-xs mt-0.5">
                        {c.vendor_list_name} · {new Date(c.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="flex items-center gap-1.5 text-sm text-navy-300">
                        <Mail className="w-4 h-4 text-blue-400" />
                        <span className="font-medium text-white">{c.total_sent}</span> sent
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-navy-300">
                        <Eye className="w-4 h-4 text-green-400" />
                        <span className="font-medium text-white">{c.total_opened}</span>
                        <span className="text-navy-500 text-xs">({openRate}%)</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-navy-300">
                        <UserX className="w-4 h-4 text-red-400" />
                        <span className="font-medium text-white">{c.total_opted_out}</span>
                      </div>
                      {expanded === c.id ? <ChevronUp className="w-4 h-4 text-navy-400" /> : <ChevronDown className="w-4 h-4 text-navy-400" />}
                    </div>
                  </div>
                </div>
              </button>

              {expanded === c.id && (
                <div className="border-t border-navy-700 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-navy-750">
                        <th className="text-left px-4 py-3 text-navy-400 font-medium">Recipient</th>
                        <th className="text-left px-4 py-3 text-navy-400 font-medium">Email</th>
                        <th className="text-left px-4 py-3 text-navy-400 font-medium">Opened</th>
                        <th className="text-left px-4 py-3 text-navy-400 font-medium">Opt-Out</th>
                        <th className="text-left px-4 py-3 text-navy-400 font-medium">Sent At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!sends[c.id] && (
                        <tr><td colSpan={5} className="text-center py-6 text-navy-500">Loading...</td></tr>
                      )}
                      {sends[c.id]?.map((s) => (
                        <tr key={s.id} className="border-b border-navy-750/50 hover:bg-navy-750/30">
                          <td className="px-4 py-3 text-white">{s.client_name}</td>
                          <td className="px-4 py-3 text-navy-300">{s.client_email}</td>
                          <td className="px-4 py-3">
                            {s.opened_at ? (
                              <span className="text-green-400 text-xs flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                {new Date(s.opened_at).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-navy-500 text-xs">Not opened</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {s.opted_out_at ? (
                              <span className="text-red-400 text-xs flex items-center gap-1">
                                <UserX className="w-3 h-3" />
                                {new Date(s.opted_out_at).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-navy-500 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-navy-400 text-xs">
                            {new Date(s.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
