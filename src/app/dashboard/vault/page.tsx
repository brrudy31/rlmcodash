'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FolderOpen, Search, Upload, FileText, File, Trash2,
  Tag, X, ChevronDown, Loader2, Download, MapPin, Edit2, Check,
} from 'lucide-react';

const FOLDERS = ['All', 'Contracts', 'Listings', 'Clients', 'Vendors', 'Compliance'] as const;
type Folder = typeof FOLDERS[number];

const FOLDER_COLORS: Record<string, string> = {
  Contracts:  'text-blue-400 bg-blue-400/10 border-blue-400/20',
  Listings:   'text-green-400 bg-green-400/10 border-green-400/20',
  Clients:    'text-purple-400 bg-purple-400/10 border-purple-400/20',
  Vendors:    'text-orange-400 bg-orange-400/10 border-orange-400/20',
  Compliance: 'text-red-400 bg-red-400/10 border-red-400/20',
};

interface VaultDoc {
  id: number;
  original_name: string;
  blob_url: string;
  mime_type: string;
  file_size: number;
  folder: string;
  property_address: string | null;
  client_id: number | null;
  created_at: string;
  tags: string | null;
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function FileIcon({ mime }: { mime: string }) {
  if (mime === 'application/pdf') return <FileText className="w-5 h-5 text-red-400" />;
  if (mime.startsWith('image/')) return <File className="w-5 h-5 text-blue-400" />;
  if (mime.includes('word') || mime.includes('document')) return <FileText className="w-5 h-5 text-blue-500" />;
  return <File className="w-5 h-5 text-navy-400" />;
}

function TagBadge({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gold-500/15 text-gold-400 border border-gold-500/20 font-medium">
      {tag}
      {onRemove && (
        <button onClick={onRemove} className="hover:text-white ml-0.5">
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}

function UploadModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: (doc: VaultDoc) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [folder, setFolder] = useState<string>('Contracts');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    if (f.size > 20 * 1024 * 1024) { setError('File too large (max 20 MB).'); return; }
    setFile(f);
    setError('');
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t) && tags.length < 10) {
      setTags((prev) => [...prev, t]);
    }
    setTagInput('');
  }

  async function upload() {
    if (!file) return;
    setUploading(true);
    setError('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', folder);
    if (propertyAddress.trim()) fd.append('property_address', propertyAddress.trim());
    if (tags.length) fd.append('tags', tags.join(','));
    try {
      const res = await fetch('/api/vault/upload', { method: 'POST', body: fd });
      if (!res.ok) { setError((await res.json()).error ?? 'Upload failed.'); return; }
      onUploaded(await res.json());
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-navy-850 border border-navy-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-gold-400" /> Upload Document
          </h2>
          <button onClick={onClose} className="text-navy-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              dragOver ? 'border-gold-400 bg-gold-400/5' : 'border-navy-600 hover:border-navy-500'
            }`}
          >
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            {file ? (
              <div>
                <FileText className="w-8 h-8 text-gold-400 mx-auto mb-2" />
                <p className="text-white text-sm font-medium truncate">{file.name}</p>
                <p className="text-navy-400 text-xs mt-1">{fmtSize(file.size)}</p>
              </div>
            ) : (
              <div>
                <Upload className="w-8 h-8 text-navy-500 mx-auto mb-2" />
                <p className="text-navy-300 text-sm">Click or drag a file here</p>
                <p className="text-navy-500 text-xs mt-1">PDF, DOCX, TXT — up to 20 MB</p>
              </div>
            )}
          </div>

          {/* Folder */}
          <div>
            <label className="block text-xs font-semibold text-navy-400 uppercase tracking-wide mb-1.5">Folder</label>
            <div className="relative">
              <select
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                className="w-full appearance-none bg-navy-900 border border-navy-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-gold-500 pr-8"
              >
                {FOLDERS.slice(1).map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400 pointer-events-none" />
            </div>
          </div>

          {/* Property address */}
          <div>
            <label className="block text-xs font-semibold text-navy-400 uppercase tracking-wide mb-1.5">Property Address <span className="text-navy-600 normal-case font-normal">(optional)</span></label>
            <input
              type="text"
              value={propertyAddress}
              onChange={(e) => setPropertyAddress(e.target.value)}
              placeholder="123 Main St, Philadelphia PA"
              className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2.5 text-white text-sm placeholder-navy-500 focus:outline-none focus:border-gold-500"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-navy-400 uppercase tracking-wide mb-1.5">Tags <span className="text-navy-600 normal-case font-normal">(optional)</span></label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
                placeholder="e.g. 2024, buyer, lease"
                className="flex-1 bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-white text-sm placeholder-navy-500 focus:outline-none focus:border-gold-500"
              />
              <button onClick={addTag} className="px-3 py-2 bg-navy-700 border border-navy-600 rounded-lg text-navy-300 hover:text-white text-sm transition-colors">
                <Tag className="w-4 h-4" />
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((t) => <TagBadge key={t} tag={t} onRemove={() => setTags((p) => p.filter((x) => x !== t))} />)}
              </div>
            )}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={upload}
            disabled={!file || uploading}
            className="w-full bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-navy-900 font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 mt-2"
          >
            {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</> : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DocCard({ doc, onDelete, onUpdated }: { doc: VaultDoc; onDelete: () => void; onUpdated: (d: VaultDoc) => void }) {
  const [editing, setEditing] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(doc.tags ? doc.tags.split(',').filter(Boolean) : []);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const tagList = doc.tags ? doc.tags.split(',').filter(Boolean) : [];

  async function saveTags() {
    setSaving(true);
    const res = await fetch(`/api/vault/documents/${doc.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    });
    setSaving(false);
    if (res.ok) { onUpdated(await res.json()); setEditing(false); }
  }

  async function deleteDoc() {
    setDeleting(true);
    await fetch(`/api/vault/documents/${doc.id}`, { method: 'DELETE' });
    onDelete();
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t) && tags.length < 10) setTags((p) => [...p, t]);
    setTagInput('');
  }

  const folderColor = FOLDER_COLORS[doc.folder] ?? 'text-navy-400 bg-navy-700 border-navy-600';

  return (
    <div className="bg-navy-800 border border-navy-700 rounded-xl p-4 flex flex-col gap-3 hover:border-navy-600 transition-colors">
      {/* Top row */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-9 h-9 bg-navy-900 rounded-lg flex items-center justify-center">
          <FileIcon mime={doc.mime_type} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium leading-snug truncate" title={doc.original_name}>{doc.original_name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full border ${folderColor}`}>{doc.folder}</span>
            <span className="text-navy-500 text-xs">{fmtSize(doc.file_size)}</span>
            <span className="text-navy-600 text-xs">{fmtDate(doc.created_at)}</span>
          </div>
          {doc.property_address && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3 text-navy-500 flex-shrink-0" />
              <span className="text-navy-400 text-xs truncate">{doc.property_address}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <a href={doc.blob_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-navy-400 hover:text-white transition-colors rounded-lg hover:bg-navy-700">
            <Download className="w-4 h-4" />
          </a>
          <button onClick={() => setEditing(!editing)} className="p-1.5 text-navy-400 hover:text-gold-400 transition-colors rounded-lg hover:bg-navy-700">
            <Edit2 className="w-4 h-4" />
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button onClick={deleteDoc} disabled={deleting} className="p-1.5 text-red-400 hover:text-red-300 transition-colors rounded-lg hover:bg-red-400/10">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="p-1.5 text-navy-400 hover:text-white transition-colors rounded-lg hover:bg-navy-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="p-1.5 text-navy-400 hover:text-red-400 transition-colors rounded-lg hover:bg-navy-700">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tags row */}
      {!editing && tagList.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tagList.map((t) => <TagBadge key={t} tag={t} />)}
        </div>
      )}

      {/* Edit tags inline */}
      {editing && (
        <div className="border-t border-navy-700 pt-3 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
              placeholder="Add tag…"
              className="flex-1 bg-navy-900 border border-navy-600 rounded-lg px-3 py-1.5 text-white text-xs placeholder-navy-500 focus:outline-none focus:border-gold-500"
            />
            <button onClick={addTag} className="px-2 py-1.5 bg-navy-700 border border-navy-600 rounded-lg text-navy-300 hover:text-white text-xs">
              <Tag className="w-3.5 h-3.5" />
            </button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => <TagBadge key={t} tag={t} onRemove={() => setTags((p) => p.filter((x) => x !== t))} />)}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={saveTags} disabled={saving} className="flex-1 py-1.5 bg-gold-500 text-navy-900 text-xs font-semibold rounded-lg hover:bg-gold-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-1">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
            </button>
            <button onClick={() => { setEditing(false); setTags(tagList); }} className="px-3 py-1.5 border border-navy-600 text-navy-400 text-xs rounded-lg hover:text-white transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VaultPage() {
  const [docs, setDocs] = useState<VaultDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFolder, setActiveFolder] = useState<Folder>('All');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (folder: Folder, q: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (folder !== 'All') params.set('folder', folder);
    if (q) params.set('search', q);
    const res = await fetch(`/api/vault/documents?${params}`);
    if (res.ok) setDocs(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(activeFolder, search); }, [activeFolder, search, load]);

  function handleSearchInput(v: string) {
    setSearchInput(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(v), 400);
  }

  // Folder counts from loaded docs (approximate — only counts current filter)
  const folderCounts: Record<string, number> = {};
  for (const d of docs) folderCounts[d.folder] = (folderCounts[d.folder] ?? 0) + 1;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-52 border-r border-navy-700 bg-navy-850 flex-shrink-0">
        <div className="px-4 py-5 border-b border-navy-700">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-gold-400" />
            <h1 className="text-base font-bold text-white">Vault</h1>
          </div>
          <p className="text-xs text-navy-500 mt-0.5">Document repository</p>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {FOLDERS.map((f) => {
            const count = f === 'All' ? docs.length : (folderCounts[f] ?? 0);
            const active = activeFolder === f;
            return (
              <button
                key={f}
                onClick={() => setActiveFolder(f)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                  active ? 'bg-gold-500/15 text-gold-400 border border-gold-500/30' : 'text-navy-300 hover:bg-navy-700 hover:text-white'
                }`}
              >
                <span className="font-medium">{f}</span>
                {(search ? null : <span className={`text-xs ${active ? 'text-gold-500' : 'text-navy-500'}`}>{count}</span>)}
              </button>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-navy-700">
          <button
            onClick={() => setShowUpload(true)}
            className="w-full flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold py-2.5 rounded-lg text-sm transition-colors"
          >
            <Upload className="w-4 h-4" /> Upload
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="px-5 py-3 border-b border-navy-700 flex items-center gap-3 flex-shrink-0">
          {/* Mobile folder selector */}
          <div className="lg:hidden relative">
            <select
              value={activeFolder}
              onChange={(e) => setActiveFolder(e.target.value as Folder)}
              className="appearance-none bg-navy-800 border border-navy-600 rounded-lg pl-3 pr-7 py-2 text-white text-sm focus:outline-none focus:border-gold-500"
            >
              {FOLDERS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-navy-400 pointer-events-none" />
          </div>

          {/* Search */}
          <div className="flex-1 relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Search documents, text, addresses…"
              className="w-full bg-navy-900 border border-navy-600 rounded-lg pl-9 pr-3 py-2 text-white text-sm placeholder-navy-500 focus:outline-none focus:border-gold-500"
            />
            {searchInput && (
              <button onClick={() => { setSearchInput(''); setSearch(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-500 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Mobile upload */}
          <button
            onClick={() => setShowUpload(true)}
            className="lg:hidden flex items-center gap-1.5 bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold px-3 py-2 rounded-lg text-sm transition-colors"
          >
            <Upload className="w-4 h-4" />
          </button>

          <span className="text-navy-500 text-xs hidden sm:block">
            {loading ? '…' : `${docs.length} doc${docs.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Doc grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 animate-spin text-gold-400" />
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <FolderOpen className="w-12 h-12 text-navy-600 mb-3" />
              <p className="text-navy-400 font-medium">
                {search ? 'No documents match your search.' : 'No documents in this folder yet.'}
              </p>
              {!search && (
                <button onClick={() => setShowUpload(true)} className="mt-3 text-gold-400 hover:text-gold-300 text-sm underline">
                  Upload your first document
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {docs.map((doc) => (
                <DocCard
                  key={doc.id}
                  doc={doc}
                  onDelete={() => setDocs((p) => p.filter((d) => d.id !== doc.id))}
                  onUpdated={(updated) => setDocs((p) => p.map((d) => d.id === updated.id ? updated : d))}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={(doc) => {
            setDocs((p) => [doc, ...p]);
            setShowUpload(false);
            if (activeFolder !== 'All' && activeFolder !== doc.folder) setActiveFolder('All');
          }}
        />
      )}
    </div>
  );
}
