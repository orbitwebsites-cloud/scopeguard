'use client';

import { useState } from 'react';
import { createChangeOrder, sendChangeOrder } from '@/actions/change-orders';
import { meterStatus, formatCents, METER_LABELS, METER_UNITS } from '@/lib/domain';
import type { Meter, ChangeOrder, LineItem } from '@/lib/supabase/types';

interface Props {
  projectId: string;
  meters: (Meter & { used: number })[];
  changeOrders: ChangeOrder[];
  projectThreshold: number;
}

export function ChangeOrderSection({ projectId, meters, changeOrders, projectThreshold }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  // Pre-fill line items from over-meters
  const defaultLineItems: LineItem[] = meters
    .map(m => {
      const s = meterStatus(m, projectThreshold);
      if (s.over <= 0) return null;
      return {
        label: `Additional ${METER_LABELS[m.type].toLowerCase()} (${s.over} ${METER_UNITS[m.type]}${s.over !== 1 ? 's' : ''} over)`,
        qty: s.over,
        unit_cents: m.overage_rate_cents,
        total_cents: Math.round(s.over * m.overage_rate_cents),
      };
    })
    .filter(Boolean) as LineItem[];

  const [lineItems, setLineItems] = useState<LineItem[]>(defaultLineItems.length > 0 ? defaultLineItems : [
    { label: '', qty: 1, unit_cents: 0, total_cents: 0 },
  ]);

  const totalCents = lineItems.reduce((s, l) => s + l.total_cents, 0);

  function updateItem(i: number, field: keyof LineItem, value: string | number) {
    setLineItems(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      if (field === 'qty' || field === 'unit_cents') {
        next[i].total_cents = Math.round(Number(next[i].qty) * Number(next[i].unit_cents));
      }
      return next;
    });
  }

  async function handleCreate() {
    setCreating(true);
    setError('');
    const result = await createChangeOrder({ projectId, lineItems, note: note || undefined });
    setCreating(false);
    if (result.error) { setError(result.error); return; }
    setShowModal(false);
    setNote('');
  }

  async function handleSend(id: string) {
    setSending(id);
    const result = await sendChangeOrder(id);
    setSending(null);
    if (result.error) alert(result.error);
  }

  const hasOverage = meters.some(m => meterStatus(m, projectThreshold).level === 'over');

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Change orders</h2>
        <button
          onClick={() => setShowModal(true)}
          className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            hasOverage
              ? 'bg-red-600 hover:bg-red-500 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
          }`}
        >
          + New change order
        </button>
      </div>

      {changeOrders.length === 0 ? (
        <p className="text-sm text-gray-500">No change orders yet.</p>
      ) : (
        <div className="space-y-2">
          {changeOrders.map((co, i) => (
            <div key={co.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
              <div>
                <span className="text-sm font-medium">Change Order #{changeOrders.length - i}</span>
                <span className="ml-2 text-sm text-gray-400">{formatCents(co.total_cents)}</span>
                {co.sent_at && (
                  <span className="ml-2 text-xs text-emerald-400">Sent {new Date(co.sent_at).toLocaleDateString()}</span>
                )}
              </div>
              <div className="flex gap-2">
                {co.pdf_url && (
                  <a href={co.pdf_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300">PDF</a>
                )}
                {!co.sent_at && (
                  <button
                    onClick={() => handleSend(co.id)}
                    disabled={sending === co.id}
                    className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded transition-colors"
                  >
                    {sending === co.id ? '…' : 'Email client'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">New change order</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>

            {/* Line items */}
            <div className="space-y-2 mb-4">
              <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 mb-1">
                <span className="col-span-5">Description</span>
                <span className="col-span-2">Qty</span>
                <span className="col-span-2">Unit ($)</span>
                <span className="col-span-2">Total</span>
              </div>
              {lineItems.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    value={item.label}
                    onChange={e => updateItem(i, 'label', e.target.value)}
                    placeholder="Additional revision rounds"
                    className="col-span-5 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number" min="0" step="0.5"
                    value={item.qty}
                    onChange={e => updateItem(i, 'qty', parseFloat(e.target.value))}
                    className="col-span-2 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number" min="0" step="1"
                    value={item.unit_cents / 100}
                    onChange={e => updateItem(i, 'unit_cents', Math.round(parseFloat(e.target.value) * 100))}
                    className="col-span-2 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="col-span-2 text-sm text-gray-300">{formatCents(item.total_cents)}</span>
                  <button onClick={() => setLineItems(prev => prev.filter((_, j) => j !== i))}
                    className="col-span-1 text-gray-500 hover:text-red-400 text-lg">×</button>
                </div>
              ))}
              <button
                onClick={() => setLineItems(prev => [...prev, { label: '', qty: 1, unit_cents: 0, total_cents: 0 }])}
                className="text-xs text-blue-400 hover:text-blue-300 mt-1"
              >
                + Add line
              </button>
            </div>

            <div className="text-right text-lg font-bold mb-4">
              Total: <span className="text-blue-400">{formatCents(totalCents)}</span>
            </div>

            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Notes / terms (optional — appears on the PDF)"
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            />

            {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors"
              >
                {creating ? 'Generating PDF…' : 'Generate change order'}
              </button>
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-700 text-gray-300 hover:border-gray-500 text-sm transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
