'use client';

import { useEffect, useState } from 'react';
import { Send, CheckSquare, Square, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Client { id: number; name: string; email: string; opted_out_at: string | null; }
interface VendorList { id: number; name: string; }

export default function EmailPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [lists, setLists] = useState<VendorList[]>([]);
  const [selectedList, setSelectedList] = useState('');
  const [selectedClients, setSelectedClients] = useState<number[]>([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const activeClients = clients.filter((c) => !c.opted_out_at);

  useEffect(() => {
    fetch('/api/clients').then((r) => r.json()).then(setClients);
    fetch('/api/vendor-lists').then((r) => r.json()).then(setLists);
  }, []);

  function toggleClient(id: number) {
    setSelectedClients((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  function selectAll() {
    if (selectedClients.length === activeClients.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(activeClients.map((c) => c.id));
    }
  }

  async function send() {
    if (!selectedList || !selectedClients.length || !subject.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorListId: Number(selectedList),
          clientIds: selectedClients,
          subject,
          message,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, message: `Successfully sent to ${data.sent} of ${data.total} recipient${data.total !== 1 ? 's' : ''}.` });
        setSubject('');
        setMessage('');
        setSelectedClients([]);
        setSelectedList('');
      } else {
        setResult({ success: false, message: data.error || 'Failed to send emails.' });
      }
    } catch {
      setResult({ success: false, message: 'Network error. Please try again.' });
    }
    setSending(false);
  }

  const allSelected = activeClients.length > 0 && selectedClients.length === activeClients.length;
  const canSend = selectedList && selectedClients.length > 0 && subject.trim();

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Send Emails</h2>
        <p className="text-navy-400 text-sm mt-1">Email a vendor list to your clients.</p>
      </div>

      {result && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border mb-6 text-sm ${result.success ? 'bg-green-400/10 border-green-400/30 text-green-300' : 'bg-red-400/10 border-red-400/30 text-red-300'}`}>
          {result.success ? <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />}
          {result.message}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-5">
          {/* Vendor List */}
          <div className="bg-navy-800 rounded-xl border border-navy-700 p-5">
            <label className="block text-sm font-semibold text-white mb-3">Vendor List</label>
            {lists.length === 0 ? (
              <p className="text-navy-400 text-sm">No vendor lists yet. Create one first.</p>
            ) : (
              <select
                value={selectedList}
                onChange={(e) => setSelectedList(e.target.value)}
                className="w-full bg-navy-750 border border-navy-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-gold-500 text-sm"
              >
                <option value="">— Select a vendor list —</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Email Content */}
          <div className="bg-navy-800 rounded-xl border border-navy-700 p-5 space-y-4">
            <label className="block text-sm font-semibold text-white">Email Content</label>
            <div>
              <label className="block text-xs text-navy-400 mb-1.5">Subject Line <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-navy-750 border border-navy-600 rounded-lg px-4 py-2.5 text-white placeholder-navy-400 focus:outline-none focus:border-gold-500 text-sm"
                placeholder="e.g. Preferred Vendor Resources from RLM&CO"
              />
            </div>
            <div>
              <label className="block text-xs text-navy-400 mb-1.5">Personal Message (optional)</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="w-full bg-navy-750 border border-navy-600 rounded-lg px-4 py-2.5 text-white placeholder-navy-400 focus:outline-none focus:border-gold-500 text-sm resize-none"
                placeholder="Add a personal note to accompany the vendor list..."
              />
            </div>
          </div>
        </div>

        {/* Right column - Client selector */}
        <div className="bg-navy-800 rounded-xl border border-navy-700 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-white">
              Recipients <span className="text-navy-400 font-normal">({selectedClients.length} selected)</span>
            </label>
            {activeClients.length > 0 && (
              <button onClick={selectAll} className="flex items-center gap-1.5 text-xs text-gold-400 hover:text-gold-300">
                {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto max-h-64 space-y-1">
            {activeClients.length === 0 && (
              <p className="text-navy-400 text-sm py-4 text-center">No active clients.</p>
            )}
            {activeClients.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-navy-750 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedClients.includes(c.id)}
                  onChange={() => toggleClient(c.id)}
                  className="w-4 h-4 accent-gold-500 cursor-pointer"
                />
                <div>
                  <p className="text-sm text-white">{c.name}</p>
                  <p className="text-xs text-navy-400">{c.email}</p>
                </div>
              </label>
            ))}
          </div>
          {clients.filter((c) => c.opted_out_at).length > 0 && (
            <p className="text-xs text-navy-500 mt-3 pt-3 border-t border-navy-700">
              {clients.filter((c) => c.opted_out_at).length} opted-out client{clients.filter((c) => c.opted_out_at).length !== 1 ? 's' : ''} excluded
            </p>
          )}
        </div>
      </div>

      <div className="mt-6">
        <button
          onClick={send}
          disabled={!canSend || sending}
          className="flex items-center gap-2 bg-gold-500 hover:bg-gold-400 disabled:opacity-50 disabled:cursor-not-allowed text-navy-900 font-semibold px-6 py-3 rounded-lg text-sm transition-colors"
        >
          <Send className="w-4 h-4" />
          {sending ? 'Sending...' : `Send Email${selectedClients.length > 1 ? 's' : ''} (${selectedClients.length})`}
        </button>
      </div>
    </div>
  );
}
