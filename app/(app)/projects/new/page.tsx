'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createProject } from '@/actions/projects';
import type { MeterType } from '@/lib/supabase/types';

const METER_TYPES: { type: MeterType; label: string; unit: string; placeholder: string }[] = [
  { type: 'revisions', label: 'Revision rounds', unit: 'rounds', placeholder: '3' },
  { type: 'hours', label: 'Hours', unit: 'hrs', placeholder: '40' },
  { type: 'deliverables', label: 'Deliverables / pages', unit: 'items', placeholder: '5' },
];

interface MeterInput {
  enabled: boolean;
  budget: string;
  overageRate: string;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [threshold, setThreshold] = useState(80);
  const [meters, setMeters] = useState<Record<MeterType, MeterInput>>({
    revisions: { enabled: true, budget: '', overageRate: '' },
    hours: { enabled: false, budget: '', overageRate: '' },
    deliverables: { enabled: false, budget: '', overageRate: '' },
  });

  function updateMeter(type: MeterType, field: keyof MeterInput, value: string | boolean) {
    setMeters(prev => ({ ...prev, [type]: { ...prev[type], [field]: value } }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const fd = new FormData(e.currentTarget);

    const enabledMeters = METER_TYPES
      .filter(m => meters[m.type].enabled)
      .map(m => ({
        type: m.type,
        budget: parseFloat(meters[m.type].budget),
        overageRateCents: Math.round(parseFloat(meters[m.type].overageRate || '0') * 100),
      }));

    if (enabledMeters.length === 0) {
      setError('Enable at least one scope meter.');
      setLoading(false);
      return;
    }

    const result = await createProject({
      name: fd.get('name') as string,
      clientName: fd.get('clientName') as string,
      clientEmail: fd.get('clientEmail') as string,
      projectValueCents: fd.get('projectValue') ? Math.round(parseFloat(fd.get('projectValue') as string) * 100) : null,
      threshold: threshold / 100,
      meters: enabledMeters,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    router.push(`/app/projects/${result.projectId}`);
  }

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold">New project</h1>
        <p className="text-sm text-gray-400 mt-1">Set the agreed scope upfront — ScopeGuard watches it from here.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic info */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Project details</h2>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Project name *</label>
            <input name="name" required placeholder="Acme Corp Website Redesign"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Client name</label>
              <input name="clientName" placeholder="Jane Smith"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Client email</label>
              <input name="clientEmail" type="email" placeholder="jane@acme.com"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Project value ($)</label>
            <input name="projectValue" type="number" step="0.01" placeholder="5000"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Scope meters */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">Scope budgets</h2>
          <div className="space-y-4">
            {METER_TYPES.map(({ type, label, placeholder }) => (
              <div key={type} className={`border rounded-lg p-4 transition-colors ${meters[type].enabled ? 'border-blue-600/40 bg-blue-950/20' : 'border-gray-700'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="checkbox"
                    id={`enable-${type}`}
                    checked={meters[type].enabled}
                    onChange={e => updateMeter(type, 'enabled', e.target.checked)}
                    className="rounded border-gray-600 bg-gray-700"
                  />
                  <label htmlFor={`enable-${type}`} className="font-medium text-sm cursor-pointer">{label}</label>
                </div>
                {meters[type].enabled && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Included budget</label>
                      <input
                        type="number"
                        step="0.5"
                        required
                        placeholder={placeholder}
                        value={meters[type].budget}
                        onChange={e => updateMeter(type, 'budget', e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Overage rate ($/unit)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="150"
                        value={meters[type].overageRate}
                        onChange={e => updateMeter(type, 'overageRate', e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Threshold */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Alert threshold</h2>
            <span className="text-sm font-bold text-blue-400">{threshold}%</span>
          </div>
          <input
            type="range" min={50} max={95} step={5}
            value={threshold}
            onChange={e => setThreshold(Number(e.target.value))}
            className="w-full"
          />
          <p className="text-xs text-gray-500 mt-2">
            Client email fires when any meter hits {threshold}% of budget. Default 80% works well.
          </p>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {loading ? 'Creating…' : 'Create project'}
          </button>
          <a href="/app" className="px-5 py-3 rounded-xl border border-gray-700 text-gray-300 hover:border-gray-500 text-sm font-medium transition-colors flex items-center">
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
