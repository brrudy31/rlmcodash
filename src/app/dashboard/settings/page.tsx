'use client';

import { useEffect, useState } from 'react';
import { Settings, CheckCircle, AlertCircle, Loader2, ExternalLink } from 'lucide-react';

type CrmType = 'none' | 'ghl' | 'followupboss' | 'hubspot';

const CRM_OPTIONS: { value: CrmType; label: string; description: string; docsUrl: string; fields: { key: 'api_key' | 'location_id'; label: string; placeholder: string; hint: string }[] }[] = [
  {
    value: 'none',
    label: 'No CRM',
    description: 'Contacts are saved locally only.',
    docsUrl: '',
    fields: [],
  },
  {
    value: 'ghl',
    label: 'GoHighLevel',
    description: 'Push sign-ins directly into your GHL location as contacts with tags.',
    docsUrl: 'https://help.gohighlevel.com/support/solutions/articles/155000002166',
    fields: [
      { key: 'api_key', label: 'Private Integration Token', placeholder: 'pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', hint: 'Settings → Integrations → Private Integration Token' },
      { key: 'location_id', label: 'Location ID', placeholder: 'xxxxxxxxxxxxxxxxxx', hint: 'Settings → Business Profile → Location ID' },
    ],
  },
  {
    value: 'followupboss',
    label: 'Follow Up Boss',
    description: 'Add open house sign-ins as leads with source and notes in Follow Up Boss.',
    docsUrl: 'https://help.followupboss.com/hc/en-us/articles/360003948292',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'fub_xxxxxxxxxxxxxxxx', hint: 'Admin → API → Create API Key' },
    ],
  },
  {
    value: 'hubspot',
    label: 'HubSpot',
    description: 'Create or update contacts in HubSpot CRM with open house tags.',
    docsUrl: 'https://developers.hubspot.com/docs/api/private-apps',
    fields: [
      { key: 'api_key', label: 'Private App Access Token', placeholder: 'pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', hint: 'Settings → Integrations → Private Apps → Create app' },
    ],
  },
];

export default function SettingsPage() {
  const [crmType, setCrmType] = useState<CrmType>('none');
  const [apiKey, setApiKey] = useState('');
  const [locationId, setLocationId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    fetch('/api/settings/crm')
      .then((r) => r.json())
      .then((data) => {
        setCrmType((data.crm_type as CrmType) || 'none');
        setApiKey(data.api_key || '');
        setLocationId(data.location_id || '');
        setLoading(false);
      });
  }, []);

  const selected = CRM_OPTIONS.find((o) => o.value === crmType)!;

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/settings/crm', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crm_type: crmType, api_key: apiKey || null, location_id: locationId || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setStatus({ type: 'success', msg: 'CRM settings saved.' });
    } catch (e) {
      setStatus({ type: 'error', msg: String(e) });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gold-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="w-6 h-6 text-gold-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-navy-400 text-sm mt-0.5">Configure CRM integration for open house sign-ins</p>
        </div>
      </div>

      <div className="bg-navy-800 border border-navy-700 rounded-xl p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-navy-300 mb-2">CRM Integration</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CRM_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setCrmType(opt.value); setStatus(null); }}
                className={`text-left p-4 rounded-lg border transition-all ${
                  crmType === opt.value
                    ? 'border-gold-500 bg-gold-500/10 text-white'
                    : 'border-navy-600 bg-navy-900 text-navy-300 hover:border-navy-500 hover:text-white'
                }`}
              >
                <div className="font-semibold text-sm">{opt.label}</div>
                <div className="text-xs mt-1 text-navy-400 leading-snug">{opt.description}</div>
              </button>
            ))}
          </div>
        </div>

        {selected.fields.length > 0 && (
          <div className="space-y-4 pt-2 border-t border-navy-700">
            {selected.docsUrl && (
              <a
                href={selected.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-gold-400 hover:text-gold-300"
              >
                <ExternalLink className="w-3 h-3" />
                How to get your {selected.label} credentials
              </a>
            )}
            {selected.fields.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-navy-300 mb-1">
                  {field.label}
                </label>
                <input
                  type="password"
                  value={field.key === 'api_key' ? apiKey : locationId}
                  onChange={(e) => field.key === 'api_key' ? setApiKey(e.target.value) : setLocationId(e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2.5 text-white text-sm placeholder-navy-500 focus:outline-none focus:border-gold-500 font-mono"
                />
                <p className="text-xs text-navy-500 mt-1">{field.hint}</p>
              </div>
            ))}
          </div>
        )}

        {status && (
          <div className={`flex items-center gap-2 text-sm rounded-lg px-4 py-3 ${
            status.type === 'success'
              ? 'bg-green-900/30 border border-green-700 text-green-400'
              : 'bg-red-900/30 border border-red-700 text-red-400'
          }`}>
            {status.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {status.msg}
          </div>
        )}

        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-navy-900 font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Settings
        </button>
      </div>

      <p className="text-xs text-navy-500 mt-4 text-center">
        Credentials are stored securely and used only when pushing sign-ins to your CRM.
      </p>
    </div>
  );
}
