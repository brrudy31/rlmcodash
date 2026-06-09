'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, UserX, Search } from 'lucide-react';
import Modal from '@/components/Modal';

interface Client {
  id: number;
  name: string;
  email: string;
  opted_out_at: string | null;
  created_at: string;
}

const empty = { name: '', email: '' };

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  async function load() {
    const data = await fetch('/api/clients').then((r) => r.json());
    setClients(data);
  }

  useEffect(() => { load(); }, []);

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  function openAdd() {
    setForm(empty);
    setError('');
    setModal('add');
  }

  function openEdit(c: Client) {
    setEditing(c);
    setForm({ name: c.name, email: c.email });
    setError('');
    setModal('edit');
  }

  async function save() {
    setSaving(true);
    setError('');
    const url = modal === 'edit' ? `/api/clients/${editing!.id}` : '/api/clients';
    const method = modal === 'edit' ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSaving(false); return; }
    setModal(null);
    setSaving(false);
    load();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await fetch(`/api/clients/${deleteId}`, { method: 'DELETE' });
    setDeleteId(null);
    load();
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Clients</h2>
          <p className="text-navy-400 text-sm mt-1">{clients.length} total · {clients.filter((c) => c.opted_out_at).length} opted out</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Client
        </button>
      </div>

      <div className="bg-navy-800 rounded-xl border border-navy-700 overflow-hidden">
        <div className="p-4 border-b border-navy-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-navy-750 border border-navy-600 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-navy-400 focus:outline-none focus:border-gold-500"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-700">
                <th className="text-left px-4 py-3 text-navy-400 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-navy-400 font-medium">Email</th>
                <th className="text-left px-4 py-3 text-navy-400 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-navy-400 font-medium">Added</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-navy-500">
                    {search ? 'No matching clients' : 'No clients yet. Add your first client.'}
                  </td>
                </tr>
              )}
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-navy-750 hover:bg-navy-750/50 transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-navy-300">{c.email}</td>
                  <td className="px-4 py-3">
                    {c.opted_out_at ? (
                      <span className="flex items-center gap-1 text-red-400 text-xs">
                        <UserX className="w-3 h-3" /> Opted Out
                      </span>
                    ) : (
                      <span className="text-green-400 text-xs">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-navy-400">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => openEdit(c)}
                        className="p-1.5 text-navy-400 hover:text-gold-400 hover:bg-navy-700 rounded transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteId(c.id)}
                        className="p-1.5 text-navy-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <Modal title={modal === 'add' ? 'Add Client' : 'Edit Client'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1.5">Full Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-navy-750 border border-navy-600 rounded-lg px-4 py-2.5 text-white placeholder-navy-400 focus:outline-none focus:border-gold-500 text-sm"
                placeholder="Jane Smith"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1.5">Email Address</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-navy-750 border border-navy-600 rounded-lg px-4 py-2.5 text-white placeholder-navy-400 focus:outline-none focus:border-gold-500 text-sm"
                placeholder="jane@example.com"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setModal(null)}
                className="flex-1 border border-navy-600 text-navy-300 hover:text-white hover:border-navy-500 py-2.5 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || !form.name.trim() || !form.email.trim()}
                className="flex-1 bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-navy-900 font-semibold py-2.5 rounded-lg text-sm transition-colors"
              >
                {saving ? 'Saving...' : modal === 'add' ? 'Add Client' : 'Save Changes'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <Modal title="Delete Client" onClose={() => setDeleteId(null)} size="sm">
          <p className="text-navy-300 text-sm mb-6">
            Are you sure you want to delete this client? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setDeleteId(null)}
              className="flex-1 border border-navy-600 text-navy-300 hover:text-white py-2.5 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className="flex-1 bg-red-500 hover:bg-red-400 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
