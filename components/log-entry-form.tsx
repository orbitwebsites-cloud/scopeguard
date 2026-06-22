'use client';

import { useState } from 'react';
import { logEntry } from '@/actions/entries';
import { METER_LABELS, METER_UNITS } from '@/lib/domain';
import type { Meter, MeterType } from '@/lib/supabase/types';

interface Props {
  projectId: string;
  meters: (Meter & { used: number })[];
}

export function LogEntryForm({ projectId, meters }: Props) {
  const [loading, setLoading] = useState<MeterType | null>(null);
  const [error, setError] = useState('');
  const [hourInput, setHourInput] = useState('');
  const [notes, setNotes] = useState<Record<MeterType, string>>({ revisions: '', hours: '', deliverables: '' });

  async function handleLog(meterType: MeterType, amount: number) {
    setLoading(meterType);
    setError('');
    const result = await logEntry(projectId, meterType, amount, notes[meterType]);
    if (result.error) setError(result.error);
    setLoading(null);
    setNotes(prev => ({ ...prev, [meterType]: '' }));
    if (meterType === 'hours') setHourInput('');
  }

  return (
    <div className="space-y-3">
      {meters.map(m => (
        <div key={m.id} className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-300 w-36 flex-none">{METER_LABELS[m.type]}</span>

          {m.type === 'hours' ? (
            <input
              type="number"
              step="0.25"
              min="0.25"
              placeholder="e.g. 2.5"
              value={hourInput}
              onChange={e => setHourInput(e.target.value)}
              className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : null}

          <input
            type="text"
            placeholder="Note (optional)"
            value={notes[m.type]}
            onChange={e => setNotes(prev => ({ ...prev, [m.type]: e.target.value }))}
            className="flex-1 min-w-32 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            onClick={() => {
              const amount = m.type === 'hours' ? parseFloat(hourInput) : 1;
              if (!amount || isNaN(amount)) return;
              handleLog(m.type, amount);
            }}
            disabled={loading === m.type}
            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors flex-none"
          >
            {loading === m.type ? '…' : m.type === 'hours' ? `+${hourInput || '?'} hr` : `+1 ${METER_UNITS[m.type]}`}
          </button>
        </div>
      ))}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
