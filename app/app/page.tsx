import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { meterStatus, projectLevel, formatCents, METER_LABELS } from '@/lib/domain';
import type { Project, Meter, MeterType } from '@/lib/supabase/types';

interface ProjectWithData extends Project {
  meters: (Meter & { used: number })[];
}

async function getProjects(): Promise<ProjectWithData[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .single();
  if (!membership) return [];

  const { data: projects } = await supabase
    .from('projects')
    .select('*, meters(*)')
    .eq('workspace_id', membership.workspace_id)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (!projects) return [];

  // Sum entries per project per meter type
  const projectIds = projects.map(p => p.id);
  const { data: entrySums } = await supabase
    .from('entries')
    .select('project_id, meter_type, amount')
    .in('project_id', projectIds);

  const usageMap: Record<string, Record<MeterType, number>> = {};
  for (const e of entrySums ?? []) {
    if (!usageMap[e.project_id]) usageMap[e.project_id] = { revisions: 0, hours: 0, deliverables: 0 };
    usageMap[e.project_id][e.meter_type as MeterType] += Number(e.amount);
  }

  return projects.map(p => ({
    ...p,
    meters: (p.meters as Meter[]).map(m => ({
      ...m,
      used: usageMap[p.id]?.[m.type] ?? 0,
    })),
  }));
}

const LEVEL_BADGE: Record<string, string> = {
  healthy: 'badge-healthy',
  approaching: 'badge-approaching',
  over: 'badge-over',
};

const LEVEL_LABEL: Record<string, string> = {
  healthy: 'Healthy',
  approaching: 'Approaching',
  over: 'Over scope',
};

export default async function DashboardPage() {
  const projects = await getProjects();

  const approaching = projects.filter(p => projectLevel(p.meters.map(m => meterStatus(m))) === 'approaching').length;
  const over = projects.filter(p => projectLevel(p.meters.map(m => meterStatus(m))) === 'over').length;

  // Estimated recoverable $ from over-projects
  const recoverableCents = projects
    .filter(p => projectLevel(p.meters.map(m => meterStatus(m))) === 'over')
    .flatMap(p => p.meters.map(m => {
      const s = meterStatus(m);
      return s.over * m.overage_rate_cents;
    }))
    .reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Projects</h1>
        <Link
          href="/app/projects/new"
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + New project
        </Link>
      </div>

      {/* Summary strip */}
      {projects.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Active', value: projects.length, className: 'text-white' },
            { label: 'Approaching', value: approaching, className: 'text-amber-400' },
            { label: 'Over scope', value: over, className: 'text-red-400' },
            { label: 'Est. recoverable', value: formatCents(recoverableCents), className: 'text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className={`text-xl font-bold ${s.className}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Project cards */}
      {projects.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg mb-3">No projects yet</p>
          <Link href="/app/projects/new" className="text-blue-400 hover:text-blue-300 text-sm">
            Create your first project →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map(p => {
            const meterStatuses = p.meters.map(m => meterStatus(m, p.threshold));
            const level = projectLevel(meterStatuses);
            return (
              <Link
                key={p.id}
                href={`/app/projects/${p.id}`}
                className="block bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-5 transition-colors group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold group-hover:text-blue-300 transition-colors">{p.name}</div>
                    {p.client_name && <div className="text-sm text-gray-500 mt-0.5">{p.client_name}</div>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LEVEL_BADGE[level]}`}>
                    {LEVEL_LABEL[level]}
                  </span>
                </div>

                {/* Mini meter bars */}
                <div className="space-y-2">
                  {p.meters.map((m, i) => {
                    const s = meterStatuses[i];
                    const barColor = s.level === 'over' ? 'bg-red-500' : s.level === 'approaching' ? 'bg-amber-400' : 'bg-emerald-500';
                    return (
                      <div key={m.id}>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{METER_LABELS[m.type]}</span>
                          <span>{m.used}/{m.budget}</span>
                        </div>
                        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${barColor}`}
                            style={{ width: `${Math.min(s.ratio * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {level === 'over' && (
                  <div className="mt-3 pt-3 border-t border-gray-800 text-xs text-red-400 font-medium">
                    Generate change order →
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
