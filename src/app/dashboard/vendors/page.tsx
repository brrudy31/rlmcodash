'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, List, Upload, X, Check, AlertCircle } from 'lucide-react';
import Modal from '@/components/Modal';

interface VendorList { id: number; name: string; created_at: string; }
interface Vendor { id: number; vendor_list_id: number; name: string; trade: string | null; phone: string | null; email: string | null; }
interface ParsedVendor { name: string; trade: string; phone: string; email: string; }

export default function VendorsPage() {
  const [lists, setLists] = useState<VendorList[]>([]);
  const [vendors, setVendors] = useState<Record<number, Vendor[]>>({});
  const [expanded, setExpanded] = useState<number | null>(null);

  const [listModal, setListModal] = useState<'add' | 'edit' | null>(null);
  const [editingList, setEditingList] = useState<VendorList | null>(null);
  const [listName, setListName] = useState('');

  const [vendorModal, setVendorModal] = useState<'add' | 'edit' | null>(null);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [activeListId, setActiveListId] = useState<number | null>(null);
  const [vendorForm, setVendorForm] = useState({ name: '', trade: '', phone: '', email: '' });

  const [deleteListId, setDeleteListId] = useState<number | null>(null);
  const [deleteVendorId, setDeleteVendorId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // PDF import state
  const [pdfListId, setPdfListId] = useState<number | null>(null);
  const [pdfStep, setPdfStep] = useState<'upload' | 'preview'>('upload');
  const [pdfParsed, setPdfParsed] = useState<ParsedVendor[]>([]);
  const [pdfEdited, setPdfEdited] = useState<ParsedVendor[]>([]);
  const [pdfError, setPdfError] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfImporting, setPdfImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadLists() {
    const data = await fetch('/api/vendor-lists').then((r) => r.json());
    setLists(data);
  }

  async function loadVendors(listId: number) {
    const data = await fetch(`/api/vendor-lists/${listId}/vendors`).then((r) => r.json());
    setVendors((prev) => ({ ...prev, [listId]: data }));
  }

  useEffect(() => { loadLists(); }, []);

  async function toggleExpand(id: number) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    await loadVendors(id);
  }

  async function saveList() {
    setSaving(true); setError('');
    const url = listModal === 'edit' ? `/api/vendor-lists/${editingList!.id}` : '/api/vendor-lists';
    const method = listModal === 'edit' ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: listName }) });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSaving(false); return; }
    setListModal(null); setSaving(false); loadLists();
  }

  async function saveVendor() {
    setSaving(true); setError('');
    const url = vendorModal === 'edit' ? `/api/vendors/${editingVendor!.id}` : `/api/vendor-lists/${activeListId}/vendors`;
    const method = vendorModal === 'edit' ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(vendorForm) });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSaving(false); return; }
    setVendorModal(null); setSaving(false);
    if (activeListId) loadVendors(activeListId);
  }

  async function deleteList() {
    if (!deleteListId) return;
    await fetch(`/api/vendor-lists/${deleteListId}`, { method: 'DELETE' });
    setDeleteListId(null);
    if (expanded === deleteListId) setExpanded(null);
    loadLists();
  }

  async function deleteVendor() {
    if (!deleteVendorId || !activeListId) return;
    await fetch(`/api/vendors/${deleteVendorId}`, { method: 'DELETE' });
    setDeleteVendorId(null);
    loadVendors(activeListId);
  }

  const vform = (f: Partial<typeof vendorForm>) => setVendorForm((p) => ({ ...p, ...f }));

  // PDF helpers
  function openPdfModal(listId: number) {
    setPdfListId(listId);
    setPdfStep('upload');
    setPdfParsed([]);
    setPdfEdited([]);
    setPdfError('');
    setPdfLoading(false);
  }

  function closePdfModal() {
    setPdfListId(null);
  }

  async function handlePdfFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setPdfError('Please select a PDF file.');
      return;
    }
    setPdfLoading(true);
    setPdfError('');
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`/api/vendor-lists/${pdfListId}/import-pdf`, { method: 'POST', body: fd });
    const data = await res.json();
    setPdfLoading(false);
    if (!res.ok) { setPdfError(data.error || 'Failed to parse PDF.'); return; }
    if (!data.preview?.length) {
      setPdfError('No vendors could be detected in this PDF. Try a different format or add vendors manually.');
      return;
    }
    setPdfParsed(data.preview);
    setPdfEdited(data.preview.map((v: ParsedVendor) => ({ ...v })));
    setPdfStep('preview');
  }

  function editPdfRow(i: number, field: keyof ParsedVendor, value: string) {
    setPdfEdited((rows) => rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  function removePdfRow(i: number) {
    setPdfEdited((rows) => rows.filter((_, idx) => idx !== i));
  }

  async function importPdfVendors() {
    if (!pdfListId || pdfEdited.length === 0) return;
    setPdfImporting(true);
    // Save each vendor via the existing POST endpoint
    for (const v of pdfEdited) {
      if (!v.name.trim()) continue;
      await fetch(`/api/vendor-lists/${pdfListId}/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: v.name, trade: v.trade, phone: v.phone, email: v.email }),
      });
    }
    setPdfImporting(false);
    closePdfModal();
    loadVendors(pdfListId);
    if (expanded !== pdfListId) {
      setExpanded(pdfListId);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Vendor Lists</h2>
          <p className="text-navy-400 text-sm mt-1">{lists.length} list{lists.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setListName(''); setError(''); setListModal('add'); }}
          className="flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> New List
        </button>
      </div>

      <div className="space-y-3">
        {lists.length === 0 && (
          <div className="bg-navy-800 rounded-xl border border-navy-700 p-12 text-center text-navy-500">
            No vendor lists yet. Create your first list.
          </div>
        )}
        {lists.map((list) => (
          <div key={list.id} className="bg-navy-800 rounded-xl border border-navy-700 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <button
                onClick={() => toggleExpand(list.id)}
                className="flex items-center gap-3 flex-1 text-left"
              >
                <List className="w-5 h-5 text-gold-500 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-white">{list.name}</p>
                  <p className="text-navy-400 text-xs mt-0.5">
                    {vendors[list.id] ? `${vendors[list.id].length} vendor${vendors[list.id].length !== 1 ? 's' : ''}` : 'Click to expand'}
                  </p>
                </div>
                {expanded === list.id ? (
                  <ChevronUp className="w-4 h-4 text-navy-400 ml-2" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-navy-400 ml-2" />
                )}
              </button>
              <div className="flex items-center gap-1 ml-4">
                <button
                  onClick={() => { setEditingList(list); setListName(list.name); setError(''); setListModal('edit'); }}
                  className="p-1.5 text-navy-400 hover:text-gold-400 hover:bg-navy-700 rounded transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeleteListId(list.id)}
                  className="p-1.5 text-navy-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {expanded === list.id && (
              <div className="border-t border-navy-700">
                <div className="px-5 py-3 flex items-center justify-end gap-3 border-b border-navy-750">
                  <button
                    onClick={() => openPdfModal(list.id)}
                    className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-sm font-medium"
                  >
                    <Upload className="w-4 h-4" /> Import PDF
                  </button>
                  <button
                    onClick={() => { setActiveListId(list.id); setVendorForm({ name: '', trade: '', phone: '', email: '' }); setError(''); setVendorModal('add'); }}
                    className="flex items-center gap-1.5 text-gold-400 hover:text-gold-300 text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" /> Add Vendor
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-navy-750">
                        <th className="text-left px-4 py-3 text-navy-400 font-medium">Name</th>
                        <th className="text-left px-4 py-3 text-navy-400 font-medium">Trade / Specialty</th>
                        <th className="text-left px-4 py-3 text-navy-400 font-medium">Phone</th>
                        <th className="text-left px-4 py-3 text-navy-400 font-medium">Email</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {!vendors[list.id]?.length && (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-navy-500">No vendors in this list yet.</td>
                        </tr>
                      )}
                      {vendors[list.id]?.map((v) => (
                        <tr key={v.id} className="border-b border-navy-750/50 hover:bg-navy-750/30">
                          <td className="px-4 py-3 text-white font-medium">{v.name}</td>
                          <td className="px-4 py-3 text-navy-300">{v.trade || '—'}</td>
                          <td className="px-4 py-3 text-navy-300">{v.phone || '—'}</td>
                          <td className="px-4 py-3 text-navy-300">{v.email || '—'}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                onClick={() => { setActiveListId(list.id); setEditingVendor(v); setVendorForm({ name: v.name, trade: v.trade || '', phone: v.phone || '', email: v.email || '' }); setError(''); setVendorModal('edit'); }}
                                className="p-1.5 text-navy-400 hover:text-gold-400 hover:bg-navy-700 rounded transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => { setActiveListId(list.id); setDeleteVendorId(v.id); }}
                                className="p-1.5 text-navy-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* List Modal */}
      {listModal && (
        <Modal title={listModal === 'add' ? 'New Vendor List' : 'Rename List'} onClose={() => setListModal(null)} size="sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1.5">List Name</label>
              <input
                type="text"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                className="w-full bg-navy-750 border border-navy-600 rounded-lg px-4 py-2.5 text-white placeholder-navy-400 focus:outline-none focus:border-gold-500 text-sm"
                placeholder="e.g. Preferred Contractors"
                autoFocus
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setListModal(null)} className="flex-1 border border-navy-600 text-navy-300 hover:text-white py-2.5 rounded-lg text-sm transition-colors">Cancel</button>
              <button onClick={saveList} disabled={saving || !listName.trim()} className="flex-1 bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-navy-900 font-semibold py-2.5 rounded-lg text-sm transition-colors">
                {saving ? 'Saving...' : listModal === 'add' ? 'Create List' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Vendor Modal */}
      {vendorModal && (
        <Modal title={vendorModal === 'add' ? 'Add Vendor' : 'Edit Vendor'} onClose={() => setVendorModal(null)}>
          <div className="space-y-4">
            {(['name', 'trade', 'phone', 'email'] as const).map((field) => (
              <div key={field}>
                <label className="block text-sm font-medium text-navy-300 mb-1.5 capitalize">
                  {field === 'trade' ? 'Trade / Specialty' : field}{field === 'name' && <span className="text-red-400 ml-0.5">*</span>}
                </label>
                <input
                  type={field === 'email' ? 'email' : 'text'}
                  value={vendorForm[field]}
                  onChange={(e) => vform({ [field]: e.target.value })}
                  className="w-full bg-navy-750 border border-navy-600 rounded-lg px-4 py-2.5 text-white placeholder-navy-400 focus:outline-none focus:border-gold-500 text-sm"
                  placeholder={field === 'trade' ? 'e.g. Plumber, Electrician' : field === 'phone' ? '(555) 000-0000' : field === 'email' ? 'vendor@example.com' : 'Vendor Company Name'}
                  autoFocus={field === 'name'}
                />
              </div>
            ))}
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setVendorModal(null)} className="flex-1 border border-navy-600 text-navy-300 hover:text-white py-2.5 rounded-lg text-sm transition-colors">Cancel</button>
              <button onClick={saveVendor} disabled={saving || !vendorForm.name.trim()} className="flex-1 bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-navy-900 font-semibold py-2.5 rounded-lg text-sm transition-colors">
                {saving ? 'Saving...' : vendorModal === 'add' ? 'Add Vendor' : 'Save Changes'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete list confirm */}
      {deleteListId && (
        <Modal title="Delete Vendor List" onClose={() => setDeleteListId(null)} size="sm">
          <p className="text-navy-300 text-sm mb-6">Delete this vendor list and all its vendors? This cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteListId(null)} className="flex-1 border border-navy-600 text-navy-300 hover:text-white py-2.5 rounded-lg text-sm">Cancel</button>
            <button onClick={deleteList} className="flex-1 bg-red-500 hover:bg-red-400 text-white font-semibold py-2.5 rounded-lg text-sm">Delete</button>
          </div>
        </Modal>
      )}

      {/* Delete vendor confirm */}
      {deleteVendorId && (
        <Modal title="Delete Vendor" onClose={() => setDeleteVendorId(null)} size="sm">
          <p className="text-navy-300 text-sm mb-6">Remove this vendor from the list? This cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteVendorId(null)} className="flex-1 border border-navy-600 text-navy-300 hover:text-white py-2.5 rounded-lg text-sm">Cancel</button>
            <button onClick={deleteVendor} className="flex-1 bg-red-500 hover:bg-red-400 text-white font-semibold py-2.5 rounded-lg text-sm">Delete</button>
          </div>
        </Modal>
      )}

      {/* PDF Import Modal */}
      {pdfListId !== null && (
        <Modal
          title={pdfStep === 'upload' ? 'Import Vendors from PDF' : `Review ${pdfEdited.length} Detected Vendors`}
          onClose={closePdfModal}
          size={pdfStep === 'preview' ? 'lg' : 'sm'}
        >
          {pdfStep === 'upload' && (
            <div className="space-y-4">
              <p className="text-navy-400 text-sm">Upload a PDF containing your vendor list. The app will try to detect names, trades, phone numbers, and emails automatically. You can review and edit before importing.</p>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handlePdfFile(f); }}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragOver ? 'border-blue-400 bg-blue-400/10' : 'border-navy-600 hover:border-blue-500 hover:bg-navy-750/50'}`}
              >
                <Upload className="w-8 h-8 text-blue-400 mx-auto mb-3" />
                <p className="text-white font-medium mb-1">Drop your PDF here</p>
                <p className="text-navy-400 text-sm">or click to browse</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePdfFile(f); }}
                />
              </div>

              {pdfLoading && (
                <div className="flex items-center gap-2 text-blue-400 text-sm justify-center py-2">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  Parsing PDF…
                </div>
              )}

              {pdfError && (
                <div className="flex items-start gap-2 bg-red-400/10 border border-red-400/30 rounded-lg p-3 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {pdfError}
                </div>
              )}

              <div className="flex justify-end">
                <button onClick={closePdfModal} className="border border-navy-600 text-navy-300 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors">Cancel</button>
              </div>
            </div>
          )}

          {pdfStep === 'preview' && (
            <div className="space-y-4">
              <p className="text-navy-400 text-sm">Review the vendors detected from your PDF. Edit or remove any rows before importing. All checked rows will be added to the vendor list.</p>

              <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-navy-700">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-navy-800 z-10">
                    <tr className="border-b border-navy-700">
                      <th className="text-left px-3 py-2.5 text-navy-400 font-medium">Name *</th>
                      <th className="text-left px-3 py-2.5 text-navy-400 font-medium">Trade</th>
                      <th className="text-left px-3 py-2.5 text-navy-400 font-medium">Phone</th>
                      <th className="text-left px-3 py-2.5 text-navy-400 font-medium">Email</th>
                      <th className="px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {pdfEdited.map((v, i) => (
                      <tr key={i} className="border-b border-navy-750/50">
                        {(['name', 'trade', 'phone', 'email'] as const).map((f) => (
                          <td key={f} className="px-2 py-1.5">
                            <input
                              type="text"
                              value={v[f]}
                              onChange={(e) => editPdfRow(i, f, e.target.value)}
                              className="w-full bg-navy-750 border border-navy-600 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-gold-500 min-w-[80px]"
                            />
                          </td>
                        ))}
                        <td className="px-2 py-1.5">
                          <button onClick={() => removePdfRow(i)} className="text-navy-500 hover:text-red-400 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pdfEdited.length === 0 && (
                <p className="text-center text-navy-500 text-sm py-4">All rows removed. Go back to re-upload.</p>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={() => { setPdfStep('upload'); setPdfError(''); }} className="border border-navy-600 text-navy-300 hover:text-white px-4 py-2.5 rounded-lg text-sm transition-colors">
                  ← Back
                </button>
                <button
                  onClick={importPdfVendors}
                  disabled={pdfImporting || pdfEdited.filter(v => v.name.trim()).length === 0}
                  className="flex-1 flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-navy-900 font-semibold py-2.5 rounded-lg text-sm transition-colors"
                >
                  {pdfImporting ? (
                    <><div className="w-4 h-4 border-2 border-navy-900 border-t-transparent rounded-full animate-spin" /> Importing…</>
                  ) : (
                    <><Check className="w-4 h-4" /> Import {pdfEdited.filter(v => v.name.trim()).length} Vendor{pdfEdited.filter(v => v.name.trim()).length !== 1 ? 's' : ''}</>
                  )}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
