import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { meterStatus, formatCents, METER_LABELS, METER_UNITS } from '@/lib/domain';
import { LogEntryForm } from '@/components/log-entry-form';
import { ChangeOrderSection } from '@/components/change-order-section';
import type { Meter, Entry, ScopeEvent, ChangeOrder, MeterType } from '@/lib/supabase/types';

async function getProject(id: string) {
  const supabase = await createClient();

  const { data: project } = await supabase
    .from('projects')
    .select('*, meters(*)')
    .eq('id', id)
    .single();
  if (!project) return null;

  const [{ data: entries }, { data: events }, { data: changeOrders }] = await Promise.all([
    supabase.from('entries').select('*').eq('project_id', id).order('occurred_at', { ascending: false }),
    supabase.from('scope_events').select('*').eq('project_id', id),
    supabase.from('change_orders').select('*').eq('project_id', id).order('created_at', { ascending: false }),
  ]);

  // Sum used per meter type
  const usageMap: Record<MeterType, number> = { revisions: 0, hours: 0, deliverables: 0 };
  for (const e of entries ?? []) {
    usageMap[e.meter_type as MeterType] += Number(e.amount);
  }

  const metersWithUsage = (project.meters as Meter[]).map(m => ({
    ...m,
    used: usageMap[m.type] ?? 0,
  }));

  return {
    project,
    meters: metersWithUsage,
    entries: (entries ?? []) as Entry[],
    events: (events ?? []) as ScopeEvent[],
    changeOrders: (changeOrders ?? []) as ChangeOrder[],
  };
}

const LEVEL_COLOR = {
  healthy: 'bg-emerald-500',
  approaching: 'bg-amber-400',
  over: 'bg-red-500',
};

const LEVEL_BADGE = {
  healthy: 'badge-healthy',
  approaching: 'badge-approaching',
  over: 'badge-over',
};

const LEVEL_LABEL = { healthy: 'Healthy', approaching: 'Approaching limit', over: 'Over scope' };

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getProject(id);
  if (!data) notFound();

  const { project, meters, entries, events, changeOrders } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/app" className="text-xs text-gray-500 hover:text-gray-300 mb-1 block">← All projects</Link>
          <h1 className="text-xl font-bold">{project.name}</h1>
          {project.client_name && <p className="text-sm text-gray-400 mt-0.5">{project.client_name}</p>}
        </div>
        {project.client_email && (
          <a href={`mailto:${project.client_email}`} className="text-xs text-gray-500 hover:text-gray-300">
            {project.client_email}
          </a>
        )}
      </div>

      {/* Meters */}
      <div className="grid gap-4 sm:grid-cols-3">
        {meters.map(m => {
          const s = meterStatus(m, project.threshold);
          return (
            <div key={m.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium">{METER_LABELS[m.type]}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LEVEL_BADGE[s.level]}`}>
                  {LEVEL_LABEL[s.level]}
                </span>
              </div>
              <div className="text-3xl font-bold mb-1">
                {m.used}<span className="text-lg text-gray-500">/{m.budget}</span>
              </div>
              <div className="text-xs text-gray-500 mb-3">{METER_UNITS[m.type]}s used</div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${LEVEL_COLOR[s.level]}`}
                  style={{ width: `${Math.min(s.ratio * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1.5">
                <span>{Math.round(s.ratio * 100)}%</span>
                {s.over > 0 && (
                  <span className="text-red-400">
                    +{s.over} {METER_UNITS[m.type]} = {formatCents(s.over * m.overage_rate_cents)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick-log bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">Log consumption</h2>
        <LogEntryForm projectId={project.id} meters={meters} />
      </div>

      {/* Change orders */}
      <ChangeOrderSection
        projectId={project.id}
        meters={meters}
        changeOrders={changeOrders}
        projectThreshold={project.threshold}
      />

      {/* Timeline */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">Timeline</h2>
        {entries.length === 0 && events.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing logged yet.</p>
        ) : (
          <div className="space-y-2">
            {/* Merge entries + events, sort by date */}
            {[
              ...entries.map(e => ({ type: 'entry' as const, date: e.occurred_at, data: e })),
              ...events.map(ev => ({ type: 'event' as const, date: ev.created_at, data: ev })),
            ]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((item, i) => {
                if (item.type === 'entry') {
                  const e = item.data as Entry;
                  return (
                    <div key={e.id} className="flex gap-3 text-sm py-2 border-b border-gray-800 last:border-0">
                      <span className="text-gray-500 w-24 flex-none text-xs pt-0.5">
                        {new Date(e.occurred_at).toLocaleDateString()}
                      </span>
                      <span>
                        <span className="font-medium">+{e.amount} {METER_LABELS[e.meter_type]}</span>
                        {e.note && <span className="text-gray-400"> — {e.note}</span>}
                      </span>
                    </div>
                  );
                } else {
                  const ev = item.data as ScopeEvent;
                  return (
                    <div key={ev.id} className={`flex gap-3 text-sm py-2 border-b border-gray-800 last:border-0 ${ev.kind === 'over' ? 'text-red-400' : 'text-amber-400'}`}>
                      <span className="w-24 flex-none text-xs pt-0.5 opacity-60">
                        {new Date(ev.created_at).toLocaleDateString()}
                      </span>
                      <span>
                        {ev.kind === 'approaching' ? '⚠️' : '🔴'} Client emailed:{' '}
                        {ev.kind === 'approaching' ? 'approaching scope' : 'scope exceeded'}{' '}
                        ({METER_LABELS[ev.meter_type as MeterType]})
                        {ev.emailed_at && <span className="opacity-60"> · sent {new Date(ev.emailed_at).toLocaleTimeString()}</span>}
                      </span>
                    </div>
                  );
                }
              })}
          </div>
        )}
      </div>
    </div>
  );
}
